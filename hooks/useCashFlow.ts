import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry } from '../supabase';
import { useView } from '../contexts/ViewContext';
import { useCompany } from '../contexts/CompanyContext';

export const useCashFlow = () => {
    const { isBusiness } = useView();
    const { activeCompany } = useCompany();
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
            const { data } = await withRetry(async () => {
                let query = supabase.from('accounts')
                    .select('*')
                    .eq('is_business', isBusiness);

                if (isBusiness && activeCompany) {
                    query = query.eq('company_id', activeCompany.id);
                } else if (!isBusiness) {
                    query = query.is('company_id', null);
                }
                return await query;
            });
            setAccounts(data || []);
        } catch (err) {
            console.error('Error fetching metadata in useCashFlow:', err);
        }
    }, [isBusiness, activeCompany]);

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

                if (isBusiness && activeCompany) {
                    transQuery = transQuery.eq('company_id', activeCompany.id);
                } else if (!isBusiness) {
                    transQuery = transQuery.is('company_id', null);
                }

                if (accountId) {
                    transQuery = transQuery.eq('account_id', accountId);
                }

                let accountsQuery = supabase.from('accounts').select('id, balance, initial_balance_date, type').eq('is_business', isBusiness);

                if (isBusiness && activeCompany) {
                    accountsQuery = accountsQuery.eq('company_id', activeCompany.id);
                } else if (!isBusiness) {
                    accountsQuery = accountsQuery.is('company_id', null);
                }
                if (accountId) {
                    accountsQuery = accountsQuery.eq('id', accountId);
                }

                return await Promise.all([
                    transQuery.order('due_date', { ascending: true }),
                    accountsQuery
                ]);
            });

            const transRaw = transRes.data || [];
            const accountsData = accountsRes.data || [];

            // Map accounts for easy lookup
            const accountsMap = new Map();
            accountsData.forEach(acc => {
                accountsMap.set(acc.id, acc);
            });

            const currentBalance = accountsData.reduce((acc: number, curr: any) => acc + Number(curr.balance), 0);

            let projectedBalance = currentBalance;

            if (startDate > todayStr) {
                const { data: gapTrans } = await withRetry(async () => {
                    let gapQuery = supabase
                        .from('transactions')
                        .select('amount, type, transfer_id, investment_id, payment_method, account_id, due_date')
                        .eq('is_business', isBusiness)
                        .eq('status', 'open')
                        .gte('due_date', todayStr)
                        .lt('due_date', startDate);

                    if (isBusiness && activeCompany) {
                        gapQuery = gapQuery.eq('company_id', activeCompany.id);
                    } else if (!isBusiness) {
                        gapQuery = gapQuery.is('company_id', null);
                    }

                    if (accountId) {
                        gapQuery = gapQuery.eq('account_id', accountId);
                    }
                    return await gapQuery;
                });

                // Projeção futura: Somar o que vai entrar e subtrair o que vai sair das contas bancárias
                const gapIn = gapTrans?.filter(t => {
                    const method = t.payment_method?.toLowerCase() || '';
                    return t.type === 'income' &&
                        !t.transfer_id &&
                        !t.investment_id &&
                        method !== 'transferencia';
                }).reduce((acc, t) => acc + Number(t.amount), 0) || 0;

                const gapOut = gapTrans?.filter(t => {
                    const method = t.payment_method?.toLowerCase() || '';
                    return t.type === 'expense' &&
                        !t.transfer_id &&
                        !t.investment_id &&
                        method !== 'transferencia';
                }).reduce((acc, t) => acc + Number(t.amount), 0) || 0;

                projectedBalance = currentBalance + gapIn - gapOut;

            } else {
                const { data: gapTrans } = await withRetry(async () => {
                    let gapQuery = supabase
                        .from('transactions')
                        .select('amount, type, transfer_id, investment_id, payment_method, account_id, due_date')
                        .eq('is_business', isBusiness)
                        .eq('status', 'completed')
                        .gte('due_date', startDate)
                        .lt('due_date', nextToday);

                    if (isBusiness && activeCompany) {
                        gapQuery = gapQuery.eq('company_id', activeCompany.id);
                    } else if (!isBusiness) {
                        gapQuery = gapQuery.is('company_id', null);
                    }

                    if (accountId) {
                        gapQuery = gapQuery.eq('account_id', accountId);
                    }
                    return await gapQuery;
                });

                // Para calcular o saldo inicial de um período passado (Retroativo):
                // Precisamos reverter transações que aconteceram desde 'startDate' até hoje.
                // IMPORTANTE: Só revertemos o que aconteceu APÓS a data do saldo inicial da conta.
                // Se a startDate for anterior à criação da conta, paramos a reversão na data inicial.

                let totalRevertedBalance = 0;

                accountsData.forEach(acc => {
                    let accBalance = Number(acc.balance);

                    // Reverter todas as transações desta conta ocorridas desde startDate até hoje
                    const accTrans = gapTrans?.filter(t =>
                        t.account_id === acc.id &&
                        t.due_date >= startDate &&
                        t.due_date < nextToday
                    ) || [];

                    const accGapIn = accTrans.filter(t => {
                        const method = t.payment_method?.toLowerCase() || '';
                        return t.type?.toLowerCase() === 'income' &&
                            !t.transfer_id &&
                            method !== 'transferencia';
                    }).reduce((accVal, t) => accVal + Number(t.amount), 0);

                    const accGapOut = accTrans.filter(t => {
                        const method = t.payment_method?.toLowerCase() || '';
                        return t.type?.toLowerCase() === 'expense' &&
                            !t.transfer_id &&
                            method !== 'transferencia';
                    }).reduce((accVal, t) => accVal + Number(t.amount), 0);

                    // Revertido = Atual - Ganhos + Gastos nos traz de volta ao passado.
                    totalRevertedBalance += (accBalance - accGapIn + accGapOut);
                });

                projectedBalance = totalRevertedBalance;
            }

            // Filtrar transações do período para exibição e indicadores (stats)
            const trans = transRaw;

            const dayInflow = trans.filter(t => {
                const method = t.payment_method?.toLowerCase() || '';
                return t.type?.toLowerCase() === 'income' &&
                    !t.investment_id &&
                    !t.transfer_id &&
                    method !== 'transferencia';
            }).reduce((acc, t) => acc + Number(t.amount), 0);

            const dayOutflow = trans.filter(t => {
                const method = t.payment_method?.toLowerCase() || '';
                return t.type?.toLowerCase() === 'expense' &&
                    !t.investment_id &&
                    !t.transfer_id &&
                    method !== 'transferencia';
            }).reduce((acc, t) => acc + Number(t.amount), 0);

            const investmentIn = trans.filter(t => (t.type?.toLowerCase() === 'income' || t.type?.toLowerCase() === 'investment') && (t.investment_id || t.type?.toLowerCase() === 'investment')).reduce((acc, t) => acc + Number(t.amount), 0);
            const investmentOut = trans.filter(t => (t.type?.toLowerCase() === 'expense' || t.type?.toLowerCase() === 'investment') && (t.investment_id || t.type?.toLowerCase() === 'investment')).reduce((acc, t) => acc + Number(t.amount), 0);

            const totalIn = trans.filter(t => {
                const method = t.payment_method?.toLowerCase() || '';
                return t.type?.toLowerCase() === 'income' &&
                    !t.transfer_id &&
                    !t.investment_id &&
                    method !== 'transferencia' &&
                    t.type?.toLowerCase() !== 'transfer' &&
                    t.type?.toLowerCase() !== 'investment';
            }).reduce((acc, t) => acc + Number(t.amount), 0);

            const totalOut = trans.filter(t => {
                const method = t.payment_method?.toLowerCase() || '';
                return t.type?.toLowerCase() === 'expense' &&
                    !t.transfer_id &&
                    !t.investment_id &&
                    method !== 'transferencia' &&
                    t.type?.toLowerCase() !== 'transfer' &&
                    t.type?.toLowerCase() !== 'investment';
            }).reduce((acc, t) => acc + Number(t.amount), 0);

            // O saldo final projetado deve incluir o impacto dos investimentos no banco
            const netInvestments = investmentIn - investmentOut;
            const calculatedFinalBalance = projectedBalance + totalIn - totalOut + netInvestments;

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
    }, [startDate, endDate, accountId, isBusiness, activeCompany]);

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
