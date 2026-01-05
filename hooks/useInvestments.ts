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

            if (error) throw error;
            setInvestments(data || []);
        } catch (error) {
            console.error('Error fetching investments:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const addInvestment = async (investment: Omit<Investment, 'id' | 'user_id' | 'created_at'>) => {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return { error: new Error('User not authenticated') };

        const { data, error } = await supabase
            .from('investments')
            .insert([{ ...investment, user_id: user.id }])
            .select();

        if (!error) fetchInvestments();
        return { data, error };
    };

    const updateInvestment = async (id: string, updates: Partial<Investment>) => {
        const { data, error } = await supabase
            .from('investments')
            .update(updates)
            .eq('id', id)
            .select();

        if (!error) fetchInvestments();
        return { data, error };
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
