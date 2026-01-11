
import React, { useState, useEffect, useMemo } from 'react';
import { supabase, withRetry } from '../supabase';
import { useSales } from '../hooks/useSales';
import { useView } from '../contexts/ViewContext';

const DRE: React.FC = () => {
    const { fetchSales, loading: salesLoading } = useSales();
    const { isBusiness } = useView();
    const [salesData, setSalesData] = useState<any[]>([]);
    const [expensesData, setExpensesData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [allPeriods, setAllPeriods] = useState<string[]>([]);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    useEffect(() => {
        const loadPeriods = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            let allDates: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('sales')
                    .select('date')
                    .eq('user_id', session.user.id)
                    .order('date', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) break;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allDates = [...allDates, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                }
                if (page > 50) break;
            }

            if (allDates.length > 0) {
                const p = new Set<string>();
                allDates.forEach((s: any) => {
                    const parts = s.date?.split('-');
                    if (parts?.length === 3) {
                        p.add(`${parseInt(parts[1]) - 1}-${parts[0]}`);
                    }
                });
                const sortedPeriods = Array.from(p).sort((a, b) => {
                    const [am, ay] = a.split('-').map(Number);
                    const [bm, by] = b.split('-').map(Number);
                    return ay !== by ? ay - by : am - bm;
                });
                setAllPeriods(sortedPeriods);
            }
        };
        loadPeriods();
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data } = await fetchSales({ month: selectedMonth, year: selectedYear });
            if (data) setSalesData(data);

            const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const { data: expData } = await supabase
                .from('transactions')
                .select('amount, type, description, date, category_id, categories(name, parent_id)')
                .eq('is_business', true)
                .eq('type', 'expense')
                .gte('date', startDate)
                .lte('date', endDate);

            if (expData) setExpensesData(expData);
            setLoading(false);
        };
        load();
    }, [fetchSales, selectedMonth, selectedYear]);

    const metrics = useMemo(() => {
        // Revenue by Payment Method
        const revByMethod: Record<string, number> = {};
        let totalRev = 0;
        let cmv = 0;

        salesData.forEach(sale => {
            const method = sale.payment_method || 'Outros';
            revByMethod[method] = (revByMethod[method] || 0) + Number(sale.total_amount || 0);
            totalRev += Number(sale.total_amount || 0);

            sale.sale_items?.forEach((item: any) => {
                cmv += (Number(item.products?.cost || 0) * Number(item.quantity || 0));
            });
        });

        // Expenses breakdown
        // We group by category name or specific keywords for Variable vs Fixed
        let fixedExpenses = 0;
        let variableExpenses = 0;

        // Specific sub-metrics from the image (Mocking some based on category names or descriptions)
        const detailedExpenses: any[] = [];

        expensesData.forEach(exp => {
            const catName = (exp.categories?.name || 'Geral').toLowerCase();
            const desc = (exp.description || '').toLowerCase();
            const amount = Number(exp.amount || 0);

            // Image-specific mapping
            const varKeywords = ['comissao', 'royalties', 'taxa de cartao', 'taxa de pix', 'marketing', 'caixa', 'cashback', 'imposto', 'simples nacional'];
            const fixKeywords = ['funcionario', 'salario', 'veiculo', 'sistema', 'software', 'aluguel', 'pro-labore', 'prolabore', 'contador', 'internet', 'telefone', 'energia', 'agua', 'contabilidade'];

            const isVariable = varKeywords.some(k => catName.includes(k) || desc.includes(k));
            const isFixed = fixKeywords.some(k => catName.includes(k) || desc.includes(k));

            if (isVariable) {
                variableExpenses += amount;
                detailedExpenses.push({ description: exp.description || catName, amount, isVariable: true });
            } else {
                fixedExpenses += amount;
                detailedExpenses.push({ description: exp.description || catName, amount, isVariable: false });
            }
        });

        const grossProfit = totalRev - cmv;
        const netProfit = grossProfit - variableExpenses - fixedExpenses;

        return {
            revByMethod,
            totalRev,
            cmv,
            grossProfit,
            variableExpenses,
            fixedExpenses,
            netProfit,
            detailedExpenses
        };
    }, [salesData, expensesData]);

    const Row = ({ label, value, percentage, isHeader, isTotal, isSubTotal, isNegative }: any) => (
        <div className={`flex items-center justify-between py-2 px-4 ${isHeader ? 'bg-[#1e293b] text-white font-black uppercase text-xs' : 'border-b border-[#1e293b] text-slate-300'} ${isTotal ? 'bg-indigo-600/20 font-black' : ''} ${isSubTotal ? 'bg-slate-800/50 font-bold italic' : ''}`}>
            <div className="flex-1 text-xs">
                {label}
            </div>
            <div className={`w-32 text-right text-xs font-bold ${isNegative ? 'text-red-400' : ''}`}>
                {isNegative && value > 0 ? '-' : ''} R$ {Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="w-24 text-right text-[10px] font-medium text-slate-500">
                {percentage ? `${percentage.toFixed(2)}%` : '--'}
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-6 bg-[#0f172a] min-h-screen text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg material-symbols-outlined">receipt_long</span>
                        DRE - DEMONSTRATIVO DE RESULTADO
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">Visão detalhada de faturamento, custos e lucratividade</p>
                </div>

                <div className="flex gap-1 flex-nowrap overflow-x-auto pb-1 max-w-[600px] custom-scrollbar">
                    {allPeriods.length > 0 ? (
                        [...allPeriods].reverse().map(period => {
                            const [m, y] = period.split('-').map(Number);
                            const active = selectedMonth === m && selectedYear === y;
                            return (
                                <button
                                    key={period}
                                    onClick={() => { setSelectedMonth(m); setSelectedYear(y); }}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${active ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white'}`}
                                >
                                    {monthNames[m].substring(0, 3)}/{y}
                                </button>
                            );
                        })
                    ) : null}
                </div>
            </div>

            <div className="bg-[#111a22] rounded-2xl border border-[#233648] overflow-hidden shadow-2xl">
                <div className="p-4 bg-[#1e293b] border-b border-[#233648] flex justify-between items-center font-black text-[10px] uppercase tracking-widest text-slate-400">
                    <span>Descrição</span>
                    <div className="flex gap-16 mr-4">
                        <span>Valor (R$)</span>
                        <span>% s/ Receita</span>
                    </div>
                </div>

                {/* VENDAS */}
                <Row label="VENDAS REALIZADAS" isHeader />
                {Object.entries(metrics.revByMethod).map(([method, val]) => (
                    <Row
                        key={method}
                        label={`Vendas realizadas no ${method}`}
                        value={val}
                        percentage={metrics.totalRev > 0 ? (val / metrics.totalRev) * 100 : 0}
                    />
                ))}
                <Row
                    label="RECEITA BRUTA (R$)"
                    value={metrics.totalRev}
                    percentage={100}
                    isTotal
                />

                <div className="h-4 bg-[#0f172a]/50"></div>

                {/* IMPOSTOS & CMV */}
                <Row label="DEDUÇÕES E CUSTOS" isHeader />
                <Row
                    label="Impostos sobre vendas (-)"
                    value={0} // To be implemented if we add tax field
                    percentage={0}
                    isNegative
                />
                <Row
                    label="RECEITA SEM IMPOSTOS (R$)"
                    value={metrics.totalRev}
                    percentage={100}
                    isSubTotal
                />
                <Row
                    label="Custo de mercadoria vendido (CMV) (-)"
                    value={metrics.cmv}
                    percentage={metrics.totalRev > 0 ? (metrics.cmv / metrics.totalRev) * 100 : 0}
                    isNegative
                />
                <Row
                    label="MARGEM BRUTA"
                    value={metrics.grossProfit}
                    percentage={metrics.totalRev > 0 ? (metrics.grossProfit / metrics.totalRev) * 100 : 0}
                    isTotal
                />

                <div className="h-4 bg-[#0f172a]/50"></div>

                {/* DESPESAS VARIÁVEIS */}
                <Row label="DESPESAS VARIÁVEIS" isHeader />
                {metrics.detailedExpenses.filter(e => e.isVariable).map((exp, i) => (
                    <Row
                        key={i}
                        label={exp.description}
                        value={exp.amount}
                        percentage={metrics.totalRev > 0 ? (exp.amount / metrics.totalRev) * 100 : 0}
                        isNegative
                    />
                ))}
                <Row
                    label="TOTAL DESPESAS VARIÁVEIS"
                    value={metrics.variableExpenses}
                    percentage={metrics.totalRev > 0 ? (metrics.variableExpenses / metrics.totalRev) * 100 : 0}
                    isSubTotal
                    isNegative
                />

                <div className="h-4 bg-[#0f172a]/50"></div>

                {/* DESPESAS FIXAS */}
                <Row label="DESPESAS FIXAS" isHeader />
                {metrics.detailedExpenses.filter(e => !e.isVariable).map((exp, i) => (
                    <Row
                        key={i}
                        label={exp.description}
                        value={exp.amount}
                        percentage={metrics.totalRev > 0 ? (exp.amount / metrics.totalRev) * 100 : 0}
                        isNegative
                    />
                ))}
                <Row
                    label="TOTAL DESPESAS FIXAS"
                    value={metrics.fixedExpenses}
                    percentage={metrics.totalRev > 0 ? (metrics.fixedExpenses / metrics.totalRev) * 100 : 0}
                    isSubTotal
                    isNegative
                />

                <div className="h-8 bg-[#0f172a]"></div>

                {/* RESULTADO FINAL */}
                <div className="bg-indigo-600 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Resultado do Exercício</p>
                            <h2 className="text-4xl font-black">LUCRO LÍQUIDO</h2>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-5xl font-black">
                            R$ {metrics.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm font-bold opacity-80 mt-1">
                            Margem Líquida: {((metrics.netProfit / metrics.totalRev) * 100).toFixed(2)}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DRE;
