import { useState, useEffect } from 'react';
import { supabase, withRetry, formatError } from '../supabase';

export const useAccounts = () => {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const { data, error } = await withRetry(async () => await supabase.from('accounts').select('*').order('name'));
            if (error) {
                console.error('Error fetching accounts:', error);
            } else {
                setAccounts(data || []);
            }
        } catch (err) {
            console.error('Unexpected error in fetchAccounts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const addAccount = async (account: any) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Session fetch error:', sessionError);
                return { error: sessionError };
            }
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('accounts')
                    .insert([{ ...account, user_id: user.id }])
                    .select()
            );

            if (error) {
                console.error('Account insert error:', error);
            } else {
                fetchAccounts();
            }
            return { data, error };
        } catch (err: any) {
            console.error('Unexpected error in addAccount:', err);
            return { error: err };
        }
    };

    const getAccountTransactions = async (accountId: string) => {
        return await withRetry(async () =>
            await supabase
                .from('transactions')
                .select('*, categories(name, icon, color), accounts:accounts!transactions_account_id_fkey(name)')
                .eq('account_id', accountId)
                .order('due_date', { ascending: false })
        );
    };

    const getAccountStatement = async (accountId: string) => {
        return await withRetry(async () =>
            await supabase
                .from('transactions')
                .select('*, categories(name, icon, color), accounts:accounts!transactions_account_id_fkey(name)')
                .eq('account_id', accountId)
                .eq('status', 'completed')
                .order('due_date', { ascending: true })
                .order('created_at', { ascending: true })
        );
    };

    const getTransactionsAfterDate = async (accountId: string, date: string) => {
        return await withRetry(async () =>
            await supabase
                .from('transactions')
                .select('*')
                .eq('account_id', accountId)
                .eq('status', 'completed')
                .gt('due_date', date)
        );
    };

    // Get completed transactions with due_date up to the given date
    const getTransactionsUntilDueDate = async (accountId: string, date: string) => {
        return await withRetry(async () =>
            await supabase
                .from('transactions')
                .select('*')
                .eq('account_id', accountId)
                .eq('status', 'completed')
                .lte('due_date', date)
        );
    };

    const updateAccount = async (id: string, updates: any) => {
        try {
            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('accounts')
                    .update(updates)
                    .eq('id', id)
                    .select()
            );

            if (error) {
                console.error('Account update error:', error);
            } else {
                fetchAccounts();
            }
            return { data, error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            console.error('Unexpected error in updateAccount:', err);
            return { error: { message: formatError(err, 'Erro ao atualizar conta') } };
        }
    };

    const deleteAccount = async (id: string) => {
        try {
            const { error } = await withRetry(async () =>
                await supabase
                    .from('accounts')
                    .delete()
                    .eq('id', id)
            );

            if (!error) fetchAccounts();
            return { error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao deletar conta') } };
        }
    };

    return { accounts, loading, addAccount, updateAccount, deleteAccount, getAccountTransactions, getAccountStatement, getTransactionsAfterDate, getTransactionsUntilDueDate, refresh: fetchAccounts };
};
