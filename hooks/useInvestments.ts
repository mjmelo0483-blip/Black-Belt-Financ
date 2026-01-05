import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export interface Investment {
    id: string;
    user_id: string;
    name: string;
    type: 'renda_fixa' | 'acoes' | 'fiis' | 'cripto' | 'outros';
    value: number;
    quantity: number;
    created_at: string;
}

export const useInvestments = () => {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvestments = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('investments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching investments:', error);
                throw error;
            }
            setInvestments(data || []);
        } catch (error) {
            console.error('Unexpected error in fetchInvestments:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const addInvestment = async (investment: Omit<Investment, 'id' | 'user_id' | 'created_at'>) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Session fetch error:', sessionError);
                return { error: sessionError };
            }
            const user = session?.user;
            if (!user) return { error: new Error('User not authenticated') };

            const { data, error } = await supabase
                .from('investments')
                .insert([{ ...investment, user_id: user.id }])
                .select();

            if (error) {
                console.error('Investment insert error:', error);
            } else {
                fetchInvestments();
            }
            return { data, error };
        } catch (err: any) {
            console.error('Unexpected error in addInvestment:', err);
            let message = err.message || 'Erro inesperado ao adicionar investimento';
            if (message.includes('fetch') || message.includes('NetworkError') || err.name === 'TypeError') {
                message = 'Erro de rede: "Failed to fetch". Verifique se há AdBlockers bloqueando o Supabase e recarregue a página.';
            }
            return { error: { message } };
        }
    };

    const updateInvestment = async (id: string, updates: Partial<Investment>) => {
        try {
            const { data, error } = await supabase
                .from('investments')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) {
                console.error('Investment update error:', error);
            } else {
                fetchInvestments();
            }
            return { data, error };
        } catch (err: any) {
            console.error('Unexpected error in updateInvestment:', err);
            let message = err.message || 'Erro inesperado ao atualizar investimento';
            if (message.includes('fetch') || message.includes('NetworkError') || err.name === 'TypeError') {
                message = 'Erro de rede: "Failed to fetch". Verifique extensões do navegador e tente novamente.';
            }
            return { error: { message } };
        }
    };

    const deleteInvestment = async (id: string) => {
        const { error } = await supabase
            .from('investments')
            .delete()
            .eq('id', id);

        if (!error) fetchInvestments();
        return { error };
    };

    useEffect(() => {
        fetchInvestments();
    }, [fetchInvestments]);

    return {
        investments,
        loading,
        addInvestment,
        updateInvestment,
        deleteInvestment,
        refreshInvestments: fetchInvestments
    };
};
