import { useState, useEffect } from 'react';
import { supabase, withRetry, formatError } from '../supabase';

export const useTransactions = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentFilters, setCurrentFilters] = useState<any>(null);

    const fetchMetadata = async () => {
        const [accRes, catRes, cardRes] = await Promise.all([
            supabase.from('accounts').select('*'),
            supabase.from('categories').select('*'),
            supabase.from('cards').select('*'),
        ]);
        setAccounts(accRes.data || []);
        setCategories(catRes.data || []);
        setCards(cardRes.data || []);
    };

    const fetchTransactions = async (filters?: {
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

        // If filters are provided, save them. If not, use last saved filters.
        const activeFilters = filters !== undefined ? filters : currentFilters;
        if (filters !== undefined) {
            setCurrentFilters(filters);
        }

        let query = supabase
            .from('transactions')
            .select(`
                *,
                accounts:accounts!account_id (name),
                categories (name, icon, color)
            `)
            .order('date', { ascending: false });

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

        // Subcategory filter has priority over Category filter
        if (activeFilters?.subcategoryId) {
            query = query.eq('category_id', activeFilters.subcategoryId);
        } else if (activeFilters?.categoryId) {
            // Find all subcategories for this parent
            const { data: subcats } = await supabase
                .from('categories')
                .select('id')
                .eq('parent_id', activeFilters.categoryId);

            const categoryIds = [activeFilters.categoryId, ...(subcats?.map(s => s.id) || [])];
            query = query.in('category_id', categoryIds);
        }

        const { data, error } = await withRetry(() => query);
        if (error) {
            console.error('Error fetching transactions:', error);
        }
        if (!error) setTransactions(data || []);
        setLoading(false);
        return { data, error };
    };

    useEffect(() => {
        fetchMetadata();
        fetchTransactions();
    }, []);

    const saveTransaction = async (transaction: any) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Session fetch error:', sessionError);
                return { error: sessionError };
            }
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const transactionsList = (Array.isArray(transaction) ? transaction : [transaction]).map(t => ({
                ...t,
                user_id: user.id
            }));

            setLoading(true);
            const { data, error } = await withRetry(() =>
                supabase
                    .from('transactions')
                    .insert(transactionsList)
                    .select()
            );

            if (error) {
                console.error('Transaction insert error:', error);
            } else {
                fetchTransactions();
            }
            setLoading(false);
            return { data, error };
        } catch (err: any) {
            console.error('Unexpected error in saveTransaction:', err);
            setLoading(false);
            return { error: { message: formatError(err, 'Erro ao salvar transação') } };
        }
    };

    const saveInvestmentTransaction = async (transaction: {
        operationType: 'application' | 'redemption';
        amount: number;
        accountId: string;
        investmentId: string;
        date: string;
        dueDate: string;
        description: string;
        status: 'open' | 'completed';
    }) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Session fetch error:', sessionError);
                return { error: sessionError };
            }
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const { data: investment, error: fetchError } = await supabase
                .from('investments')
                .select('value, quantity')
                .eq('id', transaction.investmentId)
                .single();

            if (fetchError || !investment) {
                console.error('Error fetching investment for transaction:', fetchError);
                return { error: { message: 'Investimento não encontrado' } };
            }

            const isApplication = transaction.operationType === 'application';
            const currentTotalValue = investment.value * investment.quantity;
            const newTotalValue = isApplication
                ? currentTotalValue + transaction.amount
                : currentTotalValue - transaction.amount;
            const newValuePerUnit = newTotalValue / investment.quantity;

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

            setLoading(true);

            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .insert([accountTransaction])
                .select();

            if (txError) {
                console.error('Investment transaction insert error:', txError);
                setLoading(false);
                return { error: txError };
            }

            const { error: invError } = await supabase
                .from('investments')
                .update({ value: newValuePerUnit })
                .eq('id', transaction.investmentId);

            if (invError) {
                console.error('Investment update error:', invError);
                setLoading(false);
                return { error: invError };
            }

            fetchTransactions();
            setLoading(false);
            return { data: txData, error: null };
        } catch (err: any) {
            console.error('Unexpected error in saveInvestmentTransaction:', err);
            setLoading(false);
            return { error: { message: formatError(err, 'Erro ao salvar investimento') } };
        }
    };

    const saveTransfer = async (transfer: {
        amount: number;
        fromAccountId: string;
        toAccountId: string;
        date: string;
        dueDate: string;
        description: string;
        status: 'open' | 'completed';
    }) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Session fetch error:', sessionError);
                return { error: sessionError };
            }
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const transferId = crypto.randomUUID();

            const debitTransaction = {
                user_id: user.id,
                amount: transfer.amount,
                date: transfer.date,
                due_date: transfer.dueDate,
                description: `${transfer.description}`,
                category_id: null,
                account_id: transfer.fromAccountId,
                type: 'expense',
                payment_method: 'transferencia',
                status: transfer.status,
                transfer_id: transferId,
                transfer_account_id: transfer.toAccountId
            };

            const creditTransaction = {
                user_id: user.id,
                amount: transfer.amount,
                date: transfer.date,
                due_date: transfer.dueDate,
                description: `${transfer.description}`,
                category_id: null,
                account_id: transfer.toAccountId,
                type: 'income',
                payment_method: 'transferencia',
                status: transfer.status,
                transfer_id: transferId,
                transfer_account_id: transfer.fromAccountId
            };

            setLoading(true);
            const { data, error } = await supabase
                .from('transactions')
                .insert([debitTransaction, creditTransaction])
                .select();

            if (error) {
                console.error('Transfer insert error:', error);
            } else {
                fetchTransactions();
            }
            setLoading(false);
            return { data, error };
        } catch (err: any) {
            console.error('Unexpected error in saveTransfer:', err);
            setLoading(false);
            return { error: { message: formatError(err, 'Erro ao salvar transferência') } };
        }
    };

    const updateTransaction = async (id: string, updates: any) => {
        try {
            setLoading(true);
            const { data, error } = await withRetry(() =>
                supabase
                    .from('transactions')
                    .update(updates)
                    .eq('id', id)
                    .select()
            );

            if (!error) fetchTransactions();
            setLoading(false);
            return { data, error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            console.error('Unexpected error in updateTransaction:', err);
            setLoading(false);
            return { error: { message: formatError(err, 'Erro ao atualizar transação') } };
        }
    };

    const updateInvestmentTransaction = async (id: string, transaction: {
        operationType: 'application' | 'redemption';
        amount: number;
        accountId: string;
        investmentId: string;
        date: string;
        dueDate: string;
        description: string;
        status: 'open' | 'completed';
    }) => {
        setLoading(true);

        const { data: oldTx, error: oldTxError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (oldTxError || !oldTx) {
            setLoading(false);
            return { error: { message: 'Transação original não encontrada' } };
        }

        const { data: investment, error: invFetchError } = await supabase
            .from('investments')
            .select('value, quantity')
            .eq('id', transaction.investmentId)
            .single();

        if (invFetchError || !investment) {
            setLoading(false);
            return { error: { message: 'Investimento não encontrado' } };
        }

        const currentTotal = investment.value * investment.quantity;
        const wasApplication = oldTx.type === 'expense';
        let revertedTotal = wasApplication
            ? currentTotal - Number(oldTx.amount)
            : currentTotal + Number(oldTx.amount);

        const isApplication = transaction.operationType === 'application';
        let newTotal = isApplication
            ? revertedTotal + transaction.amount
            : revertedTotal - transaction.amount;

        const newValuePerUnit = newTotal / investment.quantity;

        const { data: updatedTx, error: txError } = await supabase
            .from('transactions')
            .update({
                amount: transaction.amount,
                date: transaction.date,
                due_date: transaction.dueDate,
                description: transaction.description,
                account_id: transaction.accountId,
                type: isApplication ? 'expense' : 'income',
                status: transaction.status,
                investment_id: transaction.investmentId
            })
            .eq('id', id)
            .select();

        if (txError) {
            setLoading(false);
            return { error: txError };
        }

        const { error: invError } = await supabase
            .from('investments')
            .update({ value: newValuePerUnit })
            .eq('id', transaction.investmentId);

        if (invError) {
            setLoading(false);
            return { error: invError };
        }

        fetchTransactions();
        setLoading(false);
        return { data: updatedTx, error: null };
    };

    const deleteTransaction = async (id: string | string[]) => {
        const ids = Array.isArray(id) ? id : [id];
        if (ids.length === 0) return { error: null };

        setLoading(true);

        try {
            const { data: txsToDelete, error: fetchError } = await supabase
                .from('transactions')
                .select('amount, type, investment_id')
                .in('id', ids);

            if (txsToDelete && txsToDelete.length > 0) {
                for (const tx of txsToDelete) {
                    if (tx.investment_id) {
                        const { data: inv, error: invFetchError } = await supabase
                            .from('investments')
                            .select('value, quantity')
                            .eq('id', tx.investment_id)
                            .single();

                        if (inv && !invFetchError) {
                            const isApplication = tx.type === 'expense';
                            const currentTotal = Number(inv.value) * Number(inv.quantity || 1);
                            const newTotal = isApplication
                                ? currentTotal - Number(tx.amount)
                                : currentTotal + Number(tx.amount);

                            const quantity = Number(inv.quantity || 1);
                            const newValue = quantity > 0 ? newTotal / quantity : newTotal;

                            await supabase
                                .from('investments')
                                .update({ value: newValue })
                                .eq('id', tx.investment_id);
                        }
                    }
                }
            }

            const { error } = await supabase
                .from('transactions')
                .delete()
                .in('id', ids);

            if (!error) {
                await fetchTransactions();
            }

            setLoading(false);
            return { error };
        } catch (err: any) {
            setLoading(false);
            return { error: err };
        }
    };

    const deleteTransactions = async (ids: string[]) => {
        return deleteTransaction(ids);
    };

    return { accounts, categories, cards, transactions, fetchTransactions, saveTransaction, saveTransfer, saveInvestmentTransaction, updateTransaction, updateInvestmentTransaction, deleteTransaction, deleteTransactions, loading };
};
