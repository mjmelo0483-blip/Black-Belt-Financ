import { useState, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';
import { useView } from '../contexts/ViewContext';
import { useCompany } from '../contexts/CompanyContext';
import { Sale, Product, Customer } from '../types';

export const useSales = () => {
    const { isBusiness } = useView();
    const { activeCompany } = useCompany();
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
                        total_price, unit_price, quantity, unit_cost,
                        products (name, code, category, cost)
                    )
                `);

                if (activeCompany) {
                    query = query.eq('company_id', activeCompany.id);
                } else {
                    query = query.eq('user_id', session.user.id).is('company_id', null);
                }

                query = query
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
    }, [isBusiness, activeCompany]);

    const importSalesFromExcel = useCallback(async (rows: any[], fileName: string) => {
        if (!isBusiness) return { error: { message: 'Importação permitida apenas no modo Business' } };
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

            // --- Robust Parsing Helpers ---
            const getVal = (row: any, possibleKeys: string[]) => {
                const keys = Object.keys(row);
                const foundKey = keys.find(k => {
                    const normalizedK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                    return possibleKeys.some(pk => {
                        const normalizedPK = pk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                        return normalizedK === normalizedPK;
                    });
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
                    // Check if dot is thousands separator or decimal
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

            const customerValueKeys = ['Cliente', 'Nome do Cliente', 'Nome Cliente', 'Destinatario', 'Nome', 'Customer'];
            const customerCpfKeys = ['CPF do Cliente', 'CPF', 'CNPJ/CPF', 'CPF/CNPJ', 'Documento', 'Doc'];
            const productCodeKeys = ['Codigo do Produto', 'SKU', 'Ref', 'Referencia', 'Codigo Produto', 'ID Produto', 'Cod. Produto', 'Cod Produto', 'Codigo', 'Cod', 'Item ID'];
            const productNameKeys = ['Nome do Produto', 'Produto', 'Descricao', 'Description', 'Item', 'Nome Produto'];
            const categoryKeys = ['Categoria', 'Grupo', 'Familia', 'Categoria do Produto', 'Departamento', 'Setor'];
            const costKeys = ['Custo', 'Vlr. Custo', 'Preço de Custo', 'Custo Unitário', 'Markup Cost', 'Cost', 'P', 'Vlr Custo', 'Preco Custo', 'Preço Custo'];

            rows.forEach(row => {
                const productName = String(getVal(row, productNameKeys) || '').trim();
                let productCode = String(getVal(row, productCodeKeys) || '').trim();

                // FALLBACK: If code is missing but name exists, use name as code
                if ((!productCode || productCode === 'undefined' || productCode === '') && productName) {
                    productCode = productName;
                }

                // Prevent collisions: Use compound key if code is short or suspiciously generic
                const productLookupKey = productCode.length < 5 ? `${productName.substring(0, 20)}_${productCode}` : productCode;

                const customerName = getVal(row, customerValueKeys);
                const customerCpf = getVal(row, customerCpfKeys);
                const category = getVal(row, categoryKeys) || 'Geral';
                const cost = parseNumber(getVal(row, costKeys));

                if (customerName && customerName !== '-' && !uniqueCustomerKeys.has(customerCpf || customerName)) {
                    customersToUpsert.push({
                        user_id: user.id,
                        name: String(customerName).trim(),
                        cpf: customerCpf ? String(customerCpf).trim() : null,
                        company_id: activeCompany?.id || null
                    });
                    uniqueCustomerKeys.add(customerCpf || customerName);
                }

                if (productCode && productCode !== 'undefined' && productCode !== '' && !uniqueProductCodes.has(productLookupKey)) {
                    productsToUpsert.push({
                        user_id: user.id,
                        code: productLookupKey,
                        name: productName || 'Produto sem nome',
                        category: category ? String(category).trim() : 'Geral',
                        cost: cost || 0,
                        company_id: activeCompany?.id || null
                    });
                    uniqueProductCodes.add(productLookupKey);
                }
            });

            // Bulk Upsert Customers
            const customersMap = new Map();
            if (customersToUpsert.length > 0) {
                const { data: custData, error: custError } = await supabase
                    .from('customers')
                    .upsert(customersToUpsert, { onConflict: 'user_id, cpf, company_id' })
                    .select();

                if (custError) throw custError;
                custData?.forEach(c => customersMap.set(c.cpf || c.name, c.id));
            }

            // Bulk Upsert Products
            const productsMap = new Map();
            if (productsToUpsert.length > 0) {
                const { data: prodData, error: prodError } = await supabase
                    .from('products')
                    .upsert(productsToUpsert, { onConflict: 'user_id, code, company_id' })
                    .select();

                if (prodError) throw prodError;
                prodData?.forEach(p => productsMap.set(p.code, p.id));
            }

            // 2. Process Sales
            const salesGroups = new Map();
            let lastDate: string | null = null;
            let lastCode: string | null = null;
            let lastStore: string | null = null;

            const codeKeys = ['Nº Pedido', 'Pedido', 'Documento', 'Cupom', 'Ticket', 'Venda', 'ID Venda', 'Codigo Venda', 'Nº Transação', 'Venda ID', 'Nº', 'Codigo', 'ID', 'Transacao', 'Venda ID'];
            const dateKeys = ['Data da Compra', 'Data', 'Data Venda', 'Data Emissão', 'Data Movimento', 'Emissão', 'Data do Pedido', 'Dt. Venda', 'Data Transação', 'Data de Emissão', 'Data Vda', 'Dt Venda'];
            const storeKeys = ['Loja', 'Unidade', 'Filial', 'Ponto de Venda', 'Estabelecimento', 'Nome da Loja', 'PDV', 'Checkout'];
            const paymentKeys = ['Forma de Pagamento', 'Pagamento', 'Metodo', 'Meio de Pagamento', 'Tipo de Pagamento', 'Pagto', 'Forma Pagto', 'Meio Pagto'];
            const deviceKeys = ['Dispositivo', 'Origem', 'Canal', 'Marketplace', 'Plataforma'];
            const qtyKeys = ['Quantidade', 'Qtde', 'Qtd', 'Quant.', 'Quantidade Vendida', 'Qtd.', 'Quant', 'Volume', 'Units', 'Quantity'];
            const unitPriceKeys = ['Valor Unitario', 'Vlr Unitario', 'Preco', 'Preço Unitário', 'Vlr. Unit.', 'Valor Unit.', 'Preco Venda', 'Preço Vda', 'Preço Liq.', 'Preço Líquido', 'Valor Liq.', 'Vlr. Liq.', 'Preço Venda Unitário', 'Vlr Unit'];
            const itemTotalKeys = ['Valor Total Item', 'Vlr. Total Item', 'Total Item', 'Subtotal', 'Total Líquido', 'Total Liquido', 'Vlr Total Item', 'Valor Líquido Item', 'Vlr liq item', 'Valor Total', 'Vlr. Total', 'Total', 'Vlr Total'];
            const orderTotalKeys = ['Total Venda', 'Total Pedido', 'Valor da Venda', 'Valor Total Pedido', 'Vlr. Total Venda', 'Total', 'Valor Total'];
            const statusKeys = ['Status', 'Situacao', 'Situação', 'Estado', 'Operação', 'Operacao', 'Tipo Movimento', 'Movimento', 'Cancelado'];

            rows.forEach((row, index) => {
                // SKIP CANCELLED ROWS
                const status = String(getVal(row, statusKeys) || '').toLowerCase();
                if (status.includes('cancel') || status.includes('estorn') || status.includes('dev')) return;

                // Try to find a unique Sale ID (Order Number, Ticket, etc)
                const rawCode = String(getVal(row, codeKeys) || '');
                const rawDate = getVal(row, dateKeys);
                const date = formatDate(rawDate) || lastDate;

                if (!date) return; // Skip rows without date (and no previous date to carry over)
                lastDate = date;

                const store = getVal(row, storeKeys) || lastStore || 'Unica';
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
                        customer_id: customersMap.get(getVal(row, customerCpfKeys)) ||
                            customersMap.get(getVal(row, customerValueKeys)) || null,
                        date: date,
                        time: getVal(row, ['Hora da Compra', 'Hora', 'Horário']),
                        payment_method: getVal(row, paymentKeys),
                        store_name: store,
                        device: getVal(row, deviceKeys),
                        import_filename: fileName,
                        company_id: activeCompany?.id || null,
                        total_amount: 0,
                        // Store the spreadsheet's stated total for this order to use as fallback
                        spreadsheet_order_total: parseNumber(getVal(row, orderTotalKeys)),
                        items: []
                    });
                }

                const qty = parseNumber(getVal(row, qtyKeys));
                const unitPrice = parseNumber(getVal(row, unitPriceKeys));

                // Determine line total - PRIORITIZE calculation as requested by user
                const lineTotalRaw = getVal(row, itemTotalKeys);
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
                const productName = String(getVal(row, productNameKeys) || '').trim();
                let productCode = String(getVal(row, productCodeKeys) || '').trim();

                // FALLBACK: Use the same logic as above to ensure matching
                if ((!productCode || productCode === 'undefined') && productName) {
                    productCode = productName;
                }

                const productLookupKey = productCode.length < 5 ? `${productName.substring(0, 20)}_${productCode}` : productCode;

                sale.items.push({
                    product_id: productsMap.get(productLookupKey),
                    quantity: qty,
                    unit_price: unitPrice || (qty > 0 ? lineTotalPrice / qty : 0),
                    total_price: lineTotalPrice,
                    unit_cost: costPerUnit
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
                    .upsert(salesToUpsert, { onConflict: 'user_id, external_code, company_id' })
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
    }, [isBusiness, activeCompany]);

    const clearSales = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

            if (activeCompany) {
                await supabase.from('sales').delete().eq('company_id', activeCompany.id);
            } else {
                await supabase.from('sales').delete().eq('user_id', user.id).is('company_id', null);
            }
            return { success: true };
        } catch (err: any) {
            return { error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, [activeCompany]);

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
                    .select('id');

                if (activeCompany) {
                    query = query.eq('company_id', activeCompany.id);
                } else {
                    query = query.eq('user_id', user.id).is('company_id', null);
                }

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
    }, [activeCompany]);

    const fetchImports = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return { data: [] };

            // Fetch all records in pages to group them correctly (PostgREST limit is 1000)
            let allData: any[] = [];
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                let query = supabase
                    .from('sales')
                    .select('import_filename, created_at, date');

                if (activeCompany) {
                    query = query.eq('company_id', activeCompany.id);
                } else {
                    query = query.eq('user_id', session.user.id).is('company_id', null);
                }

                const { data, error } = await query.range(page * 1000, (page + 1) * 1000 - 1);

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
    }, [activeCompany]);

    return { loading, fetchSales, importSalesFromExcel, clearSales, deleteSalesByFilename, fetchImports };
};

// Robust Helper to convert various formats to YYYY-MM-DD
function formatDate(dateValue: any) {
    if (!dateValue) return null;

    // 1. Handle Date objects
    if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) return null;
        const y = dateValue.getUTCFullYear();
        const m = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dateValue.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 2. Handle Excel serial numbers (numbers)
    if (typeof dateValue === 'number') {
        const date = new Date((dateValue - 25569) * 86400 * 1000);
        if (isNaN(date.getTime())) return null;
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const str = String(dateValue).trim();
    if (!str || str === '-') return null;

    // 3. Handle strings with separators / or - or .
    const separator = str.includes('/') ? '/' : (str.includes('-') ? '-' : (str.includes('.') ? '.' : null));
    if (separator) {
        const parts = str.split(separator).map(p => p.trim());
        if (parts.length === 3) {
            let p1 = parts[0];
            let p2 = parts[1];
            let p3 = parts[2];

            // Case: YYYY-XX-XX
            if (p1.length === 4) {
                const year = p1;
                let m = parseInt(p2);
                let d = parseInt(p3);
                // If month > 12, it's very likely DD and MM are swapped (YYYY-DD-MM)
                if (m > 12 && d <= 12) {
                    [m, d] = [d, m];
                }
                return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }

            // Case: XX-XX-YYYY (DD-MM-YYYY or MM-DD-YYYY)
            if (p3.length === 4) {
                const year = p3;
                let v1 = parseInt(p1);
                let v2 = parseInt(p2);
                let day, month;

                if (v2 > 12 && v1 <= 12) { // Clearly MM-DD-YYYY
                    month = v1;
                    day = v2;
                } else { // Assume DD-MM-YYYY
                    day = v1;
                    month = v2;
                }
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }

            // Case: XX-XX-YY
            if (p3.length === 2 && p1.length <= 2) {
                const year = `20${p3}`;
                let v1 = parseInt(p1);
                let v2 = parseInt(p2);
                let day, month;
                if (v2 > 12 && v1 <= 12) { // MM-DD-YY
                    month = v1;
                    day = v2;
                } else { // DD-MM-YY
                    day = v1;
                    month = v2;
                }
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }

    // 4. Handle YYYYMMDD
    if (str.length === 8 && !isNaN(Number(str))) {
        return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    }

    return str;
}
