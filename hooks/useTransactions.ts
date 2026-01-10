import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';

export const useTransactions = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentFilters, setCurrentFilters] = useState<any>(null);

    const fetchMetadata = useCallback(async () => {
        try {
            const results = await withRetry(async () => await Promise.all([
                supabase.from('accounts').select('*'),
                supabase.from('categories').select('*').order('name'),
                supabase.from('cards').select('*'),
            ]));

            const [accRes, catRes, cardRes] = results as any[];
            setAccounts(accRes.data || []);
            setCategories(catRes.data || []);
            setCards(cardRes.data || []);
        } catch (err) {
            console.error('Error fetching metadata:', err);
        }
    }, []);

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
        types?: string[];
    }) => {
        setLoading(true);

        const activeFilters = filters !== undefined ? filters : currentFilters;
        if (filters !== undefined) {
            setCurrentFilters(filters);
        }

        try {
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    accounts:accounts!transactions_account_id_fkey(name),
                    categories (name, icon, color)
                `)
                .order('date', { ascending: false });

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
            if (activeFilters?.types && activeFilters.types.length > 0) {
                query = query.in('type', activeFilters.types);
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

            if (activeFilters?.subcategoryId) {
                query = query.eq('category_id', activeFilters.subcategoryId);
            } else if (activeFilters?.categoryId) {
                const { data: subcats } = await withRetry(async () =>
                    await supabase
                        .from('categories')
                        .select('id')
                        .eq('parent_id', activeFilters.categoryId)
                );

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
    }, [currentFilters]);

    useEffect(() => {
        fetchTransactions();
        fetchMetadata();
    }, [fetchTransactions, fetchMetadata]);

    const saveTransaction = useCallback(async (transaction: any) => {
        setLoading(true);
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) return { error: sessionError };
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const transactionsList = (Array.isArray(transaction) ? transaction : [transaction]).map(t => ({
                ...t,
                user_id: user.id
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
    }, [fetchTransactions]);

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
                investment_id: transaction.investmentId
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
    }, [fetchTransactions]);

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
                    transfer_account_id: transfer.toAccountId
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
                    transfer_account_id: transfer.fromAccountId
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
    }, [fetchTransactions]);

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
        loading,
        refresh: fetchTransactions
    };
};
