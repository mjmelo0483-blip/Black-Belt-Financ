
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

    interface DREMetrics {
        revByMethod: Record<string, number>;
        totalRev: number;
        impostos: number;
        rl: number;
        cmv: number;
        grossMargin: number;
        perdaEstoque: number;
        marginAfterLoss: number;
        varGroups: Record<string, { label: string; amount: number }>;
        totalVar: number;
        fixGroups: Record<string, { label: string; amount: number }>;
        totalFix: number;
        netProfit: number;
    }

    const metrics = useMemo<DREMetrics>(() => {
        // Revenue by Payment Method
        const revByMethod: Record<string, number> = { 'Crédito': 0, 'Débito': 0, 'PIX': 0, 'Outros': 0 };
        let totalRev = 0;
        let cmv = 0;

        salesData.forEach(sale => {
            let method = sale.payment_method || 'Outros';
            if (method.toLowerCase().includes('credito')) method = 'Crédito';
            else if (method.toLowerCase().includes('debito')) method = 'Débito';
            else if (method.toLowerCase().includes('pix')) method = 'PIX';
            else method = 'Outros';

            revByMethod[method] = (revByMethod[method] || 0) + Number(sale.total_amount || 0);
            totalRev += Number(sale.total_amount || 0);

            sale.sale_items?.forEach((item: any) => {
                cmv += (Number(item.products?.cost || 0) * Number(item.quantity || 0));
            });
        });

        // Detailed Categorization for Expenses
        let impostos = 0;
        let perdaEstoque = 0;

        const varGroups: Record<string, { label: string; amount: number }> = {
            cashback: { label: 'Comissão paga ao condominio (cashback)', amount: 0 },
            royalties: { label: 'Royalties', amount: 0 },
            tarifaCartao: { label: 'Tarifa de cartão', amount: 0 },
            tarifaPix: { label: 'Tarifa de Pix', amount: 0 },
            marketing: { label: 'Investimento Marketing da loja', amount: 0 },
            diversas: { label: 'Despesas diversas da loja', amount: 0 },
        };

        const fixGroups: Record<string, { label: string; amount: number }> = {
            funcionarios: { label: 'Funcionários', amount: 0 },
            manutencaoVeiculo: { label: 'Manutenção de veículo', amount: 0 },
            taxaSistema: { label: 'Taxa de uso do sistema', amount: 0 },
            aluguelContainer: { label: 'Aluguel de container', amount: 0 },
            combustivel: { label: 'Despesa com combustível', amount: 0 },
            aluguelEscritorio: { label: 'Aluguel de Escritório', amount: 0 },
            tef: { label: 'Elgin+TEF+LgoPass', amount: 0 },
            aluguelLoja: { label: 'Aluguel do espaço da loja', amount: 0 },
            contabilidade: { label: 'Despesa com contabilidade', amount: 0 },
            internet: { label: 'Despesa com internet', amount: 0 },
            energia: { label: 'Despesa com energia elétrica', amount: 0 },
            outros: { label: 'Outros', amount: 0 },
        };

        expensesData.forEach(exp => {
            const catName = (exp.categories?.name || 'Geral').toLowerCase();
            const desc = (exp.description || '').toLowerCase();
            const amount = Number(exp.amount || 0);

            // Mapping logic based on keywords
            if (catName.includes('imposto') || desc.includes('imposto') || desc.includes('simples nacional')) {
                impostos += amount;
            } else if (catName.includes('perda') || desc.includes('perda') || desc.includes('furto') || desc.includes('vencido') || desc.includes('danificado')) {
                perdaEstoque += amount;
            }
            // Variable Groups
            else if (desc.includes('cashback') || desc.includes('condominio')) varGroups.cashback.amount += amount;
            else if (catName.includes('royalties') || desc.includes('royalties')) varGroups.royalties.amount += amount;
            else if (desc.includes('tarifa de cartao') || desc.includes('taxa de cartao') || desc.includes('maquininha')) varGroups.tarifaCartao.amount += amount;
            else if (desc.includes('tarifa de pix') || desc.includes('taxa de pix')) varGroups.tarifaPix.amount += amount;
            else if (catName.includes('marketing') || desc.includes('marketing') || desc.includes('propaganda')) varGroups.marketing.amount += amount;
            else if (catName.includes('diversas') || catName.includes('loja') || desc.includes('loja')) varGroups.diversas.amount += amount;
            // Fixed Groups
            else if (catName.includes('funcionario') || catName.includes('salario') || desc.includes('pgto') || desc.includes('salario')) fixGroups.funcionarios.amount += amount;
            else if (desc.includes('veiculo') || desc.includes('carro') || desc.includes('moto')) fixGroups.manutencaoVeiculo.amount += amount;
            else if (desc.includes('sistema') || desc.includes('software') || desc.includes('mensalidade')) fixGroups.taxaSistema.amount += amount;
            else if (desc.includes('container')) fixGroups.aluguelContainer.amount += amount;
            else if (desc.includes('combustivel') || desc.includes('gasolina') || desc.includes('diesel')) fixGroups.combustivel.amount += amount;
            else if (desc.includes('escritorio')) fixGroups.aluguelEscritorio.amount += amount;
            else if (desc.includes('elgin') || desc.includes('tef') || desc.includes('lgopass')) fixGroups.tef.amount += amount;
            else if (desc.includes('aluguel do espaço') || desc.includes('aluguel da loja')) fixGroups.aluguelLoja.amount += amount;
            else if (catName.includes('contabil') || desc.includes('contador')) fixGroups.contabilidade.amount += amount;
            else if (desc.includes('internet') || desc.includes('wi-fi')) fixGroups.internet.amount += amount;
            else if (desc.includes('energia') || desc.includes('luz') || desc.includes('equatorial')) fixGroups.energia.amount += amount;
            else fixGroups.outros.amount += amount;
        });

        const totalVar = Object.values(varGroups).reduce((acc, g) => acc + g.amount, 0);
        const totalFix = Object.values(fixGroups).reduce((acc, g) => acc + g.amount, 0);

        const rl = totalRev - impostos;
        const grossMargin = rl - cmv;
        const marginAfterLoss = grossMargin - perdaEstoque;
        const netProfit = marginAfterLoss - totalVar - totalFix;

        return {
            revByMethod,
            totalRev,
            impostos,
            rl,
            cmv,
            grossMargin,
            perdaEstoque,
            marginAfterLoss,
            varGroups,
            totalVar,
            fixGroups,
            totalFix,
            netProfit
        };
    }, [salesData, expensesData]);

    const Row = ({ label, value, percentage, isTotal, isSubTotal, isNegative, isFinal }: any) => (
        <div className={`flex items-center justify-between px-4 ${isTotal || isFinal ? 'bg-[#1e293b] text-white font-black uppercase text-xs border-y border-[#334155] py-2.5' : 'border-b border-[#1e293b] text-slate-300 py-1.5'} ${isSubTotal ? 'bg-slate-800/30 font-bold' : ''}`}>
            <div className={`flex-1 text-[11px] ${isTotal || isFinal || isSubTotal ? 'font-black' : ''} ${isFinal ? 'text-sm' : ''}`}>
                {label}
            </div>
            <div className={`w-32 text-right font-bold ${isFinal ? 'text-sm' : 'text-[11px]'} ${isNegative ? 'text-red-400' : (isFinal ? (value >= 0 ? 'text-emerald-400' : 'text-red-500') : '')}`}>
                {isNegative && value > 0 ? '-' : ''} R$ {Math.abs(Number(value)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="w-24 text-right text-[10px] font-medium text-slate-500">
                {percentage !== undefined ? `${percentage.toFixed(2)}%` : '--'}
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

                {/* RECEITA */}
                {Object.entries(metrics.revByMethod).map(([method, val]) => (
                    <Row
                        key={method}
                        label={`Vendas realizadas no ${method}`}
                        value={val}
                        percentage={Number(metrics.totalRev) > 0 ? (Number(val) / Number(metrics.totalRev)) * 100 : 0}
                    />
                ))}
                <Row
                    label="RECEITA BRUTA (RB)"
                    value={metrics.totalRev}
                    percentage={100}
                    isTotal
                />

                <Row
                    label="Impostos sobre as vendas"
                    value={metrics.impostos}
                    percentage={metrics.totalRev > 0 ? (metrics.impostos / metrics.totalRev) * 100 : 0}
                    isNegative
                />
                <Row
                    label="RECEITA SEM IMPOSTOS (RL)"
                    value={metrics.rl}
                    percentage={metrics.totalRev > 0 ? (metrics.rl / metrics.totalRev) * 100 : 0}
                    isSubTotal
                />

                <Row
                    label="Custos de mercadoria vendida (CMV)"
                    value={metrics.cmv}
                    percentage={metrics.totalRev > 0 ? (metrics.cmv / metrics.totalRev) * 100 : 0}
                    isNegative
                />
                <Row
                    label="MARGEM BRUTA"
                    value={metrics.grossMargin}
                    percentage={metrics.totalRev > 0 ? (metrics.grossMargin / metrics.totalRev) * 100 : 0}
                    isTotal
                />

                <Row
                    label="Perda do estoque (Furto, vencido, danificado)"
                    value={metrics.perdaEstoque}
                    percentage={metrics.totalRev > 0 ? (metrics.perdaEstoque / metrics.totalRev) * 100 : 0}
                    isNegative
                />
                <Row
                    label="MARGEM BRUTA SEM PERDA DE ESTOQUE"
                    value={metrics.marginAfterLoss}
                    percentage={metrics.totalRev > 0 ? (metrics.marginAfterLoss / metrics.totalRev) * 100 : 0}
                    isSubTotal
                />

                <div className="h-4 bg-[#0f172a]/20"></div>

                {/* DESPESAS VARIÁVEIS */}
                {Object.values(metrics.varGroups).map((group: { label: string; amount: number }, i) => (
                    <Row
                        key={i}
                        label={group.label}
                        value={group.amount}
                        percentage={Number(metrics.totalRev) > 0 ? (Number(group.amount) / Number(metrics.totalRev)) * 100 : 0}
                        isNegative
                    />
                ))}
                <Row
                    label="DESPESAS VARIÁVEIS"
                    value={metrics.totalVar}
                    percentage={metrics.totalRev > 0 ? (metrics.totalVar / metrics.totalRev) * 100 : 0}
                    isTotal
                />

                <div className="h-4 bg-[#0f172a]/20"></div>

                {/* DESPESAS FIXAS */}
                {Object.values(metrics.fixGroups).map((group: { label: string; amount: number }, i) => (
                    <Row
                        key={i}
                        label={group.label}
                        value={group.amount}
                        percentage={Number(metrics.totalRev) > 0 ? (Number(group.amount) / Number(metrics.totalRev)) * 100 : 0}
                        isNegative
                    />
                ))}
                <Row
                    label="DESPESAS FIXAS"
                    value={metrics.totalFix}
                    percentage={metrics.totalRev > 0 ? (metrics.totalFix / metrics.totalRev) * 100 : 0}
                    isTotal
                />

                {/* RESULTADO FINAL */}
                <div className="mt-8">
                    <Row
                        label={metrics.netProfit >= 0 ? "LUCRO LÍQUIDO" : "PREJUÍZO LÍQUIDO"}
                        value={metrics.netProfit}
                        percentage={metrics.totalRev > 0 ? (metrics.netProfit / metrics.totalRev) * 100 : 0}
                        isFinal
                    />
                </div>
            </div>
        </div>
    );
};

export default DRE;
