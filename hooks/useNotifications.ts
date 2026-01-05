import { useState, useEffect, useCallback } from 'react';
import { useBudgets } from './useBudgets';
import { useCards } from './useCards';
import { useTransactions } from './useTransactions';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'budget' | 'card' | 'system';
    date: string;
    read: boolean;
}

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const { spending } = useBudgets();
    const { cards, getCardTransactions } = useCards();

    const generateNotifications = useCallback(async () => {
        setLoading(true);
        const newNotifications: Notification[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 1. Check Budgets
        spending.forEach(item => {
            if (item.planned > 0) {
                const percentage = (item.actual / item.planned) * 100;
                if (percentage >= 100) {
                    newNotifications.push({
                        id: `budget-over-${item.category_id}`,
                        title: 'Orçamento Excedido',
                        message: `Você ultrapassou o limite definido para ${item.name}.`,
                        type: 'budget',
                        date: new Date().toISOString(),
                        read: false
                    });
                } else if (percentage >= 80) {
                    newNotifications.push({
                        id: `budget-warning-${item.category_id}`,
                        title: 'Alerta de Orçamento',
                        message: `Você atingiu ${Math.round(percentage)}% do orçamento de ${item.name}.`,
                        type: 'budget',
                        date: new Date().toISOString(),
                        read: false
                    });
                }
            }
        });

        // 2. Check Credit Card Bills
        // For each card, we check if there are transactions for the current month due soon
        for (const card of cards) {
            // This is a simplified logic. In a real scenario, we'd check against a 'bills' table or specific due dates.
            // Here we check transactions in the current month that are near the bill due date.
            // Let's assume the user has to pay the bill around the 'due_day' of the card if it existed, 
            // but since we only have 'transactions', we look for 'open' transactions with 'due_date' near now.

            // For this implementation, let's look for any 'open' credit transaction due in the next 3 days.
            const { data: openTxs } = await getCardTransactions(card.id, currentMonth, currentYear);
            const urgentTxs = openTxs?.filter(t => {
                if (t.status !== 'open') return false;
                const dueDate = new Date(t.due_date);
                const diffTime = dueDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
            });

            if (urgentTxs && urgentTxs.length > 0) {
                newNotifications.push({
                    id: `card-due-${card.id}`,
                    title: 'Fatura Próxima ao Vencimento',
                    message: `Existem lançamentos no cartão ${card.name} vencendo em breve.`,
                    type: 'card',
                    date: new Date().toISOString(),
                    read: false
                });
            }
        }

        setNotifications(newNotifications);
        setLoading(false);
    }, [spending, cards, getCardTransactions]);

    useEffect(() => {
        if (spending.length > 0 || cards.length > 0) {
            generateNotifications();
        }
    }, [spending.length, cards.length, generateNotifications]);

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    return {
        notifications,
        loading,
        markAsRead,
        clearAll,
        refresh: generateNotifications
    };
};
