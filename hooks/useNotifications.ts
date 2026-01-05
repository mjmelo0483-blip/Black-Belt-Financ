import { useState, useEffect, useCallback } from 'react';
import { useBudgets } from './useBudgets';
import { useCards } from './useCards';

export interface Notification {
    id: string;
    type: 'budget' | 'card' | 'system';
    title: string;
    message: string;
    date: string;
    read: boolean;
    category?: string;
    link?: string;
}

export const useNotifications = () => {
    const { spending } = useBudgets();
    const { cards, getCardTransactions } = useCards();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);

    const generateNotifications = useCallback(async () => {
        if (!spending || !cards || !getCardTransactions) return;
        setLoading(true);

        try {
            const newNotifications: Notification[] = [];
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // 1. Budget Alerts
            spending.forEach(cat => {
                if (cat.planned > 0) {
                    const percentage = (cat.actual / cat.planned) * 100;
                    if (percentage >= 80 && percentage < 100) {
                        newNotifications.push({
                            id: `budget-${cat.category_id}-80`,
                            type: 'budget',
                            title: 'Limite de Orçamento Próximo',
                            message: `Você atingiu ${percentage.toFixed(0)}% do orçamento planejado para ${cat.name}.`,
                            date: new Date().toISOString(),
                            read: false,
                            category: 'budget',
                            link: '/budgets'
                        });
                    } else if (percentage >= 100) {
                        newNotifications.push({
                            id: `budget-${cat.category_id}-100`,
                            type: 'budget',
                            title: 'Orçamento Excedido',
                            message: `Você ultrapassou o orçamento planejado para ${cat.name}.`,
                            date: new Date().toISOString(),
                            read: false,
                            category: 'budget',
                            link: '/budgets'
                        });
                    }
                }
            });

            // 2. Card Bill Alerts
            for (const card of cards) {
                try {
                    const { data: transactions } = await getCardTransactions(card.id, currentMonth, currentYear);
                    if (transactions && transactions.length > 0) {
                        const totalBill = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
                        if (totalBill > card.limit * 0.8) {
                            newNotifications.push({
                                id: `card-${card.id}-limit`,
                                type: 'card',
                                title: 'Fatura Elevada',
                                message: `A fatura do cartão ${card.name} está em R$ ${totalBill.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (mais de 80% do limite).`,
                                date: new Date().toISOString(),
                                read: false,
                                category: 'card',
                                link: '/cards'
                            });
                        }
                    }
                } catch (cardErr) {
                    console.error(`Error generating card notifications for ${card.name}:`, cardErr);
                }
            }

            setNotifications(newNotifications);
        } catch (err) {
            console.error('Error generating notifications:', err);
        } finally {
            setLoading(false);
        }
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
        unreadCount: notifications.filter(n => !n.read).length,
        markAsRead,
        clearAll,
        refresh: generateNotifications
    };
};
