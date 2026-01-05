import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const useCategories = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCategories = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name');
        setCategories(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const addCategory = async (category: any) => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Session fetch error:', sessionError);
                return { error: sessionError };
            }
            const user = session?.user;
            if (!user) return { error: { message: 'Usuário não autenticado' } };

            const { data, error } = await supabase
                .from('categories')
                .insert([{ ...category, user_id: user.id }])
                .select();

            if (error) {
                console.error('Category insert error:', error);
            } else {
                fetchCategories();
            }
            return { data, error };
        } catch (err: any) {
            console.error('Unexpected error in addCategory:', err);
            let message = err.message || 'Erro inesperado ao adicionar categoria';
            if (message.includes('fetch') || message.includes('NetworkError') || err.name === 'TypeError') {
                message = 'Erro de rede: "Failed to fetch". Verifique se há extensões (AdBlockers) bloqueando a conexão e recarregue a página.';
            }
            return { error: { message } };
        }
    };

    const updateCategory = async (id: string, updates: any) => {
        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select();

        if (!error) fetchCategories();
        return { data, error };
    };

    const deleteCategory = async (id: string) => {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (!error) fetchCategories();
        return { error };
    };

    return { categories, loading, addCategory, updateCategory, deleteCategory, refresh: fetchCategories };
};
