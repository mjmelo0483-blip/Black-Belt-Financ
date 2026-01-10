import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry } from '../supabase';
import { useView } from '../contexts/ViewContext';

export const useCashFlow = () => {
    const { isBusiness } = useView();
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
        try {
            const { data } = await withRetry(async () =>
                await supabase.from('accounts')
                    .select('*')
                    .eq('is_business', isBusiness)
            );
            setAccounts(data || []);
        } catch (err) {
            console.error('Error fetching metadata in useCashFlow:', err);
        }
    }, [isBusiness]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const addDays = (dateStr: string, days: number) => {
                const [y, m, d] = dateStr.split('-').map(Number);
                const date = new Date(y, m - 1, d + days);
                const newY = date.getFullYear();
                const newM = String(date.getMonth() + 1).padStart(2, '0');
                const newD = String(date.getDate()).padStart(2, '0');
                return `${newY}-${newM}-${newD}`;
            };

            const todayObj = new Date();
            const todayStr = todayObj.toISOString().split('T')[0];
            const nextDay = addDays(endDate, 1);
            const nextToday = addDays(todayStr, 1);

            // 1. Fetch data with retries
            const [
                transRes,
                accountsRes
            ] = await withRetry(async () => {
                let transQuery = supabase
                    .from('transactions')
                    .select(`
                        *,
                        categories (name, icon, color),
                        accounts:accounts!transactions_account_id_fkey(name)
                    `)
                    .eq('is_business', isBusiness)
                    .gte('due_date', startDate)
                    .lt('due_date', nextDay);

                if (accountId) {
                    transQuery = transQuery.eq('account_id', accountId);
                }

                let accountsQuery = supabase.from('accounts').select('balance').eq('is_business', isBusiness);
                if (accountId) {
                    accountsQuery = accountsQuery.eq('id', accountId);
                }

                return await Promise.all([
                    transQuery.order('due_date', { ascending: true }),
                    accountsQuery
                ]);
            });

            const trans = transRes.data || [];
            const accountsData = accountsRes.data || [];
            const currentBalance = accountsData.reduce((acc: number, curr: any) => acc + Number(curr.balance), 0);

            let projectedBalance = currentBalance;

            if (startDate > todayStr) {
                const { data: gapTrans } = await withRetry(async () => {
                    let gapQuery = supabase
                        .from('transactions')
                        .select('amount, type')
                        .eq('is_business', isBusiness)
                        .eq('status', 'open')
                        .gte('due_date', todayStr)
                        .lt('due_date', startDate);

                    if (accountId) {
                        gapQuery = gapQuery.eq('account_id', accountId);
                    }
                    return await gapQuery;
                });

                const gapIn = gapTrans?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                const gapOut = gapTrans?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                projectedBalance = currentBalance + gapIn - gapOut;

            } else {
                const { data: gapTrans } = await withRetry(async () => {
                    let gapQuery = supabase
                        .from('transactions')
                        .select('amount, type')
                        .eq('is_business', isBusiness)
                        .eq('status', 'completed')
                        .gte('due_date', startDate)
                        .lt('due_date', nextToday);

                    if (accountId) {
                        gapQuery = gapQuery.eq('account_id', accountId);
                    }
                    return await gapQuery;
                });

                const gapIn = gapTrans?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                const gapOut = gapTrans?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
                projectedBalance = currentBalance - gapIn + gapOut;
            }

            const dayInflow = trans.filter(t => t.type === 'income' && !t.investment_id && (accountId ? true : !t.transfer_id)).reduce((acc, t) => acc + Number(t.amount), 0);
            const dayOutflow = trans.filter(t => t.type === 'expense' && !t.investment_id && (accountId ? true : !t.transfer_id)).reduce((acc, t) => acc + Number(t.amount), 0);
            const investmentIn = trans.filter(t => t.type === 'income' && t.investment_id).reduce((acc, t) => acc + Number(t.amount), 0);
            const investmentOut = trans.filter(t => t.type === 'expense' && t.investment_id).reduce((acc, t) => acc + Number(t.amount), 0);

            const totalIn = trans.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
            const totalOut = trans.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
            const calculatedFinalBalance = projectedBalance + totalIn - totalOut;

            setTransactions(trans);
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
    }, [startDate, endDate, accountId, isBusiness]);

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
