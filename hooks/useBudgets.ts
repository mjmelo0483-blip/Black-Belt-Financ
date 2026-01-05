import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';

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

export interface ParentCategorySpending extends CategorySpending {
    children: CategorySpending[];
}

export const useBudgets = () => {
    const [budgets, setBudgets] = useState<BudgetLimit[]>([]);
    const [spending, setSpending] = useState<ParentCategorySpending[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'competencia' | 'caixa'>('caixa');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            // 1. Fetch Categories with parent_id
            const { data: categories } = await withRetry(async () =>
                await supabase
                    .from('categories')
                    .select('*')
                    .eq('type', 'expense')
            );

            // 2. Fetch Budget Limits for current month
            const { data: budgetLimits } = await withRetry(async () =>
                await supabase
                    .from('budgets')
                    .select(`
                        *,
                        categories (name, color, icon, parent_id)
                    `)
                    .eq('month', startOfMonth)
            );

            // 3. Fetch Actual Transactions for current month
            const activeDateColumn = viewMode === 'competencia' ? 'date' : 'due_date';

            const { data: transactions } = await withRetry(async () =>
                await supabase
                    .from('transactions')
                    .select('amount, category_id')
                    .eq('type', 'expense')
                    .is('transfer_id', null)
                    .is('investment_id', null)
                    .gte(activeDateColumn, startOfMonth)
                    .lte(activeDateColumn, endOfMonth)
            );

            // 4. Build category map
            const categoriesMap = new Map(categories?.map(c => [c.id, c]) || []);

            // 5. Build spending by category
            const spendingByCategory: Record<string, CategorySpending> = {};
            categories?.forEach(cat => {
                spendingByCategory[cat.id] = {
                    category_id: cat.id,
                    name: cat.name,
                    color: cat.color || '#3b82f6',
                    icon: cat.icon || 'label',
                    planned: 0,
                    actual: 0
                };
            });

            // Add budget limits
            budgetLimits?.forEach(limit => {
                if (spendingByCategory[limit.category_id]) {
                    spendingByCategory[limit.category_id].planned = Number(limit.amount);
                }
            });

            // Add actual spending
            transactions?.forEach(t => {
                if (spendingByCategory[t.category_id]) {
                    spendingByCategory[t.category_id].actual += Number(t.amount);
                }
            });

            // 6. Group by parent category
            const parentSpending: Record<string, ParentCategorySpending> = {};

            Object.values(spendingByCategory).forEach(cat => {
                const category = categoriesMap.get(cat.category_id);

                if (category?.parent_id) {
                    const parentCat = categoriesMap.get(category.parent_id);
                    if (parentCat) {
                        if (!parentSpending[parentCat.id]) {
                            parentSpending[parentCat.id] = {
                                category_id: parentCat.id,
                                name: parentCat.name,
                                color: parentCat.color || '#3b82f6',
                                icon: parentCat.icon || 'label',
                                planned: spendingByCategory[parentCat.id]?.planned || 0,
                                actual: spendingByCategory[parentCat.id]?.actual || 0,
                                children: []
                            };
                        }
                        parentSpending[parentCat.id].actual += cat.actual;
                        if (cat.planned > 0 || cat.actual > 0) {
                            parentSpending[parentCat.id].children.push(cat);
                        }
                    }
                } else {
                    if (!parentSpending[cat.category_id]) {
                        parentSpending[cat.category_id] = {
                            ...cat,
                            children: []
                        };
                    }
                }
            });

            Object.values(parentSpending).forEach(parent => {
                parent.children.sort((a, b) => b.actual - a.actual);
            });

            setBudgets(budgetLimits || []);
            setSpending(
                Object.values(parentSpending)
                    .filter(s => s.planned > 0 || s.actual > 0 || s.children.length > 0)
                    .sort((a, b) => b.actual - a.actual)
            );

        } catch (error) {
            console.error('Error fetching budget data:', error);
        } finally {
            setLoading(false);
        }
    }, [viewMode]);

    const setBudgetLimit = useCallback(async (categoryId: string, amount: number) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return { error: new Error('Usuário não autenticado') };

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

            const { data, error } = await withRetry(async () =>
                await supabase
                    .from('budgets')
                    .upsert({
                        user_id: user.id,
                        category_id: categoryId,
                        amount: amount,
                        month: startOfMonth
                    }, {
                        onConflict: 'user_id, category_id, month'
                    })
                    .select()
            );

            if (!error) fetchData();
            return { data, error };
        } catch (err: any) {
            return { error: err };
        }
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        budgets,
        spending,
        loading,
        viewMode,
        setViewMode,
        setBudgetLimit,
        refreshBudgets: fetchData
    };

};
