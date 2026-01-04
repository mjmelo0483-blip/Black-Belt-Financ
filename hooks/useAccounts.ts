import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const useAccounts = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAccounts = async () => {
        setLoading(true);
        const { data } = await supabase.from('accounts').select('*').order('name');
        setAccounts(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const addAccount = async (account: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Usuário não autenticado' } };

        const { data, error } = await supabase
            .from('accounts')
            .insert([{ ...account, user_id: user.id }])
            .select();

        if (!error) fetchAccounts();
        return { data, error };
    };

    const getAccountTransactions = async (accountId: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*, categories(name, icon, color)')
            .eq('account_id', accountId)
            .order('date', { ascending: false });

        return { data, error };
    };

    const getAccountStatement = async (accountId: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*, categories(name, icon, color)')
            .eq('account_id', accountId)
            .eq('status', 'completed')
            .order('date', { ascending: true })
            .order('created_at', { ascending: true });

        return { data, error };
    };

    const getTransactionsAfterDate = async (accountId: string, date: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('account_id', accountId)
            .eq('status', 'completed')
            .gt('date', date);

        return { data, error };
    };

    // Get completed transactions with due_date up to the given date
    const getTransactionsUntilDueDate = async (accountId: string, date: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('account_id', accountId)
            .eq('status', 'completed')
            .lte('due_date', date);

        return { data, error };
    };

    const updateAccount = async (id: string, updates: any) => {
        const { data, error } = await supabase
            .from('accounts')
            .update(updates)
            .eq('id', id)
            .select();

        if (!error) fetchAccounts();
        return { data, error };
    };

    const deleteAccount = async (id: string) => {
        const { error } = await supabase
            .from('accounts')
            .delete()
            .eq('id', id);

        if (!error) fetchAccounts();
        return { error };
    };

    return { accounts, loading, addAccount, updateAccount, deleteAccount, getAccountTransactions, getAccountStatement, getTransactionsAfterDate, getTransactionsUntilDueDate, refresh: fetchAccounts };
};
