import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, withRetry, formatError } from '../supabase';
import { useView } from '../contexts/ViewContext';
import { useCompany } from '../contexts/CompanyContext';

export const useTransactions = () => {
    const { isBusiness } = useView();
    const { activeCompany } = useCompany();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const filtersRef = useRef<any>(null);

    const fetchMetadata = useCallback(async () => {
        try {
            const results = await withRetry(async () => {
                let accQuery = supabase.from('accounts').select('*').eq('is_business', isBusiness);
                let catQuery = supabase.from('categories').select('*').eq('is_business', isBusiness).order('name');
                let cardQuery = supabase.from('cards').select('*').eq('is_business', isBusiness);

                if (isBusiness && activeCompany) {
                    accQuery = accQuery.eq('company_id', activeCompany.id);
                    catQuery = catQuery.eq('company_id', activeCompany.id);
                    cardQuery = cardQuery.eq('company_id', activeCompany.id);
                } else if (!isBusiness) {
                    accQuery = accQuery.is('company_id', null);
                    catQuery = catQuery.is('company_id', null);
                    cardQuery = cardQuery.is('company_id', null);
                }

                return await Promise.all([accQuery, catQuery, cardQuery]);
            });

            const [accRes, catRes, cardRes] = results as any[];
            setAccounts(accRes.data || []);
            setCategories(catRes.data || []);
            setCards(cardRes.data || []);
        } catch (err) {
            console.error('Error fetching metadata:', err);
        }
    }, [isBusiness, activeCompany]);

    const fetchTransactions = useCallback(async (filters?: {
        incStartDate?: string;
        incEndDate?: string;
        dueStartDate?: string;
        dueEndDate?: string;
        minAmount?: number;
        maxAmount?: number;
        description?: string;
        accountId?: string;
        categoryId?: string;
        subcategoryId?: string;
        paymentMethod?: string;
        status?: string;
        storeName?: string;
        types?: string[];
    }) => {
        setLoading(true);

        const activeFilters = filters !== undefined ? filters : filtersRef.current;
        if (filters !== undefined) {
            filtersRef.current = filters;
        }

        try {
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    accounts:accounts!transactions_account_id_fkey(name),
                    categories (name, icon, color)
                `)
                .eq('is_business', isBusiness)
                .order('date', { ascending: false });

            if (isBusiness && activeCompany) {
                query = query.eq('company_id', activeCompany.id);
            } else if (!isBusiness) {
                query = query.is('company_id', null);
            }

            if (activeFilters?.description) {
                query = query.ilike('description', `%${activeFilters.description}%`);
            }
            if (activeFilters?.accountId) {
                query = query.eq('account_id', activeFilters.accountId);
            }
            if (activeFilters?.status) {
                query = query.eq('status', activeFilters.status);
            }
            if (activeFilters?.paymentMethod) {
                query = query.eq('payment_method', activeFilters.paymentMethod);
            }
            if (activeFilters?.storeName) {
                query = query.eq('store_name', activeFilters.storeName);
            }
            if (activeFilters?.incStartDate) {
                query = query.gte('date', activeFilters.incStartDate);
            }
            if (activeFilters?.incEndDate) {
                query = query.lte('date', activeFilters.incEndDate);
            }
            if (activeFilters?.dueStartDate) {
                query = query.gte('due_date', activeFilters.dueStartDate);
            }
            if (activeFilters?.dueEndDate) {
                query = query.lte('due_date', activeFilters.dueEndDate);
            }
            if (activeFilters?.minAmount !== undefined && activeFilters?.minAmount !== null) {
                query = query.gte('amount', activeFilters.minAmount);
            }
            if (activeFilters?.maxAmount !== undefined && activeFilters?.maxAmount !== null) {
                query = query.lte('amount', activeFilters.maxAmount);
            }
            if (activeFilters?.types && activeFilters.types.length > 0) {
                const orParts: string[] = [];

                if (activeFilters.types.includes('income')) {
                    // Real income: income type AND no transfer/investment IDs AND not transferencia payment method
                    orParts.push('and(type.eq.income,transfer_id.is.null,investment_id.is.null,payment_method.neq.transferencia)');
                }
                if (activeFilters.types.includes('expense')) {
                    // Real expense: expense type AND no transfer/investment IDs AND not transferencia payment method
                    orParts.push('and(type.eq.expense,transfer_id.is.null,investment_id.is.null,payment_method.neq.transferencia)');
                }
                if (activeFilters.types.includes('transfer')) {
                    // Any transfer: has transfer_id OR payment_method is transferencia
                    orParts.push('transfer_id.not.is.null', 'payment_method.eq.transferencia');
                }
                if (activeFilters.types.includes('investment')) {
                    // Any investment: has investment_id
                    orParts.push('investment_id.not.is.null');
                }

                if (orParts.length > 0) {
                    query = query.or(orParts.join(','));
                }
            } else {
                // Default: only real income and expenses (exclude transfers and investments)
                query = query.is('transfer_id', null).is('investment_id', null).neq('payment_method', 'transferencia');
            }

            if (activeFilters?.subcategoryId) {
                query = query.eq('category_id', activeFilters.subcategoryId);
            } else if (activeFilters?.categoryId) {
                const { data: subcats } = await withRetry(async () => {
                    let scQuery = supabase
                        .from('categories')
                        .select('id')
                        .eq('parent_id', activeFilters.categoryId);

                    if (isBusiness && activeCompany) {
                        scQuery = scQuery.eq('company_id', activeCompany.id);
                    } else if (!isBusiness) {
                        scQuery = scQuery.is('company_id', null);
                    }
                    return await scQuery;
                });

                const categoryIds = [activeFilters.categoryId, ...(subcats?.map(s => s.id) || [])];
                query = query.in('category_id', categoryIds);
            }

            const { data, error } = await withRetry(async () => await query);
            if (error) {
                console.error('Error fetching transactions:', error);
            } else {
                setTransactions(data || []);
            }
            return { data, error };
        } catch (err) {
            console.error('Unexpected error in fetchTransactions:', err);
            return { data: null, error: err };
        } finally {
            setLoading(false);
        }
    }, [isBusiness, activeCompany]);

    useEffect(() => {
        fetchMetadata();
    }, [fetchMetadata]);

    const saveTransaction = useCallback(async (transaction: any) => {
        setLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) return { error: sessionError };
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const transactionsList = (Array.isArray(transaction) ? transaction : [transaction]).map(t => ({
                ...t,
                user_id: user.id,
                is_business: isBusiness,
                company_id: isBusiness ? activeCompany?.id : null
            }));

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .insert(transactionsList)
                    .select()
            );

            if (!error) {
                fetchTransactions();
            }
            return { data, error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao salvar transação') } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions, isBusiness, activeCompany]);

    const updateTransaction = useCallback(async (id: string, updates: any) => {
        setLoading(true);
        try {
            // First, check if it's a transfer to sync both sides
            const { data: currentTx } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .select('transfer_id')
                    .eq('id', id)
                    .single()
            );

            if (currentTx?.transfer_id) {
                // Synchronize common fields for both sides of the transfer
                const { amount, date, due_date, description, status, payment_method } = updates;
                const syncUpdates: any = {};
                if (amount !== undefined) syncUpdates.amount = amount;
                if (date !== undefined) syncUpdates.date = date;
                if (due_date !== undefined) syncUpdates.due_date = due_date;
                if (description !== undefined) syncUpdates.description = description;
                if (status !== undefined) syncUpdates.status = status;
                if (payment_method !== undefined) syncUpdates.payment_method = payment_method;

                if (Object.keys(syncUpdates).length > 0) {
                    await withRetry(async () =>
                        await supabase
                            .from('transactions')
                            .update(syncUpdates)
                            .eq('transfer_id', currentTx.transfer_id)
                    );
                }
            } else {
                // Normal update for non-transfer transactions
                await withRetry(async () =>
                    await supabase
                        .from('transactions')
                        .update(updates)
                        .eq('id', id)
                );
            }

            fetchTransactions();
            return { data: null, error: null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao atualizar transação') } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions]);

    const updateTransactions = useCallback(async (ids: string[], updates: any) => {
        setLoading(true);
        try {
            const { error } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .update(updates)
                    .in('id', ids)
            );

            if (!error) {
                fetchTransactions();
            }
            return { error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao atualizar transações') } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions]);

    const deleteTransaction = useCallback(async (id: string | string[]) => {
        const ids = Array.isArray(id) ? id : [id];
        if (ids.length === 0) return { error: null };

        setLoading(true);
        try {
            const { data: txsToDelete, error: fetchError } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .select('amount, type, investment_id, transfer_id')
                    .in('id', ids)
            );

            if (txsToDelete && txsToDelete.length > 0) {
                const transferIds = txsToDelete.map(t => t.transfer_id).filter(Boolean);

                // Handle investment logic (existing)
                for (const tx of txsToDelete) {
                    if (tx.investment_id) {
                        const { data: inv } = await withRetry(async () =>
                            await supabase
                                .from('investments')
                                .select('value, quantity')
                                .eq('id', tx.investment_id)
                                .single()
                        );

                        if (inv) {
                            const isApplication = tx.type === 'expense';
                            const currentTotal = Number(inv.value) * Number(inv.quantity || 1);
                            const newTotal = isApplication
                                ? currentTotal - Number(tx.amount)
                                : currentTotal + Number(tx.amount);

                            const quantity = Number(inv.quantity || 1);
                            const newValue = quantity > 0 ? newTotal / quantity : newTotal;

                            await withRetry(async () =>
                                await supabase
                                    .from('investments')
                                    .update({ value: newValue })
                                    .eq('id', tx.investment_id)
                            );
                        }
                    }
                }

                // Delete the transactions and their linked transfers
                const { error } = await withRetry(async () => {
                    let query = supabase.from('transactions').delete();
                    if (transferIds.length > 0) {
                        // Use .or to delete by ID OR by transfer_id to catch both sides
                        const idList = ids.map(id => `id.eq.${id}`).join(',');
                        const transList = transferIds.map(tid => `transfer_id.eq.${tid}`).join(',');
                        return await query.or(`${idList},${transList}`);
                    } else {
                        return await query.in('id', ids);
                    }
                });

                if (!error) {
                    fetchTransactions();
                }
                return { error: error ? { message: formatError(error) } : null };
            }
            return { error: null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao deletar transação') } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions]);

    const saveInvestmentTransaction = useCallback(async (transaction: any) => {
        setLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) return { error: sessionError };
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const { data: investment, error: fetchError } = await withRetry(async () =>
                await supabase
                    .from('investments')
                    .select('value, quantity')
                    .eq('id', transaction.investmentId)
                    .single()
            );

            if (fetchError || !investment) {
                return { error: { message: 'Investimento não encontrado' } };
            }

            const isApplication = transaction.operationType === 'application';
            const currentTotalValue = investment.value * investment.quantity;
            const newTotalValue = isApplication
                ? currentTotalValue + transaction.amount
                : currentTotalValue - transaction.amount;
            const newValuePerUnit = investment.quantity > 0 ? newTotalValue / investment.quantity : 0;

            const accountTransaction = {
                user_id: user.id,
                amount: transaction.amount,
                date: transaction.date,
                due_date: transaction.dueDate,
                description: transaction.description || (isApplication ? 'Aplicação em investimento' : 'Resgate de investimento'),
                category_id: null,
                account_id: transaction.accountId,
                type: isApplication ? 'expense' : 'income',
                payment_method: 'investimento',
                status: transaction.status,
                investment_id: transaction.investmentId,
                is_business: isBusiness,
                company_id: isBusiness ? activeCompany?.id : null
            };

            const { data: txData, error: txError } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .insert([accountTransaction])
                    .select()
            );

            if (txError) return { error: txError };

            await withRetry(async () =>
                await supabase
                    .from('investments')
                    .update({ value: newValuePerUnit })
                    .eq('id', transaction.investmentId)
            );

            fetchTransactions();
            return { data: txData, error: null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao salvar investimento') } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions, isBusiness, activeCompany]);

    const saveTransfer = useCallback(async (transfer: any) => {
        setLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) return { error: sessionError };
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const transferId = crypto.randomUUID();

            const movements = [
                {
                    description: `${transfer.description}`,
                    amount: transfer.amount,
                    type: 'expense',
                    category_id: null,
                    account_id: transfer.fromAccountId,
                    date: transfer.date,
                    due_date: transfer.dueDate,
                    status: transfer.status,
                    payment_method: 'transferencia',
                    user_id: user.id,
                    transfer_id: transferId,
                    transfer_account_id: transfer.toAccountId,
                    is_business: isBusiness,
                    company_id: isBusiness ? activeCompany?.id : null
                },
                {
                    description: `${transfer.description}`,
                    amount: transfer.amount,
                    type: 'income',
                    category_id: null,
                    account_id: transfer.toAccountId,
                    date: transfer.date,
                    due_date: transfer.dueDate,
                    status: transfer.status,
                    payment_method: 'transferencia',
                    user_id: user.id,
                    transfer_id: transferId,
                    transfer_account_id: transfer.fromAccountId,
                    is_business: isBusiness,
                    company_id: isBusiness ? activeCompany?.id : null
                }
            ];

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .insert(movements)
                    .select()
            );

            if (!error) {
                fetchTransactions();
            }
            return { data, error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao salvar transferência') } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions, isBusiness]);

    const updateInvestmentTransaction = useCallback(async (id: string, transaction: any) => {
        setLoading(true);
        try {
            const { data: oldTx } = await withRetry(async () =>
                await supabase.from('transactions').select('*').eq('id', id).single()
            );

            if (oldTx && oldTx.investment_id) {
                const { data: inv } = await withRetry(async () =>
                    await supabase.from('investments').select('value, quantity').eq('id', oldTx.investment_id).single()
                );

                if (inv) {
                    const wasApplication = oldTx.type === 'expense';
                    const currentTotal = Number(inv.value) * Number(inv.quantity || 1);
                    const revertedTotal = wasApplication
                        ? currentTotal - Number(oldTx.amount)
                        : currentTotal + Number(oldTx.amount);

                    const isApplication = transaction.operationType === 'application';
                    const newTotal = isApplication
                        ? revertedTotal + transaction.amount
                        : revertedTotal - transaction.amount;
                    const newValuePerUnit = inv.quantity > 0 ? newTotal / inv.quantity : newTotal;

                    await withRetry(async () =>
                        await supabase.from('investments').update({ value: newValuePerUnit }).eq('id', transaction.investmentId)
                    );
                }
            }

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .update({
                        amount: transaction.amount,
                        date: transaction.date,
                        due_date: transaction.dueDate,
                        description: transaction.description,
                        account_id: transaction.accountId,
                        type: transaction.operationType === 'application' ? 'expense' : 'income',
                        status: transaction.status,
                        investment_id: transaction.investmentId
                    })
                    .eq('id', id)
                    .select()
            );

            if (!error) fetchTransactions();
            return { data, error };
        } catch (err: any) {
            return { error: { message: formatError(err) } };
        } finally {
            setLoading(false);
        }
    }, [fetchTransactions]);

    const importTransactionsFromExcel = useCallback(async (rows: any[]) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error('Usuário não autenticado');

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

            // 1. Collect all unique account and category names
            const uniqueAccountNames = new Set<string>();
            const uniqueCategoryNames = new Set<string>();

            rows.forEach(row => {
                const accNameRaw = getVal(row, ['Banco', 'Conta', 'Instituicao']);
                const accName = accNameRaw ? String(accNameRaw).trim() : 'Geral';

                const catNameRaw = getVal(row, ['Categoria', 'Grupo']);
                const catName = catNameRaw ? String(catNameRaw).trim() : 'Outros';

                uniqueAccountNames.add(accName);
                uniqueCategoryNames.add(catName);
            });

            // 2. Lookup existing accounts and categories
            const { data: existingAccounts } = await supabase
                .from('accounts')
                .select('id, name')
                .eq('user_id', user.id)
                .eq('is_business', isBusiness)
                .filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null);

            const { data: existingCategories } = await supabase
                .from('categories')
                .select('id, name')
                .eq('user_id', user.id)
                .eq('is_business', isBusiness)
                .filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null);

            const accountsMap = new Map((existingAccounts || []).map(a => [a.name.toLowerCase().trim(), a.id]));
            const categoriesMap = new Map((existingCategories || []).map(c => [c.name.toLowerCase().trim(), c.id]));

            // 3. Create missing accounts/categories if needed
            for (const accName of uniqueAccountNames) {
                const normalizedAccName = accName.toLowerCase().trim();
                if (!accountsMap.has(normalizedAccName)) {
                    const { data: newAcc } = await supabase
                        .from('accounts')
                        .insert({
                            user_id: user.id,
                            name: accName,
                            type: 'checking',
                            balance: 0,
                            is_business: isBusiness,
                            company_id: isBusiness ? activeCompany?.id : null
                        })
                        .select()
                        .single();
                    if (newAcc) accountsMap.set(normalizedAccName, newAcc.id);
                }
            }

            for (const catName of uniqueCategoryNames) {
                if (!categoriesMap.has(catName.toLowerCase().trim())) {
                    const { data: newCat } = await supabase
                        .from('categories')
                        .insert({
                            user_id: user.id,
                            name: catName,
                            type: 'expense',
                            is_business: isBusiness,
                            company_id: isBusiness ? activeCompany?.id : null
                        })
                        .select()
                        .single();
                    if (newCat) categoriesMap.set(catName.toLowerCase().trim(), newCat.id);
                }
            }

            // 4. Prepare transactions
            const transactionsToInsert = rows.map(row => {
                const accNameRaw = getVal(row, ['Banco', 'Conta', 'Instituicao']);
                const accName = accNameRaw ? String(accNameRaw).trim() : 'Geral';

                const catNameRaw = getVal(row, ['Categoria', 'Grupo']);
                const catName = catNameRaw ? String(catNameRaw).trim() : 'Outros';

                const dateLaunch = getVal(row, ['DatadeLancamento', 'Data', 'Vencimento', 'DataLancamento']);
                const datePayment = getVal(row, ['DataPagamento', 'Pagamento', 'DatadePagamento']);
                const valRaw = getVal(row, ['Valor', 'Montante', 'Preco', 'Amount']);
                const typeRaw = String(getVal(row, ['Tipo', 'Type']) || '').toLowerCase();
                const statusRaw = String(getVal(row, ['Situacao', 'Status', 'Situação']) || '').toLowerCase();
                const nameRaw = getVal(row, ['Nome', 'Descricao', 'Produto', 'Name', 'Description']) || 'Sem descrição';
                const obsRaw = getVal(row, ['Observacao', 'Notas', 'Notes', 'Obs', 'Observação']) || '';
                const paymentMethod = getVal(row, ['FormaPagamento/Recebimento', 'FormadePagamento', 'Metodo', 'PaymentMethod', 'FormaPagamento']) || 'Dinheiro';

                // Robust amount parsing
                let amount = 0;
                let isNegative = false;
                if (typeof valRaw === 'number') {
                    isNegative = valRaw < 0;
                    amount = Math.abs(valRaw);
                } else if (valRaw) {
                    let amountStr = String(valRaw).replace('R$', '').replace(/\s/g, '');
                    isNegative = amountStr.includes('-');

                    // Handle pt-BR format: -1.234,56 -> -1234.56
                    // First remove dots (separators), then replace comma with dot (decimal)
                    amountStr = amountStr.replace(/\./g, '').replace(',', '.').trim();
                    amount = Math.abs(parseFloat(amountStr) || 0);
                }

                // Determining Type
                let type: 'income' | 'expense' = 'expense';
                const normalizedType = typeRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                if (normalizedType.includes('entrada') || normalizedType.includes('receita') || normalizedType.includes('income')) {
                    type = 'income';
                } else if (normalizedType.includes('saida') || normalizedType.includes('despesa') || normalizedType.includes('expense')) {
                    type = 'expense';
                } else if (valRaw !== undefined) {
                    // Fallback to sign detection if type column is non-standard or missing
                    type = isNegative ? 'expense' : 'income';
                }

                const status = (statusRaw.includes('realizado') || statusRaw.includes('pago') || statusRaw.includes('completed')) ? 'completed' : 'open';
                const finalDescription = obsRaw ? `${nameRaw} (${obsRaw})` : String(nameRaw);

                const launchDate = formatDate(dateLaunch);
                const paymentDate = formatDate(datePayment);

                return {
                    user_id: user.id,
                    description: finalDescription,
                    amount,
                    type,
                    date: launchDate || new Date().toISOString().split('T')[0],
                    due_date: paymentDate || launchDate,
                    status,
                    account_id: accountsMap.get(accName.toLowerCase().trim()),
                    category_id: categoriesMap.get(catName.toLowerCase().trim()),
                    payment_method: paymentMethod,
                    is_business: isBusiness,
                    company_id: isBusiness ? activeCompany?.id : null
                };
            }).filter(t => t.amount > 0 && t.account_id);

            if (transactionsToInsert.length === 0) return { success: true, count: 0 };

            const { error } = await supabase.from('transactions').insert(transactionsToInsert);
            if (error) throw error;

            fetchTransactions();
            return { success: true, count: transactionsToInsert.length };

        } catch (err: any) {
            return { error: formatError(err) };
        } finally {
            setLoading(false);
        }
    }, [isBusiness, activeCompany, fetchTransactions]);

    function formatDate(dateValue: any) {
        if (!dateValue) return null;

        // 1. Handle Date objects
        if (dateValue instanceof Date) {
            // Check if the date is valid
            if (isNaN(dateValue.getTime())) return null;
            const y = dateValue.getFullYear();
            const m = String(dateValue.getMonth() + 1).padStart(2, '0');
            const d = String(dateValue.getDate()).padStart(2, '0');
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

        // 3. Handle strings with separators / or -
        const separator = str.includes('/') ? '/' : (str.includes('-') ? '-' : null);
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

        return str;
    }


    return {
        accounts,
        categories,
        cards,
        transactions,
        fetchTransactions,
        saveTransaction,
        saveTransfer,
        saveInvestmentTransaction,
        updateTransaction,
        updateTransactions,
        updateInvestmentTransaction,
        deleteTransaction,
        deleteTransactions: deleteTransaction,
        importTransactionsFromExcel,
        loading,
        refresh: fetchTransactions
    };
};
