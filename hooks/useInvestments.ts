import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';
import { useView } from '../contexts/ViewContext';

export const useInvestments = () => {
    const { isBusiness } = useView();
    const [investments, setInvestments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvestments = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('investments')
                    .select('*')
                    .eq('is_business', isBusiness)
                    .order('name', { ascending: true })
            );
            if (error) {
                console.error('Error fetching investments:', error);
            } else {
                setInvestments(data || []);
            }
        } catch (err) {
            console.error('Unexpected error in fetchInvestments:', err);
        } finally {
            setLoading(false);
        }
    }, [isBusiness]);

    useEffect(() => {
        fetchInvestments();
    }, [fetchInvestments]);

    const addInvestment = useCallback(async (investment: any) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) return { error: sessionError };
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('investments')
                    .insert([{ ...investment, user_id: user.id, is_business: isBusiness }])
                    .select()
            );

            if (!error) {
                fetchInvestments();
            }
            return { data, error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao adicionar investimento') } };
        }
    }, [fetchInvestments, isBusiness]);

    const updateInvestment = useCallback(async (id: string, updates: any) => {
        try {
            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('investments')
                    .update(updates)
                    .eq('id', id)
                    .select()
            );

            if (!error) {
                fetchInvestments();
            }
            return { data, error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao atualizar investimento') } };
        }
    }, [fetchInvestments]);

    const deleteInvestment = useCallback(async (id: string) => {
        try {
            const { error } = await withRetry(async () =>
                await supabase
                    .from('investments')
                    .delete()
                    .eq('id', id)
            );

            if (!error) {
                fetchInvestments();
            }
            return { error: error ? { message: formatError(error) } : null };
        } catch (err: any) {
            return { error: { message: formatError(err, 'Erro ao deletar investimento') } };
        }
    }, [fetchInvestments]);

    return {
        investments,
        loading,
        addInvestment,
        updateInvestment,
        deleteInvestment,
        refresh: fetchInvestments
    };
};
