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
                    id, date, time, store_name, payment_method, total_amount,
                    sale_items (
                        total_price, unit_price, quantity, unit_cost,
                        products (name, code, category, sub_category, cost)
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

            // 0. Auto-delete existing sales for this filename to avoid duplicates
            // Especially important if the spreadsheet has no unique Order IDs (we generate them based on index)
            await deleteSalesByFilename(fileName);

            // --- Robust Parsing Helpers ---
            const getVal = (row: any, possibleKeys: string[]) => {
                const keys = Object.keys(row);
                // Prioritize the order of possibleKeys to allow preferring specific letters
                for (const pk of possibleKeys) {
                    const normalizedPK = pk.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                    const foundKey = keys.find(k => {
                        const normalizedK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
                        return normalizedK === normalizedPK;
                    });
                    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
                        return row[foundKey];
                    }
                }
                return undefined;
            };

            const parseNumber = (val: any) => {
                if (typeof val === 'number') return val;
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
                return parseFloat(str) || 0;
            };
            // ------------------------------

            // 1. Process Customers and Products in bulk to avoid duplicates
            const customersToUpsert: any[] = [];
            const productsToUpsert: any[] = [];
            const uniqueCustomerKeys = new Set();
            const uniqueProductCodes = new Set();

            const customerValueKeys = ['Cliente', 'Cliente/Nome social', 'Cliente/Nome Social', 'Nome do Cliente', 'Nome Cliente', 'Destinatario', 'Nome', 'Customer'];
            const customerCpfKeys = ['CPF do Cliente', 'CPF', 'CNPJ/CPF', 'CPF/CNPJ', 'Documento', 'Doc'];
            const productCodeKeys = ['C', 'Cód. de Barras', 'Codigo de Barras', 'Codigo do Produto', 'SKU', 'Ref', 'Referencia', 'Codigo Produto', 'ID Produto', 'Cod. Produto', 'Cod Produto', 'Codigo', 'Cod', 'Item ID'];
            const productNameKeys = ['K', 'Item', 'Nome do Produto', 'Produto', 'Descricao', 'Description', 'Nome Produto', 'Rotulos de Linha'];
            const categoryKeys = ['Categoria', 'Grupo', 'Familia', 'Categoria do Produto', 'Departamento', 'Setor'];
            const costKeys = ['P', 'Custo', 'Custo Un.', 'Custo Unitário', 'Vlr. Custo', 'Preço de Custo', 'Markup Cost', 'Cost', 'Vlr Custo', 'Preco Custo', 'Preço Custo'];
            const subCategoryKeys = ['Sub-Categoria', 'Sub-categoria', 'Subcategoria', 'Sub Categoria', 'Sub_Categoria', 'Tipo Produto', 'Classificação', 'Classificacao'];

            const normalizeCode = (c: string) => {
                const s = String(c || '').trim();
                if (/^\d+$/.test(s)) return s.replace(/^0+/, ''); // Remove leading zeros if numeric
                return s;
            };

            const normalizeName = (n: string) => String(n || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            rows.forEach(row => {
                let productName = String(getVal(row, productNameKeys) || '').trim();
                if (!productName) {
                    productName = activeCompany?.business_type === 'services' ? 'Serviço Prestado' : 'Produto Geral';
                }
                let rawProductCode = String(getVal(row, productCodeKeys) || '').trim();

                // FALLBACK: If code is missing but name exists, use name as code
                if ((!rawProductCode || rawProductCode === 'undefined' || rawProductCode === '' || rawProductCode === 'null') && productName) {
                    rawProductCode = productName;
                }

                // Normalization for lookup
                const productCode = normalizeCode(rawProductCode);

                // Prevent collisions: Use compound key if code is short or suspiciously generic
                const productLookupKey = productCode.length < 5 ? `${productName.substring(0, 20)}_${productCode}` : productCode;

                const customerName = getVal(row, customerValueKeys);
                const customerCpf = getVal(row, customerCpfKeys);
                const rawCategory = getVal(row, categoryKeys);
                const category = rawCategory ? String(rawCategory).trim() : null; // null = no category in spreadsheet
                const rawSubCategory = getVal(row, subCategoryKeys);
                const subCategory = rawSubCategory ? String(rawSubCategory).trim() : null;
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
                        category: category, // null if not provided by spreadsheet
                        sub_category: subCategory, // null if not provided by spreadsheet
                        cost: cost || 0,
                        company_id: activeCompany?.id || null
                    });
                    uniqueProductCodes.add(productLookupKey);
                }
            });

            // Bulk Upsert Customers - split by CPF presence
            const customersMap = new Map();
            const customersWithCpf = customersToUpsert.filter(c => c.cpf !== null);
            const customersWithoutCpf = customersToUpsert.filter(c => c.cpf === null);

            if (customersWithCpf.length > 0) {
                const { data: custData, error: custError } = await supabase
                    .from('customers')
                    .upsert(customersWithCpf, { onConflict: 'user_id, cpf, company_id' })
                    .select();

                if (custError) throw custError;
                custData?.forEach(c => customersMap.set(c.cpf || c.name, c.id));
            }

            for (const cust of customersWithoutCpf) {
                const { data: existing } = await supabase
                    .from('customers')
                    .select('id, name')
                    .eq('user_id', cust.user_id)
                    .eq('name', cust.name)
                    .is('cpf', null)
                    .eq('company_id', cust.company_id)
                    .maybeSingle();

                if (existing) {
                    customersMap.set(cust.name, existing.id);
                } else {
                    const { data: inserted, error: insertErr } = await supabase
                        .from('customers')
                        .insert(cust)
                        .select()
                        .maybeSingle();

                    if (!insertErr && inserted) {
                        customersMap.set(inserted.name, inserted.id);
                    }
                }
            }

            // Bulk Upsert Products - preserve existing categories when spreadsheet doesn't provide one
            const productsMap = new Map();

            // First, fetch existing products to get their current categories
            const existingProductCodes = productsToUpsert.map(p => p.code);
            const existingProductsMap = new Map<string, string>(); // key: normalized code
            const nameToCategoryMap = new Map<string, string>(); // key: normalized name

            if (existingProductCodes.length > 0) {
                // Fetch in batches of 200
                for (let i = 0; i < existingProductCodes.length; i += 200) {
                    const batch = existingProductCodes.slice(i, i + 200);
                    const { data: existingProducts } = await supabase
                        .from('products')
                        .select('code, category, name')
                        .eq('user_id', user.id)
                        .eq('company_id', activeCompany?.id || '');

                    // We filter code after fetching or use smart or condition if possible, 
                    // but for simplicity let's rely on the codes we have + name matches from all products of company
                    // Note: 'in batch' is more efficient but we might miss name-matches if codes don't match.
                    // Let's refine this to fetch ALL products for the company if the list is small, 
                    // or do a broad search for names.
                }

                // REFINED STRATEGY: Fetch all products for company that HAVE categories
                const { data: companyProducts } = await supabase
                    .from('products')
                    .select('code, name, category')
                    .eq('company_id', activeCompany?.id || '')
                    .not('category', 'is', null)
                    .neq('category', 'Geral');

                companyProducts?.forEach(p => {
                    const normCode = normalizeCode(p.code);
                    const normName = normalizeName(p.name);
                    if (p.category) {
                        existingProductsMap.set(normCode, p.category);
                        nameToCategoryMap.set(normName, p.category);
                    }
                });
            }

            // Apply existing categories to products that don't have one from the spreadsheet
            const finalProductsToUpsert = productsToUpsert.map(p => {
                const normCode = normalizeCode(p.code);
                const normName = normalizeName(p.name);
                const existingCat = p.category || existingProductsMap.get(normCode) || nameToCategoryMap.get(normName) || 'Geral';
                return { ...p, category: existingCat };
            });

            if (finalProductsToUpsert.length > 0) {
                const { data: prodData, error: prodError } = await supabase
                    .from('products')
                    .upsert(finalProductsToUpsert, { onConflict: 'user_id, code, company_id' })
                    .select();

                if (prodError) throw prodError;
                prodData?.forEach(p => productsMap.set(p.code, p.id));
            }

            // 2. Process Sales
            const salesGroups = new Map();
            let lastDate: string | null = null;
            let lastCode: string | null = null;
            let lastStore: string | null = null;

            const codeKeys = ['A', 'ID Transação', 'ID Transacao', 'Número', 'Nº Pedido Loja', 'Nº Pedido', 'Pedido', 'Documento', 'Cupom', 'Ticket', 'Venda', 'ID Venda', 'Codigo Venda', 'Nº Transação', 'Venda ID', 'Nº', 'Codigo', 'Transacao'];
            const dateKeys = ['B', 'Data / Hora (GMT -3)', 'Data / Hora', 'Data', 'Data da Compra', 'Data Venda', 'Data Emissão', 'Data Movimento', 'Emissão', 'Data do Pedido', 'Dt. Venda', 'Data Transação', 'Data de Emissão', 'Data Vda', 'Dt Venda'];
            const storeKeys = ['Loja', 'Unidade', 'Filial', 'Ponto de Venda', 'Estabelecimento', 'Nome da Loja', 'PDV', 'Checkout'];
            const paymentKeys = ['E', 'Modalidade', 'Forma de Pagamento', 'Pagamento', 'Metodo', 'Meio de Pagamento', 'Tipo de Pagamento', 'Pagto', 'Forma Pagto', 'Meio Pagto', 'Bandeira'];
            const deviceKeys = ['Dispositivo', 'Formato Transação', 'Formato Transacao', 'Origem', 'Canal', 'Marketplace', 'Plataforma', 'Canal de Venda'];
            const qtyKeys = ['O', 'Qtd', 'Quantidade', 'Qtde', 'Quant.', 'Quantidade Vendida', 'Qtd.', 'Quant', 'Volume', 'Units', 'Quantity'];
            const unitPriceKeys = ['L', 'Preço Un.', 'Preço Unitário', 'Valor Unitario', 'Vlr Unitario', 'Preco', 'Vlr. Unit.', 'Valor Unit.', 'Preco Venda', 'Preço Vda', 'Preço Liq.', 'Preço Líquido', 'Valor Liq.', 'Vlr. Liq.', 'Preço Venda Unitário', 'Vlr Unit'];
            const itemTotalKeys = ['N', 'Total Item', 'Vlr Total', 'Valor Total Item', 'Vlr. Total Item', 'Subtotal', 'Total Líquido', 'Total Liquido', 'Vlr Total Item', 'Valor Líquido Item', 'Vlr liq item', 'Valor Total', 'Vlr. Total', 'Total'];
            const orderTotalKeys = ['Total Pago', 'Total Carrinho', 'Valor Líquido', 'Vlr Total', 'Total Venda', 'Total Pedido', 'Valor da Venda', 'Valor Total Pedido', 'Vlr. Total Venda', 'Total', 'Valor Total'];
            const statusKeys = ['Q', 'Status', 'Situacao', 'Situação', 'Estado', 'Operação', 'Operacao', 'Tipo Movimento', 'Movimento', 'Cancelado'];

            // DIAGNOSTIC COUNTERS
            let diagCancelled = 0;
            let diagNoDate = 0;
            let diagEmpty = 0;
            let diagProcessed = 0;
            let diagFirstRowKeys = '';
            let diagFirstRowSample = '';

            rows.forEach((row, index) => {
                if (index === 0) {
                    diagFirstRowKeys = Object.keys(row).join(', ');
                    const vals = Object.entries(row).slice(0, 8).map(([k,v]) => `${k}=${v}`);
                    diagFirstRowSample = vals.join(' | ');
                }
                // SKIP CANCELLED ROWS - Robust detection for retail software
                const status = String(getVal(row, statusKeys) || '').toLowerCase().trim();
                const isCancelled = status === 'c' ||
                    status.includes('cancel') || status.includes('estorn') ||
                    status.includes('devol') || status.includes('canc') ||
                    status.includes('refund') || status.includes('failed') || status.includes('error');
                if (isCancelled) { diagCancelled++; return; }

                let productName = String(getVal(row, productNameKeys) || '').trim();
                if (!productName) {
                    productName = activeCompany?.business_type === 'services' ? 'Serviço Prestado' : 'Produto Geral';
                }
                let qty = parseNumber(getVal(row, qtyKeys));
                if (qty === 0) qty = 1; // Default to 1 for order-level imports

                const orderTotal = parseNumber(getVal(row, orderTotalKeys));
                const itemTotal = parseNumber(getVal(row, itemTotalKeys));

                // Skip rows that are clearly empty or just separators
                if ((!productName || productName === '-') && orderTotal === 0 && itemTotal === 0) { diagEmpty++; return; }

                // Try to find a unique Sale ID (Order Number, Ticket, etc)
                const rawCode = String(getVal(row, codeKeys) || '');
                const rawDate = getVal(row, dateKeys);
                const date = formatDate(rawDate) || lastDate;

                if (!date) { diagNoDate++; return; } // Skip rows without date (and no previous date to carry over)
                lastDate = date;

                let store = String(getVal(row, storeKeys) || lastStore || 'Unica').trim();
                // Normalize store names: strip brand prefixes so different spreadsheet formats match
                // e.g. "Minha Quitandinha - Condomínio Lar Portugal" → "Condomínio Lar Portugal"
                store = store.replace(/^Minha Quitandinha\s*-\s*/i, '').trim();
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
                        time: getVal(row, ['Hora da Compra', 'Hora', 'Horário', 'Hora Saída']),
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
                let productCode = String(getVal(row, productCodeKeys) || '').trim();

                // FALLBACK: Use the same logic as above to ensure matching
                if (!productCode || productCode === 'undefined' || productCode === '' || productCode === 'null') {
                    productCode = productName;
                }

                const productLookupKey = productCode.length < 5 ? `${productName.substring(0, 20)}_${productCode}` : productCode;
                const costPerUnit = parseNumber(getVal(row, costKeys));

                sale.items.push({
                    product_id: productsMap.get(productLookupKey),
                    quantity: qty,
                    unit_price: unitPrice || (qty > 0 ? lineTotalPrice / qty : 0),
                    total_price: lineTotalPrice,
                    unit_cost: costPerUnit
                });

                // Increment calculated total
                sale.total_amount += lineTotalPrice;
                diagProcessed++;
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

                // DEDUPLICATE by external_code to prevent "ON CONFLICT DO UPDATE cannot affect row a second time"
                const deduped = new Map<string, any>();
                chunk.forEach(sale => {
                    const key = sale.external_code;
                    if (deduped.has(key)) {
                        // Merge items and totals from duplicate entries
                        const existing = deduped.get(key);
                        existing.items = [...existing.items, ...sale.items];
                        existing.total_amount += sale.total_amount;
                    } else {
                        deduped.set(key, { ...sale });
                    }
                });
                const dedupedChunk = Array.from(deduped.values());

                const salesToUpsert = dedupedChunk.map(({ items, ...sale }) => sale);

                const { data: upsertedSales, error: upsertError } = await supabase
                    .from('sales')
                    .upsert(salesToUpsert, { onConflict: 'user_id, external_code, company_id' })
                    .select('id, external_code');

                if (upsertError) throw upsertError;

                // Prepare items for this chunk
                const itemsToInsert: any[] = [];
                const saleIdsToDelete: string[] = [];

                upsertedSales?.forEach(insertedSale => {
                    const originalSale = dedupedChunk.find(s => s.external_code === insertedSale.external_code);
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

            return { success: true, diagnostics: { totalRows: rows.length, processed: diagProcessed, cancelled: diagCancelled, noDate: diagNoDate, empty: diagEmpty, salesCreated: allSalesData.length, firstRowKeys: diagFirstRowKeys, firstRowSample: diagFirstRowSample } };
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
                // Use deleteSalesByFilename with a targeted filter instead of a single massive delete if needed,
                // but for clearSales, we'll do a robust wipe.
                const { error } = await supabase.from('sales').delete().eq('company_id', activeCompany.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('sales').delete().eq('user_id', user.id).is('company_id', null);
                if (error) throw error;
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
                if (page > 200) break; // Safety: 200k records
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
                if (page > 100) break; // Limit to 100k records for summary
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

    // Extract just the date part, ignoring time (e.g. "16/03/2026 15:30")
    const str = String(dateValue).trim().split(' ')[0];
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
