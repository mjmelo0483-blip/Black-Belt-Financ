import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import StatCard from '../components/StatCard';
import { useDashboardData } from '../hooks/useDashboardData';

const Dashboard: React.FC = () => {
  const { stats, chartData, recentTransactions, assetAllocation, expensesByCategory, loading, refreshData } = useDashboardData();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[400px]">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-white text-3xl font-bold tracking-tight text-white/90">Painel Financeiro</h1>
          <p className="text-[#92adc9] mt-1">Resumo atualizado em <span className="text-white font-medium">{new Date().toLocaleDateString('pt-BR')}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            className="text-primary hover:text-blue-400 transition-colors flex items-center gap-1 group bg-primary/5 px-4 py-2 rounded-lg border border-primary/20"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform duration-500">refresh</span>
            <span className="text-sm font-bold">Atualizar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div onClick={() => navigate('/accounts')} className="cursor-pointer">
          <StatCard label="Saldo Total em Conta" value={formatCurrency(stats.totalBalance)} icon="account_balance" trend="Geral" trendType="neutral" />
        </div>
        <div onClick={() => navigate('/transactions')} className="cursor-pointer">
          <StatCard label="A Pagar Hoje" value={formatCurrency(stats.dueToday)} icon="payments" trend="Pendente" trendType="neutral" color="text-orange-500" />
        </div>
        <div onClick={() => navigate('/investments')} className="cursor-pointer">
          <StatCard label="Investimentos" value={formatCurrency(stats.investments)} icon="monitoring" trend="Ativos" trendType="neutral" color="text-purple-500" />
        </div>
        <div onClick={() => navigate('/transactions')} className="cursor-pointer">
          <StatCard label="Receitas Mensais" value={formatCurrency(stats.monthlyIncome)} icon="trending_up" trend="Este Mês" trendType="positive" color="text-green-500" />
        </div>
        <div onClick={() => navigate('/transactions')} className="cursor-pointer">
          <StatCard label="Gastos Mensais" value={formatCurrency(stats.monthlyExpenses)} icon="shopping_bag" trend="Este Mês" trendType="neutral" color="text-pink-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-white text-lg font-bold text-white/90">Histórico de Saldo em Conta</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.totalBalance)}</p>
                  <span className="text-[#92adc9] text-sm">Disponível</span>
                </div>
              </div>
            </div>

            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#137fec" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#137fec" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#324d67" vertical={false} />
                  <XAxis dataKey="name" stroke="#92adc9" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111a22', border: '1px solid #324d67', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#137fec" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-lg font-bold text-white/90">Lançamentos Recentes</h2>
              <button onClick={() => navigate('/transactions')} className="text-primary text-sm font-bold hover:underline">Ver Todos</button>
            </div>
            <div className="space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((t, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg bg-[#111a22] hover:bg-[#1a2632] transition-colors border-l-4 ${t.type === 'expense' ? 'border-red-500' : 'border-green-500'}`}>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-[#233648] flex items-center justify-center text-white">
                        <span className="material-symbols-outlined">{t.categories?.icon || 'receipt_long'}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium text-sm leading-tight text-white/90">{t.description}</p>
                          {t.payment_method && (
                            <span className="px-1.5 py-0.5 rounded bg-[#1a2632] text-[#6384a3] text-[8px] font-black uppercase tracking-tighter border border-[#324d67]/30">
                              {t.payment_method === 'credito' ? 'Cartão' : t.payment_method === 'pix' ? 'Pix' : 'Débito'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[#92adc9] text-[9px] font-black uppercase tracking-widest leading-none">INC: {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          {t.due_date && (
                            <p className="text-[#92adc9] text-[9px] font-black uppercase tracking-widest leading-none">VENC: {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-bold ${t.type === 'expense' ? 'text-white' : 'text-green-400'}`}>
                        {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.amount)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-[48px] text-[#324d67]">history</span>
                  <p className="text-[#92adc9] mt-2">Nenhum lançamento encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div
            onClick={() => navigate('/cards')}
            className="rounded-3xl p-8 shadow-2xl relative overflow-hidden h-72 flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-all duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#137fec] via-[#094b8e] to-[#042d57] z-0"></div>
            <div className="absolute inset-0 z-0 opacity-30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"></div>
            <div className="absolute -bottom-20 -right-20 size-64 bg-white/5 rounded-full blur-3xl z-0"></div>

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Cartões Consolidados</p>
                <h3 className="text-white font-bold text-2xl tracking-tighter">BLACK BELT PLATINUM</h3>
              </div>
              <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                <span className="material-symbols-outlined text-white text-2xl">contactless</span>
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-end mb-3">
                <div className="flex flex-col">
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Disponível</span>
                  <span className="text-white font-black text-xl">{formatCurrency(stats.totalCards - stats.usedCards)}</span>
                </div>
                <div className="text-right flex flex-col">
                  <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Limite Total</span>
                  <span className="text-white/90 font-bold text-sm">{formatCurrency(stats.totalCards)}</span>
                </div>
              </div>
              <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden backdrop-blur-md border border-white/5 p-[2px]">
                <div
                  className="bg-gradient-to-r from-white/80 to-white h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  style={{ width: `${stats.totalCards > 0 ? Math.min(100, (stats.usedCards / stats.totalCards) * 100) : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="relative z-10 flex justify-between items-end">
              <div>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Titular</p>
                <p className="text-white font-bold text-sm tracking-wide">USUÁRIO VIP</p>
              </div>
              <div className="text-right">
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-green-400 animate-pulse"></div>
                  <p className="text-white font-bold text-xs">ATIVO</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* New Expense Chart */}
        <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-bold text-white/90">
              Despesas por Categoria ({new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })})
            </h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-1 text-primary hover:text-blue-400 text-sm font-bold transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Voltar
              </button>
            )}
          </div>

          {selectedCategory && (
            <div className="mb-4 px-3 py-2 bg-[#111a22] rounded-lg border border-[#324d67]/50">
              <p className="text-[#92adc9] text-xs uppercase tracking-widest">Categoria Principal</p>
              <p className="text-white font-bold">{selectedCategory}</p>
            </div>
          )}

          <div className="flex flex-col items-center justify-center mb-6 relative">
            <div className="size-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      selectedCategory
                        ? (expensesByCategory.find(c => c.name === selectedCategory) as any)?.children || []
                        : expensesByCategory
                    }
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => {
                      if (!selectedCategory && data?.children?.length > 0) {
                        setSelectedCategory(data.name);
                      }
                    }}
                    style={{ cursor: selectedCategory ? 'default' : 'pointer' }}
                  >
                    {(selectedCategory
                      ? (expensesByCategory.find(c => c.name === selectedCategory) as any)?.children || []
                      : expensesByCategory
                    ).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111a22', border: '1px solid #324d67', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[#92adc9] text-xs font-medium uppercase">
                {selectedCategory ? 'Total Cat.' : 'Total Mês'}
              </p>
              <p className="text-white text-xl font-bold">
                {formatCurrency(
                  selectedCategory
                    ? expensesByCategory.find(c => c.name === selectedCategory)?.value || 0
                    : stats.monthlyExpenses
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(selectedCategory
              ? (expensesByCategory.find(c => c.name === selectedCategory) as any)?.children || []
              : expensesByCategory
            ).slice(0, 6).map((cat: any, i: number) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${!selectedCategory && cat.children?.length > 0
                    ? 'hover:bg-[#111a22] cursor-pointer'
                    : ''
                  }`}
                onClick={() => {
                  if (!selectedCategory && cat.children?.length > 0) {
                    setSelectedCategory(cat.name);
                  }
                }}
              >
                <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold">{formatCurrency(cat.value)}</p>
                  <p className="text-[#92adc9] text-xs truncate">{cat.name}</p>
                </div>
                {!selectedCategory && cat.children?.length > 0 && (
                  <span className="material-symbols-outlined text-[#92adc9] text-[16px]">chevron_right</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg flex-1">
          <h2 className="text-white text-lg font-bold mb-6 text-white/90">Alocação de Ativos</h2>
          <div className="flex flex-col items-center justify-center mb-6 relative">
            <div className="size-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetAllocation}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {assetAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[#92adc9] text-xs font-medium uppercase">Total</p>
              <p className="text-white text-xl font-bold">{formatCurrency(stats.investments)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {assetAllocation.map((asset, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: asset.color }} />
                <div>
                  <p className="text-white text-sm font-bold">{asset.value}%</p>
                  <p className="text-[#92adc9] text-xs">{asset.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
