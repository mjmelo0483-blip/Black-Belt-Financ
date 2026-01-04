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
    }>({
        totalBalance: 0,
        dueToday: 0,
        investments: 0,
        monthlyExpenses: 0,
        monthlyIncome: 0,
        totalCards: 0,
        usedCards: 0,
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [assetAllocation, setAssetAllocation] = useState<any[]>([]);
    const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);
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
                .gte('due_date', formatDate(startOfMonth))
                .lte('due_date', formatDate(endOfMonth));

            const monthlyTotal = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 3.1 Fetch Expenses by Category for Chart
            const { data: expensesCat } = await supabase
                .from('transactions')
                .select(`
                    amount,
                    categories (name, color)
                `)
                .eq('type', 'expense')
                .is('transfer_id', null)
                .gte('due_date', formatDate(startOfMonth))
                .lte('due_date', formatDate(endOfMonth));

            const catMap: Record<string, { value: number, color: string }> = {};
            expensesCat?.forEach(t => {
                const cat = Array.isArray(t.categories) ? t.categories[0] : t.categories;
                const catName = cat?.name || 'Outros';
                const catColor = cat?.color || '#92adc9';
                if (!catMap[catName]) {
                    catMap[catName] = { value: 0, color: catColor };
                }
                catMap[catName].value += Number(t.amount);
            });

            const catList = Object.entries(catMap)
                .map(([name, data]) => ({
                    name,
                    value: data.value,
                    color: data.color
                }))
                .sort((a, b) => b.value - a.value); // Sort by highest expense

            setExpensesByCategory(catList);

            // 4. Fetch Monthly Income (current month) based on Due Date
            const { data: income } = await supabase
                .from('transactions')
                .select('amount')
                .eq('type', 'income')
                .is('transfer_id', null)
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
                .eq('due_date', todayStr);

            const dueTodayTotal = dueTodayItems?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            // 5. Fetch Credit Cards for Total Limits
            const { data: cardsData } = await supabase
                .from('cards')
                .select('credit_limit');

            const totalCards = cardsData?.reduce((acc, curr) => acc + Number(curr.credit_limit), 0) || 0;

            // 6. Fetch Used Credit (open transactions on credit cards)
            const { data: usedCreditData } = await supabase
                .from('transactions')
                .select('amount')
                .eq('payment_method', 'credito')
                .eq('status', 'open');

            const totalUsedCards = usedCreditData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

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
                usedCards: totalUsedCards
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
        loading,
        refreshData: fetchData
    };
};
