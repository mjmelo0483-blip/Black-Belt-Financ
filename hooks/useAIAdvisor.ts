import { useState, useCallback } from 'react';
import { supabase, withRetry } from '../supabase';
import { useView } from '../contexts/ViewContext';
import { useCompany } from '../contexts/CompanyContext';

export interface AIInsight {
    type: 'saving' | 'warning' | 'opportunity' | 'tip';
    title: string;
    description: string;
    impact?: string;
}

export const useAIAdvisor = () => {
    const { isBusiness } = useView();
    const { activeCompany } = useCompany();
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<AIInsight[]>([]);

    const generateInsights = useCallback(async (month: number, year: number) => {
        setLoading(true);
        try {
            // 1. Gather comprehensive data for AI context
            const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
            const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];
            
            const [transactionsRes, budgetsRes, accountsRes] = await Promise.all([
                supabase.from('transactions').select('*, categories(name)').eq('is_business', isBusiness).gte('due_date', startOfMonth).lte('due_date', endOfMonth).filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null),
                supabase.from('budgets').select('*, categories(name)').eq('is_business', isBusiness).eq('month', startOfMonth).filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null),
                supabase.from('accounts').select('*').eq('is_business', isBusiness).filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null)
            ]);

            // 2. Prepare context for the AI
            // We'll calculate a summary here to send to the Edge Function
            const txs = transactionsRes.data || [];
            const budgets = budgetsRes.data || [];
            const accounts = accountsRes.data || [];

            const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
            const totalExpenses = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
            const balance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

            const categoryTotal: Record<string, number> = {};
            txs.filter(t => t.type === 'expense').forEach(t => {
                const cat = t.categories?.name || 'Variavel';
                categoryTotal[cat] = (categoryTotal[cat] || 0) + Number(t.amount);
            });

            const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

            const topExpenses = Object.entries(categoryTotal)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([name, amount]) => `${name}: ${formatBRL(amount)}`);

            const overBudgets = budgets
                .map(b => {
                    const spent = txs.filter(t => t.category_id === b.category_id).reduce((acc, t) => acc + Number(t.amount), 0);
                    return { name: b.categories?.name, limit: b.amount, spent };
                })
                .filter(b => b.spent > b.limit);

            const context = {
                type: isBusiness ? 'Empresa' : 'Pessoa Física',
                name: isBusiness ? activeCompany?.name : 'Usuário',
                balance,
                totalIncome,
                totalExpenses,
                topExpenses,
                overBudgets,
                month: month + 1,
                year
            };

            // 3. Call Supabase Edge Function (or simulate for now if function doesn't exist)
            // Note: In a production environment, you would call:
            // const { data, error } = await supabase.functions.invoke('financial-advisor', { body: { context } });
            
            // SIMULATION for demonstration if Edge Function is not yet deployed
            // In a real scenario, this would come from an LLM.
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate AI thinking
            
            const mockedInsights: AIInsight[] = [];
            
            if (totalExpenses > totalIncome) {
                mockedInsights.push({
                    type: 'warning',
                    title: 'Déficit Mensal Detectado',
                    description: `Suas despesas (${formatBRL(totalExpenses)}) superaram suas receitas (${formatBRL(totalIncome)}).`,
                    impact: 'Redução de reservas financeiras.'
                });
            }

            if (overBudgets.length > 0) {
                mockedInsights.push({
                    type: 'saving',
                    title: 'Ajuste de Orçamento Necessário',
                    description: `Você ultrapassou o orçamento em ${overBudgets.length} categorias, especialmente em ${overBudgets[0].name}.`,
                    impact: `Excesso de gastos de ${formatBRL(overBudgets[0].spent - overBudgets[0].limit)}`
                });
            }

            if (balance > totalExpenses * 3) {
                mockedInsights.push({
                    type: 'opportunity',
                    title: 'Oportunidade de Investimento',
                    description: 'Seu saldo em caixa é suficiente para cobrir mais de 3 meses de despesas. Considere investir o excedente.',
                    impact: 'Maximize sua rentabilidade passiva.'
                });
            } else {
                mockedInsights.push({
                    type: 'tip',
                    title: 'Foco em Fluxo de Caixa',
                    description: `Foque em reduzir as despesas de ${topExpenses[0]?.split(':')[0] || 'maior peso'} para melhorar sua margem este mês.`,
                    impact: 'Aumento imediato da liquidez.'
                });
            }

            setInsights(mockedInsights);

        } catch (error) {
            console.error('AI Advisor Error:', error);
        } finally {
            setLoading(false);
        }
    }, [isBusiness, activeCompany]);

    return {
        insights,
        loading,
        generateInsights
    };
};
