import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTransactions } from '../hooks/useTransactions';
import { useInvestments } from '../hooks/useInvestments';
import { supabase } from '../supabase';
import TransactionModal from '../components/TransactionModal';

const Transactions: React.FC = () => {
  const {
    accounts,
    categories,
    cards,
    transactions,
    fetchTransactions,
    saveTransaction,
    saveTransfer,
    saveInvestmentTransaction,
    updateTransaction,
    deleteTransaction,
    deleteTransactions,
    loading: metaLoading
  } = useTransactions();

  const { investments, refreshInvestments } = useInvestments();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);

  // Filters State
  const [filterDescription, setFilterDescription] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterIncStartDate, setFilterIncStartDate] = useState('');
  const [filterIncEndDate, setFilterIncEndDate] = useState('');
  const [filterDueStartDate, setFilterDueStartDate] = useState('');
  const [filterDueEndDate, setFilterDueEndDate] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const location = useLocation();

  // Listen for search query from header
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    if (query) {
      setFilterDescription(query);
      fetchTransactions({ description: query });
    }
  }, [location.search]);

  const handleApplyFilters = () => {
    fetchTransactions({
      description: filterDescription,
      accountId: filterAccountId,
      incStartDate: filterIncStartDate,
      incEndDate: filterIncEndDate,
      dueStartDate: filterDueStartDate,
      dueEndDate: filterDueEndDate,
      minAmount: filterMinAmount ? parseFloat(filterMinAmount) : undefined,
      maxAmount: filterMaxAmount ? parseFloat(filterMaxAmount) : undefined,
      status: filterStatus
    });
  };

  const clearFilters = () => {
    setFilterDescription('');
    setFilterAccountId('');
    setFilterIncStartDate('');
    setFilterIncEndDate('');
    setFilterDueStartDate('');
    setFilterDueEndDate('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setFilterStatus('');
    fetchTransactions();
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
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Lançamentos</h1>
          <p className="text-[#92adc9] mt-1">Gerencie e acompanhe todas as suas movimentações financeiras.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="px-6 h-12 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Novo Lançamento
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-[#324d67]/50">
        <div className="flex flex-col gap-8">
          {/* Row 1: Context & Primary Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                <span className="material-symbols-outlined text-[16px]">search</span>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Descrição</span>
              </div>
              <input
                className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white placeholder:text-[#4a6b8a] outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                placeholder="Busque por descrição..."
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
              />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                <span className="material-symbols-outlined text-[16px]">flag</span>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Situação</span>
              </div>
              <select
                className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="completed">Realizado</option>
                <option value="open">Em Aberto</option>
              </select>
            </div>
            <div className="lg:col-span-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Conta</span>
              </div>
              <select
                className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
              >
                <option value="">Todas as contas</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3 flex gap-2 h-[46px]">
              <button
                onClick={handleApplyFilters}
                className="flex-[2] h-full rounded-xl bg-primary text-white font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                Filtrar
              </button>
              <button
                onClick={clearFilters}
                className="flex-1 h-full rounded-xl border border-[#324d67] text-[#92adc9] hover:text-white hover:border-white transition-all flex items-center justify-center"
                title="Limpar Filtros"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
              </button>
            </div>
          </div>

          {/* Row 2: Values & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Faixa de Valor</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6b8a] text-[10px] font-bold">R$</span>
                  <input
                    className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl pl-8 pr-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium"
                    placeholder="Min"
                    type="number"
                    value={filterMinAmount}
                    onChange={(e) => setFilterMinAmount(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6b8a] text-[10px] font-bold">R$</span>
                  <input
                    className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl pl-8 pr-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-medium"
                    placeholder="Max"
                    type="number"
                    value={filterMaxAmount}
                    onChange={(e) => setFilterMaxAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Inclusão</span>
              </div>
              <div className="flex items-center gap-2 h-[46px]">
                <input
                  className="flex-1 h-full bg-[#111a22] border border-[#324d67] rounded-xl px-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-xs [color-scheme:dark] font-medium"
                  type="date"
                  value={filterIncStartDate}
                  onChange={(e) => setFilterIncStartDate(e.target.value)}
                />
                <span className="text-[#324d67] font-bold">-</span>
                <input
                  className="flex-1 h-full bg-[#111a22] border border-[#324d67] rounded-xl px-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-xs [color-scheme:dark] font-medium"
                  type="date"
                  value={filterIncEndDate}
                  onChange={(e) => setFilterIncEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                <span className="material-symbols-outlined text-[16px]">event_busy</span>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Vencimento</span>
              </div>
              <div className="flex items-center gap-2 h-[46px]">
                <input
                  className="flex-1 h-full bg-[#111a22] border border-[#324d67] rounded-xl px-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-xs [color-scheme:dark] font-medium"
                  type="date"
                  value={filterDueStartDate}
                  onChange={(e) => setFilterDueStartDate(e.target.value)}
                />
                <span className="text-[#324d67] font-bold">-</span>
                <input
                  className="flex-1 h-full bg-[#111a22] border border-[#324d67] rounded-xl px-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-xs [color-scheme:dark] font-medium"
                  type="date"
                  value={filterDueEndDate}
                  onChange={(e) => setFilterDueEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-[18px]">check_box</span>
            </div>
            <span className="text-red-400 font-bold text-sm">{selectedIds.length} item(s) selecionado(s)</span>
          </div>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-6 h-10 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Excluir Selecionados
          </button>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-[#324d67]/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111a22]/50 border-b border-[#324d67]/50">
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded bg-[#111a22] border-[#324d67] text-primary focus:ring-offset-[#1c2a38] focus:ring-primary w-4 h-4 cursor-pointer"
                    checked={transactions.length > 0 && selectedIds.length === transactions.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Descrição</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Categoria / Conta</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Data / Venc.</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Forma</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Situação</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#324d67]/30">
              {transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className={`hover:bg-[#111a22]/30 transition-colors group ${selectedIds.includes(t.id) ? 'bg-[#111a22]/50' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded bg-[#111a22] border-[#324d67] text-primary focus:ring-offset-[#1c2a38] focus:ring-primary w-4 h-4 cursor-pointer"
                        checked={selectedIds.includes(t.id)}
                        onChange={() => toggleSelection(t.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-[#111a22] flex items-center justify-center text-white shrink-0">
                          <span className="material-symbols-outlined text-[20px]">{t.categories?.icon || 'receipt_long'}</span>
                        </div>
                        <p className="text-white font-bold text-sm truncate max-w-[200px]">{t.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-white text-xs font-bold">{t.categories?.name || 'Sem categoria'}</p>
                      <p className="text-[#92adc9] text-[10px] mt-0.5 uppercase tracking-wider">{t.accounts?.name || 'Sem conta'}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <p className="text-white font-medium">Inc: {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      {t.due_date && <p className="text-[#92adc9] mt-0.5">Venc: {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 rounded-md bg-[#111a22] text-[#6384a3] text-[9px] font-black uppercase tracking-widest border border-[#324d67]/50">
                        {t.payment_method === 'credito' ? '💳 Cartão' : t.payment_method === 'pix' ? '💎 Pix' : '💰 Débito'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {t.status === 'completed' ? (
                        <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-[9px] font-black border border-green-500/20 uppercase tracking-widest">Realizado</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[9px] font-black border border-orange-500/20 uppercase tracking-widest">Em Aberto</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <p className={`font-black text-sm ${t.type === 'expense' ? 'text-white' : 'text-green-400'}`}>
                        {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.amount)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(t)}
                          className="size-8 rounded-lg text-[#92adc9] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="size-8 rounded-lg text-[#92adc9] hover:text-red-400 hover:bg-red-400/10 transition-all flex items-center justify-center"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-[48px] text-[#324d67]">inbox</span>
                      <p className="text-[#92adc9] text-sm font-medium">Nenhum lançamento encontrado com estes filtros.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          fetchTransactions();
          refreshInvestments();
          setIsModalOpen(false);
        }}
        accounts={accounts}
        categories={categories}
        cards={cards}
        investments={investments}
        saveTransaction={saveTransaction}
        saveTransfer={saveTransfer}
        saveInvestmentTransaction={saveInvestmentTransaction}
        updateTransaction={updateTransaction}
        isEditing={isEditing}
        initialData={currentTransactionId ? transactions.find(t => t.id === currentTransactionId) : null}
      />
    </div>
  );
};

export default Transactions;
