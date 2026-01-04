import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export interface BudgetLimit {
    id: string;
    category_id: string;
    amount: number;
    month: string;
    categories?: {
        name: string;
        color: string;
        icon: string;
    };
}

export interface CategorySpending {
    category_id: string;
    name: string;
    color: string;
    icon: string;
    planned: number;
    actual: number;
}

export const useBudgets = () => {
    const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
    const [spending, setSpending] = useState<CategorySpending[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            // 1. Fetch Categories
            const { data: categories } = await supabase
                .from('categories')
                .select('*')
                .eq('type', 'expense');

            // 2. Fetch Budget Limits for current month
            const { data: budgetLimits } = await supabase
                .from('budgets')
                .select(`
                    *,
                    categories (name, color, icon)
                `)
                .eq('month', startOfMonth);

            // 3. Fetch Actual Transactions for current month
            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount, category_id')
                .eq('type', 'expense')
                .is('transfer_id', null)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            // 4. Process Data
            const spendingMap: Record<string, CategorySpending> = {};

            categories?.forEach(cat => {
                spendingMap[cat.id] = {
                    category_id: cat.id,
                    name: cat.name,
                    color: cat.color || '#3b82f6',
                    icon: cat.icon || 'label',
                    planned: 0,
                    actual: 0
                };
            });

            budgetLimits?.forEach(limit => {
                if (spendingMap[limit.category_id]) {
                    spendingMap[limit.category_id].planned = Number(limit.amount);
                }
            });

            transactions?.forEach(t => {
                if (spendingMap[t.category_id]) {
                    spendingMap[t.category_id].actual += Number(t.amount);
                }
            });

            setBudgets(budgetLimits || []);
            setSpending(Object.values(spendingMap).filter(s => s.planned > 0 || s.actual > 0));

        } catch (error) {
            console.error('Error fetching budget data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const setBudgetLimit = async (categoryId: string, amount: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: new Error('User not authenticated') };

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('budgets')
            .upsert({
                user_id: user.id,
                category_id: categoryId,
                amount: amount,
                month: startOfMonth
            }, {
                onConflict: 'user_id, category_id, month'
            })
            .select();

        if (!error) fetchData();
        return { data, error };
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        budgets,
        spending,
        loading,
        setBudgetLimit,
        refreshBudgets: fetchData
    };
};
