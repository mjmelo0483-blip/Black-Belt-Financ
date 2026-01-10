
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
                const getVal = (r: any, possibleKeys: string[]) => {
                    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                    const keys = Object.keys(r);
                    const foundKey = keys.find(k => {
                        const normalizedK = normalize(k);
                        return possibleKeys.some(pk => normalize(pk) === normalizedK);
                    });
                    return foundKey ? r[foundKey] : undefined;
                };

                const customerName = getVal(row, ['Cliente', 'Nome do Cliente']);
                const customerCpf = getVal(row, ['CPF do Cliente', 'CPF']);
                const productCode = String(getVal(row, ['Codigo do Produto', 'SKU', 'Ref']));
                const productName = getVal(row, ['Nome do Produto', 'Produto', 'Descricao', 'Description']);
                const category = getVal(row, ['Categoria', 'Grupo', 'Familia', 'Categoria do Produto']) || 'Geral';

                if (customerName && customerName !== '-' && !uniqueCustomerKeys.has(customerCpf || customerName)) {
                    customersToUpsert.push({
                        user_id: user.id,
                        name: String(customerName).trim(),
                        cpf: customerCpf ? String(customerCpf).trim() : null
                    });
                    uniqueCustomerKeys.add(customerCpf || customerName);
                }

                if (productCode && productCode !== 'undefined' && productCode !== '' && !uniqueProductCodes.has(productCode)) {
                    productsToUpsert.push({
                        user_id: user.id,
                        code: productCode,
                        name: productName ? String(productName).trim() : 'Produto sem nome',
                        category: category ? String(category).trim() : 'Geral'
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
            const getVal = (row: any, possibleKeys: string[]) => {
                const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                const keys = Object.keys(row);
                const foundKey = keys.find(k => {
                    const normalizedK = normalize(k);
                    return possibleKeys.some(pk => normalize(pk) === normalizedK);
                });
                return foundKey ? row[foundKey] : undefined;
            };

            const parseNumber = (val: any) => {
                if (typeof val === 'number') return Math.abs(val);
                if (!val) return 0;
                let str = String(val).replace('R$', '').replace(/\s/g, '');
                str = str.replace(/\./g, '').replace(',', '.').trim();
                return Math.abs(parseFloat(str) || 0);
            };

            rows.forEach(row => {
                const code = String(getVal(row, ['Codigo', 'Nº Pedido', 'Venda', 'ID']) || '');
                if (!code || code === 'undefined' || code === '') return;

                if (!salesGroups.has(code)) {
                    salesGroups.set(code, {
                        user_id: user.id,
                        external_code: code,
                        customer_id: customersMap.get(getVal(row, ['CPF do Cliente', 'CPF'])) || customersMap.get(getVal(row, ['Cliente', 'Nome do Cliente'])) || null,
                        date: formatDate(getVal(row, ['Data da Compra', 'Data', 'Data Venda'])),
                        time: getVal(row, ['Hora da Compra', 'Hora']),
                        payment_method: getVal(row, ['Forma de Pagamento', 'Pagamento', 'Metodo']),
                        store_name: getVal(row, ['Loja', 'Unidade']),
                        device: getVal(row, ['Dispositivo', 'Origem']),
                        total_amount: 0,
                        items: []
                    });
                }

                const qty = parseNumber(getVal(row, ['Quantidade', 'Qtde', 'Qtd']) || 1);
                const unitPrice = parseNumber(getVal(row, ['Valor Unitario', 'Vlr Unitario', 'Preco']));
                const totalPrice = parseNumber(getVal(row, ['Valor Total', 'Vlr Total', 'Total']) || (qty * unitPrice));

                // Log values for debugging if they are 0
                if (totalPrice === 0) {
                    console.log('Zero price detected for row:', row);
                }

                const sale = salesGroups.get(code);
                sale.items.push({
                    product_id: productsMap.get(String(getVal(row, ['Codigo do Produto', 'SKU', 'Ref']))),
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
