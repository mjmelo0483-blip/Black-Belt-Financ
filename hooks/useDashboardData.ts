import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export const useDashboardData = () => {
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

            // 1. Fetch Accounts for Balance
            const { data: accounts } = await supabase
                .from('accounts')
                .select('*');

            const bankBalance = accounts?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

            // 2. Fetch Investments for Total and Allocation
            const { data: investmentsData } = await supabase
                .from('investments')
                .select('*');

            const investmentsTotal = investmentsData?.reduce((acc, curr) => acc + (Number(curr.value) * Number(curr.quantity)), 0) || 0;

            const allocationMap: Record<string, { value: number, color: string, label: string }> = {
                renda_fixa: { value: 0, color: '#137fec', label: 'Renda Fixa' },
                acoes: { value: 0, color: '#0bda5b', label: 'Ações' },
                fiis: { value: 0, color: '#fa6238', label: 'FIIs' },
                cripto: { value: 0, color: '#92adc9', label: 'Cripto' },
                outros: { value: 0, color: '#6d8399', label: 'Outros' }
            };

            investmentsData?.forEach(inv => {
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

            // 3. Fetch Monthly Expenses (current month) based on Due Date
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();

            // Format to YYYY-MM-DD using local time to avoid UTC shifts
            const formatDate = (d: Date) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            const { data: expenses } = await supabase
                .from('transactions')
                .select('amount')
                .eq('type', 'expense')
                .is('transfer_id', null)
                .is('investment_id', null)
                .gte('due_date', formatDate(startOfMonth))
                .lte('due_date', formatDate(endOfMonth));

            const monthlyTotal = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 3.1 Fetch Expenses by Category for Chart - grouped by parent categories
            const { data: expensesCat } = await supabase
                .from('transactions')
                .select(`
                    amount,
                    category_id,
                    categories (id, name, color, parent_id)
                `)
                .eq('type', 'expense')
                .is('transfer_id', null)
                .is('investment_id', null)
                .gte('due_date', formatDate(startOfMonth))
                .lte('due_date', formatDate(endOfMonth));

            // Fetch all categories to get parent names
            const { data: allCategories } = await supabase
                .from('categories')
                .select('id, name, color, parent_id');

            const categoriesMap = new Map(allCategories?.map(c => [c.id, c]) || []);

            // Group by parent category (or self if no parent)
            const parentCatMap: Record<string, {
                value: number,
                color: string,
                children: Array<{ name: string, value: number, color: string }>
            }> = {};

            expensesCat?.forEach(t => {
                const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
                if (!cat) return;

                const catName = cat.name || 'Outros';
                const catColor = cat.color || '#92adc9';
                const amount = Number(t.amount);

                // Check if this category has a parent
                if (cat.parent_id) {
                    const parentCat = categoriesMap.get(cat.parent_id);
                    const parentName = parentCat?.name || 'Outros';
                    const parentColor = parentCat?.color || '#92adc9';

                    if (!parentCatMap[parentName]) {
                        parentCatMap[parentName] = { value: 0, color: parentColor, children: [] };
                    }
                    parentCatMap[parentName].value += amount;

                    // Add to children
                    const existingChild = parentCatMap[parentName].children.find(c => c.name === catName);
                    if (existingChild) {
                        existingChild.value += amount;
                    } else {
                        parentCatMap[parentName].children.push({ name: catName, value: amount, color: catColor });
                    }
                } else {
                    // This is a root category
                    if (!parentCatMap[catName]) {
                        parentCatMap[catName] = { value: 0, color: catColor, children: [] };
                    }
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
                .sort((a, b) => b.value - a.value); // Sort by highest expense

            setExpensesByCategory(catList);

            // 4. Fetch Monthly Income (current month) based on Due Date
            const { data: income } = await supabase
                .from('transactions')
                .select('amount')
                .eq('type', 'income')
                .is('transfer_id', null)
                .is('investment_id', null)
                .gte('due_date', formatDate(startOfMonth))
                .lte('due_date', formatDate(endOfMonth));

            const monthlyIncomeTotal = income?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 4. Fetch Due Today (open expenses)
            const { data: dueTodayItems } = await supabase
                .from('transactions')
                .select('amount')
                .eq('type', 'expense')
                .eq('status', 'open')
                .is('transfer_id', null)
                .is('investment_id', null)
                .eq('due_date', todayStr);

            const dueTodayTotal = dueTodayItems?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 5. Fetch Credit Cards for Total Limits
            const { data: cardsData } = await supabase
                .from('cards')
                .select('credit_limit');

            const totalCards = cardsData?.reduce((acc, curr) => acc + Number(curr.credit_limit), 0) || 0;

            // 6. Fetch Used Credit (ALL open transactions on credit cards - for available limit)
            const { data: allUsedCreditData } = await supabase
                .from('transactions')
                .select('amount')
                .eq('payment_method', 'credito')
                .eq('status', 'open');

            const totalUsedCards = allUsedCreditData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 6.1 Fetch current month card balance (for KPI display)
            const { data: monthUsedCreditData } = await supabase
                .from('transactions')
                .select('amount')
                .eq('payment_method', 'credito')
                .eq('status', 'open')
                .gte('due_date', formatDate(startOfMonth))
                .lte('due_date', formatDate(endOfMonth));

            const monthCardBalance = monthUsedCreditData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 7. Fetch Recent Transactions
            const { data: recents } = await supabase
                .from('transactions')
                .select(`
                    *,
                    categories (name, icon, color),
                    accounts (name)
                `)
                .order('date', { ascending: false })
                .limit(5);

            setStats({
                totalBalance: bankBalance,
                dueToday: dueTodayTotal,
                investments: investmentsTotal,
                monthlyExpenses: monthlyTotal,
                monthlyIncome: monthlyIncomeTotal,
                totalCards: totalCards,
                usedCards: totalUsedCards,
                cardBalance: monthCardBalance
            });
            setRecentTransactions(recents || []);

            // Balance trend (Bank only)
            setChartData([
                { name: 'D-6', value: bankBalance * 0.98 },
                { name: 'D-5', value: bankBalance * 0.99 },
                { name: 'D-4', value: bankBalance * 0.97 },
                { name: 'D-3', value: bankBalance * 1.01 },
                { name: 'D-2', value: bankBalance * 1.02 },
                { name: 'D-1', value: bankBalance * 0.99 },
                { name: 'Hoje', value: bankBalance },
            ]);

            setAssetAllocation(allocationList.length > 0 ? allocationList : [
                { name: 'Aguardando Ativos', value: 100, color: '#324d67' }
            ]);

            // 8. Fetch Budget Progress (limits vs actual spending)
            const { data: budgetLimits } = await supabase
                .from('budgets')
                .select('*, categories (name, color, icon)')
                .eq('month', formatDate(startOfMonth));

            if (budgetLimits && budgetLimits.length > 0) {
                // Build category map for parent lookups
                const catMap = new Map(allCategories?.map(c => [c.id, c]) || []);

                const budgetItems = budgetLimits.map(b => {
                    // Find actual spending: include direct category + subcategories
                    let catSpent = 0;

                    expensesCat?.forEach(e => {
                        const expense = e as any;
                        const expenseCategory = catMap.get(expense.category_id);

                        // Match if direct category or if it's a subcategory of this budget's category
                        if (expense.category_id === b.category_id ||
                            expenseCategory?.parent_id === b.category_id) {
                            catSpent += Number(expense.amount);
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
                setBudgetProgress(budgetItems);
            } else {
                setBudgetProgress([]);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

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
