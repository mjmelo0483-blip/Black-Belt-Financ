import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export const useCards = () => {
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCards = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('cards')
            .select('*')
            .order('created_at', { ascending: false });
        setCards(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchCards();
    }, []);

    const addCard = async (card: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: { message: 'Usuário não autenticado' } };

        const { data, error } = await supabase
            .from('cards')
            .insert([{ ...card, user_id: user.id }])
            .select();

        if (!error) fetchCards();
        return { data, error };
    };

    const updateCard = async (id: string, updates: any) => {
        const { data, error } = await supabase
            .from('cards')
            .update(updates)
            .eq('id', id)
            .select();

        if (!error) fetchCards();
        return { data, error };
    };

    const getCardTransactions = async (cardId: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                *,
                categories (name, icon, color)
            `)
            .eq('card_id', cardId)
            .eq('payment_method', 'credito')
            .order('date', { ascending: false });

        return { data, error };
    };

    const deleteCard = async (id: string) => {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', id);

        if (!error) fetchCards();
        return { error };
    };

    return { cards, loading, addCard, updateCard, deleteCard, refresh: fetchCards, getCardTransactions };
};
