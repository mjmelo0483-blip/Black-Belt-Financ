
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
    const [selectedStore, setSelectedStore] = useState<string>('Todas');
    const [allPeriods, setAllPeriods] = useState<string[]>([]);
    const [showConfig, setShowConfig] = useState(false);
    const [detailingItems, setDetailingItems] = useState<any[]>([]);
    const [detailingTitle, setDetailingTitle] = useState('');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [allKnownStores, setAllKnownStores] = useState<string[]>([]);
    const [params, setParams] = useState({
        tax_rate: 3.24,
        royalty_rate: 6.00,
        pix_fee_rate: 0.80,
        loss_rate: 2.00,
        card_fee_rate: 1.110284,
        cashback_rates: {} as Record<string, number>
    });
    const [configTab, setConfigTab] = useState<'rates' | 'mapping'>('rates');
    const [categories, setCategories] = useState<any[]>([]);

    const DRE_GROUPS = [
        { id: 'cashback', label: 'Comissão paga ao condominio (cashback)', type: 'variable' },
        { id: 'marketing', label: 'Investimento Marketing da loja', type: 'variable' },
        { id: 'diversas', label: 'Despesas diversas da loja', type: 'variable' },
        { id: 'funcionarios', label: 'Funcionários', type: 'fixed' },
        { id: 'manutencaoVeiculo', label: 'Manutenção de veículo', type: 'fixed' },
        { id: 'taxaSistema', label: 'Taxa de uso do sistema', type: 'fixed' },
        { id: 'aluguelContainer', label: 'Aluguel de container', type: 'fixed' },
        { id: 'combustivel', label: 'Despesa com combustível', type: 'fixed' },
        { id: 'aluguelEscritorio', label: 'Aluguel de Escritório', type: 'fixed' },
        { id: 'tef', label: 'Elgin+TEF+LgoPass', type: 'fixed' },
        { id: 'despesasFinanceiras', label: 'Despesas financeiras', type: 'fixed' },
        { id: 'contabilidade', label: 'Despesa com contabilidade', type: 'fixed' },
        { id: 'internet', label: 'Despesa com internet', type: 'fixed' },
        { id: 'energia', label: 'Despesa com energia elétrica', type: 'fixed' },
        { id: 'outros', label: 'Outros', type: 'fixed' },
        { id: 'perda', label: 'Perda do estoque', type: 'variable' },
    ];

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    useEffect(() => {
        const loadInitialData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // Fetch periods
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
                if (page > 5) break;
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

            // Fetch all known stores to ensure config is always populated
            const knownStores = [
                'Vitta Bela Fonte',
                'Associação Dos Amigos Do Residencial Cenere',
                'Condomínio Lar Chile',
                'Condomínio Lar Portugal',
                'Associação dos Proprietarios em loteamento village costa Sul'
            ];

            const { data: storeData } = await supabase
                .from('sales')
                .select('store_name')
                .not('store_name', 'is', null);

            const dbStores = storeData ? storeData.map(s => s.store_name) : [];
            const uniqueStores = Array.from(new Set([...knownStores, ...dbStores])).filter(Boolean).sort() as string[];
            setAllKnownStores(uniqueStores);

            // Fetch categories for mapping
            const { data: catData } = await supabase
                .from('categories')
                .select('*')
                .eq('is_business', true)
                .order('name');
            setCategories(catData || []);
        };
        loadInitialData();
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
                        tax_rate: Number(pData.tax_rate || 3.24),
                        royalty_rate: Number(pData.royalty_rate || 6.00),
                        pix_fee_rate: Number(pData.pix_fee_rate || 0.80),
                        loss_rate: Number(pData.loss_rate || 2.00),
                        card_fee_rate: Number(pData.card_fee_rate || 1.110284),
                        cashback_rates: pData.cashback_rates || {}
                    });
                } else {
                    setParams({
                        tax_rate: 3.24,
                        royalty_rate: 6.00,
                        pix_fee_rate: 0.80,
                        loss_rate: 2.00,
                        card_fee_rate: 1.110284,
                        cashback_rates: {}
                    });
                }
            }

            const { data } = await fetchSales({ month: selectedMonth, year: selectedYear });
            if (data) setSalesData(data);

            const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const { data: expData } = await supabase
                .from('transactions')
                .select('amount, type, description, date, category_id, store_name, categories(name, parent_id, dre_group)')
                .eq('is_business', true)
                .eq('type', 'expense')
                .gte('date', startDate)
                .lte('date', endDate);

            if (expData) setExpensesData(expData);
            setLoading(false);
        };
        load();
    }, [fetchSales, selectedMonth, selectedYear]);

    const stores = useMemo(() => {
        const s = new Set<string>(allKnownStores);
        salesData.forEach(sale => { if (sale.store_name) s.add(sale.store_name); });
        expensesData.forEach(exp => { if (exp.store_name) s.add(exp.store_name); });
        return Array.from(s).filter(Boolean).sort();
    }, [salesData, expensesData, allKnownStores]);

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
            alert('Erro ao salvar configurações.');
        } else {
            setShowConfig(false);
        }
    };

    const updateCategoryMapping = async (catId: string, dreGroup: string) => {
        const { error } = await supabase
            .from('categories')
            .update({ dre_group: dreGroup || null })
            .eq('id', catId);

        if (error) {
            alert('Erro ao atualizar mapeamento.');
        } else {
            setCategories(prev => prev.map(c => c.id === catId ? { ...c, dre_group: dreGroup || null } : c));
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
        varGroups: Record<string, { label: string; amount: number; items: any[] }>;
        totalVar: number;
        fixGroups: Record<string, { label: string; amount: number; items: any[] }>;
        totalFix: number;
        netProfit: number;
    }

    const metrics = useMemo<DREMetrics>(() => {
        const revByMethod: Record<string, number> = { 'Crédito': 0, 'Débito': 0, 'PIX': 0, 'Outros': 0 };
        let totalRev = 0;
        let cmvCents = 0;

        const filteredSales = selectedStore === 'Todas' ? salesData : salesData.filter(s => s.store_name === selectedStore);

        filteredSales.forEach(sale => {
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
                    const itemQty = Number(item.quantity || 0);
                    const itemCost = Number(item.products?.cost || 0);
                    cmvCents += Math.round(itemCost * itemQty * 100);
                });
            } else {
                saleTotal = Number(sale.total_amount || 0);
            }

            revByMethod[method] = (revByMethod[method] || 0) + saleTotal;
            totalRev += saleTotal;
        });

        const activeStores = Array.from(new Set(salesData.map(s => s.store_name).filter(Boolean))) as string[];
        const activeStoresCount = activeStores.length || 1;
        const prorationFactor = selectedStore !== 'Todas' ? (1 / activeStoresCount) : 1;
        const cmv = cmvCents / 100;

        let impostos = 0;
        let perdaEstoque = 0;

        const storeRevMap: Record<string, number> = {};
        const storeManualCashback: Record<string, { amount: number; items: any[] }> = {};

        activeStores.forEach(s => {
            storeRevMap[s] = 0;
            storeManualCashback[s] = { amount: 0, items: [] };
        });

        salesData.forEach(sale => {
            const sName = sale.store_name;
            if (!sName) return;
            let saleTotal = 0;
            if (sale.sale_items && sale.sale_items.length > 0) {
                sale.sale_items.forEach((item: any) => {
                    saleTotal += Number(item.total_price || 0);
                });
            } else {
                saleTotal = Number(sale.total_amount || 0);
            }
            if (!storeRevMap[sName]) storeRevMap[sName] = 0;
            storeRevMap[sName] += saleTotal;
        });

        const varGroups: Record<string, { label: string; amount: number; items: any[] }> = {
            cashback: { label: 'Comissão paga ao condominio (cashback)', amount: 0, items: [] },
            royalties: { label: 'Royalties', amount: 0, items: [] },
            tarifaCartao: { label: 'Tarifa de cartão', amount: 0, items: [] },
            tarifaPix: { label: 'Tarifa de Pix', amount: 0, items: [] },
            marketing: { label: 'Investimento Marketing da loja', amount: 0, items: [] },
            diversas: { label: 'Despesas diversas da loja', amount: 0, items: [] },
        };

        const fixGroups: Record<string, { label: string; amount: number; items: any[] }> = {
            funcionarios: { label: 'Funcionários', amount: 0, items: [] },
            manutencaoVeiculo: { label: 'Manutenção de veículo', amount: 0, items: [] },
            taxaSistema: { label: 'Taxa de uso do sistema', amount: 0, items: [] },
            aluguelContainer: { label: 'Aluguel de container', amount: 0, items: [] },
            combustivel: { label: 'Despesa com combustível', amount: 0, items: [] },
            aluguelEscritorio: { label: 'Aluguel de Escritório', amount: 0, items: [] },
            tef: { label: 'Elgin+TEF+LgoPass', amount: 0, items: [] },
            despesasFinanceiras: { label: 'Despesas financeiras', amount: 0, items: [] },
            contabilidade: { label: 'Despesa com contabilidade', amount: 0, items: [] },
            internet: { label: 'Despesa com internet', amount: 0, items: [] },
            energia: { label: 'Despesa com energia elétrica', amount: 0, items: [] },
            outros: { label: 'Outros', amount: 0, items: [] },
        };

        expensesData.forEach(exp => {
            const catName = (exp.categories?.name || 'Geral').toLowerCase();
            const dreGroup = exp.categories?.dre_group;
            const desc = (exp.description || '').toLowerCase();
            let amount = Number(exp.amount || 0);

            if (selectedStore !== 'Todas') {
                if (exp.store_name === selectedStore) {
                } else if (!exp.store_name) {
                    amount = amount * prorationFactor;
                } else {
                    return;
                }
            }

            if (catName.includes('fornecedor')) return;

            const isCalculated =
                desc.includes('royalties') ||
                desc.includes('imposto') ||
                desc.includes('tarifa de pix') ||
                desc.includes('tarifa pix') ||
                desc.includes('tarifa de cartao') ||
                desc.includes('taxa de cartao') ||
                desc.includes('perda');

            // --- Prioridade 0: Mapeamento Fixo da Categoria ---
            if (dreGroup) {
                if (dreGroup === 'cashback') {
                    if (exp.store_name && storeManualCashback[exp.store_name]) {
                        storeManualCashback[exp.store_name].amount += amount;
                        storeManualCashback[exp.store_name].items.push(exp);
                    } else {
                        varGroups.cashback.amount += amount;
                        varGroups.cashback.items.push(exp);
                    }
                } else if (varGroups[dreGroup]) {
                    varGroups[dreGroup].amount += amount;
                    varGroups[dreGroup].items.push(exp);
                } else if (fixGroups[dreGroup]) {
                    fixGroups[dreGroup].amount += amount;
                    fixGroups[dreGroup].items.push(exp);
                } else if (dreGroup === 'perda') {
                    perdaEstoque += amount;
                }
                return;
            }

            // --- Prioridade 1: Categorias específicas e Serviços Fixos (Fallback Inteligente) ---

            // Internet e Celular
            if (catName.includes('internet') || catName.includes('celular') || desc.includes('internet')) {
                fixGroups.internet.amount += amount;
                fixGroups.internet.items.push(exp);
            }
            // Energia Elétrica
            else if (catName.includes('energia') || desc.includes('luz') || desc.includes('equatorial') || desc.includes('enel') || desc.includes('celpa')) {
                fixGroups.energia.amount += amount;
                fixGroups.energia.items.push(exp);
            }
            // Combustível
            else if (catName.includes('combustivel') || desc.includes('gasolina') || desc.includes('diesel') || desc.includes('etanol') || desc.includes('posto ')) {
                fixGroups.combustivel.amount += amount;
                fixGroups.combustivel.items.push(exp);
            }
            // Funcionários e Pró-labore
            else if (catName.includes('funcionario') || catName.includes('salario') || catName.includes('pro-labore') || desc.includes('salario') || desc.includes('folha pgto') || desc.includes('pro-labore')) {
                fixGroups.funcionarios.amount += amount;
                fixGroups.funcionarios.items.push(exp);
            }
            // Contabilidade
            else if (catName.includes('contabil') || desc.includes('contador') || desc.includes('contabilidade')) {
                fixGroups.contabilidade.amount += amount;
                fixGroups.contabilidade.items.push(exp);
            }
            // Aluguel de Escritório
            else if (catName.includes('escritorio') && (catName.includes('aluguel') || desc.includes('aluguel'))) {
                fixGroups.aluguelEscritorio.amount += amount;
                fixGroups.aluguelEscritorio.items.push(exp);
            }
            // Aluguel de Container
            else if (catName.includes('container')) {
                fixGroups.aluguelContainer.amount += amount;
                fixGroups.aluguelContainer.items.push(exp);
            }

            // --- Prioridade 2: Despesas Variáveis Específicas ---

            // Cashback / Comissão Condomínio (mais restrito para evitar falsos positivos)
            else if (catName.includes('comissão') || desc.includes('cashback') || desc.includes('comissão condomínio')) {
                if (exp.store_name && storeManualCashback[exp.store_name]) {
                    storeManualCashback[exp.store_name].amount += amount;
                    storeManualCashback[exp.store_name].items.push(exp);
                } else {
                    varGroups.cashback.amount += amount;
                    varGroups.cashback.items.push(exp);
                }
            }
            // Marketing e Propaganda
            else if (catName.includes('marketing') || desc.includes('marketing') || desc.includes('propaganda') || desc.includes('facebook ads') || desc.includes('google ads')) {
                varGroups.marketing.amount += amount;
                varGroups.marketing.items.push(exp);
            }
            // Perda de Estoque (se não for calculado automaticamente)
            else if (!isCalculated && (catName.includes('perda') || desc.includes('perda') || desc.includes('furto') || desc.includes('vencido') || desc.includes('danificado'))) {
                perdaEstoque += amount;
            }

            // --- Prioridade 3: Outros Grupos ---

            // Manutenção de Veículos
            else if (desc.includes('veiculo') || desc.includes('carro') || desc.includes('moto') || desc.includes('oficina') || desc.includes('pneu')) {
                fixGroups.manutencaoVeiculo.amount += amount;
                fixGroups.manutencaoVeiculo.items.push(exp);
            }
            // Taxas de Sistema
            else if (catName.includes('taxa de uso do sistema') || (catName.includes('sistema') && (desc.includes('taxa') || desc.includes('mensalidade')))) {
                fixGroups.taxaSistema.amount += amount;
                fixGroups.taxaSistema.items.push(exp);
            }
            // TEF / Equipamentos Pagamento
            else if (catName.includes('elgin') || catName.includes('tef') || catName.includes('igopass') || catName.includes('lgopass')) {
                fixGroups.tef.amount += amount;
                fixGroups.tef.items.push(exp);
            }
            // Despesas Financeiras e Espaço
            else if (catName.includes('despesas financeiras') || catName.includes('aluguel do espaco') || desc.includes('aluguel da loja') || desc.includes('aluguel sala')) {
                fixGroups.despesasFinanceiras.amount += amount;
                fixGroups.despesasFinanceiras.items.push(exp);
            }
            // Despesas Diversas da Loja
            else if (catName.includes('diversas') || catName.includes('loja') || desc.includes('loja')) {
                if (!isCalculated) {
                    varGroups.diversas.amount += amount;
                    varGroups.diversas.items.push(exp);
                }
            }
            // Outros (Fallback)
            else if (!isCalculated) {
                fixGroups.outros.amount += amount;
                fixGroups.outros.items.push(exp);
            }
        });

        impostos = (totalRev * (params.tax_rate / 100));
        perdaEstoque = (totalRev * (params.loss_rate / 100));
        varGroups.royalties.amount = (totalRev * (params.royalty_rate / 100));
        varGroups.tarifaPix.amount = (revByMethod['PIX'] * (params.pix_fee_rate / 100));
        varGroups.tarifaCartao.amount = ((revByMethod['Crédito'] + revByMethod['Débito']) * (params.card_fee_rate / 100));

        if (selectedStore !== 'Todas') {
            const manual = storeManualCashback[selectedStore];
            if (manual && manual.amount > 0) {
                varGroups.cashback.amount += manual.amount;
                varGroups.cashback.items.push(...manual.items);
            } else {
                const rates = params.cashback_rates as Record<string, number>;
                const rate = rates[selectedStore] || 0;
                varGroups.cashback.amount += (totalRev * (rate / 100));
            }
        } else {
            activeStores.forEach(s => {
                const manual = storeManualCashback[s];
                if (manual && manual.amount > 0) {
                    varGroups.cashback.amount += manual.amount;
                    varGroups.cashback.items.push(...manual.items);
                } else {
                    const rates = params.cashback_rates as Record<string, number>;
                    const rate = rates[s] || 0;
                    const sRev = storeRevMap[s] || 0;
                    varGroups.cashback.amount += (sRev * (rate / 100));
                }
            });
        }

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
    }, [salesData, expensesData, params, selectedStore]);

    const Row = ({ label, value, percentage, isTotal, isSubTotal, isNegative, isFinal, onClick }: any) => (
        <div
            onClick={onClick}
            className={`flex items-center justify-between px-4 ${onClick ? 'cursor-pointer hover:bg-indigo-500/10' : ''} ${isTotal || isFinal ? 'bg-[#1e293b] text-white font-black uppercase text-xs border-y border-[#334155] py-2.5' : 'border-b border-[#1e293b] text-slate-300 py-1.5'} ${isSubTotal ? 'bg-slate-800/30 font-bold' : ''}`}
        >
            <div className={`flex-1 text-[11px] ${isTotal || isFinal || isSubTotal ? 'font-black' : ''} ${isFinal ? 'text-sm' : ''} flex items-center gap-2`}>
                {label}
                {onClick && <span className="material-symbols-outlined text-[14px] opacity-40 hover:opacity-100 transition-opacity">info</span>}
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

                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] rounded-xl px-3 py-1.5 min-w-[200px]">
                        <span className="material-symbols-outlined text-slate-500 text-sm">storefront</span>
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="bg-transparent border-none text-white text-xs font-bold focus:ring-0 w-full"
                        >
                            <option value="Todas" className="bg-[#1e293b]">Todas as Lojas</option>
                            {stores.map(s => (
                                <option key={s} value={s} className="bg-[#1e293b]">{s}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold border ${showConfig ? 'bg-amber-600 border-amber-500 text-white' : 'bg-[#1e293b] border-[#334155] text-amber-400 hover:bg-amber-600/10'}`}
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
                    <div className="flex justify-between items-center mb-6 border-b border-[#334155]/50">
                        <div className="flex gap-6">
                            <button
                                onClick={() => setConfigTab('rates')}
                                className={`text-[10px] font-black uppercase tracking-widest pb-3 border-b-2 transition-all ${configTab === 'rates' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">percent</span>
                                    Taxas e Comissões
                                </span>
                            </button>
                            <button
                                onClick={() => setConfigTab('mapping')}
                                className={`text-[10px] font-black uppercase tracking-widest pb-3 border-b-2 transition-all ${configTab === 'mapping' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">account_tree</span>
                                    Mapeamento de Contas
                                </span>
                            </button>
                        </div>
                        <h3 className="text-amber-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-sm">tune</span>
                            Configurações da DRE
                        </h3>
                    </div>

                    {configTab === 'rates' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Impostos (Geral %)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
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
                                            step="0.1"
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
                                            step="0.01"
                                            value={params.pix_fee_rate}
                                            onChange={(e) => setParams({ ...params, pix_fee_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Perdas (% Faturamento)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={params.loss_rate}
                                            onChange={(e) => setParams({ ...params, loss_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tarifa Cartão (% Crédito+Débito)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={params.card_fee_rate}
                                            onChange={(e) => setParams({ ...params, card_fee_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                </div>
                            </div>

                            {stores.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-[#334155]">
                                    <h4 className="text-amber-400 font-bold text-[10px] uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">storefront</span>
                                        Comissões (Cashback) por Condomínio (%)
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {stores.map(storeName => (
                                            <div key={storeName} className="space-y-1">
                                                <label className="text-[9px] text-slate-500 font-black uppercase truncate block">{storeName}</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={(params.cashback_rates as Record<string, number>)[storeName] || ''}
                                                        onChange={(e) => setParams({
                                                            ...params,
                                                            cashback_rates: {
                                                                ...params.cashback_rates,
                                                                [storeName]: Number(e.target.value)
                                                            }
                                                        })}
                                                        className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500/50"
                                                    />
                                                    <span className="absolute right-2 top-1.5 text-slate-600 text-[10px]">%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-amber-600/10 border border-amber-500/20 rounded-lg">
                                <p className="text-amber-200 text-[10px] uppercase font-black leading-relaxed">
                                    Vincule suas categorias diretamente às contas da DRE para garantir 100% de precisão nos relatórios.
                                    <br /><span className="text-white/60 font-medium">Categorias não vinculadas continuarão sendo classificadas automaticamente pelo sistema.</span>
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                {categories.filter(c => {
                                    if (c.type !== 'expense') return false;
                                    const n = (c.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                    const isAuto = n.includes('royalties') ||
                                        n.includes('imposto') ||
                                        n.includes('tarifa de pix') ||
                                        n.includes('tarifa pix') ||
                                        n.includes('tarifa de cartao') ||
                                        n.includes('taxa de cartao') ||
                                        n.includes('perda') ||
                                        n.includes('fornecedor');
                                    return !isAuto;
                                }).map(cat => (
                                    <div key={cat.id} className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] hover:border-amber-500/30 transition-colors flex flex-col gap-2 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-white truncate max-w-[70%]">{cat.name}</span>
                                            <span className="material-symbols-outlined text-slate-600 text-sm">link</span>
                                        </div>
                                        <select
                                            value={cat.dre_group || ''}
                                            onChange={(e) => updateCategoryMapping(cat.id, e.target.value)}
                                            className={`w-full bg-[#1e293b] border rounded-lg px-2 py-2 text-[10px] font-black transition-all focus:outline-none ${cat.dre_group ? 'border-amber-500/50 text-amber-400' : 'border-[#334155] text-slate-400'}`}
                                        >
                                            <option value="" className="text-slate-500 italic">AUTOMÁTICO (Fuzzy Match)</option>
                                            <optgroup label="Despesas Variáveis" className="bg-[#0f172a] text-indigo-400">
                                                {DRE_GROUPS.filter(g => g.type === 'variable').map(group => (
                                                    <option key={group.id} value={group.id} className="text-white">{group.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Despesas Fixas" className="bg-[#0f172a] text-emerald-400">
                                                {DRE_GROUPS.filter(g => g.type === 'fixed').map(group => (
                                                    <option key={group.id} value={group.id} className="text-white">{group.label}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    <div className="mt-6 flex justify-end gap-3 border-t border-[#334155] pt-4">
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

                {Object.values(metrics.varGroups).map((group: any, i) => (
                    <Row
                        key={i}
                        label={group.label}
                        value={group.amount}
                        percentage={metrics.totalRev > 0 ? (group.amount / metrics.totalRev) * 100 : 0}
                        isNegative
                        onClick={group.items.length > 0 ? () => { setDetailingItems(group.items); setDetailingTitle(group.label); setShowDetailModal(true); } : undefined}
                    />
                ))}

                <Row label="TOTAL DESPESAS VARIÁVEIS" value={metrics.totalVar} percentage={metrics.totalRev > 0 ? (metrics.totalVar / metrics.totalRev) * 100 : 0} isTotal isNegative />

                <div className="h-0.5 bg-indigo-500/10 my-4"></div>

                <Row
                    label="MARGEM DE CONTRIBUIÇÃO"
                    value={metrics.marginAfterLoss - metrics.totalVar}
                    percentage={metrics.totalRev > 0 ? ((metrics.marginAfterLoss - metrics.totalVar) / metrics.totalRev) * 100 : 0}
                    isSubTotal
                />

                <div className="h-4 bg-[#0f172a]/20"></div>

                {Object.values(metrics.fixGroups).map((group: any, i) => (
                    <Row
                        key={i}
                        label={group.label}
                        value={group.amount}
                        percentage={metrics.totalRev > 0 ? (group.amount / metrics.totalRev) * 100 : 0}
                        isNegative
                        onClick={group.items.length > 0 ? () => { setDetailingItems(group.items); setDetailingTitle(group.label); setShowDetailModal(true); } : undefined}
                    />
                ))}

                <Row
                    label="DESPESAS FIXAS"
                    value={metrics.totalFix}
                    percentage={metrics.totalRev > 0 ? (metrics.totalFix / metrics.totalRev) * 100 : 0}
                    isTotal
                    isNegative
                />

                <div className="mt-8">
                    <Row
                        label={metrics.netProfit >= 0 ? 'LUCRO LÍQUIDO' : 'PREJUÍZO LÍQUIDO'}
                        value={metrics.netProfit}
                        percentage={metrics.totalRev > 0 ? (metrics.netProfit / metrics.totalRev) * 100 : 0}
                        isFinal
                    />
                </div>
            </div>

            {showDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#111a22] border border-[#233648] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-[#233648] flex justify-between items-center bg-[#1e293b]">
                            <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">list_alt</span>
                                Detalhamento: {detailingTitle} ({detailingItems.length})
                            </h3>
                            <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-slate-500 uppercase font-black tracking-widest border-b border-[#233648]">
                                        <th className="pb-2 px-2">Data</th>
                                        <th className="pb-2 px-2">Loja</th>
                                        <th className="pb-2 px-2">Descrição</th>
                                        <th className="pb-2 px-2">Categoria</th>
                                        <th className="pb-2 px-2 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#233648]">
                                    {detailingItems.map((exp, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="py-2 px-2 text-slate-400">{new Date(exp.date).toLocaleDateString()}</td>
                                            <td className="py-2 px-2 text-indigo-400 font-bold">{exp.store_name || 'Geral'}</td>
                                            <td className="py-2 px-2 text-white font-medium">{exp.description}</td>
                                            <td className="py-2 px-2 text-slate-400">{exp.categories?.name}</td>
                                            <td className="py-2 px-2 text-right text-red-400 font-bold">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    {detailingItems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-slate-500">Nenhum lançamento encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-[#0f172a] border-t border-[#233648] flex justify-between items-center text-xs font-black uppercase">
                            <span className="text-slate-400">Total</span>
                            <span className="text-white">R$ {detailingItems.reduce((acc, e) => acc + Number(e.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DRE;
