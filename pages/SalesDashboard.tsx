import React, { useEffect, useState, useMemo } from 'react';
import { useSales } from '../hooks/useSales';
import { useCompany } from '../contexts/CompanyContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { supabase } from '../supabase';

const SalesDashboard: React.FC = () => {
    const { fetchSales } = useSales();
    const { activeCompany } = useCompany();
    const [salesData, setSalesData] = useState<any[]>([]);

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [selectedStore, setSelectedStore] = useState<string>('Todas');
    const [expensesData, setExpensesData] = useState<any[]>([]);
    const [params, setParams] = useState({
        tax_rate: 3.24,
        royalty_rate: 6.00,
        pix_fee_rate: 0.80,
        loss_rate: 2.00,
        card_fee_rate: 1.110284,
        cashback_rates: {} as Record<string, number>
    });

    const [cache, setCache] = useState<Record<string, any[]>>({});

    useEffect(() => {
        const load = async () => {
            setSalesData([]);
            setExpensesData([]);

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                let pQuery = supabase
                    .from('dre_parameters')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear);

                if (activeCompany) {
                    pQuery = pQuery.eq('company_id', activeCompany.id);
                } else {
                    pQuery = pQuery.is('company_id', null);
                }

                const { data: pData } = await pQuery.maybeSingle();

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

            const { data: sData } = await fetchSales({ month: selectedMonth, year: selectedYear });
            if (sData) setSalesData(sData);

            const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            let expQuery = supabase
                .from('transactions')
                .select('amount, type, description, date, due_date, category_id, store_name, categories(name, parent_id, dre_group)')
                .eq('is_business', true)
                .eq('type', 'expense')
                .gte('date', startDate)
                .lte('date', endDate);

            if (activeCompany) {
                expQuery = expQuery.eq('company_id', activeCompany.id);
            } else {
                expQuery = expQuery.is('company_id', null);
            }

            const { data: expData } = await expQuery;
            if (expData) setExpensesData(expData);
        };
        load();
    }, [fetchSales, selectedMonth, selectedYear, activeCompany]);

    const [allPeriods, setAllPeriods] = useState<string[]>([]);
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

    const periods = allPeriods;

    const categories = useMemo(() => {
        const c = new Set<string>();
        salesData.forEach(sale => {
            sale.sale_items?.forEach((item: any) => {
                if (item.products?.category) c.add(item.products.category);
            });
        });
        return ['Todas', ...Array.from(c).sort()];
    }, [salesData]);

    const stores = useMemo(() => {
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const storeMap = new Map<string, string>();

        const addStore = (name: string) => {
            if (!name) return;
            const normalized = normalize(name);
            const current = storeMap.get(normalized);
            const getScore = (s: string) => (s.match(/[A-Z]/g)?.length || 0) + (s.match(/[áéíóúâêîôûãõàèìòù]/gi)?.length || 0);

            if (!current || getScore(name) > getScore(current)) {
                storeMap.set(normalized, name);
            }
        };

        salesData.forEach(sale => {
            if (sale.store_name) addStore(sale.store_name);
        });

        return ['Todas', ...Array.from(storeMap.values()).sort()];
    }, [salesData]);

    const filteredItems = useMemo(() => {
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const items: any[] = [];
        salesData.forEach(sale => {
            if (!sale.date) return;
            const parts = sale.date.split('-');
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;

            const matchesMonth = m === selectedMonth;
            const matchesYear = y === selectedYear;
            const matchesStore = selectedStore === 'Todas' || (sale.store_name && normalize(sale.store_name) === normalize(selectedStore));

            if (matchesMonth && matchesYear && matchesStore) {
                sale.sale_items?.forEach((item: any) => {
                    const matchesCategory = selectedCategory === 'Todas' || item.products?.category === selectedCategory;
                    if (matchesCategory) {
                        items.push({
                            ...item,
                            date: sale.date,
                            store_name: sale.store_name
                        });
                    }
                });
            }
        });
        return items;
    }, [salesData, selectedMonth, selectedYear, selectedCategory, selectedStore]);

    const totalRevenue = filteredItems.reduce((acc, item) => acc + Number(item.total_price || 0), 0);
    const totalUnits = filteredItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

    const relevantSalesCount = useMemo(() => {
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const saleIds = new Set();
        salesData.forEach(sale => {
            if (!sale.date) return;
            const parts = sale.date.split('-');
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[0]);
            if (m === selectedMonth && y === selectedYear && (selectedStore === 'Todas' || (sale.store_name && normalize(sale.store_name) === normalize(selectedStore)))) {
                const hasMatchingItem = sale.sale_items?.some((item: any) => selectedCategory === 'Todas' || item.products?.category === selectedCategory);
                if (hasMatchingItem) saleIds.add(sale.id);
            }
        });
        return saleIds.size;
    }, [salesData, selectedMonth, selectedYear, selectedStore, selectedCategory]);

    const averageTicket = relevantSalesCount > 0 ? totalRevenue / relevantSalesCount : 0;

    const productSales = useMemo(() => {
        const map: any = {};
        filteredItems.forEach(item => {
            const prod = item.products;
            if (!prod) return;
            if (!map[prod.code]) {
                map[prod.code] = { name: prod.name, total: 0, count: 0 };
            }
            map[prod.code].total += Number(item.total_price || 0);
            map[prod.code].count += Number(item.quantity || 0);
        });
        return Object.values(map).sort((a: any, b: any) => b.total - a.total);
    }, [filteredItems]);

    const bestProduct = productSales[0] || { name: '-', total: 0 };

    const dailyData = useMemo(() => {
        const map: any = {};
        filteredItems.forEach(item => {
            const dateStr = item.date;
            if (!map[dateStr]) {
                map[dateStr] = { date: dateStr, revenue: 0, units: 0 };
            }
            map[dateStr].revenue += Number(item.total_price || 0);
            map[dateStr].units += Number(item.quantity || 0);
        });
        return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [filteredItems]);

    const dreMetrics = useMemo(() => {
        const revByMethod: Record<string, number> = { 'Crédito': 0, 'Débito': 0, 'PIX': 0, 'Outros': 0 };
        let totalRev = 0;
        let cmvCents = 0;

        const normalizeStore = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sNorm = selectedStore === 'Todas' ? null : normalizeStore(selectedStore);

        const filteredSales = selectedStore === 'Todas' ? salesData : salesData.filter(s => {
            if (!s.store_name) return false;
            return normalizeStore(s.store_name) === sNorm;
        });

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
                    const itemCost = Number(item.unit_cost !== undefined && item.unit_cost !== null ? item.unit_cost : (item.products?.cost || 0));
                    cmvCents += Math.round(itemCost * itemQty * 100);
                });
            } else {
                saleTotal = Number(sale.total_amount || 0);
            }

            revByMethod[method] = (revByMethod[method] || 0) + saleTotal;
            totalRev += saleTotal;
        });

        const activeStoreMap = new Map<string, string>();
        salesData.forEach(s => {
            if (s.store_name) {
                const norm = normalizeStore(s.store_name);
                if (norm !== 'geral' && norm !== 'administrativo') {
                    if (!activeStoreMap.has(norm)) activeStoreMap.set(norm, s.store_name);
                }
            }
        });
        const activeStores = Array.from(activeStoreMap.values());

        const storeRevMapTotal: Record<string, number> = {};
        salesData.forEach(sale => {
            if (sale.store_name) {
                const norm = normalizeStore(sale.store_name);
                if (norm === 'geral' || norm === 'administrativo') return;
                let saleTotal = 0;
                if (sale.sale_items && sale.sale_items.length > 0) {
                    sale.sale_items.forEach((item: any) => { saleTotal += Number(item.total_price || 0); });
                } else {
                    saleTotal = Number(sale.total_amount || 0);
                }
                storeRevMapTotal[norm] = (storeRevMapTotal[norm] || 0) + saleTotal;
            }
        });

        const storesWithRevenue = activeStores.filter(s => (storeRevMapTotal[normalizeStore(s)] || 0) > 0);
        const storesWithRevenueCount = storesWithRevenue.length || 1;
        const isCurrentStoreInRevenueList = selectedStore !== 'Todas' && storesWithRevenue.some(s => normalizeStore(s) === sNorm);
        const prorationFactor = selectedStore === 'Todas' ? 1 : (isCurrentStoreInRevenueList ? (1 / storesWithRevenueCount) : 0);

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
                sale.sale_items.forEach((item: any) => { saleTotal += Number(item.total_price || 0); });
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
            const expNorm = normalizeStore(exp.store_name);
            const isGeralItem = !exp.store_name || expNorm === 'geral' || expNorm === 'administrativo';

            if (selectedStore !== 'Todas') {
                if (expNorm === sNorm) {
                } else if (isGeralItem) {
                    amount = amount * prorationFactor;
                } else { return; }
            }

            const pushToGroup = (group: any) => { group.amount += amount; };
            if (catName.includes('fornecedor') || catName.includes('retirada sócios') || catName.includes('retirada socios')) return;
            const isCalculated = desc.includes('royalties') || desc.includes('imposto') || desc.includes('tarifa') || desc.includes('perda');
            if (isCalculated && !dreGroup) return;

            if (dreGroup) {
                if (dreGroup === 'cashback') {
                    const cashbackKey = activeStores.find(as => normalizeStore(as) === expNorm);
                    if (cashbackKey && storeManualCashback[cashbackKey]) {
                        storeManualCashback[cashbackKey].amount += amount;
                    } else { varGroups.cashback.amount += amount; }
                } else if (varGroups[dreGroup]) { varGroups[dreGroup].amount += amount; }
                else if (fixGroups[dreGroup]) { fixGroups[dreGroup].amount += amount; }
                else if (dreGroup === 'perda') { perdaEstoque += amount; }
                return;
            }

            if (catName.includes('internet') || catName.includes('celular') || desc.includes('internet')) { pushToGroup(fixGroups.internet); }
            else if (catName.includes('energia') || desc.includes('luz') || desc.includes('equatorial') || desc.includes('enel') || desc.includes('celpa')) { pushToGroup(fixGroups.energia); }
            else if (catName.includes('combustivel') || desc.includes('gasolina') || desc.includes('diesel') || desc.includes('etanol') || (desc.includes('posto ') && !desc.includes('imposto'))) { pushToGroup(fixGroups.combustivel); }
            else if (catName.includes('funcionario') || catName.includes('salario') || catName.includes('pro-labore') || desc.includes('salario') || desc.includes('folha pgto')) { pushToGroup(fixGroups.funcionarios); }
            else if (catName.includes('contabil') || desc.includes('contador') || desc.includes('contabilidade')) { pushToGroup(fixGroups.contabilidade); }
            else if (catName.includes('escritorio') && (catName.includes('aluguel') || desc.includes('aluguel'))) { pushToGroup(fixGroups.aluguelEscritorio); }
            else if (catName.includes('container')) { pushToGroup(fixGroups.aluguelContainer); }
            else if (catName.includes('comissão') || desc.includes('cashback')) {
                const cashbackKey = activeStores.find(as => normalizeStore(as) === expNorm);
                if (cashbackKey && storeManualCashback[cashbackKey]) { storeManualCashback[cashbackKey].amount += amount; }
                else { pushToGroup(varGroups.cashback); }
            }
            else if (catName.includes('marketing') || desc.includes('marketing') || desc.includes('propaganda')) { pushToGroup(varGroups.marketing); }
            else if (catName.includes('veiculo') || desc.includes('oficina') || desc.includes('pneu')) { pushToGroup(fixGroups.manutencaoVeiculo); }
            else if (catName.includes('taxa de uso do sistema') || (catName.includes('sistema') && (desc.includes('taxa') || desc.includes('mensalidade')))) { pushToGroup(fixGroups.taxaSistema); }
            else if (catName.includes('elgin') || catName.includes('tef') || catName.includes('igopass')) { pushToGroup(fixGroups.tef); }
            else if (catName.includes('despesas financeiras') || desc.includes('aluguel da loja')) { pushToGroup(fixGroups.despesasFinanceiras); }
            else if (catName.includes('diversas') || catName.includes('loja') || desc.includes('loja')) { if (!isCalculated) pushToGroup(varGroups.diversas); }
            else if (!isCalculated) { pushToGroup(fixGroups.outros); }
        });

        impostos = (totalRev * (params.tax_rate / 100));
        perdaEstoque = (totalRev * (params.loss_rate / 100));
        varGroups.royalties.amount = (totalRev * (params.royalty_rate / 100));
        varGroups.tarifaPix.amount = (revByMethod['PIX'] * (params.pix_fee_rate / 100));
        varGroups.tarifaCartao.amount = ((revByMethod['Crédito'] + revByMethod['Débito']) * (params.card_fee_rate / 100));

        if (selectedStore !== 'Todas') {
            const key = Object.keys(storeManualCashback).find(k => normalizeStore(k) === sNorm);
            const manual = key ? storeManualCashback[key] : null;
            if (manual && manual.amount > 0) { varGroups.cashback.amount += manual.amount; }
            else {
                const rates = params.cashback_rates as Record<string, number>;
                const rateKey = Object.keys(rates).find(rk => normalizeStore(rk) === sNorm);
                const rate = rateKey ? rates[rateKey] : 0;
                varGroups.cashback.amount += (totalRev * (rate / 100));
            }
        } else {
            activeStores.forEach(s => {
                const manual = storeManualCashback[s];
                if (manual && manual.amount > 0) { varGroups.cashback.amount += manual.amount; }
                else {
                    const rates = params.cashback_rates as Record<string, number>;
                    const rateKey = Object.keys(rates).find(rk => normalizeStore(rk) === normalizeStore(s));
                    const rate = rateKey ? rates[rateKey] : 0;
                    const sRev = storeRevMap[s] || 0;
                    varGroups.cashback.amount += (sRev * (rate / 100));
                }
            });
        }

        const totalVar = Object.values(varGroups).reduce((acc, g) => acc + g.amount, 0);
        const totalFix = Object.values(fixGroups).reduce((acc, g) => acc + g.amount, 0);

        // 1. Custos Variáveis Reais (O que varia estritamente com a venda)
        const realVariableCosts = impostos + cmv + perdaEstoque +
            varGroups.royalties.amount +
            varGroups.tarifaPix.amount +
            varGroups.tarifaCartao.amount +
            varGroups.cashback.amount;

        // 2. Custos Fixos Operacionais (Numerador do PE)
        // Marketing e Diversas são tratados como fixos para o cálculo do Ponto de Equilíbrio
        const fixedOperationalCosts = totalFix + varGroups.marketing.amount + varGroups.diversas.amount;

        // 3. IMC = (Faturamento - Custos Variáveis Reais) / Faturamento
        const margemContribuicao = totalRev - realVariableCosts;
        const IMC = totalRev > 0 ? margemContribuicao / totalRev : (1 - (params.tax_rate + params.royalty_rate + params.loss_rate + params.card_fee_rate) / 100 - 0.45);

        // 4. Ponto de Equilíbrio = Custos Fixos / IMC
        const breakEven = fixedOperationalCosts / Math.max(0.01, IMC);

        return { breakEven, totalRev, totalFix, IMC, fixedCosts: fixedOperationalCosts };
    }, [salesData, expensesData, params, selectedStore]);

    const targetRevenue = dreMetrics.breakEven;
    const balancePercentage = targetRevenue > 0 ? Math.min(Math.round((totalRevenue / targetRevenue) * 100), 100) : (totalRevenue > 0 ? 100 : 0);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Projeção de Faturamento Mensal (Baseada na Data da Última Venda)
    const projection = useMemo(() => {
        const today = new Date();
        const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
        const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

        if (!isCurrentMonth) {
            return {
                isCurrent: false,
                projectedTotal: totalRevenue,
                dailyAverage: totalRevenue / totalDaysInMonth,
                daysRemaining: 0,
                daysElapsed: totalDaysInMonth,
                daysInMonth: totalDaysInMonth
            };
        }

        // Encontrar a data da última venda realizada no mês selecionado
        const saleDates = filteredItems
            .map(item => item.date)
            .filter(Boolean)
            .sort();

        const lastSaleDateStr = saleDates.length > 0 ? saleDates[saleDates.length - 1] : null;
        const lastSaleDay = lastSaleDateStr ? parseInt(lastSaleDateStr.split('-')[2]) : today.getDate();

        const daysInMonth = totalDaysInMonth;
        const daysElapsed = lastSaleDay; // Dias corridos até a última venda
        const daysRemaining = daysInMonth - daysElapsed;

        const dailyAverage = totalRevenue / Math.max(1, daysElapsed);
        const projectedTotal = totalRevenue + (dailyAverage * daysRemaining);

        return {
            isCurrent: true,
            projectedTotal,
            dailyAverage,
            daysRemaining,
            daysElapsed,
            daysInMonth
        };
    }, [totalRevenue, selectedMonth, selectedYear, filteredItems]);

    const projectedRevenue = projection.projectedTotal;
    const projectedResult = (projectedRevenue * dreMetrics.IMC) - dreMetrics.fixedCosts;
    const currentResult = (totalRevenue * dreMetrics.IMC) - dreMetrics.fixedCosts;

    return (
        <div className="p-6 space-y-6 bg-[#0f172a] min-h-screen text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Dashboard de Vendas</h1>

                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-1.5">
                        <span className="material-symbols-outlined text-xs text-slate-400">store</span>
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                        >
                            {stores.map(store => <option key={store} value={store} className="bg-[#1e293b]">{store}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-1 flex-nowrap overflow-x-auto pb-1 max-w-[600px] custom-scrollbar">
                        {periods.length > 0 ? (
                            [...periods].reverse().map(period => {
                                const [m, y] = period.split('-').map(Number);
                                const active = selectedMonth === m && selectedYear === y;
                                return (
                                    <button
                                        key={period}
                                        onClick={() => { setSelectedMonth(m); setSelectedYear(y); }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${active ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white'}`}
                                    >
                                        {monthNames[m]}/{y}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#1e293b] border border-[#334155] text-slate-500">
                                {monthNames[selectedMonth]}/{selectedYear}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-3 space-y-4">
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] flex flex-col items-center justify-center text-center shadow-2xl">
                        <div className="size-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-indigo-400 text-3xl">api</span>
                        </div>
                        <p className="text-xl font-black text-white whitespace-nowrap">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Total Faturado</p>
                    </div>

                    <div className="bg-[#1e293b] px-6 py-4 rounded-xl border border-[#334155] flex justify-between items-center">
                        <div className="text-left">
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Unidades</p>
                            <p className="text-xl font-black">{totalUnits}</p>
                        </div>
                        <span className="material-symbols-outlined text-emerald-400">shopping_cart</span>
                    </div>

                    <div className="bg-[#1e293b] px-6 py-4 rounded-xl border border-[#334155] flex justify-between items-center">
                        <div className="text-left">
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Ticket Médio</p>
                            <p className="text-xl font-black">R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <span className="material-symbols-outlined text-amber-400">confirmation_number</span>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155] space-y-2">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Maior Faturamento</p>
                        <p className="text-sm font-bold text-white truncate">{bestProduct.name}</p>
                        <p className="text-xl font-black text-indigo-400">R$ {bestProduct.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>

                    <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-xs">filter_alt</span> Categoria
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase text-center transition-all border ${selectedCategory === cat ? 'bg-amber-500 border-amber-400 text-slate-900 shadow-lg shadow-amber-500/20' : 'bg-[#0f172a] border-[#334155] text-slate-400'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-9 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl flex flex-col items-center">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Ponto de Equilíbrio</h3>
                            <div className="relative size-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { value: totalRevenue },
                                                { value: Math.max(0, targetRevenue * 1.2 - totalRevenue) }
                                            ]}
                                            cx="50%" cy="50%" innerRadius={50} outerRadius={70} fill="#8884d8" paddingAngle={5} dataKey="value" stroke="none"
                                            startAngle={90} endAngle={450}
                                        >
                                            <Cell fill="#fbbf24" />
                                            <Cell fill="#0f172a" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-amber-500">{balancePercentage}%</span>
                                </div>
                            </div>
                            <p className="mt-4 text-amber-500 font-black text-lg">R$ {targetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>

                        <div className="md:col-span-2 bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Total Vendido por Dia (R$)</h3>
                            <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => parseInt(val.split('-')[2]).toString()}
                                            stroke="#64748b"
                                            fontSize={10}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                        />
                                        <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                                            cursor={{ fill: '#334155', opacity: 0.4 }}
                                            labelFormatter={(val) => {
                                                if (!val) return '';
                                                const [y, m, d] = val.split('-');
                                                return `${d}/${m}/${y}`;
                                            }}
                                            formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Faturamento']}
                                        />
                                        <Bar dataKey="revenue" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Top 10 Produtos Mais Vendidos</h3>
                                <div className="h-[450px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={productSales.slice(0, 10)}>
                                            <XAxis type="number" hide />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                stroke="#94a3b8"
                                                fontSize={10}
                                                width={180}
                                                tick={{ fill: '#94a3b8' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(value) => value.length > 25 ? `${value.substring(0, 25)}...` : value}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                                                formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Total Vendido']}
                                            />
                                            <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-[#1e293b] overflow-hidden rounded-2xl border border-[#334155] shadow-xl">
                                <div className="bg-indigo-600/10 px-6 py-4 border-b border-[#334155] flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">trending_up</span> Projeção de Faturamento
                                    </h3>
                                    {projection.isCurrent && (
                                        <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
                                            {projection.daysRemaining} DIAS CORRIDOS RESTANTES
                                        </span>
                                    )}
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <p className="text-4xl font-black text-white">
                                                    R$ {projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                                <span className="text-slate-500 text-xs font-bold uppercase">Previsto</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Faturamento total estimado</p>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-[#0f172a]/50 p-3 rounded-xl border border-[#334155]/50">
                                                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Faturamento Atual</p>
                                                    <p className="text-sm font-black text-white">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                                <div className="bg-[#0f172a]/50 p-3 rounded-xl border border-[#334155]/50">
                                                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Média Diária</p>
                                                    <p className="text-sm font-black text-white">R$ {projection.dailyAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-center border-l border-[#334155]/30 pl-8">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Projeção de Lucro Líquido</p>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${projectedResult >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-500'}`}>
                                                    <span className="material-symbols-outlined">{projectedResult >= 0 ? 'payments' : 'poker_chip'}</span>
                                                </div>
                                                <div>
                                                    <p className={`text-3xl font-black ${projectedResult >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                                                        R$ {projectedResult.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${projectedResult >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                            {projectedRevenue > 0 ? ((projectedResult / projectedRevenue) * 100).toFixed(1) : 0}%
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Margem Final Est.</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                                                <span>Resultado em tempo real:</span>
                                                <span className={currentResult >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                                    R$ {currentResult.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {projection.isCurrent && (
                                        <div className="mt-6 pt-6 border-t border-[#334155]/50">
                                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2">
                                                <span>Progresso do Mês</span>
                                                <span>{projection.daysElapsed} / {projection.daysInMonth} DIAS CORRIDOS</span>
                                            </div>
                                            <div className="h-2 bg-[#0f172a] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
                                                    style={{ width: `${(projection.daysElapsed / projection.daysInMonth) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Quantidade Vendida por Dia</h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dailyData}>
                                        <defs>
                                            <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => parseInt(val.split('-')[2]).toString()}
                                            stroke="#64748b"
                                            fontSize={10}
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                        />
                                        <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                                            labelFormatter={(val) => {
                                                if (!val) return '';
                                                const [y, m, d] = val.split('-');
                                                return `${d}/${m}/${y}`;
                                            }}
                                        />
                                        <Area type="monotone" dataKey="units" stroke="#94a3b8" fillOpacity={1} fill="url(#colorUnits)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesDashboard;
