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
            
            const [transactionsRes, budgetsRes, accountsRes, salesRes] = await Promise.all([
                supabase.from('transactions').select('*, categories(name)').eq('is_business', isBusiness).gte('due_date', startOfMonth).lte('due_date', endOfMonth).filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null),
                supabase.from('budgets').select('*, categories(name)').eq('is_business', isBusiness).eq('month', startOfMonth).filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null),
                supabase.from('accounts').select('*').eq('is_business', isBusiness).filter('company_id', isBusiness ? 'eq' : 'is', isBusiness ? activeCompany?.id : null),
                isBusiness ? supabase.from('sales').select('*, sale_items(total_price, quantity)').gte('date', startOfMonth).lte('date', endOfMonth).filter('company_id', 'eq', activeCompany?.id) : Promise.resolve({ data: [] })
            ]);

            // 2. Prepare context for the AI
            const txs = transactionsRes.data || [];
            const budgets = budgetsRes.data || [];
            const accounts = accountsRes.data || [];
            const sales = salesRes.data || [];

            const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
            const totalExpenses = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
            const balance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

            let totalSalesRevenue = 0;
            let totalSalesCount = 0;
            if (isBusiness) {
                sales.forEach(sale => {
                    let sTotal = Number(sale.total_amount || 0);
                    let itemSum = 0;
                    if (sale.sale_items && sale.sale_items.length > 0) {
                        sale.sale_items.forEach((it: any) => itemSum += Number(it.total_price || 0));
                    }
                    totalSalesRevenue += Math.max(sTotal, itemSum);
                    totalSalesCount++;
                });
            }

            const categoryTotal: Record<string, number> = {};
            txs.filter(t => t.type === 'expense').forEach(t => {
                const cat = t.categories?.name || 'Variavel';
                categoryTotal[cat] = (categoryTotal[cat] || 0) + Number(t.amount);
            });

            const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

            const sortedExpenses = Object.entries(categoryTotal).sort(([, a], [, b]) => b - a);
            const topExpense = sortedExpenses.length > 0 ? sortedExpenses[0] : null;

            const overBudgets = budgets
                .map(b => {
                    const spent = txs.filter(t => t.category_id === b.category_id).reduce((acc, t) => acc + Number(t.amount), 0);
                    return { name: b.categories?.name, limit: b.amount, spent };
                })
                .filter(b => b.spent > b.limit);

            await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate Deep Analysis
            
            const generatedInsights: AIInsight[] = [];
            
            // Insight 1: Cashflow Health
            const realIncome = isBusiness ? Math.max(totalIncome, totalSalesRevenue) : totalIncome;
            if (totalExpenses > realIncome && totalExpenses > 0) {
                generatedInsights.push({
                    type: 'warning',
                    title: 'Alerta de Fluxo de Caixa Negativo',
                    description: `Suas despesas (${formatBRL(totalExpenses)}) superaram suas entradas (${formatBRL(realIncome)}) neste mês. Você está operando com um déficit de ${formatBRL(totalExpenses - realIncome)}.`,
                    impact: 'Corrosão acelerada da sua margem de liquidez.'
                });
            } else if (realIncome > totalExpenses && realIncome > 0) {
                const margin = ((realIncome - totalExpenses) / realIncome) * 100;
                generatedInsights.push({
                    type: margin > 20 ? 'saving' : 'tip',
                    title: margin > 20 ? 'Excelente Geração de Caixa' : 'Margem Positiva, mas Apertada',
                    description: margin > 20 
                        ? `Você operou com uma margem de segurança de ${margin.toFixed(1)}%. Sobraram ${formatBRL(realIncome - totalExpenses)} que podem ser direcionados para reserva de oportunidade.`
                        : `Sua margem livre foi de apenas ${margin.toFixed(1)}%. Você tem um superávit de ${formatBRL(realIncome - totalExpenses)}. Aumentar o faturamento ou cortar gastos não essenciais é recomendado.`,
                    impact: margin > 20 ? 'Crescimento de patrimônio garantido.' : 'Aumento incremental do caixa livre.'
                });
            }

            // Insight 2: Expense Concentration
            if (topExpense && totalExpenses > 0) {
                const concentration = (topExpense[1] / totalExpenses) * 100;
                if (concentration > 35) {
                    generatedInsights.push({
                        type: 'warning',
                        title: 'Alta Concentração de Despesas',
                        description: `A categoria "${topExpense[0]}" representa ${concentration.toFixed(1)}% de todas as suas despesas (${formatBRL(topExpense[1]!)}). Qualquer reajuste nesta linha afetará dramaticamente seus custos totais.`,
                        impact: 'Risco de dependência de fornecedor ou ineficiência estrutural.'
                    });
                } else {
                    const savingsImpact = topExpense[1]! * 0.05;
                    generatedInsights.push({
                        type: 'opportunity',
                        title: `Foco Estratégico em ${topExpense[0]}`,
                        description: `Como "${topExpense[0]}" é seu maior custo (${formatBRL(topExpense[1]!)}), renegociar contratos para uma redução de apenas 5% geraria uma economia direta de ${formatBRL(savingsImpact)} ao mês.`,
                        impact: 'Aumento imediato do Lucro Líquido sem impacto em vendas.'
                    });
                }
            }

            // Insight 3: Emergency Runway
            const averageMonthlyBurn = totalExpenses > 0 ? totalExpenses : 1;
            const monthsRunway = balance / averageMonthlyBurn;
            
            if (monthsRunway < 1.5 && balance > 0) {
                generatedInsights.push({
                    type: 'warning',
                    title: 'Reserva de Emergência Crítica',
                    description: `Seu saldo líquido atual garante apenas ${Math.floor(monthsRunway * 30)} dias de operação. É vital aumentar as reservas para evitar tomada de crédito emergencial (empréstimos) nos próximos ciclos.`,
                    impact: 'Alto risco de insolvência a curto prazo.'
                });
            } else if (monthsRunway >= 6) {
                generatedInsights.push({
                    type: 'opportunity',
                    title: 'Capital Custo-Zero Estagnado',
                    description: `Sua empresa / conta possui ${monthsRunway.toFixed(1)} meses de capital imobilizado no saldo. Mantenha 3 a 4 meses como segurança e aplique o restante em investimentos com liquidez diária.`,
                    impact: 'Geração de renda passiva que atenua a inflação.'
                });
            }

            // Insight 4: Dynamic Budget Warnings
            if (overBudgets.length > 0) {
                const totalOver = overBudgets.reduce((acc, b) => acc + (b.spent - b.limit), 0);
                generatedInsights.push({
                    type: 'warning',
                    title: 'Rompimento de Limites de Orçamento',
                    description: `Excedeu o teto previsto em ${overBudgets.length} categorias (ex: ${overBudgets[0].name}). O estouro combinado soma ${formatBRL(totalOver)}.`,
                    impact: 'Desvio no planejamento financeiro anual.'
                });
            }

            // Insight 5: Business specific
            if (isBusiness && totalSalesCount > 0) {
                const averageTicket = totalSalesRevenue / totalSalesCount;
                generatedInsights.push({
                    type: 'tip',
                    title: 'Inteligência Comercial (Ticket Médio)',
                    description: `Seu ticket médio neste mês é de ${formatBRL(averageTicket)}. Tentar estratégias de "Cross-sell" para aumentar esse valor em R$ 10 aumentaria o faturamento total em R$ ${(totalSalesCount * 10).toLocaleString('pt-BR')} no mesmo volume de vendas.`,
                    impact: 'Crescimento de receita sem aumento de Custo de Aquisição (CAC).'
                });
            }

            // Fallback general tip if metrics are too small
            if (generatedInsights.length === 0) {
                generatedInsights.push({
                    type: 'tip',
                    title: 'Início de Ciclo Constante',
                    description: 'Poucas movimentações detectadas com precisão extrema. Recomendamos manter a classificação das suas despesas rigorosamente em dia para receber relatórios mais profundos.',
                    impact: 'Melhor previsibilidade financeira.'
                });
            }

            setInsights(generatedInsights.slice(0, 4)); // Return top 4 best insights

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
