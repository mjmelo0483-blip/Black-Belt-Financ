import React, { useState, useEffect, useMemo } from 'react';
import { supabase, withRetry } from '../supabase';
import { useSales } from '../hooks/useSales';
import { useView } from '../contexts/ViewContext';
import { useCompany } from '../contexts/CompanyContext';

const DRE: React.FC = () => {
    const { fetchSales, loading: salesLoading } = useSales();
    const { isBusiness } = useView();
    const { activeCompany } = useCompany();
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
        cashback_rates: {} as Record<string, number>
    });
    const [currentParamId, setCurrentParamId] = useState<string | null>(null);
    const [configTab, setConfigTab] = useState<'rates' | 'mapping' | 'groups'>('rates');
    const [categories, setCategories] = useState<any[]>([]);

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
    const [editingGroup, setEditingGroup] = useState<{ id: string, label: string, type: string } | null>(null);
    const [isAddingGroup, setIsAddingGroup] = useState(false);

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
                let query = supabase
                    .from('sales')
                    .select('date');

                if (activeCompany) {
                    query = query.eq('company_id', activeCompany.id);
                } else {
                    query = query.eq('user_id', session.user.id).is('company_id', null);
                }

                const { data, error } = await query
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

            // Fetch DRE structure from company
            if (activeCompany) {
                const { data: compData } = await supabase
                    .from('companies')
                    .select('dre_structure')
                    .eq('id', activeCompany.id)
                    .single();
                
                if (compData?.dre_structure && Array.isArray(compData.dre_structure) && compData.dre_structure.length > 0) {
                    setDreGroups(compData.dre_structure);
                } else {
                    setDreGroups(DEFAULT_DRE_GROUPS);
                }
            }

            // Fetch all known stores to ensure config is always populated
            let storeQuery = supabase
                .from('sales')
                .select('store_name')
                .not('store_name', 'is', null);

            if (activeCompany) {
                storeQuery = storeQuery.eq('company_id', activeCompany.id);
            } else {
                storeQuery = storeQuery.is('company_id', null);
            }

            const { data: storeData } = await storeQuery;

            const dbStores = storeData ? storeData.map(s => s.store_name) : [];

            // Deduplicate case-insensitive and accent-insensitive
            const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const storeMap = new Map<string, string>();
            dbStores.forEach(name => {
                if (!name) return;
                const normalized = normalize(name);
                // If we don't have it yet, OR if the new name is "prettier" (more uppercase letters, or has accents which are usually more correct)
                const current = storeMap.get(normalized);

                const currentScore = current ? (current.match(/[A-Z]/g)?.length || 0) + (current.match(/[áéíóúâêîôûãõàèìòù]/gi)?.length || 0) : -1;
                const newScore = (name.match(/[A-Z]/g)?.length || 0) + (name.match(/[áéíóúâêîôûãõàèìòù]/gi)?.length || 0);

                if (!current || newScore > currentScore) {
                    storeMap.set(normalized, name);
                }
            });

            const uniqueStores = Array.from(storeMap.values()).sort();
            setAllKnownStores(uniqueStores);

            // Fetch categories for mapping
            let catQuery = supabase
                .from('categories')
                .select('*')
                .eq('is_business', true);

            if (activeCompany) {
                catQuery = catQuery.eq('company_id', activeCompany.id);
            } else {
                catQuery = catQuery.is('company_id', null);
            }

            const { data: catData } = await catQuery
                .order('name');
            setCategories(catData || []);
        };
        loadInitialData();
    }, [activeCompany]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            // Fetch Parameters
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                let paramQuery = supabase
                    .from('dre_parameters')
                    .select('*')
                    .eq('month', selectedMonth)
                    .eq('year', selectedYear);

                if (activeCompany) {
                    paramQuery = paramQuery.eq('company_id', activeCompany.id);
                } else {
                    paramQuery = paramQuery.eq('user_id', session.user.id).is('company_id', null);
                }

                const { data: pData } = await paramQuery.maybeSingle();

                if (pData) {
                    setCurrentParamId(pData.id);
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
                    setCurrentParamId(null);
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
            }

            const { data } = await fetchSales({ month: selectedMonth, year: selectedYear });
            if (data) setSalesData(data);

            const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            let expQuery = supabase
                .from('transactions')
                .select('amount, type, description, date, due_date, category_id, store_name, categories(name, parent_id, dre_group)')
                .eq('is_business', true)
                .is('transfer_id', null)
                .is('investment_id', null)
                .or('payment_method.not.ilike.transferencia,payment_method.is.null')
                .not('type', 'ilike', 'transfer')
                .not('type', 'ilike', 'investment')
                .gte('date', startDate)
                .lte('date', endDate);

            if (activeCompany) {
                expQuery = expQuery.eq('company_id', activeCompany.id);
            } else {
                expQuery = expQuery.is('company_id', null);
            }

            const { data: expData } = await expQuery;

            if (expData) setExpensesData(expData);
            setLoading(false);
        };
        load();
    }, [fetchSales, selectedMonth, selectedYear, activeCompany]);

    const stores = useMemo(() => {
        const normalize = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const storeMap = new Map<string, string>();

        const addStore = (name: string) => {
            if (!name) return;
            const normalized = normalize(name);
            if (normalized === 'geral' || normalized === 'administrativo' || normalized === 'todos') return;
            const current = storeMap.get(normalized);

            // Score based on Uppercase letters and Accents (correct typing)
            const getScore = (s: string) => (s.match(/[A-Z]/g)?.length || 0) + (s.match(/[áéíóúâêîôûãõàèìòù]/gi)?.length || 0);

            if (!current || getScore(name) > getScore(current)) {
                storeMap.set(normalized, name);
            }
        };

        allKnownStores.forEach(addStore);
        salesData.forEach(sale => { if (sale.store_name) addStore(sale.store_name); });
        expensesData.forEach(exp => { if (exp.store_name) addStore(exp.store_name); });

        return Array.from(storeMap.values()).sort();
    }, [salesData, expensesData, allKnownStores]);

    const saveParams = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { error, data } = await supabase
            .from('dre_parameters')
            .upsert({
                id: currentParamId || undefined,
                user_id: session.user.id,
                month: selectedMonth,
                year: selectedYear,
                ...params,
                is_business: !!activeCompany,
                company_id: activeCompany?.id || null
            }, {
                onConflict: currentParamId ? 'id' : (activeCompany ? 'company_id, month, year' : 'user_id, month, year')
            })
            .select('id')
            .single();

        if (error) {
            console.error('Error saving dre_parameters:', error);
            alert('Erro ao salvar configurações.');
        } else {
            if (data) setCurrentParamId(data.id);
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
        revGroups: Record<string, { label: string; amount: number; items: any[] }>;
        totalRev: number;
        impostos: number;
        commissions: number;
        cardFees: number;
        pixFees: number;
        royalties: number;
        operadoraMargin: number;
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
        IMC: number;
        breakEven: number;
    }

    const metrics = useMemo<DREMetrics>(() => {
        const revByMethod: Record<string, number> = { 'Crédito': 0, 'Débito': 0, 'PIX': 0, 'Dinheiro': 0, 'Outros': 0 };
        let totalRev = 0;
        let cmvCents = 0;

        const normalizeStore = (name: string) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const filteredSales = selectedStore === 'Todas' ? salesData : salesData.filter(s => {
            if (!s.store_name) return false;
            return normalizeStore(s.store_name) === normalizeStore(selectedStore);
        });

        filteredSales.forEach(sale => {
            let method = sale.payment_method || 'Outros';
            const normMethod = method.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            if (normMethod.includes('credito') || normMethod.includes('credit')) method = 'Crédito';
            else if (normMethod.includes('debito') || normMethod.includes('debit')) method = 'Débito';
            else if (normMethod.includes('pix')) method = 'PIX';
            else if (normMethod.includes('dinheiro') || normMethod.includes('cash') || normMethod.includes('especie')) method = 'Dinheiro';
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
            }

            const saleTotal = Math.max(sTotal, itemSum);
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

        // Identify stores with actual revenue to perform linear proration
        const storeRevMapTotal: Record<string, number> = {};
        salesData.forEach(sale => {
            if (sale.store_name) {
                const norm = normalizeStore(sale.store_name);
                if (norm === 'geral' || norm === 'administrativo') return;

                let saleTotal = 0;
                if (sale.sale_items && sale.sale_items.length > 0) {
                    sale.sale_items.forEach((item: any) => {
                        saleTotal += Number(item.total_price || 0);
                    });
                } else {
                    saleTotal = Number(sale.total_amount || 0);
                }
                storeRevMapTotal[norm] = (storeRevMapTotal[norm] || 0) + saleTotal;
            }
        });

        const storesWithRevenue = activeStores.filter(s => (storeRevMapTotal[normalizeStore(s)] || 0) > 0);
        const storesWithRevenueCount = storesWithRevenue.length || 1;

        const isCurrentStoreInRevenueList = selectedStore !== 'Todas' && storesWithRevenue.some(s => normalizeStore(s) === normalizeStore(selectedStore));

        // Linear proration factor: 1/N for stores with revenue, 0 for others
        const prorationFactor = selectedStore === 'Todas'
            ? 1
            : (isCurrentStoreInRevenueList ? (1 / storesWithRevenueCount) : 0);

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

        const varGroups: Record<string, { label: string; amount: number; items: any[] }> = {};
        const fixGroups: Record<string, { label: string; amount: number; items: any[] }> = {};
        const revGroups: Record<string, { label: string; amount: number; items: any[] }> = {};

        dreGroups.forEach(g => {
            const groupData = { label: g.label, amount: 0, items: [] };
            if (g.type === 'variable') varGroups[g.id] = groupData;
            else if (g.type === 'fixed') fixGroups[g.id] = groupData;
            else if (g.type === 'revenue') revGroups[g.id] = groupData;
        });

        // Ensure group data is initialized correctly
        Object.keys(varGroups).forEach(id => { if (!varGroups[id]) varGroups[id] = { label: '', amount: 0, items: [] }; });
        Object.keys(fixGroups).forEach(id => { if (!fixGroups[id]) fixGroups[id] = { label: '', amount: 0, items: [] }; });
        Object.keys(revGroups).forEach(id => { if (!revGroups[id]) revGroups[id] = { label: '', amount: 0, items: [] }; });

        expensesData.forEach(exp => {
            const catName = (exp.categories?.name || 'Geral').toLowerCase();
            const dreGroup = exp.categories?.dre_group;
            const desc = (exp.description || '').toLowerCase();
            const isIncome = exp.type?.toLowerCase().includes('income');
            let amount = Number(exp.amount || 0);

            const sNorm = normalizeStore(exp.store_name);
            const isGeralItem = !exp.store_name || sNorm === 'geral' || sNorm === 'administrativo';

            if (selectedStore !== 'Todas') {
                const selNorm = normalizeStore(selectedStore);
                if (sNorm === selNorm) {
                    // Specific to this store
                } else if (isGeralItem) {
                    amount = amount * prorationFactor;
                } else {
                    return;
                }
            }

            const expToPush = (selectedStore !== 'Todas' && isGeralItem) ? { ...exp, amount, is_prorated: true } : exp;
            
            if (isIncome) {
                if (dreGroup && revGroups[dreGroup]) {
                    revGroups[dreGroup].amount += amount;
                    revGroups[dreGroup].items.push(expToPush);
                }
                totalRev += amount;
                return;
            }

            const pushToGroup = (group: any) => {
                group.amount += amount;
                group.items.push(expToPush);
            };

            if (catName.includes('fornecedor') || catName.includes('retirada sócios') || catName.includes('retirada socios')) return;

            // --- Prioridade 0: Mapeamento da Categoria ---
            if (dreGroup) {
                if (dreGroup === params.cashback_group_id) {
                    const sNorm = exp.store_name ? normalizeStore(exp.store_name) : null;
                    const cashbackKey = activeStores.find(as => normalizeStore(as) === sNorm);

                    if (cashbackKey && storeManualCashback[cashbackKey]) {
                        storeManualCashback[cashbackKey].amount += amount;
                        storeManualCashback[cashbackKey].items.push(expToPush);
                    } else if (varGroups[dreGroup]) {
                        pushToGroup(varGroups[dreGroup]);
                    }
                } else if (varGroups[dreGroup]) {
                    pushToGroup(varGroups[dreGroup]);
                } else if (fixGroups[dreGroup]) {
                    pushToGroup(fixGroups[dreGroup]);
                } else if (revGroups[dreGroup]) {
                    pushToGroup(revGroups[dreGroup]);
                }
                return;
            }

            // Fallback: If not mapped to any group, send to 'Outros' (Fixed)
            if (fixGroups.outros) {
                pushToGroup(fixGroups.outros);
            } else {
                const firstFix = Object.values(fixGroups)[0];
                if (firstFix) pushToGroup(firstFix);
            }
        });

        // Calculate automatic values
        const autoImpostos = (totalRev * (params.tax_rate / 100));
        const autoPerdaEstoque = (totalRev * (params.loss_rate / 100));
        const autoRoyalties = (totalRev * (params.royalty_rate / 100));
        const autoPixFee = (revByMethod['PIX'] * (params.pix_fee_rate / 100));
        const autoCardFee = ((revByMethod['Crédito'] + revByMethod['Débito']) * (params.card_fee_rate / 100));
        
        // Apply automatic values ONLY if the group is still empty (manual override)
        // or just add them if it's the intended way. User requested to prioritize manual entries.
        if (params.tax_group_id && varGroups[params.tax_group_id] && varGroups[params.tax_group_id].amount === 0) {
            varGroups[params.tax_group_id].amount = autoImpostos;
        }
        if (params.loss_group_id && varGroups[params.loss_group_id] && varGroups[params.loss_group_id].amount === 0) {
            varGroups[params.loss_group_id].amount = autoPerdaEstoque;
        }
        if (params.royalty_group_id && varGroups[params.royalty_group_id] && varGroups[params.royalty_group_id].amount === 0) {
            varGroups[params.royalty_group_id].amount = autoRoyalties;
        }
        if (params.pix_fee_group_id && varGroups[params.pix_fee_group_id] && varGroups[params.pix_fee_group_id].amount === 0) {
            varGroups[params.pix_fee_group_id].amount = autoPixFee;
        }
        if (params.card_fee_group_id && varGroups[params.card_fee_group_id] && varGroups[params.card_fee_group_id].amount === 0) {
            varGroups[params.card_fee_group_id].amount = autoCardFee;
        }

        // Final metrics sync
        impostos = params.tax_group_id && varGroups[params.tax_group_id] ? varGroups[params.tax_group_id].amount : autoImpostos;
        perdaEstoque = params.loss_group_id && varGroups[params.loss_group_id] ? varGroups[params.loss_group_id].amount : autoPerdaEstoque;

        if (selectedStore !== 'Todas') {
            const sNorm = normalizeStore(selectedStore);
            const key = Object.keys(storeManualCashback).find(k => normalizeStore(k) === sNorm);
            const manual = key ? storeManualCashback[key] : null;

            if (manual && manual.amount > 0) {
                if (varGroups[params.cashback_group_id]) {
                    varGroups[params.cashback_group_id].amount += manual.amount;
                    varGroups[params.cashback_group_id].items.push(...manual.items);
                }
            } else {
                const rates = params.cashback_rates as Record<string, number>;
                const rateKey = Object.keys(rates).find(rk => normalizeStore(rk) === sNorm);
                const rate = rateKey ? rates[rateKey] : 0;
                if (varGroups[params.cashback_group_id] && varGroups[params.cashback_group_id].amount === 0) {
                    varGroups[params.cashback_group_id].amount += (totalRev * (rate / 100));
                }
            }
        } else {
            activeStores.forEach(s => {
                const manual = storeManualCashback[s];
                if (manual && manual.amount > 0) {
                    if (varGroups[params.cashback_group_id]) {
                        varGroups[params.cashback_group_id].amount += manual.amount;
                        varGroups[params.cashback_group_id].items.push(...manual.items);
                    }
                } else {
                    const rates = params.cashback_rates as Record<string, number>;
                    const rateKey = Object.keys(rates).find(rk => normalizeStore(rk) === normalizeStore(s));
                    const rate = rateKey ? rates[rateKey] : 0;
                    const sRev = storeRevMap[s] || 0;
                    if (varGroups[params.cashback_group_id] && varGroups[params.cashback_group_id].amount === 0) {
                        varGroups[params.cashback_group_id].amount += (sRev * (rate / 100));
                    }
                }
            });
        }

        if (revGroups.vendas && revGroups.vendas.amount === 0) {
            revGroups.vendas.amount = totalRev; 
        }

        const totalVar = Object.values(varGroups).reduce((acc, g) => acc + g.amount, 0);
        const totalFix = Object.values(fixGroups).reduce((acc, g) => acc + g.amount, 0);

        const rl = totalRev - impostos;
        const grossMargin = rl - cmv;
        const marginAfterLoss = grossMargin - perdaEstoque;
        const netProfit = marginAfterLoss - totalVar - totalFix;

        // Marginal Contribution calculation
        // Total Var includes everything in varGroups (mapped taxes, royalties, etc.)
        // We just need to add CMV and any calculated variables NOT in groups (though we try to keep them in groups now)
        const totalVariableExpenses = cmv + totalVar + (params.tax_group_id ? 0 : impostos) + (params.loss_group_id ? 0 : perdaEstoque);
        const margemContribuicao = totalRev - totalVariableExpenses;
        
        const IMC = totalRev > 0 ? margemContribuicao / totalRev : (1 - (params.tax_rate + params.royalty_rate + params.loss_rate + params.card_fee_rate) / 100 - 0.45);
        const breakEven = totalFix / Math.max(0.01, IMC);

        return {
            revByMethod,
            revGroups,
            totalRev,
            impostos,
            commissions: (varGroups[params.cashback_group_id]?.amount || 0),
            cardFees: (varGroups[params.card_fee_group_id]?.amount || 0),
            pixFees: (varGroups[params.pix_fee_group_id]?.amount || 0),
            royalties: (varGroups[params.royalty_group_id]?.amount || 0),
            operadoraMargin: (varGroups[params.pix_fee_group_id]?.amount || 0) + (varGroups[params.card_fee_group_id]?.amount || 0),
            rl,
            cmv,
            grossMargin,
            perdaEstoque,
            marginAfterLoss,
            varGroups,
            totalVar,
            fixGroups,
            totalFix,
            netProfit,
            IMC,
            breakEven
        };
    }, [salesData, expensesData, params, selectedStore, dreGroups]);

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
                {isNegative && value > 0 ? '-' : ''} R$ {Math.abs(Number(value)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <div className="bg-[#1e293b] border border-amber-500/30 p-4 rounded-xl shadow-xl animate-in zoom-in-95 duration-200 mt-2">
                    <div className="flex justify-between items-center mb-6 border-b border-[#334155]/50">
                        <div className="flex gap-6">
                            {(['rates', 'groups', 'mapping'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setConfigTab(tab)}
                                    className={`text-[10px] font-black uppercase tracking-widest pb-3 border-b-2 transition-all ${configTab === tab ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">
                                            {tab === 'rates' ? 'percent' : tab === 'groups' ? 'edit_note' : 'account_tree'}
                                        </span>
                                        {tab === 'rates' ? 'Taxas e Comissões' : tab === 'groups' ? 'Tópicos DRE' : 'Mapeamento de Contas'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <h3 className="text-amber-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-sm">tune</span>
                            Configurações da DRE
                        </h3>
                    </div>

                    {configTab === 'rates' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Impostos (Geral %)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number" step="0.01" value={params.tax_rate}
                                            onChange={(e) => setParams({ ...params, tax_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                    <select 
                                        value={params.tax_group_id} 
                                        onChange={e => setParams({...params, tax_group_id: e.target.value})}
                                        className="bg-[#0f172a] border border-[#334155] rounded-xl px-2 text-[10px] font-black uppercase text-amber-500 outline-none w-1/2"
                                    >
                                        <option value="">Destino DRE...</option>
                                        {dreGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Royalties (% Faturamento)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number" step="0.1" value={params.royalty_rate}
                                            onChange={(e) => setParams({ ...params, royalty_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                    <select 
                                        value={params.royalty_group_id} 
                                        onChange={e => setParams({...params, royalty_group_id: e.target.value})}
                                        className="bg-[#0f172a] border border-[#334155] rounded-xl px-2 text-[10px] font-black uppercase text-amber-500 outline-none w-1/2"
                                    >
                                        <option value="">Destino DRE...</option>
                                        {dreGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tarifa PIX (% sobre PIX)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number" step="0.01" value={params.pix_fee_rate}
                                            onChange={(e) => setParams({ ...params, pix_fee_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                    <select 
                                        value={params.pix_fee_group_id} 
                                        onChange={e => setParams({...params, pix_fee_group_id: e.target.value})}
                                        className="bg-[#0f172a] border border-[#334155] rounded-xl px-2 text-[10px] font-black uppercase text-amber-500 outline-none w-1/2"
                                    >
                                        <option value="">Destino DRE...</option>
                                        {dreGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Perdas (% Faturamento)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number" step="0.1" value={params.loss_rate}
                                            onChange={(e) => setParams({ ...params, loss_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                    <select 
                                        value={params.loss_group_id} 
                                        onChange={e => setParams({...params, loss_group_id: e.target.value})}
                                        className="bg-[#0f172a] border border-[#334155] rounded-xl px-2 text-[10px] font-black uppercase text-amber-500 outline-none w-1/2"
                                    >
                                        <option value="">Destino DRE...</option>
                                        {dreGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Tarifa Cartão (% Crédito+Débito)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number" step="0.000001" value={params.card_fee_rate}
                                            onChange={(e) => setParams({ ...params, card_fee_rate: Number(e.target.value) })}
                                            className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span className="absolute right-3 top-2 text-slate-500 font-black">%</span>
                                    </div>
                                    <select 
                                        value={params.card_fee_group_id} 
                                        onChange={e => setParams({...params, card_fee_group_id: e.target.value})}
                                        className="bg-[#0f172a] border border-[#334155] rounded-xl px-2 text-[10px] font-black uppercase text-amber-500 outline-none w-1/2"
                                    >
                                        <option value="">Destino DRE...</option>
                                        {dreGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Comissão/Cashback (Grupo DRE)</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={params.cashback_group_id} 
                                        onChange={e => setParams({...params, cashback_group_id: e.target.value})}
                                        className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500/50"
                                    >
                                        <option value="">Selecione o grupo para Cashback...</option>
                                        {dreGroups.filter(g => g.type === 'variable').map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            {stores.length > 0 && (
                                <div className="col-span-full mt-6 pt-6 border-t border-[#334155]">
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
                                                        type="number" step="0.01" placeholder="0.00"
                                                        value={(params.cashback_rates as Record<string, number>)[storeName] || ''}
                                                        onChange={(e) => setParams({
                                                            ...params,
                                                            cashback_rates: { ...params.cashback_rates, [storeName]: Number(e.target.value) }
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
                        </div>
                    )}

                    {configTab === 'mapping' && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="p-3 bg-amber-600/10 border border-amber-500/20 rounded-lg mb-4">
                                <p className="text-amber-200 text-[10px] uppercase font-black leading-relaxed">
                                    Vincule suas categorias diretamente às contas da DRE para garantir 100% de precisão nos relatórios.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                {categories.filter(c => c.type === 'expense' || c.type === 'income').map(cat => (
                                    <div key={cat.id} className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] hover:border-amber-500/30 transition-colors flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5 max-w-[70%]">
                                                <span className="text-xs font-black text-white truncate">{cat.name}</span>
                                                <span className={`text-[8px] font-black uppercase tracking-tighter ${cat.type === 'income' ? 'text-emerald-500' : 'text-amber-500'}`}>{cat.type === 'income' ? 'Entrada' : 'Saída'}</span>
                                            </div>
                                            <span className="material-symbols-outlined text-slate-600 text-sm">link</span>
                                        </div>
                                        <select
                                            value={cat.dre_group || ''}
                                            onChange={(e) => updateCategoryMapping(cat.id, e.target.value)}
                                            className={`w-full bg-[#1e293b] border rounded-lg px-2 py-2 text-[10px] font-black transition-all focus:outline-none ${cat.dre_group ? 'border-indigo-500/50 text-indigo-400' : 'border-[#334155] text-slate-400'}`}
                                        >
                                            <option value="" className="text-slate-500 italic">AUTOMÁTICO</option>
                                            <optgroup label="Receitas" className="bg-[#1e293b] text-indigo-400">
                                                {dreGroups.filter(g => g.type === 'revenue').map(g => (
                                                    <option key={g.id} value={g.id} className="text-white">{g.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Despesas Variáveis" className="bg-[#1e293b] text-amber-500">
                                                {dreGroups.filter(g => g.type === 'variable').map(g => (
                                                    <option key={g.id} value={g.id} className="text-white">{g.label}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Despesas Fixas" className="bg-[#1e293b] text-emerald-400">
                                                {dreGroups.filter(g => g.type === 'fixed').map(g => (
                                                    <option key={g.id} value={g.id} className="text-white">{g.label}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {configTab === 'groups' && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-lg mb-4">
                                <p className="text-indigo-200 text-[10px] uppercase font-black leading-relaxed">
                                    Personalize os tópicos da sua DRE. Você pode adicionar, remover ou renomear tópicos de Receita e Despesas.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">payments</span>
                                        Tópicos de Receita
                                    </h5>
                                    {dreGroups.filter(g => g.type === 'revenue').map(group => (
                                        <div key={group.id} className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] flex items-center justify-between group/item">
                                            {editingGroup?.id === group.id ? (
                                                <input 
                                                    autoFocus
                                                    className="bg-transparent border-b border-indigo-500 outline-none text-xs font-bold text-white w-full"
                                                    value={editingGroup.label}
                                                    onChange={e => setEditingGroup({...editingGroup, label: e.target.value})}
                                                    onBlur={async () => {
                                                        const newGroups = dreGroups.map(g => g.id === group.id ? {...g, label: editingGroup.label} : g);
                                                        setDreGroups(newGroups);
                                                        setEditingGroup(null);
                                                        if (activeCompany) await supabase.from('companies').update({ dre_structure: newGroups }).eq('id', activeCompany.id);
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                />
                                            ) : (
                                                <>
                                                    <span className="text-xs font-bold text-slate-300">{group.label}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingGroup(group)} className="text-slate-500 hover:text-amber-500 transition-colors">
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        {!group.isSystem && (
                                                            <button onClick={async () => {
                                                                const newGroups = dreGroups.filter(g => g.id !== group.id);
                                                                setDreGroups(newGroups);
                                                                if (activeCompany) await supabase.from('companies').update({ dre_structure: newGroups }).eq('id', activeCompany.id);
                                                            }} className="text-slate-500 hover:text-red-500 transition-colors">
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const newId = 'rev_' + Math.random().toString(36).substr(2, 9);
                                            const newGroups = [...dreGroups, { id: newId, label: 'Novo Tópico de Receita', type: 'revenue', isSystem: false }];
                                            setDreGroups(newGroups);
                                            setEditingGroup({ id: newId, label: 'Novo Tópico de Receita', type: 'revenue', isSystem: false });
                                        }}
                                        className="w-full py-2 border border-dashed border-[#334155] rounded-xl text-[10px] font-black text-slate-500 hover:text-indigo-400 transition-all uppercase tracking-widest"
                                    >
                                        + Adicionar Tópico
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">variable_insert</span>
                                        Despesas Variáveis
                                    </h5>
                                    {dreGroups.filter(g => g.type === 'variable').map(group => (
                                        <div key={group.id} className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] flex items-center justify-between group/item">
                                            {editingGroup?.id === group.id ? (
                                                <input 
                                                    autoFocus
                                                    className="bg-transparent border-b border-amber-500 outline-none text-xs font-bold text-white w-full"
                                                    value={editingGroup.label}
                                                    onChange={e => setEditingGroup({...editingGroup, label: e.target.value})}
                                                    onBlur={async () => {
                                                        const newGroups = dreGroups.map(g => g.id === group.id ? {...g, label: editingGroup.label} : g);
                                                        setDreGroups(newGroups);
                                                        setEditingGroup(null);
                                                        if (activeCompany) await supabase.from('companies').update({ dre_structure: newGroups }).eq('id', activeCompany.id);
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                />
                                            ) : (
                                                <>
                                                    <span className="text-xs font-bold text-slate-300">{group.label}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingGroup(group)} className="text-slate-500 hover:text-amber-500 transition-colors">
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        {!group.isSystem && (
                                                            <button onClick={async () => {
                                                                const newGroups = dreGroups.filter(g => g.id !== group.id);
                                                                setDreGroups(newGroups);
                                                                if (activeCompany) await supabase.from('companies').update({ dre_structure: newGroups }).eq('id', activeCompany.id);
                                                            }} className="text-slate-500 hover:text-red-500 transition-colors">
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const newId = 'var_' + Math.random().toString(36).substr(2, 9);
                                            const newGroups = [...dreGroups, { id: newId, label: 'Novo Tópico Variável', type: 'variable', isSystem: false }];
                                            setDreGroups(newGroups);
                                            setEditingGroup({ id: newId, label: 'Novo Tópico Variável', type: 'variable', isSystem: false });
                                        }}
                                        className="w-full py-2 border border-dashed border-[#334155] rounded-xl text-[10px] font-black text-slate-500 hover:text-amber-500 transition-all uppercase tracking-widest"
                                    >
                                        + Adicionar Tópico
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                                        Despesas Fixas
                                    </h5>
                                    {dreGroups.filter(g => g.type === 'fixed').map(group => (
                                        <div key={group.id} className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] flex items-center justify-between group/item">
                                            {editingGroup?.id === group.id ? (
                                                <input 
                                                    autoFocus
                                                    className="bg-transparent border-b border-emerald-500 outline-none text-xs font-bold text-white w-full"
                                                    value={editingGroup.label}
                                                    onChange={e => setEditingGroup({...editingGroup, label: e.target.value})}
                                                    onBlur={async () => {
                                                        const newGroups = dreGroups.map(g => g.id === group.id ? {...g, label: editingGroup.label} : g);
                                                        setDreGroups(newGroups);
                                                        setEditingGroup(null);
                                                        if (activeCompany) await supabase.from('companies').update({ dre_structure: newGroups }).eq('id', activeCompany.id);
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                />
                                            ) : (
                                                <>
                                                    <span className="text-xs font-bold text-slate-300">{group.label}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingGroup(group)} className="text-slate-500 hover:text-amber-500 transition-colors">
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        {(!group.isSystem || group.id !== 'vendas') && (
                                                            <button onClick={async () => {
                                                                const newGroups = dreGroups.filter(g => g.id !== group.id);
                                                                setDreGroups(newGroups);
                                                                if (activeCompany) await supabase.from('companies').update({ dre_structure: newGroups }).eq('id', activeCompany.id);
                                                            }} className="text-slate-500 hover:text-red-500 transition-colors">
                                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            const newId = 'fix_' + Math.random().toString(36).substr(2, 9);
                                            const newGroups = [...dreGroups, { id: newId, label: 'Novo Tópico Fixo', type: 'fixed', isSystem: false }];
                                            setDreGroups(newGroups);
                                            setEditingGroup({ id: newId, label: 'Novo Tópico Fixo', type: 'fixed', isSystem: false });
                                        }}
                                        className="w-full py-2 border border-dashed border-[#334155] rounded-xl text-[10px] font-black text-slate-500 hover:text-emerald-400 transition-all uppercase tracking-widest"
                                    >
                                        + Adicionar Tópico
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3 border-t border-[#334155] pt-4">
                        <button onClick={() => setShowConfig(false)} className="text-[10px] font-black uppercase text-slate-400 hover:text-white px-4 py-2 transition-colors">Cancelar</button>
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

                <div className="bg-[#1e293b]/50 px-4 py-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-[#334155]/30">RECEITAS</div>
                {Object.values(metrics.revGroups).map((group: any, i) => (
                    <Row
                        key={i}
                        label={group.label}
                        value={group.amount}
                        percentage={metrics.totalRev > 0 ? (group.amount / metrics.totalRev) * 100 : 0}
                        onClick={group.items.length > 0 ? () => { setDetailingItems(group.items); setDetailingTitle(group.label); setShowDetailModal(true); } : undefined}
                    />
                ))}
                
                <div className="h-2"></div>

                <Row
                    label="RECEITA BRUTA (RB)"
                    value={metrics.totalRev}
                    percentage={100}
                    isTotal
                />

                <Row
                    label={dreGroups.find(g => g.id === params.tax_group_id)?.label || "Impostos sobre faturamento"}
                    value={metrics.impostos}
                    percentage={metrics.totalRev > 0 ? (metrics.impostos / metrics.totalRev) * 100 : 0}
                    isNegative
                />
                <Row
                    label="RECEITA LÍQUIDA (RL)"
                    value={metrics.rl}
                    percentage={metrics.totalRev > 0 ? (metrics.rl / metrics.totalRev) * 100 : 0}
                    isSubTotal
                />

                <Row
                    label={activeCompany?.business_type === 'services' ? "Custos de serviços prestados (CSP)" : "Custos de mercadoria vendida (CMV)"}
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
                    label={dreGroups.find(g => g.id === params.loss_group_id)?.label || (activeCompany?.business_type === 'services' ? "Perdas ou cancelamentos" : "Perda do estoque (Furto, vencido, danificado)")}
                    value={metrics.perdaEstoque}
                    percentage={metrics.totalRev > 0 ? (metrics.perdaEstoque / metrics.totalRev) * 100 : 0}
                    isNegative
                />
                <Row
                    label={activeCompany?.business_type === 'services' ? "MARGEM BRUTA SEM PERDAS" : "MARGEM BRUTA SEM PERDA DE ESTOQUE"}
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

                <div className="mt-6 pt-6 border-t border-[#334155] grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155] flex justify-between items-center group hover:border-amber-500/50 transition-all">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Índice de Margem (IMC)</span>
                            <span className="text-xl font-black text-amber-500">{(metrics.IMC * 100).toFixed(2)}%</span>
                        </div>
                        <span className="material-symbols-outlined text-amber-500/30 group-hover:text-amber-500 transition-colors">percent</span>
                    </div>

                    <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155] flex justify-between items-center group hover:border-indigo-500/50 transition-all">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ponto de Equilíbrio (Faturamento)</span>
                            <span className="text-xl font-black text-indigo-400">R$ {metrics.breakEven.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <span className="material-symbols-outlined text-indigo-400/30 group-hover:text-indigo-400 transition-colors">calculate</span>
                    </div>
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
                                            <td className="py-2 px-2 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">
                                                        {new Date((exp.due_date || exp.date) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                                                        Inc: {new Date(exp.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-indigo-400 font-bold">{exp.store_name || 'Geral'}</td>
                                            <td className="py-2 px-2 text-white font-medium">
                                                <div className="flex flex-col">
                                                    <span>{exp.description}</span>
                                                    {exp.is_prorated && (
                                                        <span className="text-[9px] text-amber-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">balance</span>
                                                            Valor Rateado (Sócio-Estatístico)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-slate-400">{exp.categories?.name}</td>
                                            <td className="py-2 px-2 text-right text-red-400 font-bold">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                            <span className="text-white">R$ {detailingItems.reduce((acc, e) => acc + Number(e.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DRE;
