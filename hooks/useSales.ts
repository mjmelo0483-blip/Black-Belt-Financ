
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
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return { data: [], error: null };

                let query = supabase
                    .from('sales')
                    .select(`
                    id, date, store_name, payment_method, total_amount,
                    sale_items (
                        total_price, quantity,
                        products (name, code, category, cost)
                    )
                `)
                    .eq('user_id', session.user.id)
                    .order('date', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (filters?.startDate) query = query.gte('date', filters.startDate);
                if (filters?.endDate) query = query.lte('date', filters.endDate);
                if (filters?.month !== undefined && filters?.year !== undefined) {
                    const startDate = `${filters.year}-${String(filters.month + 1).padStart(2, '0')}-01`;
                    const lastDay = new Date(filters.year, filters.month + 1, 0).getDate();
                    const endDate = `${filters.year}-${String(filters.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                    query = query.gte('date', startDate).lte('date', endDate);
                }

                const { data, error } = await withRetry(async () => await query);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                }

                // Safety break to avoid infinite loops if something goes wrong
                if (page > 50) break;
            }

            return { data: allData, error: null };
        } catch (err: any) {
            console.error('Fetch sales error:', err);
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

            // --- Robust Parsing Helpers ---
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

                const hasComma = str.includes(',');
                const hasDot = str.includes('.');

                if (hasComma && hasDot) {
                    if (str.indexOf(',') > str.indexOf('.')) {
                        str = str.replace(/\./g, '').replace(',', '.');
                    } else {
                        str = str.replace(/,/g, '');
                    }
                } else if (hasComma) {
                    str = str.replace(',', '.');
                } else if (hasDot) {
                    const parts = str.split('.');
                    if (parts[parts.length - 1].length === 3 && parts.length > 1) {
                        str = str.replace(/\./g, '');
                    }
                }
                return Math.abs(parseFloat(str) || 0);
            };
            // ------------------------------

            // 1. Process Customers and Products in bulk to avoid duplicates
            const customersToUpsert: any[] = [];
            const productsToUpsert: any[] = [];
            const uniqueCustomerKeys = new Set();
            const uniqueProductCodes = new Set();

            rows.forEach(row => {
                const customerName = getVal(row, ['Cliente', 'Nome do Cliente', 'Nome Cliente', 'Destinatario']);
                const customerCpf = getVal(row, ['CPF do Cliente', 'CPF', 'CNPJ/CPF', 'CPF/CNPJ']);
                const productCode = String(getVal(row, ['Codigo do Produto', 'SKU', 'Ref', 'Referencia', 'Codigo Produto', 'ID Produto']) || '');
                const productName = getVal(row, ['Nome do Produto', 'Produto', 'Descricao', 'Description', 'Item']);
                const category = getVal(row, ['Categoria', 'Grupo', 'Familia', 'Categoria do Produto', 'Departamento']) || 'Geral';
                const cost = parseNumber(getVal(row, ['Custo', 'Vlr. Custo', 'Preço de Custo', 'Custo Unitário', 'Markup Cost', 'Cost', 'P', 'Vlr Custo']));

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
                        category: category ? String(category).trim() : 'Geral',
                        cost: cost || 0
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
            let lastDate: string | null = null;
            let lastCode: string | null = null;
            let lastStore: string | null = null;

            rows.forEach((row, index) => {
                // Try to find a unique Sale ID (Order Number, Ticket, etc)
                const rawCode = String(getVal(row, ['Nº Pedido', 'Pedido', 'Documento', 'Cupom', 'Ticket', 'Venda', 'ID Venda', 'Codigo Venda', 'Nº Transação', 'Venda ID', 'Nº']) ||
                    getVal(row, ['Codigo', 'ID']) || '');

                const rawDate = getVal(row, ['Data da Compra', 'Data', 'Data Venda', 'Data Emissão', 'Data Movimento', 'Emissão']);
                const date = formatDate(rawDate) || lastDate;

                if (!date) return; // Skip rows without date (and no previous date to carry over)
                lastDate = date;

                const store = getVal(row, ['Loja', 'Unidade', 'Filial', 'Ponto de Venda', 'Estabelecimento', 'Nome da Loja']) || lastStore || 'Unica';
                lastStore = store;

                // Carry over or generate code
                const finalCode = (rawCode && rawCode !== 'undefined' && rawCode !== '')
                    ? rawCode
                    : (lastCode || `ROW_${index}_${date}`);
                lastCode = (rawCode && rawCode !== 'undefined' && rawCode !== '') ? rawCode : lastCode;

                const groupKey = `${finalCode}_${store}_${date}`;

                if (!salesGroups.has(groupKey)) {
                    salesGroups.set(groupKey, {
                        user_id: user.id,
                        external_code: groupKey,
                        customer_id: customersMap.get(getVal(row, ['CPF do Cliente', 'CPF', 'CNPJ/CPF', 'CPF/CNPJ'])) ||
                            customersMap.get(getVal(row, ['Cliente', 'Nome do Cliente', 'Nome Cliente'])) || null,
                        date: date,
                        time: getVal(row, ['Hora da Compra', 'Hora', 'Horário']),
                        payment_method: getVal(row, ['Forma de Pagamento', 'Pagamento', 'Metodo', 'Meio de Pagamento', 'E', 'Tipo de Pagamento', 'Pagto']),
                        store_name: store,
                        device: getVal(row, ['Dispositivo', 'Origem', 'Canal']),
                        import_filename: fileName,
                        total_amount: 0,
                        // Store the spreadsheet's stated total for this order to use as fallback
                        spreadsheet_order_total: parseNumber(getVal(row, ['Total Venda', 'Total Pedido', 'Valor da Venda', 'Valor Total Pedido', 'Vlr. Total Venda', 'Total', 'Valor Total'])),
                        items: []
                    });
                }

                const qty = parseNumber(getVal(row, ['Quantidade', 'Qtde', 'Qtd', 'Quant.', 'Quantidade Vendida', 'Qtd.', 'Quant', 'Volume']));
                const unitPrice = parseNumber(getVal(row, ['Valor Unitario', 'Vlr Unitario', 'Preco', 'Preço Unitário', 'Vlr. Unit.', 'Valor Unit.', 'Preco Venda', 'Preço Vda', 'Preço Liq.', 'Preço Líquido', 'Valor Liq.', 'Vlr. Liq.', 'Preço Venda Unitário']));

                // Determine line total - PRIORITIZE calculation as requested by user
                const lineTotalRaw = getVal(row, ['Valor Total Item', 'Vlr. Total Item', 'Total Item', 'Subtotal', 'Total Líquido', 'Total Liquido', 'Vlr Total Item', 'Valor Total', 'Vlr. Total']);
                const parsedLineTotal = parseNumber(lineTotalRaw);

                let lineTotalPrice = 0;
                if (parsedLineTotal > 0) {
                    // PRIORITIZE explicit total column as requested by the user
                    lineTotalPrice = parsedLineTotal;
                } else if (unitPrice > 0 && qty > 0) {
                    lineTotalPrice = qty * unitPrice;
                } else if (unitPrice > 0) {
                    lineTotalPrice = unitPrice;
                }

                const sale = salesGroups.get(groupKey);
                const productCode = String(getVal(row, ['Codigo do Produto', 'SKU', 'Ref', 'Referencia', 'Codigo Produto', 'ID Produto']) || '');

                sale.items.push({
                    product_id: productsMap.get(productCode),
                    quantity: qty,
                    unit_price: unitPrice || (qty > 0 ? lineTotalPrice / qty : 0),
                    total_price: lineTotalPrice
                });

                // Increment calculated total
                sale.total_amount += lineTotalPrice;
            });

            const allSalesData = Array.from(salesGroups.values()).map(s => {
                const { items, spreadsheet_order_total, ...saleData } = s;

                // CRITICAL FIX: If our calculated total_amount is 0 (or much smaller than the spreadsheet's order total),
                // and we only have ONE row for this order, the spreadsheet's "Total" column was likely the item total.
                let finalTotal = s.total_amount;
                if (finalTotal === 0 && spreadsheet_order_total > 0) {
                    finalTotal = spreadsheet_order_total;
                }

                return { ...saleData, total_amount: finalTotal, items };
            });

            // Bulk Upsert Sales in larger chunks to improve speed
            const chunkSize = 500;
            for (let i = 0; i < allSalesData.length; i += chunkSize) {
                const chunk = allSalesData.slice(i, i + chunkSize);
                const salesToUpsert = chunk.map(({ items, ...sale }) => sale);

                const { data: upsertedSales, error: upsertError } = await supabase
                    .from('sales')
                    .upsert(salesToUpsert, { onConflict: 'user_id, external_code' })
                    .select('id, external_code');

                if (upsertError) throw upsertError;

                // Prepare items for this chunk
                const itemsToInsert: any[] = [];
                const saleIdsToDelete: string[] = [];

                upsertedSales?.forEach(insertedSale => {
                    const originalSale = chunk.find(s => s.external_code === insertedSale.external_code);
                    if (originalSale && originalSale.items.length > 0) {
                        saleIdsToDelete.push(insertedSale.id);
                        originalSale.items.forEach((item: any) => {
                            itemsToInsert.push({
                                ...item,
                                sale_id: insertedSale.id
                            });
                        });
                    }
                });

                // Clear and Re-insert items in bulk for this chunk
                if (saleIdsToDelete.length > 0) {
                    await supabase.from('sale_items').delete().in('sale_id', saleIdsToDelete);
                }
                if (itemsToInsert.length > 0) {
                    const { error: itemError } = await supabase.from('sale_items').insert(itemsToInsert);
                    if (itemError) console.error('Error inserting items:', itemError);
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

            // 1. Fetch IDs of sales to delete (standard limit applies, so we might need a loop or just delete until 0)
            // But let's try a more robust way: fetch all IDs first
            let allIds: string[] = [];
            let hasMore = true;
            let page = 0;

            while (hasMore) {
                let query = supabase
                    .from('sales')
                    .select('id')
                    .eq('user_id', user.id);

                if (fileName === null) {
                    query = query.is('import_filename', null);
                } else {
                    query = query.eq('import_filename', fileName);
                }

                const { data, error } = await query.range(page * 1000, (page + 1) * 1000 - 1);
                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allIds = [...allIds, ...data.map(s => s.id)];
                    if (data.length < 1000) hasMore = false;
                    else page++;
                }
                if (page > 50) break; // Safety
            }

            // 2. Delete in chunks to avoid timeout
            const chunkSize = 200; // Small chunks for safe deletion (cascading items can be many)
            for (let i = 0; i < allIds.length; i += chunkSize) {
                const chunk = allIds.slice(i, i + chunkSize);
                const { error: deleteError } = await supabase
                    .from('sales')
                    .delete()
                    .in('id', chunk);

                if (deleteError) throw deleteError;
            }

            return { success: true };
        } catch (err: any) {
            console.error('Delete error:', err);
            return { error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchImports = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return { data: [] };

            // Fetch all records in pages to group them correctly (PostgREST limit is 1000)
            let allData: any[] = [];
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('sales')
                    .select('import_filename, created_at, date')
                    .eq('user_id', session.user.id)
                    .range(page * 1000, (page + 1) * 1000 - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData = [...allData, ...data];
                    if (data.length < 1000) hasMore = false;
                    else page++;
                }
                if (page > 20) break; // Limit to 20k records for summary
            }

            // Group by filename and date
            const groups = new Map();
            allData.forEach(s => {
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
                if (s.date && (!g.firstDate || s.date < g.firstDate)) g.firstDate = s.date;
                if (s.date && (!g.lastDate || s.date > g.lastDate)) g.lastDate = s.date;
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
