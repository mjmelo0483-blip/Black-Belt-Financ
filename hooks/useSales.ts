
import { useState, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';
import { useView } from '../contexts/ViewContext';
import { Sale, Product, Customer } from '../types';

export const useSales = () => {
    const { isBusiness } = useView();
    const [loading, setLoading] = useState(false);

    const fetchSales = useCallback(async (filters?: any) => {
        if (!isBusiness) return { data: [], error: null };
        setLoading(true);
        try {
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    customers (name, cpf),
                    sale_items (
                        *,
                        products (name, code, cost, category)
                    )
                `)
                .order('date', { ascending: false });

            if (filters?.startDate) query = query.gte('date', filters.startDate);
            if (filters?.endDate) query = query.lte('date', filters.endDate);

            const { data, error } = await withRetry(async () => await query);
            return { data, error };
        } catch (err: any) {
            return { error: err };
        } finally {
            setLoading(false);
        }
    }, [isBusiness]);

    const importSalesFromExcel = useCallback(async (rows: any[]) => {
        if (!isBusiness) return { error: { message: 'Importação permitida apenas no modo Business' } };
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Process Customers and Products in bulk to avoid duplicates
            const customersToUpsert: any[] = [];
            const productsToUpsert: any[] = [];
            const uniqueCustomerKeys = new Set();
            const uniqueProductCodes = new Set();

            rows.forEach(row => {
                const customerName = row['Cliente'];
                const customerCpf = row['CPF do Cliente'];
                const productCode = String(row['Código do Produto']);
                const productName = row['Nome do Produto'] || row['Produto'] || row['Descrição'] || row['Descricao'];
                const category = row['Categoria'] || row['Grupo'] || row['Família'] || row['Familia'] || row['Categoria do Produto'] || 'Geral';

                if (customerName && customerName !== '-' && !uniqueCustomerKeys.has(customerCpf || customerName)) {
                    customersToUpsert.push({
                        user_id: user.id,
                        name: customerName,
                        cpf: customerCpf || null
                    });
                    uniqueCustomerKeys.add(customerCpf || customerName);
                }

                if (productCode && productCode !== 'undefined' && !uniqueProductCodes.has(productCode)) {
                    productsToUpsert.push({
                        user_id: user.id,
                        code: productCode,
                        name: productName || 'Produto sem nome',
                        category: category
                    });
                    uniqueProductCodes.add(productCode);
                }
            });

            // Bulk Upsert Customers
            const customersMap = new Map();
            if (customersToUpsert.length > 0) {
                const { data: custData, error: custError } = await supabase
                    .from('customers')
                    .upsert(customersToUpsert, { onConflict: 'user_id, cpf' })
                    .select();

                if (custError) throw custError;
                custData?.forEach(c => customersMap.set(c.cpf || c.name, c.id));
            }

            // Bulk Upsert Products
            const productsMap = new Map();
            if (productsToUpsert.length > 0) {
                const { data: prodData, error: prodError } = await supabase
                    .from('products')
                    .upsert(productsToUpsert, { onConflict: 'user_id, code' })
                    .select();

                if (prodError) throw prodError;
                prodData?.forEach(p => productsMap.set(p.code, p.id));
            }

            // 2. Process Sales
            const salesGroups = new Map();
            rows.forEach(row => {
                const code = String(row['Código']);
                if (!code || code === 'undefined') return;

                if (!salesGroups.has(code)) {
                    salesGroups.set(code, {
                        user_id: user.id,
                        external_code: code,
                        customer_id: customersMap.get(row['CPF do Cliente'] || row['Cliente']) || null,
                        date: formatDate(row['Data da Compra']),
                        time: row['Hora da Compra'],
                        payment_method: row['Forma de Pagamento'],
                        store_name: row['Loja'],
                        device: row['Dispositivo'],
                        total_amount: 0,
                        items: []
                    });
                }

                const qty = Number(row['Quantidade'] || row['Qtde'] || row['Qtd'] || 1);
                const unitPrice = Number(row['Valor Unitário'] || row['Vlr Unitário'] || row['Vlr. Unitário'] || row['Preço'] || 0);
                const totalPrice = Number(row['Valor Total'] || row['Vlr. Total'] || row['Vlr Total'] || row['Total'] || (qty * unitPrice));

                // Log values for debugging if they are 0
                if (totalPrice === 0 && (row['Valor Total'] || row['Total'])) {
                    console.log('Zero price detected for row:', row);
                }

                const sale = salesGroups.get(code);
                sale.items.push({
                    product_id: productsMap.get(String(row['Código do Produto'])),
                    quantity: qty,
                    unit_price: unitPrice,
                    total_price: totalPrice
                });
                sale.total_amount += totalPrice;
            });

            // Insert Sales and Items
            for (const sale of salesGroups.values()) {
                const { items, ...saleData } = sale;
                const { data: insertedSale, error: saleError } = await supabase
                    .from('sales')
                    .upsert(saleData, { onConflict: 'user_id, external_code' })
                    .select()
                    .single();

                if (saleError) {
                    console.error('Error inserting sale:', saleError);
                    continue;
                }

                if (insertedSale) {
                    const itemsToInsert = items.map((item: any) => ({
                        ...item,
                        sale_id: insertedSale.id
                    }));

                    // Delete existing items for this sale before re-inserting (to avoid duplicates on re-import)
                    await supabase.from('sale_items').delete().eq('sale_id', insertedSale.id);
                    await supabase.from('sale_items').insert(itemsToInsert);
                }
            }

            return { success: true };
        } catch (err: any) {
            console.error('Import error:', err);
            return { error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, [isBusiness]);

    const clearSales = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

            await supabase.from('sales').delete().eq('user_id', user.id);
            return { success: true };
        } catch (err: any) {
            return { error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, []);

    return { loading, fetchSales, importSalesFromExcel, clearSales };
};

// Helper to convert DD/MM/YYYY to YYYY-MM-DD
function formatDate(dateValue: any) {
    if (!dateValue) return null;

    // If it's already a JS Date (from XLSX)
    if (dateValue instanceof Date) {
        // XLSX dates are usually midnight UTC. 
        // Using getUTC... ensures we get the intended date regardless of local timezone.
        const y = dateValue.getUTCFullYear();
        const m = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateValue.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Handle Excel serial date numbers
    if (typeof dateValue === 'number') {
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        // Excel numbers are usually UTC-based representations of local dates
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const str = String(dateValue).trim();
    if (!str || str === '-') return null;

    // Handle DD/MM/YYYY
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            const fullYear = year.length === 2 ? `20${year}` : year;
            return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }

    // Handle YYYY-MM-DD
    if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) return str; // Already YYYY-MM-DD
            // Handle DD-MM-YYYY
            const [day, month, year] = parts;
            const fullYear = year.length === 2 ? `20${year}` : year;
            return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }

    return str;
}
