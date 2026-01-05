import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const useTransactions = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

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
        status?: string;
    }) => {
        setLoading(true);
        let query = supabase
            .from('transactions')
            .select(`
                *,
                accounts:accounts!account_id (name),
                categories (name, icon, color)
            `)
            .order('date', { ascending: false });

        if (filters?.incStartDate) {
            query = query.gte('date', filters.incStartDate);
        }
        if (filters?.incEndDate) {
            query = query.lte('date', filters.incEndDate);
        }
        if (filters?.dueStartDate) {
            query = query.gte('due_date', filters.dueStartDate);
        }
        if (filters?.dueEndDate) {
            query = query.lte('due_date', filters.dueEndDate);
        }
        if (filters?.minAmount !== undefined && filters?.minAmount !== null) {
            query = query.gte('amount', filters.minAmount);
        }
        if (filters?.maxAmount !== undefined && filters?.maxAmount !== null) {
            query = query.lte('amount', filters.maxAmount);
        }

        if (filters?.description) {
            query = query.ilike('description', `%${filters.description}%`);
        }
        if (filters?.accountId) {
            query = query.eq('account_id', filters.accountId);
        }
        if (filters?.categoryId) {
            query = query.eq('category_id', filters.categoryId);
        }
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;
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
        const transactions = Array.isArray(transaction) ? transaction : [transaction];

        setLoading(true);
        const { data, error } = await supabase
            .from('transactions')
            .insert(transactions)
            .select();

        if (!error) fetchTransactions();
        setLoading(false);
        return { data, error };
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Usuário não autenticado' } };

        // Get current investment value
        const { data: investment, error: fetchError } = await supabase
            .from('investments')
            .select('value, quantity')
            .eq('id', transaction.investmentId)
            .single();

        if (fetchError || !investment) {
            return { error: { message: 'Investimento não encontrado' } };
        }

        const isApplication = transaction.operationType === 'application';

        // Calculate new investment value
        // For application: increase value. For redemption: decrease value
        const currentTotalValue = investment.value * investment.quantity;
        const newTotalValue = isApplication
            ? currentTotalValue + transaction.amount
            : currentTotalValue - transaction.amount;

        // Update value per unit (keeping quantity the same)
        const newValuePerUnit = newTotalValue / investment.quantity;

        // Create transaction for the bank account
        const accountTransaction = {
            user_id: user.id,
            amount: transaction.amount,
            date: transaction.date,
            due_date: transaction.dueDate,
            description: transaction.description || (isApplication ? 'Aplicação em investimento' : 'Resgate de investimento'),
            category_id: null,
            account_id: transaction.accountId,
            type: isApplication ? 'expense' : 'income', // Application = money out, Redemption = money in
            payment_method: 'investimento',
            status: transaction.status,
            investment_id: transaction.investmentId
        };

        setLoading(true);

        // Insert transaction
        const { data: txData, error: txError } = await supabase
            .from('transactions')
            .insert([accountTransaction])
            .select();

        if (txError) {
            setLoading(false);
            return { error: txError };
        }

        // Update investment value
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
        return { data: txData, error: null };
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Usuário não autenticado' } };

        // Generate unique transfer_id
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

        if (!error) fetchTransactions();
        setLoading(false);
        return { data, error };
    };

    const updateTransaction = async (id: string, updates: any) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('transactions')
            .update(updates)
            .eq('id', id)
            .select();

        if (!error) fetchTransactions();
        setLoading(false);
        return { data, error };
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

        // 1. Fetch original transaction to revert its impact
        const { data: oldTx, error: oldTxError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (oldTxError || !oldTx) {
            setLoading(false);
            return { error: { message: 'Transação original não encontrada' } };
        }

        // 2. Fetch investment
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

        // 3. Revert old impact
        const wasApplication = oldTx.type === 'expense';
        let revertedTotal = wasApplication
            ? currentTotal - Number(oldTx.amount)
            : currentTotal + Number(oldTx.amount);

        // 4. Apply new impact
        const isApplication = transaction.operationType === 'application';
        let newTotal = isApplication
            ? revertedTotal + transaction.amount
            : revertedTotal - transaction.amount;

        const newValuePerUnit = newTotal / investment.quantity;

        // 5. Update Transaction
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

        // 6. Update Investment
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
        setLoading(true);

        try {
            // Find investment transactions in the set
            const { data: txsToDelete } = await supabase
                .from('transactions')
                .select('amount, type, investment_id')
                .in('id', ids);

            if (txsToDelete) {
                for (const tx of txsToDelete) {
                    if (tx.investment_id) {
                        // Revert impact on investment
                        const { data: inv } = await supabase
                            .from('investments')
                            .select('value, quantity')
                            .eq('id', tx.investment_id)
                            .single();

                        if (inv) {
                            const isApplication = tx.type === 'expense';
                            const currentTotal = inv.value * inv.quantity;
                            const newTotal = isApplication
                                ? currentTotal - Number(tx.amount)
                                : currentTotal + Number(tx.amount);
                            const newValue = newTotal / inv.quantity;

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

            if (!error) fetchTransactions();
            setLoading(false);
            return { error };
        } catch (error: any) {
            setLoading(false);
            return { error };
        }
    };

    const deleteTransactions = async (ids: string[]) => {
        return deleteTransaction(ids);
    };

    return { accounts, categories, cards, transactions, fetchTransactions, saveTransaction, saveTransfer, saveInvestmentTransaction, updateTransaction, updateInvestmentTransaction, deleteTransaction, deleteTransactions, loading };
};
