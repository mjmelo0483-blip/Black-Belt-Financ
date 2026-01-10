
import React, { useEffect, useState, useMemo } from 'react';
import { useSales } from '../hooks/useSales';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, RadialBarChart, RadialBar, Legend
} from 'recharts';

const SalesDashboard: React.FC = () => {
    const { fetchSales, loading } = useSales();
    const [salesData, setSalesData] = useState<any[]>([]);

    // Use manual parts for default today to avoid timezone issues
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [selectedStore, setSelectedStore] = useState<string>('Todas');

    useEffect(() => {
        const load = async () => {
            const { data } = await fetchSales();
            if (data && data.length > 0) {
                setSalesData(data);
                // Sort by date string (YYYY-MM-DD) descending
                const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
                const latest = sorted[0].date; // YYYY-MM-DD
                if (latest) {
                    const parts = latest.split('-');
                    setSelectedMonth(parseInt(parts[1]) - 1);
                    setSelectedYear(parseInt(parts[0]));
                }
            } else if (data) {
                setSalesData(data);
            }
        };
        load();
    }, [fetchSales]);

    // Available Months and Years from data - Parsing strings manually
    const periods = useMemo(() => {
        const p = new Set<string>();
        salesData.forEach(s => {
            if (!s.date) return;
            const parts = s.date.split('-');
            if (parts.length === 3) {
                const year = parts[0];
                const month = parseInt(parts[1]) - 1;
                p.add(`${month}-${year}`);
            }
        });
        return Array.from(p).sort((a, b) => {
            const [am, ay] = a.split('-').map(Number);
            const [bm, by] = b.split('-').map(Number);
            return ay !== by ? ay - by : am - bm;
        });
    }, [salesData]);

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
        const s = new Set<string>();
        salesData.forEach(sale => {
            if (sale.store_name) s.add(sale.store_name);
        });
        return ['Todas', ...Array.from(s).sort()];
    }, [salesData]);

    // Filtering Data - Absolute comparison by string parts
    const filteredData = useMemo(() => {
        return salesData.filter(sale => {
            if (!sale.date) return false;
            const parts = sale.date.split('-');
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;

            const matchesMonth = m === selectedMonth;
            const matchesYear = y === selectedYear;
            const matchesStore = selectedStore === 'Todas' || sale.store_name === selectedStore;

            if (!matchesMonth || !matchesYear || !matchesStore) return false;

            if (selectedCategory === 'Todas') return true;
            return sale.sale_items?.some((item: any) => item.products?.category === selectedCategory);
        });
    }, [salesData, selectedMonth, selectedYear, selectedCategory, selectedStore]);

    // KPI Calculations
    const totalRevenue = filteredData.reduce((acc, sale) => acc + Number(sale.total_amount || 0), 0);
    const totalUnits = filteredData.reduce((acc, sale) => {
        const itemsQty = sale.sale_items?.reduce((iq: number, item: any) => iq + Number(item.quantity || 0), 0);
        return acc + (itemsQty || 0);
    }, 0);
    const totalSalesCount = filteredData.length;
    const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    // Top Product by Revenue
    const productSales = useMemo(() => {
        const map: any = {};
        filteredData.forEach(sale => {
            sale.sale_items?.forEach((item: any) => {
                const prod = item.products;
                if (!prod) return;
                if (!map[prod.code]) {
                    map[prod.code] = { name: prod.name, total: 0, count: 0 };
                }
                map[prod.code].total += Number(item.total_price || 0);
                map[prod.code].count += Number(item.quantity || 0);
            });
        });
        return Object.values(map).sort((a: any, b: any) => b.total - a.total);
    }, [filteredData]);

    const bestProduct = productSales[0] || { name: '-', total: 0 };

    // Charts Data
    const dailyData = useMemo(() => {
        const map: any = {};
        filteredData.forEach(sale => {
            const dateStr = sale.date; // YYYY-MM-DD
            if (!map[dateStr]) map[dateStr] = { date: dateStr, revenue: 0, units: 0 };
            map[dateStr].revenue += Number(sale.total_amount || 0);
            const itemsQty = sale.sale_items?.reduce((iq: number, item: any) => iq + Number(item.quantity || 0), 0);
            map[dateStr].units += (itemsQty || 0);
        });
        return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [filteredData]);

    // Balance Point (Target) - Mocking R$ 12,942.71 from image
    const targetRevenue = 12942.71;
    const balancePercentage = Math.min(Math.round((totalRevenue / targetRevenue) * 100), 100);

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return (
        <div className="p-6 space-y-6 bg-[#0f172a] min-h-screen text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Dashboard de Vendas</h1>

                <div className="flex flex-wrap gap-2">
                    {/* Store Filter */}
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

                    {/* Period Buttons */}
                    <div className="flex gap-1">
                        {periods.slice(-4).reverse().map(period => {
                            const [m, y] = period.split('-').map(Number);
                            const active = selectedMonth === m && selectedYear === y;
                            return (
                                <button
                                    key={period}
                                    onClick={() => { setSelectedMonth(m); setSelectedYear(y); }}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#1e293b] border-[#334155] text-slate-400 hover:text-white'}`}
                                >
                                    {monthNames[m]}/{y}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-6">

                {/* Left Sidebar KPIs */}
                <div className="col-span-12 lg:col-span-3 space-y-4">
                    <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] flex flex-col items-center justify-center text-center shadow-2xl">
                        <div className="size-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-indigo-400 text-3xl">api</span>
                        </div>
                        <p className="text-3xl font-black text-white">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
                        <p className="text-xl font-black text-indigo-400">R$ {bestProduct.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    {/* Category Filter */}
                    <div className="bg-[#1e293b] p-6 rounded-xl border border-[#334155]">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-xs">filter_alt</span> Categoria
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {categories.slice(0, 10).map(cat => (
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

                {/* Right Content Area */}
                <div className="col-span-12 lg:col-span-9 space-y-6">

                    {/* Top Row: Balance and Daily Revenue */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Balance Point */}
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl flex flex-col items-center">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Ponto de Equilíbrio</h3>
                            <div className="relative size-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { value: totalRevenue },
                                                { value: Math.max(0, targetRevenue * 1.2 - totalRevenue) } // Extended range for visual feedback
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
                            <p className="mt-4 text-amber-500 font-black text-lg">R$ {targetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>

                        {/* Daily Revenue Bar Chart */}
                        <div className="md:col-span-2 bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Total Vendido por Dia (R$)</h3>
                            <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => val.split('-')[2]}
                                            stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}
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

                    {/* Bottom Row: Top Products and Units Area */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Top 10 Products Horizontal Bar */}
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Top 10 Produtos Mais Vendidos</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={productSales.slice(0, 10)}>
                                        <XAxis type="number" hide />
                                        <YAxis
                                            type="category" dataKey="name" stroke="#94a3b8" fontSize={10}
                                            width={140} tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false}
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

                        {/* Quantity per day Area Chart */}
                        <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Quantidade Vendida por Dia</h3>
                            <div className="h-[300px] w-full">
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
                                            tickFormatter={(val) => val.split('-')[2]}
                                            stroke="#64748b" fontSize={10} axisLine={false} tickLine={false}
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
