import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry, formatError } from '../supabase';
import { useView } from '../contexts/ViewContext';

export const useDashboardData = () => {
    const { isBusiness } = useView();
    const [stats, setStats] = useState<{
        totalBalance: number;
        dueToday: number;
        investments: number;
        monthlyExpenses: number;
        monthlyIncome: number;
        totalCards: number;
        usedCards: number;
        cardBalance: number;
    }>({
        totalBalance: 0,
        dueToday: 0,
        investments: 0,
        monthlyExpenses: 0,
        monthlyIncome: 0,
        totalCards: 0,
        usedCards: 0,
        cardBalance: 0,
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [assetAllocation, setAssetAllocation] = useState<any[]>([]);
    const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);
    const [budgetProgress, setBudgetProgress] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            const d = String(today.getDate()).padStart(2, '0');
            const todayStr = `${y}-${m}-${d}`;

            // Helper to format date
            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            // 1. Fetch data with retries
            const [
                accountsRes,
                investmentsRes,
                expensesRes,
                expensesCatRes,
                allCategoriesRes,
                incomeRes,
                dueTodayRes,
                cardsRes,
                allUsedCreditRes,
                monthUsedCreditRes,
                recentsRes,
                budgetLimitsRes
            ] = await withRetry(async () => await Promise.all([
                supabase.from('accounts').select('*').eq('is_business', isBusiness),
                supabase.from('investments').select('*').eq('is_business', isBusiness),
                supabase.from('transactions').select('amount').eq('type', 'expense').eq('is_business', isBusiness).is('transfer_id', null).is('investment_id', null).gte('due_date', formatDate(startOfMonth)).lte('due_date', formatDate(endOfMonth)),
                supabase.from('transactions').select('amount, category_id, categories(id, name, color, parent_id)').eq('type', 'expense').eq('is_business', isBusiness).is('transfer_id', null).is('investment_id', null).gte('due_date', formatDate(startOfMonth)).lte('due_date', formatDate(endOfMonth)),
                supabase.from('categories').select('id, name, color, parent_id').eq('is_business', isBusiness),
                supabase.from('transactions').select('amount').eq('type', 'income').eq('is_business', isBusiness).is('transfer_id', null).is('investment_id', null).gte('due_date', formatDate(startOfMonth)).lte('due_date', formatDate(endOfMonth)),
                supabase.from('transactions').select('amount').eq('type', 'expense').eq('is_business', isBusiness).eq('status', 'open').is('transfer_id', null).is('investment_id', null).eq('due_date', todayStr),
                supabase.from('cards').select('credit_limit').eq('is_business', isBusiness),
                supabase.from('transactions').select('amount').eq('payment_method', 'credito').eq('is_business', isBusiness).eq('status', 'open'),
                supabase.from('transactions').select('amount').eq('payment_method', 'credito').eq('is_business', isBusiness).eq('status', 'open').gte('due_date', formatDate(startOfMonth)).lte('due_date', formatDate(endOfMonth)),
                supabase.from('transactions').select('*, categories(name, icon, color), accounts:accounts!transactions_account_id_fkey(name)').eq('is_business', isBusiness).order('date', { ascending: false }).limit(5),
                supabase.from('budgets').select('*, categories(name, color, icon)').eq('is_business', isBusiness).eq('month', formatDate(startOfMonth))
            ]));

            // 2. Process data
            const accounts = accountsRes.data || [];
            const investmentsData = investmentsRes.data || [];
            const expenses = expensesRes.data || [];
            const expensesCatData = expensesCatRes.data || [];
            const allCategories = allCategoriesRes.data || [];
            const income = incomeRes.data || [];
            const dueTodayItems = dueTodayRes.data || [];
            const cardsData = cardsRes.data || [];
            const allUsedCreditData = allUsedCreditRes.data || [];
            const monthUsedCreditData = monthUsedCreditRes.data || [];
            const recents = recentsRes.data || [];
            const budgetLimits = budgetLimitsRes.data || [];

            // Summaries
            const bankBalance = accounts.reduce((acc, curr) => acc + Number(curr.balance), 0);
            const investmentsTotal = investmentsData.reduce((acc, curr) => acc + (Number(curr.value) * Number(curr.quantity)), 0);
            const monthlyTotal = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
            const monthlyIncomeTotal = income.reduce((acc, curr) => acc + Number(curr.amount), 0);
            const dueTodayTotal = dueTodayItems.reduce((acc, curr) => acc + Number(curr.amount), 0);
            const totalCardsLimit = cardsData.reduce((acc, curr) => acc + Number(curr.credit_limit), 0);
            const totalUsedCards = allUsedCreditData.reduce((acc, curr) => acc + Number(curr.amount), 0);
            const monthCardBalance = monthUsedCreditData.reduce((acc, curr) => acc + Number(curr.amount), 0);

            // Allocation
            const allocationMap: Record<string, { value: number, color: string, label: string }> = {
                renda_fixa: { value: 0, color: '#137fec', label: 'Renda Fixa' },
                acoes: { value: 0, color: '#0bda5b', label: 'Ações' },
                fiis: { value: 0, color: '#fa6238', label: 'FIIs' },
                cripto: { value: 0, color: '#92adc9', label: 'Cripto' },
                outros: { value: 0, color: '#6d8399', label: 'Outros' }
            };

            investmentsData.forEach(inv => {
                if (allocationMap[inv.type]) {
                    allocationMap[inv.type].value += (Number(inv.value) * Number(inv.quantity));
                }
            });

            const allocationList = Object.entries(allocationMap)
                .filter(([_, data]) => data.value > 0)
                .map(([_, data]) => ({
                    name: data.label,
                    value: investmentsTotal > 0 ? Math.round((data.value / investmentsTotal) * 100) : 0,
                    color: data.color,
                    raw: data.value
                }));

            // Category group
            const categoriesMap = new Map(allCategories.map(c => [c.id, c]) || []);
            const parentCatMap: Record<string, { value: number, color: string, children: any[] }> = {};

            expensesCatData.forEach((t: any) => {
                const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
                if (!cat) return;
                const catName = cat.name || 'Outros';
                const catColor = cat.color || '#92adc9';
                const amount = Number(t.amount);

                if (cat.parent_id) {
                    const parentCat = categoriesMap.get(cat.parent_id);
                    const parentName = parentCat?.name || 'Outros';
                    const parentColor = parentCat?.color || '#92adc9';
                    if (!parentCatMap[parentName]) parentCatMap[parentName] = { value: 0, color: parentColor, children: [] };
                    parentCatMap[parentName].value += amount;
                    const existingChild = parentCatMap[parentName].children.find(c => c.name === catName);
                    if (existingChild) existingChild.value += amount;
                    else parentCatMap[parentName].children.push({ name: catName, value: amount, color: catColor });
                } else {
                    if (!parentCatMap[catName]) parentCatMap[catName] = { value: 0, color: catColor, children: [] };
                    parentCatMap[catName].value += amount;
                }
            });

            const catList = Object.entries(parentCatMap)
                .map(([name, data]) => ({
                    name,
                    value: data.value,
                    color: data.color,
                    children: data.children.sort((a, b) => b.value - a.value)
                }))
                .sort((a, b) => b.value - a.value);

            // Budgets
            const budgetItems = budgetLimits.map(b => {
                let catSpent = 0;
                expensesCatData.forEach((e: any) => {
                    const expenseCategory = categoriesMap.get(e.category_id);
                    if (e.category_id === b.category_id || expenseCategory?.parent_id === b.category_id) {
                        catSpent += Number(e.amount);
                    }
                });
                return {
                    name: b.categories?.name || 'Categoria',
                    color: b.categories?.color || '#137fec',
                    icon: b.categories?.icon || 'category',
                    limit: Number(b.amount),
                    spent: catSpent,
                    percentage: b.amount > 0 ? Math.round((catSpent / b.amount) * 100) : 0
                };
            }).sort((a, b) => b.percentage - a.percentage).slice(0, 4);

            setStats({
                totalBalance: bankBalance,
                dueToday: dueTodayTotal,
                investments: investmentsTotal,
                monthlyExpenses: monthlyTotal,
                monthlyIncome: monthlyIncomeTotal,
                totalCards: totalCardsLimit,
                usedCards: totalUsedCards,
                cardBalance: monthCardBalance
            });
            setRecentTransactions(recents || []);
            setExpensesByCategory(catList);
            setBudgetProgress(budgetItems);
            setAssetAllocation(allocationList.length > 0 ? allocationList : [{ name: 'Aguardando Ativos', value: 100, color: '#324d67' }]);
            setChartData([
                { name: 'D-6', value: bankBalance * 0.98 },
                { name: 'D-5', value: bankBalance * 0.99 },
                { name: 'D-4', value: bankBalance * 0.97 },
                { name: 'D-3', value: bankBalance * 1.01 },
                { name: 'D-2', value: bankBalance * 1.02 },
                { name: 'D-1', value: bankBalance * 0.99 },
                { name: 'Hoje', value: bankBalance },
            ]);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [isBusiness]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        stats,
        chartData,
        recentTransactions,
        assetAllocation,
        expensesByCategory,
        budgetProgress,
        loading,
        refreshData: fetchData
    };
};
