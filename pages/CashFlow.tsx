import React, { useState, useMemo } from 'react';
import { useCashFlow } from '../hooks/useCashFlow';
import { useTransactions } from '../hooks/useTransactions';
import { useInvestments } from '../hooks/useInvestments';
import TransactionModal from '../components/TransactionModal';
import BulkEditModal from '../components/BulkEditModal';

const CashFlow: React.FC = () => {
  const {
    setViewMode,
    selectedDate,
    setSelectedDate,
    startDate,
    endDate,
    accountId,
    setAccountId,
    accounts,
    transactions,
    stats,
    loading,
    navigateDate,
    refresh,
    viewMode
  } = useCashFlow();

  const {
    categories,
    cards,
    saveTransaction,
    saveTransfer,
    saveInvestmentTransaction,
    updateTransaction,
    updateTransactions,
    updateInvestmentTransaction,
    deleteTransaction,
    deleteTransactions
  } = useTransactions();

  const { investments, refresh: refreshInvestments } = useInvestments();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    if (viewMode === 'monthly') {
      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const toggleCategory = (catId: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(catId)) newSet.delete(catId);
    else newSet.add(catId);
    setExpandedCategories(newSet);
  };

  const groupedData = useMemo(() => {
    const groups: any = {
      income: { total: 0, categories: {} },
      expense: { total: 0, categories: {} },
      investments: { total: 0, items: [] },
      transfers: { total: 0, items: [] }
    };

    transactions.forEach(t => {
      const isInv = !!t.investment_id;
      const isTrans = !!t.transfer_id;

      if (isInv) {
        groups.investments.total += (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
        groups.investments.items.push(t);
      } else if (isTrans) {
        groups.transfers.total += Number(t.amount);
        groups.transfers.items.push(t);
      } else {
        const type = t.type === 'income' ? 'income' : 'expense';
        const catId = t.category_id || 'unassigned';
        const catName = t.categories?.name || 'Sem Categoria';
        const catIcon = t.categories?.icon || (type === 'income' ? 'arrow_downward' : 'arrow_upward');

        if (!groups[type].categories[catId]) {
          groups[type].categories[catId] = {
            id: catId,
            name: catName,
            icon: catIcon,
            total: 0,
            items: []
          };
        }

        groups[type].total += Number(t.amount);
        groups[type].categories[catId].total += Number(t.amount);
        groups[type].categories[catId].items.push(t);
      }
    });

    return groups;
  }, [transactions]);

  const handleEdit = (t: any) => {
    setIsEditing(true);
    setCurrentTransactionId(t.id);
    setIsModalOpen(true);
  };

  const handleOpenModal = () => {
    setIsEditing(false);
    setCurrentTransactionId(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja realmente excluir este lançamento?')) {
      await deleteTransaction(id);
      refresh();
      refreshInvestments();
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Deseja excluir ${selectedIds.length} lançamentos?`)) {
      await deleteTransactions(selectedIds);
      setSelectedIds([]);
      refresh();
      refreshInvestments();
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    const result = await updateTransactions(selectedIds, updates);
    if (result.error) {
      alert('Erro ao atualizar lançamentos: ' + result.error.message);
    } else {
      setSelectedIds([]);
      refresh();
      refreshInvestments();
    }
  };

  const CategoryRow = ({ cat, type }: any) => {
    const isExpanded = expandedCategories.has(cat.id + (type || ''));
    return (
      <div className="mb-2">
        <div
          onClick={() => toggleCategory(cat.id + (type || ''))}
          className="flex items-center justify-between p-4 rounded-xl bg-[#1c2a38]/60 hover:bg-[#233648] border border-[#324d67]/30 cursor-pointer transition-all group shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className={`size-10 rounded-xl flex items-center justify-center ${type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : (type === 'expense' ? 'bg-red-500/10 text-red-400' : 'bg-purple-500/10 text-purple-400')} border border-white/5`}>
              <span className="material-symbols-outlined text-[22px]">{cat.icon}</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-wide">{cat.name}</h3>
              <p className="text-[#92adc9] text-[10px] uppercase font-black tracking-widest opacity-60">{cat.items.length} LANÇAMENTOS</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <p className={`text-sm font-black ${type === 'income' ? 'text-emerald-400' : (type === 'expense' ? 'text-white' : 'text-slate-200')}`}>
              {type === 'income' ? '+' : (type === 'expense' ? '-' : '')} {formatCurrency(Math.abs(cat.total))}
            </p>
            <span className={`material-symbols-outlined text-[#92adc9] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2 ml-4 mr-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {cat.items.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#111a22]/40 border border-[#324d67]/20 hover:border-primary/30 transition-all group/item"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="rounded bg-[#233648] border-[#324d67] text-primary w-4 h-4 cursor-pointer"
                    checked={selectedIds.includes(t.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelection(t.id);
                    }}
                  />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-bold leading-none">{t.description}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {t.status === 'completed' ? 'Realizado' : 'Aberto'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-[#92adc9] text-[9px] font-bold uppercase tracking-tight flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                        {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-[#6384a3] text-[9px] font-bold uppercase tracking-tight flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">account_balance</span>
                        {t.accounts?.name}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`text-xs font-black ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </p>
                  <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(t)} className="p-1.5 text-[#92adc9] hover:text-white rounded-lg hover:bg-white/5 transition-all">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1.5 text-[#92adc9] hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-all">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Fluxo de Caixa</h1>
          <p className="text-[#92adc9] mt-1 text-sm font-medium">Controle entradas e saídas por data de <b className="text-primary font-black uppercase tracking-widest text-[10px]">vencimento</b>.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#1c2a38]/80 backdrop-blur-md rounded-xl p-1 border border-[#324d67]/50 shadow-xl">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${viewMode === 'daily' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.05]' : 'text-[#92adc9] hover:text-white'}`}
            >
              DIÁRIO
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${viewMode === 'monthly' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.05]' : 'text-[#92adc9] hover:text-white'}`}
            >
              MENSAL
            </button>
          </div>

          <div className="flex items-center bg-[#1c2a38]/80 backdrop-blur-md rounded-xl p-1 border border-[#324d67]/50 shadow-xl h-[42px]">
            <button onClick={() => navigateDate(-1)} className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#92adc9] hover:text-white transition-all">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <div className="px-4 font-black text-[11px] text-white uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">calendar_month</span>
              {formatDateLabel(selectedDate)}
            </div>
            <button onClick={() => navigateDate(1)} className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[#92adc9] hover:text-white transition-all">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Saldo Inicial', value: stats.initialBalance, color: 'primary', icon: 'account_balance_wallet' },
          { label: 'Entradas', value: stats.inflow, color: 'emerald', icon: 'trending_up' },
          { label: 'Saídas', value: -stats.outflow, color: 'red', icon: 'trending_down' },
          { label: 'Investimentos', value: stats.investmentIn - stats.investmentOut, color: 'purple', icon: 'payments' },
          { label: 'Saldo Projetado', value: stats.finalBalance, color: 'blue', icon: 'calculate', isHighlighted: true }
        ].map((card, i) => (
          <div
            key={i}
            className={`relative px-4 py-6 rounded-2xl border transition-all ${card.isHighlighted
              ? 'bg-gradient-to-br from-primary to-[#094b8e] border-white/20 shadow-2xl shadow-primary/30 scale-[1.02]'
              : 'bg-[#1c2a38]/60 backdrop-blur-xl border-[#324d67]/50 hover:border-white/20 shadow-lg'
              }`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] font-black uppercase tracking-widest ${card.isHighlighted ? 'text-blue-100' : 'text-[#92adc9]'}`}>
                {card.label}
              </span>
              <span className={`material-symbols-outlined text-[20px] ${card.isHighlighted ? 'text-white' : `text-${card.color}-400 opacity-60`}`}>
                {card.icon}
              </span>
            </div>
            <p className={`text-xl font-black tracking-tight whitespace-nowrap ${card.isHighlighted ? 'text-white' : 'text-white'}`}>
              {formatCurrency(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-[#324d67]/30">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <select
              className="bg-[#1c2a38] border border-[#324d67]/50 text-white text-xs font-bold rounded-xl pl-10 pr-8 py-2.5 focus:ring-2 focus:ring-primary outline-none cursor-pointer hover:bg-[#233648] transition-all appearance-none"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Todas as Contas</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[18px]">account_balance_wallet</span>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[#92adc9] text-[18px] pointer-events-none group-hover:translate-y-0.5 transition-transform">expand_more</span>
          </div>

          <button
            onClick={handleOpenModal}
            className="h-[42px] px-6 rounded-xl bg-primary hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Novo Lançamento
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#92adc9] bg-[#1c2a38] px-3 py-1.5 rounded-lg border border-primary/20">
              {selectedIds.length} Itens
            </span>
            <div className="flex gap-2">
              <button onClick={() => setIsBulkEditOpen(true)} className="size-10 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-all">
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
              </button>
              <button onClick={handleBulkDelete} className="size-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-10 pb-10">
        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em]">Fluxo de Entrada</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent"></div>
          </div>

          {Object.keys(groupedData.income.categories).length > 0 ? (
            Object.values(groupedData.income.categories).map((cat: any) => (
              <CategoryRow key={cat.id} cat={cat} type="income" />
            ))
          ) : (
            <div className="py-12 border-2 border-dashed border-[#324d67]/30 rounded-2xl flex flex-col items-center justify-center text-[#92adc9] gap-2 grayscale opacity-40">
              <span className="material-symbols-outlined text-[40px]">inbox</span>
              <span className="text-xs font-bold uppercase tracking-widest">Sem entradas operacionais</span>
            </div>
          )}

          {Object.keys(groupedData.income.categories).length > 0 && (
            <div className="flex justify-between items-center px-6 py-4 mt-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Total de Receitas Operacionais</span>
              <span className="text-emerald-400 font-black text-lg">{formatCurrency(groupedData.income.total)}</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-4 mb-6">
            <div className="px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <span className="text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">Fluxo de Saída</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-red-500/20 to-transparent"></div>
          </div>

          {Object.keys(groupedData.expense.categories).length > 0 ? (
            Object.values(groupedData.expense.categories).map((cat: any) => (
              <CategoryRow key={cat.id} cat={cat} type="expense" />
            ))
          ) : (
            <div className="py-12 border-2 border-dashed border-[#324d67]/30 rounded-2xl flex flex-col items-center justify-center text-[#92adc9] gap-2 grayscale opacity-40">
              <span className="material-symbols-outlined text-[40px]">inbox</span>
              <span className="text-xs font-bold uppercase tracking-widest">Sem saídas operacionais</span>
            </div>
          )}

          {Object.keys(groupedData.expense.categories).length > 0 && (
            <div className="flex justify-between items-center px-6 py-4 mt-2 bg-red-400/5 border border-red-400/20 rounded-xl">
              <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Total de Despesas Operacionais</span>
              <span className="text-red-400 font-black text-lg">{formatCurrency(groupedData.expense.total)}</span>
            </div>
          )}
        </div>

        {groupedData.investments.items.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                <span className="text-purple-400 text-[10px] font-black uppercase tracking-[0.2em]">Movimentações de Investimento</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-purple-500/20 to-transparent"></div>
            </div>

            <CategoryRow
              cat={{
                id: 'investments-section',
                name: 'Investimentos (Aportes e Resgates)',
                icon: 'payments',
                items: groupedData.investments.items,
                total: groupedData.investments.total
              }}
              type="investment"
            />
          </div>
        )}

        {groupedData.transfers.items.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="px-4 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/20">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Transferências entre Contas</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-500/20 to-transparent"></div>
            </div>

            <CategoryRow
              cat={{
                id: 'transfers-section',
                name: 'Transferências Recebidas/Enviadas',
                icon: 'sync_alt',
                items: groupedData.transfers.items,
                total: 0
              }}
              type="transfer"
            />
          </div>
        )}
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          refresh();
          refreshInvestments();
          if (isEditing) setIsModalOpen(false);
        }}
        accounts={accounts}
        categories={categories}
        cards={cards}
        investments={investments}
        saveTransaction={saveTransaction}
        saveTransfer={saveTransfer}
        saveInvestmentTransaction={saveInvestmentTransaction}
        updateTransaction={updateTransaction}
        updateInvestmentTransaction={updateInvestmentTransaction}
        isEditing={isEditing}
        initialData={currentTransactionId ? transactions.find(t => t.id === currentTransactionId) : null}
      />
      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        onSave={handleBulkUpdate}
        accounts={accounts}
        categories={categories}
        selectedCount={selectedIds.length}
      />
    </div>
  );
};

export default CashFlow;
