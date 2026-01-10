
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
                        products (name, code)
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
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Process Customers and Products in bulk to avoid duplicates
            const customersMap = new Map();
            const productsMap = new Map();

            // Extract unique customers and products from rows
            rows.forEach(row => {
                if (row['Cliente'] && row['Cliente'] !== '-') {
                    customersMap.set(row['CPF do Cliente'] || row['Cliente'], {
                        name: row['Cliente'],
                        cpf: row['CPF do Cliente']
                    });
                }
                if (row['Código do Produto']) {
                    productsMap.set(row['Código do Produto'], {
                        code: row['Código do Produto'],
                        name: row['Nome do Produto']
                    });
                }
            });

            // Upsert Customers
            for (const [key, cust] of customersMap.entries()) {
                const { data } = await supabase
                    .from('customers')
                    .upsert({
                        user_id: user.id,
                        name: cust.name,
                        cpf: cust.cpf
                    }, { onConflict: 'user_id, cpf' })
                    .select()
                    .single();
                if (data) customersMap.set(key, data.id);
            }

            // Upsert Products
            for (const [code, prod] of productsMap.entries()) {
                const { data } = await supabase
                    .from('products')
                    .upsert({
                        user_id: user.id,
                        code: prod.code,
                        name: prod.name
                    }, { onConflict: 'user_id, code' })
                    .select()
                    .single();
                if (data) productsMap.set(code, data.id);
            }

            // 2. Process Sales
            // Group rows by Sale Code
            const salesGroups = new Map();
            rows.forEach(row => {
                const code = row['Código'];
                if (!salesGroups.has(code)) {
                    salesGroups.set(code, {
                        external_code: String(code),
                        customer_id: customersMap.get(row['CPF do Cliente'] || row['Cliente']) || null,
                        date: formatDate(row['Data da Compra']),
                        time: row['Hora da Compra'],
                        payment_method: row['Forma de Pagamento'],
                        store_name: row['Loja'],
                        device: row['Dispositivo'],
                        items: []
                    });
                }
                salesGroups.get(code).items.push({
                    product_id: productsMap.get(row['Código do Produto']),
                    quantity: 1, // Assume 1 if not provided
                    unit_price: 0, // Need to find where price is
                    total_price: 0
                });
            });

            // Insert Sales and Items
            for (const sale of salesGroups.values()) {
                const { data: saleData, error: saleError } = await supabase
                    .from('sales')
                    .upsert({
                        user_id: user.id,
                        external_code: sale.external_code,
                        customer_id: sale.customer_id,
                        date: sale.date,
                        time: sale.time,
                        payment_method: sale.payment_method,
                        store_name: sale.store_name,
                        device: sale.device,
                        total_amount: 0 // Will update after items
                    }, { onConflict: 'user_id, external_code' })
                    .select()
                    .single();

                if (saleData) {
                    // Update items with sale_id
                    const itemsToInsert = sale.items.map((item: any) => ({
                        ...item,
                        sale_id: saleData.id
                    }));
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

    return { loading, fetchSales, importSalesFromExcel };
};

// Helper to convert DD/MM/YYYY to YYYY-MM-DD
function formatDate(dateStr: string) {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}
