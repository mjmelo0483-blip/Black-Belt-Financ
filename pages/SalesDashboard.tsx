
import React, { useEffect, useState } from 'react';
import { useSales } from '../hooks/useSales';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const SalesDashboard: React.FC = () => {
    const { fetchSales, loading } = useSales();
    const [salesData, setSalesData] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            const { data } = await fetchSales();
            if (data) setSalesData(data);
        };
        load();
    }, [fetchSales]);

    // KPI Calculations
    const totalRevenue = salesData.reduce((acc, sale) => acc + Number(sale.total_amount || 0), 0);
    const totalProfit = salesData.reduce((acc, sale) => {
        const saleProfit = sale.sale_items?.reduce((itemAcc: number, item: any) => {
            const cost = Number(item.products?.cost || 0);
            const price = Number(item.unit_price || 0);
            return itemAcc + ((price - cost) * item.quantity);
        }, 0);
        return acc + (saleProfit || 0);
    }, 0);
    const totalSales = salesData.length;
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Aggregate Revenue by Date
    const revenueByDate = salesData.reduce((acc: any, sale: any) => {
        const date = sale.date;
        acc[date] = (acc[date] || 0) + Number(sale.total_amount || 0);
        return acc;
    }, {});

    const chartData = Object.entries(revenueByDate)
        .map(([name, revenue]) => ({ name: formatDate(name as string), revenue }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(-7);

    // Aggregate Product Sales
    const productSales = salesData.reduce((acc: any, sale: any) => {
        sale.sale_items?.forEach((item: any) => {
            const prod = item.products;
            if (!prod) return;
            if (!acc[prod.code]) {
                acc[prod.code] = { name: prod.name, code: prod.code, total: 0, count: 0 };
            }
            acc[prod.code].total += Number(item.total_price || 0);
            acc[prod.code].count += Number(item.quantity || 0);
        });
        return acc;
    }, {});

    const topProducts = Object.values(productSales)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5);

    function formatDate(d: string) {
        return new Date(d).toLocaleDateString('pt-BR', { weekday: 'short' });
    }

    // Aggregate Payment Methods
    const paymentMethods = salesData.reduce((acc: any, sale: any) => {
        const method = sale.payment_method || 'Outros';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
    }, {});

    const paymentChartData = Object.entries(paymentMethods).map(([name, value]) => ({ name, value }));

    const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Análise de Vendas</h1>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Faturamento Total" value={totalRevenue} icon="payments" color="text-indigo-400" />
                <KPICard title="Volume de Vendas" value={totalSales} icon="shopping_bag" color="text-emerald-400" isCurrency={false} />
                <KPICard title="Ticket Médio" value={averageTicket} icon="confirmation_number" color="text-amber-400" />
                <KPICard title="Lucro Bruto" value={totalProfit} icon="trending_up" color="text-rose-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#233648] shadow-xl shadow-black/20">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-400">show_chart</span>
                        Desempenho de Vendas (Últimos 7 dias)
                    </h3>
                    <div className="h-[300px] w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#526a81" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#526a81" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111a22', border: '1px solid #233648', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#818cf8" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[#526a81]">Sem dados de vendas no período</div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#233648] shadow-xl shadow-black/20">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400">inventory_2</span>
                        Produtos Mais Vendidos
                    </h3>
                    <div className="space-y-4">
                        {topProducts.length > 0 ? topProducts.map((prod: any, i) => (
                            <div key={prod.code} className="flex items-center justify-between p-3 rounded-xl bg-[#111a22]/50 border border-[#233648]/50">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-lg bg-[#233648] flex items-center justify-center font-bold text-indigo-400">#{i + 1}</div>
                                    <div>
                                        <p className="text-white font-medium text-sm">{prod.name}</p>
                                        <p className="text-[#526a81] text-xs">Código: {prod.code}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-bold text-sm">R$ {Number(prod.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    <p className="text-emerald-400 text-[10px] font-black uppercase">{prod.count} Vendas</p>
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center text-[#526a81]">Nenhum produto vendido</div>
                        )}
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#233648] shadow-xl shadow-black/20">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-400">payments</span>
                        Formas de Pagamento
                    </h3>
                    <div className="h-[300px] flex items-center">
                        <div className="w-1/2 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={paymentChartData}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" stroke="#526a81" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#111a22', border: '1px solid #233648', borderRadius: '8px' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {paymentChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-3 pl-6">
                            {paymentChartData.map((entry, index) => (
                                <div key={entry.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        <span className="text-xs text-[#92adc9]">{entry.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-white">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Placeholder for Store Performance or Device breakdown */}
                <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#233648] shadow-xl shadow-black/20 flex flex-col justify-center items-center text-[#526a81]">
                    <span className="material-symbols-outlined text-4xl mb-2">insights</span>
                    <p className="text-center">Mais análises estarão disponíveis conforme novos dados forem importados.</p>
                </div>
            </div>
        </div>
    );
};

interface KPICardProps {
    title: string;
    value: number;
    icon: string;
    color: string;
    isCurrency?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon, color, isCurrency = true }) => (
    <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#233648] shadow-lg shadow-black/10 hover:border-indigo-500/30 transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className={`size-12 rounded-xl bg-[#111a22] border border-[#233648] flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <span className={`material-symbols-outlined ${color}`}>{icon}</span>
            </div>
            <span className="text-[10px] font-black text-[#526a81] uppercase tracking-widest bg-[#111a22] px-2 py-1 rounded-md border border-[#233648]">Mensal</span>
        </div>
        <h4 className="text-[#92adc9] text-xs font-semibold uppercase tracking-wider mb-1">{title}</h4>
        <p className="text-2xl font-black text-white">
            {isCurrency ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : value}
        </p>
    </div>
);

export default SalesDashboard;
