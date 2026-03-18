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
    const DEFAULT_DRE_GROUPS = [
        { id: 'vendas', label: 'Venda de mercadoria (Bruto)', type: 'revenue', isSystem: true },
        { id: 'impostos', label: 'Impostos sobre faturamento', type: 'variable', isSystem: true },
        { id: 'cashback', label: 'Comissão paga ao condominio (cashback)', type: 'variable' },
        { id: 'royalties', label: 'Royalties', type: 'variable' },
        { id: 'tarifaCartao', label: 'Tarifa de cartão', type: 'variable' },
        { id: 'tarifaPix', label: 'Tarifa de Pix', type: 'variable' },
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
    const [dreGroups, setDreGroups] = useState<any[]>(DEFAULT_DRE_GROUPS);

    // Unified Data Load: Parameters, Structure, Sales and Expenses
    useEffect(() => {
        const loadEverything = async () => {
            setSalesData([]);
            setExpensesData([]);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // 1. Fetch DRE structure from Company
            if (activeCompany) {
                const { data: compData } = await supabase
                    .from('companies')
                    .select('dre_structure')
                    .eq('id', activeCompany.id)
                    .single();
                if (compData?.dre_structure && Array.isArray(compData.dre_structure) && compData.dre_structure.length > 0) {
                    setDreGroups(compData.dre_structure);
                }
            }

            // 2. Fetch Parameters for the selected period
            let pQuery = supabase.from('dre_parameters').select('*').eq('month', selectedMonth).eq('year', selectedYear);
            if (activeCompany) pQuery = pQuery.eq('company_id', activeCompany.id);
            else pQuery = pQuery.eq('user_id', session.user.id).is('company_id', null);
            const { data: pData } = await pQuery.maybeSingle();

            if (pData) {
                setParams({
                    tax_rate: Number(pData.tax_rate || 3.24),
                    tax_group_id: pData.tax_group_id || 'impostos',
                    royalty_rate: Number(pData.royalty_rate || 6.00),
                    royalty_group_id: pData.royalty_group_id || 'royalties',
                    pix_fee_rate: Number(pData.pix_fee_rate || 0.80),
                    pix_fee_group_id: pData.pix_fee_group_id || 'tarifaPix',
                    loss_rate: Number(pData.loss_rate || 2.00),
                    loss_group_id: pData.loss_group_id || 'perda',
                    card_fee_rate: Number(pData.card_fee_rate || 1.110284),
                    card_fee_group_id: pData.card_fee_group_id || 'tarifaCartao',
                    cashback_group_id: pData.cashback_group_id || 'cashback',
                    cashback_rates: pData.cashback_rates || {}
                });
            } else {
                setParams({
                    tax_rate: 3.24,
                    tax_group_id: 'impostos',
                    royalty_rate: 6.00,
                    royalty_group_id: 'royalties',
                    pix_fee_rate: 0.80,
                    pix_fee_group_id: 'tarifaPix',
                    loss_rate: 2.00,
                    loss_group_id: 'perda',
                    card_fee_rate: 1.110284,
                    card_fee_group_id: 'tarifaCartao',
                    cashback_group_id: 'cashback',
                    cashback_rates: {}
                });
            }

            // 3. Fetch Sales
            const { data: sData } = await fetchSales({ month: selectedMonth, year: selectedYear });
            if (sData) setSalesData(sData);

            // 4. Fetch Expenses with correct date range
            const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;
            
            let expQuery = supabase.from('transactions')
                .select('amount, type, description, date, due_date, category_id, store_name, categories(name, parent_id, dre_group)')
                .eq('is_business', true).is('transfer_id', null).is('investment_id', null)
                .or('payment_method.not.ilike.transferencia,payment_method.is.null')
                .not('type', 'ilike', 'transfer').not('type', 'ilike', 'investment')
                .gte('date', startDate).lte('date', endDate);
            
            if (activeCompany) expQuery = expQuery.eq('company_id', activeCompany.id);
            else expQuery = expQuery.is('company_id', null);

            const { data: expData } = await expQuery;
            if (expData) setExpensesData(expData);
        };
        loadEverything();
    }, [fetchSales, selectedMonth, selectedYear, activeCompany]);

    const [allPeriods, setAllPeriods] = useState<string[]>([]);




    // Initial load: Periods and DRE Structure
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // Fetch DRE structure
            if (activeCompany) {
                const { data: compData } = await supabase
                    .from('companies')
                    .select('dre_structure')
                    .eq('id', activeCompany.id)
                    .single();
                if (compData?.dre_structure && Array.isArray(compData.dre_structure) && compData.dre_structure.length > 0) {
                    setDreGroups(compData.dre_structure);
                }
            }

            // Fetch periods
            let allDates: any[] = [];
            let page = 0;
            while (page < 20) {
                let q = supabase.from('sales').select('date');
                if (activeCompany) q = q.eq('company_id', activeCompany.id);
                else q = q.eq('user_id', session.user.id).is('company_id', null);
                const { data } = await q.order('date', { ascending: false }).range(page * 1000, (page + 1) * 1000 - 1);
                if (!data || data.length === 0) break;
                allDates = [...allDates, ...data];
                if (data.length < 1000) break;
                page++;
            }
            if (allDates.length > 0) {
                const p = new Set<string>();
                allDates.forEach((s: any) => {
                    const parts = s.date?.split('-');
                    if (parts?.length === 3) p.add(`${parseInt(parts[1]) - 1}-${parts[0]}`);
                });
                setAllPeriods(Array.from(p).sort((a, b) => {
                    const [am, ay] = a.split('-').map(Number);
                    const [bm, by] = b.split('-').map(Number);
                    return ay !== by ? ay - by : am - bm;
                }));
            }
        };
        init();
    }, [activeCompany]);

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

    // 1. Base Filtered Sales (Store, Month, Year) - includes all sales regardless of items
    const filteredSales = useMemo(() => {
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sNorm = selectedStore === 'Todas' ? null : normalize(selectedStore);

        return salesData.filter(sale => {
            if (!sale.date) return false;
            const parts = sale.date.split('-');
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;

            if (y !== selectedYear || m !== selectedMonth) return false;

            if (sNorm) {
                if (!sale.store_name) return false;
                return normalize(sale.store_name) === sNorm;
            }
            return true;
        });
    }, [salesData, selectedMonth, selectedYear, selectedStore]);

    // 2. Filtered Items (adds Category filter)
    const filteredItems = useMemo(() => {
        const items: any[] = [];
        filteredSales.forEach(sale => {
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
        });
        return items;
    }, [filteredSales, selectedCategory]);

    const dreMetrics = useMemo(() => {
        const revByMethod: Record<string, number> = { 'Crédito': 0, 'Débito': 0, 'PIX': 0, 'Dinheiro': 0, 'Outros': 0 };
        let salesOnlyRev = 0;
        let totalRev = 0;
        let cmvCents = 0;

        const normalizeS = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sNorm = selectedStore === 'Todas' ? null : normalizeS(selectedStore);

        filteredSales.forEach(sale => {
            let method = sale.payment_method || 'Outros';
            const normMethod = method.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normMethod.includes('credito')) method = 'Crédito';
            else if (normMethod.includes('debito')) method = 'Débito';
            else if (normMethod.includes('pix')) method = 'PIX';
            else if (normMethod.includes('dinheiro')) method = 'Dinheiro';
            else method = 'Outros';

            const sTotal = Number(sale.total_amount || 0);
            let itemSum = 0;
            if (sale.sale_items && sale.sale_items.length > 0) {
                sale.sale_items.forEach((item: any) => {
                    const lineTotal = Number(item.total_price || 0) || (Number(item.unit_price || 0) * Number(item.quantity || 1));
                    itemSum += lineTotal;
                    const itemQty = Number(item.quantity || 0);
                    const itemCost = Number(item.unit_cost !== undefined && item.unit_cost !== null ? item.unit_cost : (item.products?.cost || 0));
                    cmvCents += Math.round(itemCost * itemQty * 100);
                });
            } else { itemSum = sTotal; }
            const saleTotal = sale.sale_items && sale.sale_items.length > 0 ? itemSum : sTotal;
            revByMethod[method] = (revByMethod[method] || 0) + saleTotal;
            salesOnlyRev += saleTotal;
            totalRev += saleTotal;
        });

        const storeMap = new Map<string, string>();
        salesData.forEach(s => { if (s.store_name) { const norm = normalizeS(s.store_name); if (norm !== 'geral' && norm !== 'administrativo' && !storeMap.has(norm)) storeMap.set(norm, s.store_name); } });
        const activeStores = Array.from(storeMap.values());

        const storeRevMapTotal: Record<string, number> = {};
        const storeManualCashback: Record<string, { amount: number }> = {};
        activeStores.forEach(s => { storeRevMapTotal[normalizeS(s)] = 0; storeManualCashback[s] = { amount: 0 }; });

        salesData.forEach(sale => {
            if (sale.store_name) {
                const norm = normalizeS(sale.store_name);
                if (norm === 'geral' || norm === 'administrativo') return;
                let saleTotal = 0;
                if (sale.sale_items && sale.sale_items.length > 0) { sale.sale_items.forEach((item: any) => { saleTotal += Number(item.total_price || 0); }); }
                else { saleTotal = Number(sale.total_amount || 0); }
                storeRevMapTotal[norm] = (storeRevMapTotal[norm] || 0) + saleTotal;
            }
        });

        const storesWithRevenue = activeStores.filter(s => (storeRevMapTotal[normalizeS(s)] || 0) > 0);
        const storesWithRevenueCount = storesWithRevenue.length || 1;
        const isCurrentStoreInRevenueList = selectedStore !== 'Todas' && storesWithRevenue.some(s => normalizeS(s) === sNorm);
        const prorationFactor = selectedStore === 'Todas' ? 1 : (isCurrentStoreInRevenueList ? (1 / storesWithRevenueCount) : 0);

        const varGroups: Record<string, { label: string; amount: number, items: any[] }> = {};
        const fixGroups: Record<string, { label: string; amount: number, items: any[] }> = {};
        const revGroups: Record<string, { label: string; amount: number, items: any[] }> = {};
        dreGroups.forEach(g => {
            const groupData = { label: g.label, amount: 0, items: [] };
            if (g.type === 'variable') varGroups[g.id] = groupData;
            else if (g.type === 'fixed') fixGroups[g.id] = groupData;
            else if (g.type === 'revenue') revGroups[g.id] = groupData;
        });

        expensesData.forEach(exp => {
            const catName = (exp.categories?.name || 'Geral').toLowerCase();
            const dreGroup = exp.categories?.dre_group;
            const isIncome = exp.type?.toLowerCase().includes('income');
            let amount = Number(exp.amount || 0);
            const expNorm = normalizeS(exp.store_name);
            const isGeralItem = !exp.store_name || expNorm === 'geral' || expNorm === 'administrativo';

            if (selectedStore !== 'Todas') {
                if (expNorm === sNorm) {} else if (isGeralItem) { amount = amount * prorationFactor; } 
                else { return; }
            }

            const expToPush = (selectedStore !== 'Todas' && isGeralItem) ? { ...exp, amount, is_prorated: true } : exp;

            if (isIncome) {
                const isProductCompany = activeCompany?.business_type === 'products';
                const hasSalesData = salesOnlyRev > 0;
                const isSalesGroup = !dreGroup || dreGroup === 'vendas';
                
                if (isProductCompany && hasSalesData && isSalesGroup) return;

                if (dreGroup && revGroups[dreGroup]) {
                    revGroups[dreGroup].amount += amount;
                    revGroups[dreGroup].items.push(expToPush);
                } else {
                    const defaultRevGroup = revGroups.vendas || Object.values(revGroups)[0];
                    if (defaultRevGroup) {
                        defaultRevGroup.amount += amount;
                        defaultRevGroup.items.push(expToPush);
                    }
                }
                totalRev += amount;
                return;
            }

            if (catName.includes('fornecedor') || catName.includes('retirada sócios') || catName.includes('retirada socios')) return;

            if (dreGroup) {
                if (varGroups[dreGroup]) { varGroups[dreGroup].amount += amount; varGroups[dreGroup].items.push(expToPush); }
                else if (fixGroups[dreGroup]) { fixGroups[dreGroup].amount += amount; fixGroups[dreGroup].items.push(expToPush); }
                else if (revGroups[dreGroup]) { revGroups[dreGroup].amount += amount; revGroups[dreGroup].items.push(expToPush); }
                return;
            }

            const isTaxCategory = catName.includes('imposto') || catName.includes('das') || catName.includes('simples nacional');
            if (isTaxCategory && (params as any).tax_group_id && varGroups[(params as any).tax_group_id]) {
                varGroups[(params as any).tax_group_id].amount += amount;
                varGroups[(params as any).tax_group_id].items.push(expToPush);
                return;
            }

            if (fixGroups.outros) {
                fixGroups.outros.amount += amount;
                fixGroups.outros.items.push(expToPush);
            } else {
                const firstFix = Object.values(fixGroups)[0];
                if (firstFix) {
                    firstFix.amount += amount;
                    firstFix.items.push(expToPush);
                }
            }
        });

        const impostos = (params as any).tax_group_id && varGroups[(params as any).tax_group_id] && varGroups[(params as any).tax_group_id].amount > 0 
            ? varGroups[(params as any).tax_group_id].amount 
            : (totalRev * (params.tax_rate / 100));

        const perdaEstoque = (params as any).loss_group_id && varGroups[(params as any).loss_group_id] && varGroups[(params as any).loss_group_id].amount > 0 
            ? varGroups[(params as any).loss_group_id].amount 
            : (totalRev * (params.loss_rate / 100));

        if (selectedStore !== 'Todas') {
            activeStores.forEach(s => {
                if (normalizeS(s) !== sNorm) return;
                const rates = params.cashback_rates as Record<string, number>;
                const rateKey = Object.keys(rates).find(rk => normalizeS(rk) === normalizeS(s));
                const rate = rateKey ? rates[rateKey] : 0;
                if (varGroups[(params as any).cashback_group_id] && varGroups[(params as any).cashback_group_id].amount === 0) {
                    varGroups[(params as any).cashback_group_id].amount += (totalRev * (rate / 100));
                }
            });
        }

        if (revGroups.vendas) revGroups.vendas.amount += salesOnlyRev; 

        const totalVar = Object.entries(varGroups)
            .filter(([id]) => id !== (params as any).tax_group_id && id !== (params as any).loss_group_id)
            .reduce((acc, [_, g]) => acc + g.amount, 0);
        const totalFix = Object.values(fixGroups).reduce((acc, g) => acc + g.amount, 0);
        const cmv = cmvCents / 100;
        const totalVariableExpenses = cmv + totalVar + impostos + perdaEstoque;
        const margemContribuicao = totalRev - totalVariableExpenses;
        const currentIMC = totalRev > 0 ? margemContribuicao / totalRev : (1 - (params.tax_rate + params.royalty_rate + params.loss_rate + params.card_fee_rate) / 100 - 0.45);
        const currentBreakEven = totalFix / Math.max(0.01, currentIMC);

        return { breakEven: currentBreakEven, totalRev, totalFix, IMC: currentIMC, fixedCosts: totalFix };
    }, [salesData, expensesData, params, selectedStore, dreGroups, filteredSales, activeCompany]);


    const targetRevenue = isNaN(dreMetrics.breakEven) || !isFinite(dreMetrics.breakEven) ? 0 : dreMetrics.breakEven;
    const totalRevenue = dreMetrics.totalRev; 
    const balancePercentage = targetRevenue > 0 ? Math.min(Math.round((totalRevenue / targetRevenue) * 100), 100) : (totalRevenue > 0 ? 100 : 0);
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // 3. Metrics (Base Revenue and Units)
    const { totalRevenue: baseSalesRevenue, totalUnits, relevantSalesCount } = useMemo(() => {
        let rev = 0;
        let units = 0;
        const saleIds = new Set();

        if (selectedCategory === 'Todas') {
            filteredSales.forEach(sale => {
                saleIds.add(sale.id);
                const sTotal = Number(sale.total_amount || 0);
                let itemSum = 0;

                if (sale.sale_items && sale.sale_items.length > 0) {
                    sale.sale_items.forEach((it: any) => {
                        const lineTotal = Number(it.total_price || 0) || (Number(it.unit_price || 0) * Number(it.quantity || 1));
                        itemSum += lineTotal;
                        units += Number(it.quantity || 0);
                    });
                }

                // Use maximum to ensure we don't undercount if items are partially loaded
                rev += Math.max(sTotal, itemSum);
            });
        } else {
            // Category specific - only from items that match category
            filteredItems.forEach(item => {
                const lineTotal = Number(item.total_price || 0) || (Number(item.unit_price || 0) * Number(item.quantity || 1));
                rev += lineTotal;
                units += Number(item.quantity || 0);
            });
            filteredSales.forEach(sale => {
                const hasItem = sale.sale_items?.some((it: any) => it.products?.category === selectedCategory);
                if (hasItem) saleIds.add(sale.id);
            });
        }

        return { totalRevenue: rev, totalUnits: units, relevantSalesCount: saleIds.size };
    }, [filteredSales, filteredItems, selectedCategory]);

    const safeTotalRevenue = dreMetrics.totalRev;
    const averageTicket = relevantSalesCount > 0 ? (dreMetrics.totalRev / relevantSalesCount) : 0;


    // 4. Product Ranking (Improved Grouping with Accent Normalization)
    const topProductsByRevenue = useMemo(() => {
        const normalizeProdName = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const map: Record<string, { name: string, total: number, count: number }> = {};

        filteredItems.forEach(item => {
            const prod = item.products;
            const rawName = prod?.name || 'Produto sem cadastro';
            const normName = normalizeProdName(rawName);

            if (!map[normName]) {
                map[normName] = { name: rawName.toUpperCase().trim(), total: 0, count: 0 };
            }

            // Using unit_price * quantity as primary if total_price is null or zero (to handle imports that only have unit prices)
            const qty = Number(item.quantity || 0);
            const unitPrice = Number(item.unit_price || 0);
            const totalPrice = Number(item.total_price || 0);

            // If total_price is available and significant, use it. Otherwise calculate from unit_price.
            const itemRevenue = (totalPrice > 0) ? totalPrice : (unitPrice * qty);

            map[normName].total += itemRevenue;
            map[normName].count += qty;
        });

        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [filteredItems]);

    const topProductsByQty = useMemo(() => {
        return [...topProductsByRevenue].sort((a, b) => b.count - a.count);
    }, [topProductsByRevenue]);

    const bestProduct = topProductsByRevenue.length > 0 ? topProductsByRevenue[0] : { name: '-', total: 0, count: 0 };

    // 5. Daily Data (Consolidated with Corrected Revenue)
    const dailyData = useMemo(() => {
        const map: Record<string, { date: string, revenue: number, units: number }> = {};

        if (selectedCategory === 'Todas') {
            filteredSales.forEach(sale => {
                const d = sale.date;
                if (!map[d]) map[d] = { date: d, revenue: 0, units: 0 };

                const sTotal = Number(sale.total_amount || 0);
                let itemSum = 0;

                if (sale.sale_items && sale.sale_items.length > 0) {
                    sale.sale_items.forEach((it: any) => {
                        const lineTotal = Number(it.total_price || 0) || (Number(it.unit_price || 0) * Number(it.quantity || 1));
                        itemSum += lineTotal;
                        map[d].units += Number(it.quantity || 0);
                    });
                }
                map[d].revenue += Math.max(sTotal, itemSum);
            });
        } else {
            filteredItems.forEach(item => {
                const d = item.date;
                if (!map[d]) map[d] = { date: d, revenue: 0, units: 0 };
                const lineTotal = Number(item.total_price || 0) || (Number(item.unit_price || 0) * Number(item.quantity || 1));
                map[d].revenue += lineTotal;
                map[d].units += Number(item.quantity || 0);
            });
        }

        return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredSales, filteredItems, selectedCategory]);

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
        let lastSaleDay = today.getDate();
        if (lastSaleDateStr) {
            const dayPart = lastSaleDateStr.split('-')[2];
            if (dayPart) lastSaleDay = parseInt(dayPart) || today.getDate();
        }

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
                        <p className="text-xl font-black text-white whitespace-nowrap">R$ {(totalRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
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

                    {/* Gráficos Lado a Lado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">inventory_2</span> Top 10 Produtos Mais Vendidos
                            </h3>
                            <div className="h-[450px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={topProductsByQty.slice(0, 10)}>
                                        <XAxis type="number" hide />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            stroke="#94a3b8"
                                            fontSize={10}
                                            width={150}
                                            tick={{ fill: '#94a3b8', fontWeight: 700 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-[#1e293b] p-3 border border-[#334155] rounded-xl shadow-xl">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{data.name}</p>
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-black text-white">
                                                                    Total: R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </p>
                                                                <p className="text-xs font-bold text-indigo-400">
                                                                    Quantidade: {data.count} un.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">show_chart</span> Quantidade Vendida por Dia
                            </h3>
                            <div className="h-[450px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dailyData}>
                                        <defs>
                                            <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
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
                                        <Area type="monotone" dataKey="units" stroke="#818cf8" fillOpacity={1} fill="url(#colorUnits)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Bloco de Projeção Full Width */}
                    <div className="bg-[#1e293b] overflow-hidden rounded-2xl border border-[#334155] shadow-xl">
                        <div className="bg-indigo-600/10 px-6 py-4 border-b border-[#334155] flex justify-between items-center">
                            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">trending_up</span> Projeção de Resultado e Faturamento
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
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">Faturamento total estimado para o fechamento do mês</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#0f172a]/50 p-4 rounded-xl border border-[#334155]/50">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Faturamento Atual</p>
                                            <p className="text-lg font-black text-white">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="bg-[#0f172a]/50 p-4 rounded-xl border border-[#334155]/50">
                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Média Diária</p>
                                            <p className="text-lg font-black text-white">R$ {projection.dailyAverage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col justify-center border-l border-[#334155]/30 pl-8">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">Estimativa de Lucro Líquido</p>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${projectedResult >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-500'}`}>
                                            <span className="material-symbols-outlined text-3xl">{projectedResult >= 0 ? 'payments' : 'poker_chip'}</span>
                                        </div>
                                        <div>
                                            <p className={`text-4xl font-black ${projectedResult >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                                                R$ {projectedResult.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[11px] font-black px-2 py-0.5 rounded ${projectedResult >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {projectedRevenue > 0 ? ((projectedResult / projectedRevenue) * 100).toFixed(1) : 0}%
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Margem Final Projetada</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 text-[10px] font-bold uppercase overflow-hidden">
                                        <span className="text-slate-400">Resultado Operacional em Tempo Real:</span>
                                        <span className={currentResult >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            R$ {currentResult.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {projection.isCurrent && (
                                <div className="mt-8 pt-6 border-t border-[#334155]/50">
                                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">
                                        <span>Progresso do Período</span>
                                        <span>{projection.daysElapsed} / {projection.daysInMonth} DIAS CORRIDOS</span>
                                    </div>
                                    <div className="h-2.5 bg-[#0f172a] rounded-full overflow-hidden p-0.5 border border-[#334155]/50">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all duration-1000"
                                            style={{ width: `${(projection.daysElapsed / projection.daysInMonth) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesDashboard;
