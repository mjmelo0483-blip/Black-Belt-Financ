
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
                .order('date', { ascending: false })
                .limit(10000);

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

    const importSalesFromExcel = useCallback(async (rows: any[], fileName: string) => {
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

                const customerName = getVal(row, ['Cliente', 'Nome do Cliente', 'Nome Cliente', 'Destinatario']);
                const customerCpf = getVal(row, ['CPF do Cliente', 'CPF', 'CNPJ/CPF', 'CPF/CNPJ']);
                const productCode = String(getVal(row, ['Codigo do Produto', 'SKU', 'Ref', 'Referencia', 'Codigo Produto', 'ID Produto']) || '');
                const productName = getVal(row, ['Nome do Produto', 'Produto', 'Descricao', 'Description', 'Item']);
                const category = getVal(row, ['Categoria', 'Grupo', 'Familia', 'Categoria do Produto', 'Departamento']) || 'Geral';

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

                // Detect format: 1.234,56 (BR) vs 1,234.56 (US)
                const hasComma = str.includes(',');
                const hasDot = str.includes('.');

                if (hasComma && hasDot) {
                    if (str.indexOf(',') > str.indexOf('.')) {
                        // BR Format: 1.234,56
                        str = str.replace(/\./g, '').replace(',', '.');
                    } else {
                        // US Format: 1,234.56
                        str = str.replace(/,/g, '');
                    }
                } else if (hasComma) {
                    // Only comma: 1234,56 -> 1234.56
                    str = str.replace(',', '.');
                } else if (hasDot) {
                    // Only dot: could be 1.234 (thousands) or 1234.56 (decimal)
                    // If it's something like .XX or .XXX we need to be careful
                    const parts = str.split('.');
                    if (parts[parts.length - 1].length === 3 && parts.length > 1) {
                        // Likely thousands separator: 1.234
                        str = str.replace(/\./g, '');
                    } else {
                        // Likely decimal separator: 1234.56
                        // Do nothing, parseFloat will handle it
                    }
                }

                return Math.abs(parseFloat(str) || 0);
            };

            rows.forEach(row => {
                // Try to find a unique Sale ID (Order Number, Ticket, etc)
                const rawCode = String(getVal(row, ['Nº Pedido', 'Pedido', 'Documento', 'Cupom', 'Ticket', 'Venda', 'ID Venda', 'Codigo Venda']) ||
                    getVal(row, ['Codigo', 'ID']) || '');

                if (!rawCode || rawCode === 'undefined' || rawCode === '') return;

                const date = formatDate(getVal(row, ['Data da Compra', 'Data', 'Data Venda', 'Data Emissão']));
                const store = getVal(row, ['Loja', 'Unidade', 'Filial', 'Ponto de Venda']) || 'Unica';

                // Create a unique key for grouping and for the DB external_code
                // This prevents "Order 100" from Store A from overwriting "Order 100" from Store B
                // or the same order number on different dates.
                const groupKey = `${rawCode}_${store}_${date}`;

                if (!salesGroups.has(groupKey)) {
                    salesGroups.set(groupKey, {
                        user_id: user.id,
                        external_code: groupKey, // Use the concatenated key as the unique identifier
                        customer_id: customersMap.get(getVal(row, ['CPF do Cliente', 'CPF', 'CNPJ/CPF', 'CPF/CNPJ'])) ||
                            customersMap.get(getVal(row, ['Cliente', 'Nome do Cliente', 'Nome Cliente'])) || null,
                        date: date,
                        time: getVal(row, ['Hora da Compra', 'Hora', 'Horário']),
                        payment_method: getVal(row, ['Forma de Pagamento', 'Pagamento', 'Metodo', 'Meio de Pagamento']),
                        store_name: store,
                        device: getVal(row, ['Dispositivo', 'Origem', 'Canal']),
                        import_filename: fileName,
                        total_amount: 0,
                        raw_order_total: parseNumber(getVal(row, ['Total Venda', 'Total Pedido', 'Valor da Venda', 'Valor Total Pedido', 'Vlr. Total Venda'])),
                        items: []
                    });
                }

                const qty = parseNumber(getVal(row, ['Quantidade', 'Qtde', 'Qtd', 'Quant.']) || 1);
                const unitPrice = parseNumber(getVal(row, ['Valor Unitario', 'Vlr Unitario', 'Preco', 'Preço Unitário', 'Vlr. Unit.', 'Valor Unit.', 'Preco Venda']));

                // Determine line total
                const lineTotalRaw = getVal(row, ['Valor Total', 'Vlr Total', 'Total Item', 'Subtotal', 'Total Líquido', 'Total Liquido', 'Vlr. Total Item', 'Vlr Total Item']);
                const parsedLineTotal = parseNumber(lineTotalRaw);

                let lineTotalPrice = 0;
                if (lineTotalRaw && parsedLineTotal > 0) {
                    lineTotalPrice = parsedLineTotal;
                } else if (unitPrice > 0) {
                    lineTotalPrice = qty * unitPrice;
                }

                const sale = salesGroups.get(groupKey);
                const productCode = String(getVal(row, ['Codigo do Produto', 'SKU', 'Ref', 'Referencia', 'Codigo Produto', 'ID Produto']) || '');

                sale.items.push({
                    product_id: productsMap.get(productCode),
                    quantity: qty,
                    unit_price: unitPrice || (qty > 0 ? lineTotalPrice / qty : 0),
                    total_price: lineTotalPrice
                });

                // Add to total amount using the detected line price
                sale.total_amount += lineTotalPrice;
            });

            // Final adjustment: if total_amount is 0 but we have a raw_order_total, use that
            for (const sale of salesGroups.values()) {
                if (sale.total_amount === 0 && sale.raw_order_total > 0) {
                    sale.total_amount = sale.raw_order_total;
                    // If we have items but no prices, distribute the total or set 0 to first
                    if (sale.items.length === 1 && sale.items[0].total_price === 0) {
                        sale.items[0].total_price = sale.raw_order_total;
                        sale.items[0].unit_price = sale.raw_order_total / (sale.items[0].quantity || 1);
                    }
                }
                delete sale.raw_order_total; // Clean up before sending to DB
            }

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

    const deleteSalesByFilename = useCallback(async (fileName: string | null) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

            let query = supabase.from('sales').delete().eq('user_id', user.id);
            if (fileName === null) {
                query = query.is('import_filename', null);
            } else {
                query = query.eq('import_filename', fileName);
            }

            const { error } = await query;
            if (error) throw error;
            return { success: true };
        } catch (err: any) {
            return { error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchImports = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return { data: [] };

            const { data, error } = await supabase
                .from('sales')
                .select('import_filename, created_at, date')
                .eq('user_id', session.user.id);

            if (error) throw error;

            // Group by filename and date
            const groups = new Map();
            data?.forEach(s => {
                const key = s.import_filename || 'Importação Antiga/Sem Nome';
                if (!groups.has(key)) {
                    groups.set(key, {
                        name: key,
                        count: 0,
                        firstDate: s.date,
                        lastDate: s.date,
                        importedAt: s.created_at,
                        isLegacy: !s.import_filename
                    });
                }
                const g = groups.get(key);
                g.count++;
                if (s.date < g.firstDate) g.firstDate = s.date;
                if (s.date > g.lastDate) g.lastDate = s.date;
                // Keep the latest importedAt for the same filename (redundant but safe)
                if (s.created_at > g.importedAt) g.importedAt = s.created_at;
            });

            return { data: Array.from(groups.values()).sort((a, b) => b.importedAt.localeCompare(a.importedAt)) };
        } catch (err: any) {
            return { error: err };
        }
    }, []);

    return { loading, fetchSales, importSalesFromExcel, clearSales, deleteSalesByFilename, fetchImports };
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
