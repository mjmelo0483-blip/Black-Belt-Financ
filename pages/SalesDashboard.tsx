import React, { useEffect, useState, useMemo } from 'react';
import { useSales } from '../hooks/useSales';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { supabase } from '../supabase';

const SalesDashboard: React.FC = () => {
    const { fetchSales } = useSales();
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
            const cacheKey = `${selectedMonth}-${selectedYear}`;

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
                }
            }

            if (cache[cacheKey]) {
                setSalesData(cache[cacheKey]);
            } else {
                const { data } = await fetchSales({ month: selectedMonth, year: selectedYear });
                if (data) {
                    setSalesData(data);
                    setCache(prev => ({ ...prev, [cacheKey]: data }));
                }
            }

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
        };
        load();
    }, [fetchSales, selectedMonth, selectedYear]);

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
        let totalRev = 0;
        let cmv = 0;
        const revByMethod: Record<string, number> = { 'Crédito': 0, 'Débito': 0, 'PIX': 0, 'Outros': 0 };
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sNorm = selectedStore === 'Todas' ? null : normalize(selectedStore);
        const sales = selectedStore === 'Todas' ? salesData : salesData.filter(s => s.store_name && normalize(s.store_name) === sNorm);

        sales.forEach(sale => {
            let method = sale.payment_method || 'Outros';
            const mNorm = method.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (mNorm.includes('credito')) method = 'Crédito';
            else if (mNorm.includes('debito')) method = 'Débito';
            else if (mNorm.includes('pix')) method = 'PIX';
            else method = 'Outros';

            let saleTotal = 0;
            if (sale.sale_items?.length > 0) {
                sale.sale_items.forEach((item: any) => {
                    const price = Number(item.total_price || 0);
                    const qty = Number(item.quantity || 0);
                    const cost = Number(item.unit_cost !== undefined && item.unit_cost !== null ? item.unit_cost : (item.products?.cost || 0));
                    saleTotal += price;
                    cmv += (cost * qty);
                });
            } else {
                saleTotal = Number(sale.total_amount || 0);
            }
            revByMethod[method] = (revByMethod[method] || 0) + saleTotal;
            totalRev += saleTotal;
        });

        let totalFix = 0;
        let marketingAndDiversas = 0;
        const activeStoreMap = new Set();
        salesData.forEach(s => { if (s.store_name) activeStoreMap.add(normalize(s.store_name)); });
        const activeStoresCount = activeStoreMap.size || 1;
        const prorationFactor = selectedStore !== 'Todas' ? (1 / activeStoresCount) : 1;

        expensesData.forEach(exp => {
            const dreGroup = exp.categories?.dre_group;
            const catName = (exp.categories?.name || '').toLowerCase();
            const desc = (exp.description || '').toLowerCase();
            let amount = Number(exp.amount || 0);

            if (selectedStore !== 'Todas') {
                if (exp.store_name && normalize(exp.store_name) === sNorm) {
                } else if (!exp.store_name) {
                    amount = amount * prorationFactor;
                } else {
                    return;
                }
            }

            if (catName.includes('fornecedor')) return;
            const isCalculated = desc.includes('royalties') || desc.includes('imposto') || desc.includes('tarifa') || desc.includes('perda');
            if (isCalculated && !dreGroup) return;

            if (dreGroup) {
                if (['funcionarios', 'manutencaoVeiculo', 'taxaSistema', 'aluguelContainer', 'combustivel', 'aluguelEscritorio', 'tef', 'despesasFinanceiras', 'contabilidade', 'internet', 'energia', 'outros'].includes(dreGroup)) {
                    totalFix += amount;
                } else if (['marketing', 'diversas'].includes(dreGroup)) {
                    marketingAndDiversas += amount;
                } else if (['cashback', 'perda'].includes(dreGroup)) {
                    // Itens de cashback e perda lançados manualmente entram no cálculo do IMC da DRE, 
                    // mas no Dashboard simplificado usamos a taxa paramétrica para o PE.
                    // Para bater com a DRE, o ideal seria tratar aqui também, mas se usarmos a taxa paramétrica no Dashboard, 
                    // o PE se torna uma "meta teórica" baseada no modelo de negócio. 
                }
            } else {
                if (catName.includes('internet') || catName.includes('celular') || catName.includes('energia') || catName.includes('luz') || catName.includes('funcionario') || catName.includes('salario') || catName.includes('contabil') || catName.includes('escritorio') || catName.includes('container')) {
                    totalFix += amount;
                } else if (catName.includes('marketing') || catName.includes('propaganda')) {
                    marketingAndDiversas += amount;
                } else if (catName.includes('comissao') || desc.includes('cashback')) {
                    // Ignorado aqui para evitar duplicidade com a taxa paramétrica no IMC
                } else {
                    totalFix += amount;
                }
            }
        });

        const taxRate = params.tax_rate / 100;
        const royaltyRate = params.royalty_rate / 100;
        const lossRate = params.loss_rate / 100;
        const pixRate = params.pix_fee_rate / 100;
        const cardRate = params.card_fee_rate / 100;

        const totalBankFees = (revByMethod['PIX'] * pixRate) + ((revByMethod['Crédito'] + revByMethod['Débito']) * cardRate);
        const bankFeeRate = totalRev > 0 ? totalBankFees / totalRev : ((pixRate + cardRate) / 2);

        let avgCashbackRate = 0;
        if (selectedStore !== 'Todas') {
            const rates = params.cashback_rates as Record<string, number>;
            const rateKey = Object.keys(rates).find(rk => normalize(rk) === sNorm);
            avgCashbackRate = (rateKey ? rates[rateKey] : 0) / 100;
        } else {
            let cbTotal = 0;
            const rates = params.cashback_rates as Record<string, number>;
            activeStoreMap.forEach((storeNorm: any) => {
                const rateKey = Object.keys(rates).find(rk => normalize(rk) === storeNorm);
                const r = (rateKey ? rates[rateKey] : 0) / 100;
                cbTotal += r;
            });
            avgCashbackRate = activeStoreMap.size > 0 ? cbTotal / activeStoreMap.size : 0;
        }

        // 1. Índice de Margem de Contribuição (IMC = MC / Faturamento)
        const cmvRate = totalRev > 0 ? cmv / totalRev : 0.45;
        const IMC = 1 - taxRate - royaltyRate - lossRate - bankFeeRate - avgCashbackRate - cmvRate;

        // 2. Custos Fixos Totais (Numerador)
        // Somamos Despesas Fixas + Marketing + Diversas para igualar à lógica da DRE
        const totalFixedCosts = totalFix + marketingAndDiversas;

        // 3. Ponto de Equilíbrio de Faturamento
        const breakEven = totalFixedCosts / Math.max(0.01, IMC);

        return { breakEven, totalRev, totalFix, marketingAndDiversas, IMC };
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
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <p className="text-4xl font-black text-white">
                                            R$ {projection.projectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        <span className="text-slate-500 text-xs font-bold uppercase">Previsto</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Total estimado para o final do mês</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#0f172a]/50 p-3 rounded-xl border border-[#334155]/50">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Faturamento Atual</p>
                                            <p className="text-sm font-black text-white">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            <p className="text-[9px] text-slate-600 font-bold mt-0.5">{projection.daysElapsed} dias decorridos</p>
                                        </div>
                                        <div className="bg-[#0f172a]/50 p-3 rounded-xl border border-[#334155]/50">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Média Diária (Calendário)</p>
                                            <p className="text-sm font-black text-white">R$ {projection.dailyAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            <p className="text-[9px] text-slate-600 font-bold mt-0.5">Baseado em dias corridos</p>
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
