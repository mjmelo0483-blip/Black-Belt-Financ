import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import StatCard from '../components/StatCard';
import { useDashboardData } from '../hooks/useDashboardData';

const Dashboard: React.FC = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const { stats, chartData, recentTransactions, assetAllocation, expensesByCategory, budgetProgress, loading, refreshData } = useDashboardData(selectedMonth, selectedYear);
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

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
          <p className="text-[#92adc9] mt-1">
            Resumo de <span className="text-white font-medium">{monthNames[selectedMonth]} de {selectedYear}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#233648] border border-[#324d67]/50 rounded-xl px-3 py-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
            >
              {monthNames.map((name, index) => (
                <option key={index} value={index} className="bg-[#1c2a38]">{name}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-[#324d67]/50" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
            >
              {years.map(year => (
                <option key={year} value={year} className="bg-[#1c2a38]">{year}</option>
              ))}
            </select>
          </div>
          <button
            onClick={refreshData}
            className="text-primary hover:text-blue-400 transition-colors flex items-center gap-1 group bg-primary/5 px-4 py-2 rounded-xl border border-primary/20"
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

      {/* Cartões Consolidados e Alocação de Ativos - lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cartões Consolidados */}
        <div
          onClick={() => navigate('/cards')}
          className="rounded-3xl p-8 shadow-2xl relative overflow-hidden h-64 flex flex-col justify-between group cursor-pointer hover:scale-[1.02] transition-all duration-500"
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

        {/* Alocação de Ativos */}
        <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg h-64 flex flex-col">
          <h2 className="text-white text-lg font-bold mb-4 text-white/90">Alocação de Ativos</h2>
          <div className="flex-1 flex items-center gap-6">
            <div className="relative flex items-center justify-center">
              <div className="size-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetAllocation}
                      innerRadius={40}
                      outerRadius={55}
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
                <p className="text-[#92adc9] text-[9px] font-medium uppercase">Total</p>
                <p className="text-white text-sm font-bold">{formatCurrency(stats.investments)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 flex-1">
              {assetAllocation.map((asset, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: asset.color }} />
                  <div className="flex justify-between flex-1">
                    <p className="text-[#92adc9] text-xs">{asset.name}</p>
                    <p className="text-white text-xs font-bold">{asset.value}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs - Indicadores Rápidos - Largura total */}
      <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white text-lg font-bold">Indicadores Financeiros</h2>
            <p className="text-[#92adc9] text-sm">Análise do mês atual</p>
          </div>
          <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-xl">insights</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Taxa de Economia */}
          <div className="bg-[#1c2a38] rounded-xl p-5 border border-[#324d67]/30 group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Taxa de Economia</span>
              <span className="material-symbols-outlined text-emerald-400 text-[20px]">savings</span>
            </div>
            <p className={`text-xl font-black whitespace-nowrap ${stats.monthlyIncome > 0 ? ((stats.monthlyIncome - stats.monthlyExpenses) / stats.monthlyIncome * 100) >= 0 ? 'text-emerald-400' : 'text-red-400' : 'text-white'}`}>
              {stats.monthlyIncome > 0 ? Math.round((stats.monthlyIncome - stats.monthlyExpenses) / stats.monthlyIncome * 100) : 0}%
            </p>
            <p className="text-[#6384a3] text-xs mt-1">da renda mensal</p>
          </div>

          {/* Saldo Disponível */}
          <div className="bg-[#1c2a38] rounded-xl p-5 border border-[#324d67]/30 group hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Saldo Disponível</span>
              <span className="material-symbols-outlined text-primary text-[20px]">account_balance_wallet</span>
            </div>
            <p className="text-xl font-black text-white whitespace-nowrap">{formatCurrency(stats.totalBalance)}</p>
            <p className="text-[#6384a3] text-xs mt-1">em todas as contas</p>
          </div>

          {/* Fatura Cartões */}
          <div className="bg-[#1c2a38] rounded-xl p-5 border border-[#324d67]/30 group hover:border-orange-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Fatura Cartões</span>
              <span className="material-symbols-outlined text-orange-400 text-[20px]">credit_card</span>
            </div>
            <p className="text-xl font-black text-orange-400 whitespace-nowrap">{formatCurrency(stats.cardBalance || 0)}</p>
            <p className="text-[#6384a3] text-xs mt-1">em aberto</p>
          </div>

          {/* Investimentos */}
          <div className="bg-[#1c2a38] rounded-xl p-5 border border-[#324d67]/30 group hover:border-purple-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Investimentos</span>
              <span className="material-symbols-outlined text-purple-400 text-[20px]">trending_up</span>
            </div>
            <p className="text-xl font-black text-purple-400 whitespace-nowrap">{formatCurrency(stats.investments)}</p>
            <p className="text-[#6384a3] text-xs mt-1">patrimônio investido</p>
          </div>
        </div>

        {/* Barra de progresso - relação receita/despesa */}
        <div className="mt-6 p-4 bg-[#1c2a38] rounded-xl border border-[#324d67]/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Receitas vs Despesas</span>
            <span className="text-white text-sm font-bold">
              {formatCurrency(stats.monthlyIncome - stats.monthlyExpenses)}
            </span>
          </div>
          <div className="h-3 bg-[#111a22] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full transition-all duration-500"
              style={{ width: `${stats.monthlyIncome + stats.monthlyExpenses > 0 ? (stats.monthlyIncome / (stats.monthlyIncome + stats.monthlyExpenses)) * 100 : 50}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-r-full transition-all duration-500"
              style={{ width: `${stats.monthlyIncome + stats.monthlyExpenses > 0 ? (stats.monthlyExpenses / (stats.monthlyIncome + stats.monthlyExpenses)) * 100 : 50}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-emerald-400 text-xs font-bold">{formatCurrency(stats.monthlyIncome)}</span>
            <span className="text-red-400 text-xs font-bold">{formatCurrency(stats.monthlyExpenses)}</span>
          </div>
        </div>
      </div>

      {/* Metas de Orçamento - barras de progresso */}
      {budgetProgress.length > 0 && (
        <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-lg font-bold">Metas de Orçamento</h2>
              <p className="text-[#92adc9] text-sm">Progresso do mês atual</p>
            </div>
            <button
              onClick={() => navigate('/budget')}
              className="text-primary hover:text-blue-400 text-sm font-bold transition-colors flex items-center gap-1"
            >
              Ver todos
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {budgetProgress.map((budget: any, index: number) => (
              <div key={index} className="bg-[#1c2a38] rounded-xl p-4 border border-[#324d67]/30">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ color: budget.color }}
                  >
                    {budget.icon}
                  </span>
                  <span className="text-white text-sm font-medium truncate">{budget.name}</span>
                </div>

                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#92adc9]">{formatCurrency(budget.spent)} de {formatCurrency(budget.limit)}</span>
                  <span className={`font-bold ${budget.percentage > 100 ? 'text-red-400' : budget.percentage > 80 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {budget.percentage}%
                  </span>
                </div>

                <div className="h-2 bg-[#111a22] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${budget.percentage > 100 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                      budget.percentage > 80 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                        'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      }`}
                    style={{ width: `${Math.min(100, budget.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )
      }

      {/* Expense Chart - Expandido para toda largura */}
      <div className="bg-[#233648] rounded-xl border border-[#324d67]/50 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-bold text-white/90">
            Despesas por Categoria ({monthNames[selectedMonth]} de {selectedYear})
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

        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="flex flex-col items-center justify-center relative">
            <div className="size-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      selectedCategory
                        ? (expensesByCategory.find(c => c.name === selectedCategory) as any)?.children || []
                        : expensesByCategory
                    }
                    innerRadius={85}
                    outerRadius={115}
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
              <p className="text-[#92adc9] text-sm font-medium uppercase">
                {selectedCategory ? 'Total Cat.' : 'Total Mês'}
              </p>
              <p className="text-white text-3xl font-bold">
                {formatCurrency(
                  selectedCategory
                    ? expensesByCategory.find(c => c.name === selectedCategory)?.value || 0
                    : stats.monthlyExpenses
                )}
              </p>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(selectedCategory
              ? (expensesByCategory.find(c => c.name === selectedCategory) as any)?.children || []
              : expensesByCategory
            ).slice(0, 12).map((cat: any, i: number) => (
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
      </div>
    </div >
  );
};

export default Dashboard;




