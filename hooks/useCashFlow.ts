import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export const useCashFlow = () => {
    const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'custom'>('daily');
    const getTodayStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = getTodayStr();
    const [selectedDate, setSelectedDate] = useState(today);
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    const [accountId, setAccountId] = useState('');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [stats, setStats] = useState({
        initialBalance: 0,
        inflow: 0,
        outflow: 0,
        investmentIn: 0,
        investmentOut: 0,
        finalBalance: 0
    });
    const [loading, setLoading] = useState(true);

    // Sync startDate/endDate based on viewMode
    useEffect(() => {
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (viewMode === 'daily') {
            setStartDate(selectedDate);
            setEndDate(selectedDate);
        } else if (viewMode === 'monthly') {
            const date = new Date(selectedDate);
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(lastDay));
        }
    }, [viewMode, selectedDate]);

    const fetchMetadata = useCallback(async () => {
        const { data } = await supabase.from('accounts').select('*');
        setAccounts(data || []);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const addDays = (dateStr: string, days: number) => {
                const [y, m, d] = dateStr.split('-').map(Number);
                const date = new Date(y, m - 1, d + days); // Local time construction
                const newY = date.getFullYear();
                const newM = String(date.getMonth() + 1).padStart(2, '0');
                const newD = String(date.getDate()).padStart(2, '0');
                return `${newY}-${newM}-${newD}`;
            };

            const todayObj = new Date();
            const todayStr = todayObj.toISOString().split('T')[0];
            const nextDay = addDays(endDate, 1);
            const nextToday = addDays(todayStr, 1);

            // 1. Fetch transactions for the selected range (Main View)
            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    categories (name, icon, color),
                    accounts:accounts!transactions_account_id_fkey (name)
                `)
                .gte('due_date', startDate)
                .lt('due_date', nextDay); // Use LT Next Day for full coverage

            if (accountId) {
                query = query.eq('account_id', accountId);
                // query = query.is('transfer_id', null); // Removed to ensure visibility
            }

            const { data: trans, error: transError } = await query.order('due_date', { ascending: true });

            if (transError) throw transError;

            // 2. Fetch Current Base Account Balances
            let accountsQuery = supabase.from('accounts').select('balance');
            if (accountId) {
                accountsQuery = accountsQuery.eq('id', accountId);
            }
            const { data: accountsData } = await accountsQuery;
            const currentBalance = accountsData?.reduce((acc, curr) => acc + Number(curr.balance), 0) || 0;

            // 3. Calculate Projected Initial Balance for startDate
            // Logic: Start with Current Balance.
            // If startDate > Today: Add expected OPEN flow between Today and StartDate.
            // If startDate <= Today: Subtract COMPLETED flow between StartDate and Today (Rewind).

            let projectedBalance = currentBalance;

            if (startDate > todayStr) {
                // Future Projection
                let gapQuery = supabase
                    .from('transactions')
                    .select('amount, type')
                    .eq('status', 'open')
                    .gte('due_date', todayStr)
                    .lt('due_date', startDate); // Up to start of startDate

                if (accountId) {
                    gapQuery = gapQuery.eq('account_id', accountId);
                } else {
                    // gapQuery = gapQuery.is('transfer_id', null);
                }

                const { data: gapTrans } = await gapQuery;
                const gapIn = gapTrans?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                const gapOut = gapTrans?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                projectedBalance = currentBalance + gapIn - gapOut;

            } else {
                // Past Rewind (or Today)
                // We want Balance at START of startDate.
                // Subtract COMPLETED transactions from startDate up to NOW.
                let gapQuery = supabase
                    .from('transactions')
                    .select('amount, type')
                    .eq('status', 'completed')
                    .gte('due_date', startDate)
                    .lt('due_date', nextToday); // Include Today fully

                if (accountId) {
                    gapQuery = gapQuery.eq('account_id', accountId);
                } else {
                    // gapQuery = gapQuery.is('transfer_id', null);
                }

                const { data: gapTrans } = await gapQuery;
                const gapIn = gapTrans?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                const gapOut = gapTrans?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;

                // Reverse the flow to rewind
                // Current = Initial + In - Out
                // Initial = Current - In + Out
                projectedBalance = currentBalance - gapIn + gapOut;
            }

            // 4. Calculate In/Out for the CURRENT range (Excluding transfers and investments from revenue/expense totals)
            const dayInflow = trans?.filter(t => t.type === 'income' && !t.investment_id && !t.transfer_id).reduce((acc, t) => acc + Number(t.amount), 0) || 0;
            const dayOutflow = trans?.filter(t => t.type === 'expense' && !t.investment_id && !t.transfer_id).reduce((acc, t) => acc + Number(t.amount), 0) || 0;

            // 4.1 Calculate Investment Movements (Applications and Redemptions)
            const investmentIn = trans?.filter(t => t.type === 'income' && t.investment_id).reduce((acc, t) => acc + Number(t.amount), 0) || 0;
            const investmentOut = trans?.filter(t => t.type === 'expense' && t.investment_id).reduce((acc, t) => acc + Number(t.amount), 0) || 0;

            // 5. Calculate Final Projected Balance (MUST include ALL transactions that affect balance)
            const totalIn = trans?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
            const totalOut = trans?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
            const calculatedFinalBalance = projectedBalance + totalIn - totalOut;

            setTransactions(trans || []);
            setStats({
                initialBalance: projectedBalance,
                inflow: dayInflow,
                outflow: dayOutflow,
                investmentIn,
                investmentOut,
                finalBalance: calculatedFinalBalance
            });



        } catch (error) {
            console.error('Error fetching cash flow:', error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, accountId]);

    useEffect(() => {
        fetchMetadata();
    }, [fetchMetadata]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const navigateDate = (amount: number) => {
        const d = new Date(selectedDate);
        if (viewMode === 'monthly') {
            d.setMonth(d.getMonth() + amount);
        } else {
            d.setDate(d.getDate() + amount);
        }
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    return {
        viewMode,
        setViewMode,
        selectedDate,
        setSelectedDate,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        accountId,
        setAccountId,
        accounts,
        transactions,
        stats,
        loading,
        navigateDate,
        refresh: fetchData
    };
};
