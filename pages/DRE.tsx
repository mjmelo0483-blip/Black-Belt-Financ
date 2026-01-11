
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
    const [showConfig, setShowConfig] = useState(false);
    const [params, setParams] = useState({
        tax_rate: 3.24,
        royalty_rate: 6.00,
        pix_fee_rate: 0.80
    });

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

            // Fetch Parameters
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: pData } = await supabase
                    .from('dre_parameters')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear)
                    .maybeSingle();

                if (pData) {
                    setParams({
                        tax_rate: Number(pData.tax_rate),
                        royalty_rate: Number(pData.royalty_rate),
                        pix_fee_rate: Number(pData.pix_fee_rate)
                    });
                } else {
                    // Default values if none found for this month
                    setParams({ tax_rate: 3.24, royalty_rate: 6.00, pix_fee_rate: 0.80 });
                }
            }

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

    const saveParams = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { error } = await supabase
            .from('dre_parameters')
            .upsert({
                user_id: session.user.id,
                month: selectedMonth,
                year: selectedYear,
                ...params,
                is_business: true
            }, { onConflict: 'user_id, month, year, is_business' });

        if (error) {
            alert('Erro ao salvar configurações. Certifique-se de que a tabela dre_parameters existe.');
        } else {
            setShowConfig(false);
            // Re-calc metrics by just keeping state
        }
    };

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
            const normMethod = method.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            if (normMethod.includes('credito')) method = 'Crédito';
            else if (normMethod.includes('debito')) method = 'Débito';
            else if (normMethod.includes('pix')) method = 'PIX';
            else method = 'Outros';

            let saleTotal = 0;
            if (sale.sale_items && sale.sale_items.length > 0) {
                sale.sale_items.forEach((item: any) => {
                    saleTotal += Number(item.total_price || 0);
                    // Use Math.round to mitigate floating point issues
                    const itemCost = Math.round(Number(item.products?.cost || 0) * Number(item.quantity || 0) * 100);
                    cmv += (itemCost / 100);
                });
            } else {
                saleTotal = Number(sale.total_amount || 0);
            }

            revByMethod[method] = (revByMethod[method] || 0) + saleTotal;
            totalRev += saleTotal;
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
            // Skip calculated ones if they match by description to avoid double counting
            const isCalculated = desc.includes('royalties') || desc.includes('imposto') || desc.includes('tarifa de pix') || desc.includes('tarifa pix');

            if (catName.includes('perda') || desc.includes('perda') || desc.includes('furto') || desc.includes('vencido') || desc.includes('danificado')) {
                perdaEstoque += amount;
            }
            // Variable Groups (Only diverse/marketing/manual ones)
            else if (desc.includes('cashback') || desc.includes('condominio')) varGroups.cashback.amount += amount;
            else if (desc.includes('tarifa de cartao') || desc.includes('taxa de cartao') || desc.includes('maquininha')) varGroups.tarifaCartao.amount += amount;
            else if (catName.includes('marketing') || desc.includes('marketing') || desc.includes('propaganda')) varGroups.marketing.amount += amount;
            else if (catName.includes('diversas') || catName.includes('loja') || desc.includes('loja')) {
                // Only add if not already matched
                if (!isCalculated) varGroups.diversas.amount += amount;
            }
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
            else if (!isCalculated) fixGroups.outros.amount += amount;
        });

        // Apply Calculation Formulas
        impostos = (totalRev * (params.tax_rate / 100));
        varGroups.royalties.amount = (totalRev * (params.royalty_rate / 100));
        varGroups.tarifaPix.amount = (revByMethod['PIX'] * (params.pix_fee_rate / 100));

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
    }, [salesData, expensesData, params]);

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

                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold border ${showConfig ? 'bg-amber-600 border-amber-500 text-white' : 'bg-[#1e293b] border-[#334155] text-amber-400 hover:bg-amber-600/10'}`}
                    >
                        <span className="material-symbols-outlined text-sm">settings</span>
                        Taxas/Config
                    </button>

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
            </div>

            {showConfig && (
                <div className="bg-[#1e293b] border border-amber-500/30 p-4 rounded-xl shadow-xl animate-in zoom-in-95 duration-200">
                    <h3 className="text-amber-400 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">tune</span>
                        Parâmetros da DRE - {monthNames[selectedMonth]}/{selectedYear}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Impostos (Geral %)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={params.tax_rate}
                                    onChange={(e) => setParams({ ...params, tax_rate: Number(e.target.value) })}
                                    className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                />
                                <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Royalties (% Faturamento)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={params.royalty_rate}
                                    onChange={(e) => setParams({ ...params, royalty_rate: Number(e.target.value) })}
                                    className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                />
                                <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tarifa PIX (% sobre PIX)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={params.pix_fee_rate}
                                    onChange={(e) => setParams({ ...params, pix_fee_rate: Number(e.target.value) })}
                                    className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                />
                                <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setShowConfig(false)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white px-4 py-2">Cancelar</button>
                        <button onClick={saveParams} className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-lg shadow-lg shadow-amber-600/20 transition-all">Salvar para este mês</button>
                    </div>
                </div>
            )}

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
