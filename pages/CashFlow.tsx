import React, { useState } from 'react';
import { useCashFlow } from '../hooks/useCashFlow';
import { useTransactions } from '../hooks/useTransactions';
import TransactionModal from '../components/TransactionModal';

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

  const { categories, cards, saveTransaction, deleteTransaction, deleteTransactions } = useTransactions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00'); // Midday to avoid TZ issues
    if (viewMode === 'monthly') {
      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

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
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Deseja excluir ${selectedIds.length} lançamentos?`)) {
      await deleteTransactions(selectedIds);
      setSelectedIds([]);
      refresh();
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8 h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold tracking-tight">Fluxo de Caixa</h2>
          <p className="text-[#92adc9] text-sm mt-1">Veja sua movimentação {viewMode === 'daily' ? 'do dia' : 'do mês'} detalhada pela <b>data de vencimento</b>.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#233648] rounded-xl p-1 border border-[#324d67]/30">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'daily' ? 'bg-primary text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
          >
            DIÁRIO
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-primary text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
          >
            MENSAL
          </button>
        </div>

        <div className="flex items-center bg-[#233648] rounded-lg p-1 border border-[#324d67]/30">
          <button
            onClick={() => navigateDate(-1)}
            className="p-1.5 rounded-md hover:bg-[#334b63] text-[#92adc9] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>

          <div className="relative flex items-center px-4 min-w-[180px] justify-center">
            <input
              type="date"
              className="absolute inset-0 opacity-0 cursor-pointer"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <span className="material-symbols-outlined text-sm text-primary mr-2">calendar_month</span>
            <span className="text-white text-xs font-bold uppercase tracking-wider select-none">
              {formatDateLabel(selectedDate)}
            </span>
          </div>

          <button
            onClick={() => navigateDate(1)}
            className="p-1.5 rounded-md hover:bg-[#334b63] text-[#92adc9] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#233648] p-5 rounded-xl border border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92adc9] text-sm font-medium">Saldo Inicial</span>
            <span className="material-symbols-outlined text-[#92adc9] bg-white/5 p-1 rounded-md text-lg">account_balance_wallet</span>
          </div>
          <p className="text-white text-2xl font-bold">{formatCurrency(stats.initialBalance)}</p>
        </div>
        <div className="bg-[#233648] p-5 rounded-xl border border-white/5 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92adc9] text-sm font-medium group-hover:text-emerald-400 transition-colors">Entradas</span>
            <span className="material-symbols-outlined text-emerald-400 bg-emerald-400/10 p-1 rounded-md text-lg">arrow_downward</span>
          </div>
          <p className="text-white text-2xl font-bold">{formatCurrency(stats.inflow)}</p>
        </div>
        <div className="bg-[#233648] p-5 rounded-xl border border-white/5 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[#92adc9] text-sm font-medium group-hover:text-red-400 transition-colors">Saídas</span>
            <span className="material-symbols-outlined text-red-400 bg-red-400/10 p-1 rounded-md text-lg">arrow_upward</span>
          </div>
          <p className="text-white text-2xl font-bold">{formatCurrency(-stats.outflow)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#137fec] to-[#0b5cb0] p-5 rounded-xl border border-primary shadow-lg shadow-blue-900/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-blue-100 text-sm font-medium">Projetado</span>
              <span className="material-symbols-outlined text-white bg-white/20 p-1 rounded-md text-lg">trending_up</span>
            </div>
            <p className="text-white text-2xl font-bold">{formatCurrency(stats.finalBalance)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="bg-[#233648] border-none text-white text-sm rounded-lg pl-3 pr-8 py-2 focus:ring-1 focus:ring-primary cursor-pointer hover:bg-[#2c4257] transition-colors"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Todas as Contas</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          onClick={handleOpenModal}
          className="flex items-center justify-center h-9 px-4 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-bold transition-all"
        >
          <span className="material-symbols-outlined text-lg mr-2">add</span> Nova Transação
        </button>
      </div>

      {
        selectedIds.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
            <span className="text-red-400 font-bold text-sm pl-2">{selectedIds.length} item(s) selecionado(s)</span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Excluir Selecionados
            </button>
          </div>
        )
      }

      <div className="bg-[#111a22] border border-[#233648] rounded-xl overflow-hidden flex-1 shadow-sm overflow-x-auto overflow-y-auto max-h-[500px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1a2632] border-b border-[#233648]">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  className="rounded bg-[#233648] border-[#324d67] text-primary focus:ring-offset-[#111a22] focus:ring-primary w-4 h-4 cursor-pointer"
                  checked={transactions.length > 0 && selectedIds.length === transactions.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#92adc9]">Vencimento</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#92adc9]">Descrição</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#92adc9]">Categoria</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#92adc9]">Status</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#92adc9] text-right">Valor</th>
              <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#92adc9] text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#233648] text-sm">
            {transactions.length > 0 ? (
              transactions.map((t, i) => (
                <tr key={i} className={`hover:bg-[#1c2a38] transition-colors group ${selectedIds.includes(t.id) ? 'bg-[#1c2a38]' : ''}`}>
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      className="rounded bg-[#233648] border-[#324d67] text-primary focus:ring-offset-[#111a22] focus:ring-primary w-4 h-4 cursor-pointer"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleSelection(t.id)}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-xs">
                        {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-[#92adc9] text-[10px] font-bold uppercase tracking-tighter">
                        Inc: {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        <span className="material-symbols-outlined text-sm">
                          {t.categories?.icon || (t.type === 'income' ? 'arrow_downward' : 'arrow_upward')}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{t.description}</span>
                        <span className="text-[10px] text-[#92adc9] uppercase font-bold tracking-wider">{t.accounts?.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#92adc9]">{t.categories?.name || 'Geral'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border ${t.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}
                    >
                      {t.status === 'completed' ? 'Realizado' : 'Em Aberto'}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-[#92adc9] hover:text-white p-1 rounded hover:bg-[#233648]"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-[#92adc9] hover:text-red-400 p-1 rounded hover:bg-red-400/10"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#92adc9]">
                  Nenhuma transação encontrada {viewMode === 'daily' ? 'para este dia' : 'para este período'}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          refresh();
          setIsModalOpen(false);
        }}
        accounts={accounts}
        categories={categories}
        cards={cards}
        saveTransaction={saveTransaction}
        isEditing={isEditing}
        initialData={currentTransactionId ? transactions.find(t => t.id === currentTransactionId) : null}
      />
    </div >
  );
};

export default CashFlow;
