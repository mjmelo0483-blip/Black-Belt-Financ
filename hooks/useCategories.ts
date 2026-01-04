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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Usuário não autenticado' } };

        const { data, error } = await supabase
            .from('categories')
            .insert([{ ...category, user_id: user.id }])
            .select();

        if (!error) fetchCategories();
        return { data, error };
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
