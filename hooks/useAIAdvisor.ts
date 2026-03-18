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
    const [extraContext, setExtraContext] = useState<string>('');

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

            let allSales: any[] = [];
            if (isBusiness) {
                let page = 0;
                let hasMore = true;
                while (hasMore) {
                    const { data, error } = await supabase.from('sales')
                        .select('*, sale_items(total_price, quantity, products(name))')
                        .gte('date', startOfMonth)
                        .lte('date', endOfMonth)
                        .filter('company_id', 'eq', activeCompany?.id)
                        .range(page * 1000, (page + 1) * 1000 - 1);
                    
                    if (error) {
                        console.error("AI Advisor Sales Fetch Error:", error);
                        break;
                    }
                    if (!data || data.length === 0) {
                        hasMore = false;
                    } else {
                        allSales = [...allSales, ...data];
                        if (data.length < 1000) hasMore = false;
                        else page++;
                    }
                    if (page > 50) break; // Limit safely
                }
            }

            // 2. Prepare context for the AI
            const txs = transactionsRes.data || [];
            const budgets = budgetsRes.data || [];
            const accounts = accountsRes.data || [];
            const sales = allSales;

            const totalIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
            const totalExpenses = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
            const balance = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

            let totalSalesRevenue = 0;
            let totalSalesCount = 0;
            let salesExtra = "";

            if (isBusiness) {
                const storeMap: Record<string, number> = {};
                const hourMap: Record<string, number> = {};
                const dayMap: Record<number, number> = {};
                const prodMap: Record<string, number> = {};

                sales.forEach(sale => {
                    let sTotal = Number(sale.total_amount || 0);
                    let itemSum = 0;
                    if (sale.sale_items && sale.sale_items.length > 0) {
                        sale.sale_items.forEach((it: any) => {
                            const lineTotal = Number(it.total_price || 0) || (Number(it.unit_price || 0) * Number(it.quantity || 1));
                            itemSum += lineTotal;
                            const prodName = it.products?.name || 'Desconhecido';
                            prodMap[prodName] = (prodMap[prodName] || 0) + Number(it.quantity || 1);
                        });
                    }
                    const rev = Math.max(sTotal, itemSum);
                    totalSalesRevenue += rev;
                    totalSalesCount++;

                    const stName = sale.store_name?.trim() || 'Principal';
                    storeMap[stName] = (storeMap[stName] || 0) + rev;

                    if (sale.time) {
                        const timeStr = String(sale.time).trim();
                        const isPM = timeStr.toLowerCase().includes('pm');
                        const isAM = timeStr.toLowerCase().includes('am');
                        let hour = 12;

                        let hourPart = "";
                        if (timeStr.includes(':')) {
                            const segments = timeStr.split(':');
                            const match = segments[0].match(/(\d{1,2})$/);
                            if (match) hourPart = match[1];
                        } else if (!isNaN(Number(timeStr)) && Number(timeStr) > 0 && Number(timeStr) < 1) {
                            const totalSeconds = Math.round(Number(timeStr) * 86400);
                            hour = Math.floor(totalSeconds / 3600);
                            hourPart = "SET";
                        }

                        if (hourPart && hourPart !== "SET") {
                            hour = parseInt(hourPart, 10);
                            if (isPM && hour < 12) hour += 12;
                            if (isAM && hour === 12) hour = 0;
                        }

                        let block = 'Madrugada (00h-06h)';
                        if (hour >= 6 && hour < 12) block = 'Manhã (06h-12h)';
                        else if (hour >= 12 && hour < 18) block = 'Tarde (12h-18h)';
                        else if (hour >= 18) block = 'Noite (18h-24h)';
                        hourMap[block] = (hourMap[block] || 0) + rev;
                    }

                    if (sale.date) {
                         const obj = new Date(sale.date + 'T12:00:00');
                         const d = obj.getDay();
                         dayMap[d] = (dayMap[d] || 0) + rev;
                    }
                });

                const bestStore = Object.entries(storeMap).sort((a,b)=>b[1]-a[1]);
                const bestHour = Object.entries(hourMap).sort((a,b)=>b[1]-a[1]);
                const bestDay = Object.entries(dayMap).sort((a,b)=>b[1]-a[1]);
                const daysStr = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
                const topProducts = Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x => `${x[0]} (${x[1]} un)`).join(', ');

                salesExtra = `DADOS EXTRAS DE VENDAS PARA CONSULTA NO CHAT (Use essas informações se for perguntado sobre análises de vendas, volume ou desempenho geral):
- Ranking de Faturamento de Lojas: ${bestStore.map(s => `${s[0]} (R$ ${s[1].toFixed(2)})`).join(', ')}.
- Faturamento por Faixa de Horário: ${bestHour.map(s => `${s[0]} (R$ ${s[1].toFixed(2)})`).join(', ')}.
- Faturamento por Dia da Semana: ${bestDay.map(s => `${daysStr[Number(s[0])]} (R$ ${s[1].toFixed(2)})`).join(', ')}.
- Top 10 Produtos Mais Vendidos no Mês (Volume): ${topProducts}.`;
            }
            
            setExtraContext(salesExtra);

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
            const today = new Date();
            const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

            if (totalExpenses > realIncome && totalExpenses > 0) {
                generatedInsights.push({
                    type: 'warning',
                    title: isCurrentMonth ? 'Fluxo de Caixa em Alerta' : 'Alerta de Fluxo de Caixa Negativo',
                    description: isBusiness 
                        ? (isCurrentMonth 
                            ? `No momento, suas despesas (${formatBRL(totalExpenses)}) superam suas receitas (${formatBRL(realIncome)}). Falta faturamento para equilibrar o mês.`
                            : `A operação teve despesas (${formatBRL(totalExpenses)}) maiores que as receitas (${formatBRL(realIncome)}) neste mês. A empresa fechou com déficit de ${formatBRL(totalExpenses - realIncome)}.`)
                        : (isCurrentMonth
                            ? `Seus gastos no mês (${formatBRL(totalExpenses)}) já superaram sua renda (${formatBRL(realIncome)}). Reduza o ritmo para não terminar no vermelho.`
                            : `Seus gastos pessoais (${formatBRL(totalExpenses)}) superaram sua renda (${formatBRL(realIncome)}) neste mês. Você fechou no vermelho em ${formatBRL(totalExpenses - realIncome)}.`),
                    impact: 'Dificuldade iminente no cumprimento de obrigações de curto prazo.'
                });
            } else if (realIncome > totalExpenses && realIncome > 0) {
                const margin = ((realIncome - totalExpenses) / realIncome) * 100;
                generatedInsights.push({
                    type: margin > 20 ? 'saving' : 'tip',
                    title: margin > 20 ? 'Excelente Geração de Caixa' : 'Margem Positiva, mas Apertada',
                    description: margin > 20 
                        ? (isBusiness 
                            ? `A empresa operou com uma margem de segurança de ${margin.toFixed(1)}%. Sobraram ${formatBRL(realIncome - totalExpenses)} de lucro que podem ser direcionados para caixa e investimentos.`
                            : `Você operou com uma taxa de poupança (saving rate) de ${margin.toFixed(1)}%. Sobrou ${formatBRL(realIncome - totalExpenses)} de renda livre para investimentos.`)
                        : (isBusiness
                            ? `O lucro da operação foi de apenas ${margin.toFixed(1)}% (${formatBRL(realIncome - totalExpenses)}). É recomendado aumentar o faturamento ou cortar despesas operacionais não essenciais.`
                            : `Sua sobra livre de caixa foi de apenas ${margin.toFixed(1)}% (${formatBRL(realIncome - totalExpenses)}). Crie fontes extras de renda ou reduza custos supérfluos.`),
                    impact: margin > 20 ? 'Crescimento de patrimônio garantido.' : 'Aumento incremental do caixa livre.'
                });
            }

            // Insight 2: Expense Concentration
            if (topExpense && totalExpenses > 0) {
                const concentration = (topExpense[1] / totalExpenses) * 100;
                if (concentration > 35) {
                    generatedInsights.push({
                        type: 'warning',
                        title: 'Alta Concentração de Gastos',
                        description: isBusiness
                            ? `A rubrica "${topExpense[0]}" consome ${concentration.toFixed(1)}% de todas as despesas da empresa (${formatBRL(topExpense[1]!)}). Qualquer reajuste aqui afeta os custos enormemente.`
                            : `Sua categoria "${topExpense[0]}" consome ${concentration.toFixed(1)}% de todo o seu custo de vida (${formatBRL(topExpense[1]!)}). Cuidado com o desequilíbrio no padrão de vida.`,
                        impact: isBusiness ? 'Risco de dependência estrutural na empresa.' : 'Comprometimento excessivo do orçamento pessoal.'
                    });
                } else {
                    const savingsImpact = topExpense[1]! * 0.05;
                    generatedInsights.push({
                        type: 'opportunity',
                        title: `Foco Estratégico em ${topExpense[0]}`,
                        description: isBusiness
                            ? `Como "${topExpense[0]}" é a maior despesa da empresa (${formatBRL(topExpense[1]!)}), renegociar contratos ou processos para cortar 5% geraria economia de ${formatBRL(savingsImpact)}/mês.`
                            : `Como "${topExpense[0]}" é seu maior gasto pessoal (${formatBRL(topExpense[1]!)}), cortar 5% no consumo geraria economia livre de ${formatBRL(savingsImpact)}/mês.`,
                        impact: isBusiness ? 'Aumento imediato do Lucro Líquido na operação.' : 'Mais dinheiro sobrando no bolso ao final do mês.'
                    });
                }
            }

            // Insight 3: Emergency Runway
            const averageMonthlyBurn = totalExpenses > 0 ? totalExpenses : 1;
            const monthsRunway = balance / averageMonthlyBurn;
            
            if (monthsRunway < 1.5 && balance > 0) {
                generatedInsights.push({
                    type: 'warning',
                    title: isBusiness ? 'Caixa Operacional Crítico' : 'Fundo de Emergência Crítico',
                    description: isBusiness
                        ? `Seu saldo líquido atual garante apenas ${Math.floor(monthsRunway * 30)} dias de sobrevivência da operação do negócio. É prioridade 1 reter lucro ou captar capital barato.`
                        : `Suas economias cobrem apenas ${Math.floor(monthsRunway * 30)} dias do seu custo de vida atual. Monte com urgência uma reserva equivalente a 6 meses de gastos.`,
                    impact: isBusiness ? 'Alto risco de insolvência na empresa.' : 'Vulnerabilidade absoluta a imprevistos.'
                });
            } else if (monthsRunway >= 6) {
                generatedInsights.push({
                    type: 'opportunity',
                    title: 'Capital Ocioso Detectado',
                    description: isBusiness
                        ? `Sua empresa possui ${monthsRunway.toFixed(1)} meses de capital estacionado no caixa. Mantenha 3 meses de segurança e aplique o resto para mitigar inflação.`
                        : `Você atingiu notáveis ${monthsRunway.toFixed(1)} meses de custos de vida como reserva. Estude fazer aplicações de rendimento de maior liquidez e retorno.`,
                    impact: 'Perda do poder de compra pela desvalorização do dinheiro parado.'
                });
            }

            // Insight 4: Dynamic Budget Warnings
            if (overBudgets.length > 0) {
                const totalOver = overBudgets.reduce((acc, b) => acc + (b.spent - b.limit), 0);
                generatedInsights.push({
                    type: 'warning',
                    title: 'Rompimento de Orçamento',
                    description: isBusiness
                        ? `Cuidado! A empresa estourou limites traçados em ${overBudgets.length} contas de despesas (ex: ${overBudgets[0].name}). O estouro somado é de ${formatBRL(totalOver)}.`
                        : `Atenção: Você gastou a mais do que orçou originalmente em ${overBudgets.length} categorias (ex: ${overBudgets[0].name}). Estouro de ${formatBRL(totalOver)}.`,
                    impact: isBusiness ? 'Desvio fatal do planejamento de resultados anuais da empresa.' : 'Dificuldade de atingir as metas financeiras estabelecidas.'
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

            // Insight 6: Específico 2M - Projeções
            if (isBusiness && activeCompany?.name.toLowerCase().includes('2m')) {
                const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
                
                if (isCurrentMonth && totalSalesRevenue > 0) {
                    const daysElapsed = today.getDate();
                    const daysRemaining = Math.max(0, totalDaysInMonth - daysElapsed);
                    const dailyAverage = totalSalesRevenue / Math.max(1, daysElapsed);
                    const projectedTotal = totalSalesRevenue + (dailyAverage * daysRemaining);
                    
                    // Calculo mais refinado de Resultado Projetado baseado no Fluxo de Caixa Atual
                    const burnoutExpenses = totalExpenses; // Gastos já ocorridos
                    const projectedRawProfit = (projectedTotal * 0.40); // Margem de contribuição simulada realista (40%)
                    const finalProjectedResult = projectedRawProfit - burnoutExpenses;
                    
                    generatedInsights.push({
                        type: finalProjectedResult > 0 ? 'saving' : 'warning',
                        title: 'Projeção Estratégica 2M',
                        description: `Com média diária de ${formatBRL(dailyAverage)}, você tende a fechar o mês com ${formatBRL(projectedTotal)} de faturamento. Considerando seus gastos fixos e variáveis projetados, a estimativa do Resultado Final é de ${formatBRL(finalProjectedResult)}. ${daysRemaining > 0 ? `Temos ${daysRemaining} dias para acelerar as vendas e garantir um lucro maior.` : 'O mês está em fechamento.'}`,
                        impact: finalProjectedResult > 0 ? 'Caminho sólido para fechar no lucro.' : 'Necessidade de aumento imediato de ticket ou volume.'
                    });
                }
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
        loading,
        insights,
        generateInsights,
        extraContext
    };
};
