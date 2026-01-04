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

    const deleteTransaction = async (id: string) => {
        setLoading(true);
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (!error) fetchTransactions();
        setLoading(false);
        return { error };
    };

    const deleteTransactions = async (ids: string[]) => {
        setLoading(true);
        const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', ids);

        if (!error) fetchTransactions();
        setLoading(false);
        return { error };
    };

    return { accounts, categories, cards, transactions, fetchTransactions, saveTransaction, saveTransfer, updateTransaction, deleteTransaction, deleteTransactions, loading };
};
