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
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
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

    const getCardTransactions = async (cardId: string, month?: number, year?: number) => {
        let query = supabase
            .from('transactions')
            .select(`
                *,
                categories (name, icon, color)
            `)
            .eq('card_id', cardId)
            .eq('payment_method', 'credito');

        // Se mês e ano foram fornecidos, filtrar por due_date no período
        if (month !== undefined && year !== undefined) {
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const endOfMonth = new Date(year, month + 1, 0);
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

            query = query
                .gte('due_date', startDate)
                .lte('due_date', endDate);
        }

        const { data, error } = await query.order('due_date', { ascending: false });

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

    return { cards, loading, addCard, updateCard, deleteCard, refresh: fetchCards, getCardTransactions, getCardOpenTransactions };

    // Função para buscar todas as transações em aberto do cartão (para calcular limite utilizado)
    async function getCardOpenTransactions(cardId: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('amount')
            .eq('card_id', cardId)
            .eq('payment_method', 'credito')
            .eq('status', 'open');

        return { data, error };
    }
};
