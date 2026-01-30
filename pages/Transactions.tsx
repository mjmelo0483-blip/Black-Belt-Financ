import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTransactions } from '../hooks/useTransactions';
import { useInvestments } from '../hooks/useInvestments';
import TransactionModal from '../components/TransactionModal';
import { useView } from '../contexts/ViewContext';
import BulkEditModal from '../components/BulkEditModal';
import * as XLSX from 'xlsx';

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
    updateTransactions,
    updateInvestmentTransaction,
    deleteTransaction,
    deleteTransactions,
    importTransactionsFromExcel,
  } = useTransactions();
  const { isBusiness } = useView();

  const { investments, refresh: refreshInvestments } = useInvestments();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
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
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSubcategoryId, setFilterSubcategoryId] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const location = useLocation();

  // Listen for search query from header or initial load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    if (query) {
      setFilterDescription(query);
      fetchTransactions({ description: query, types: ['income', 'expense'] });
    } else {
      fetchTransactions({ types: ['income', 'expense'] });
    }
  }, [location.search, fetchTransactions]);

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
      status: filterStatus,
      categoryId: filterCategoryId,
      subcategoryId: filterSubcategoryId,
      paymentMethod: filterPaymentMethod,
      types: filterTypes.length > 0 ? filterTypes : undefined
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
    setFilterCategoryId('');
    setFilterSubcategoryId('');
    setFilterPaymentMethod('');
    setFilterTypes([]);
    fetchTransactions({ types: ['income', 'expense'] });
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
      refreshInvestments();
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
      refreshInvestments();
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    const result = await updateTransactions(selectedIds, updates);
    if (result.error) {
      alert('Erro ao atualizar lançamentos: ' + result.error.message);
    } else {
      setSelectedIds([]);
      refreshInvestments();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const totalIncome = transactions.filter(t => t.type === 'income' && !t.transfer_id && !t.investment_id && t.payment_method !== 'transferencia').reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense' && !t.transfer_id && !t.investment_id && t.payment_method !== 'transferencia').reduce((acc, t) => acc + Number(t.amount), 0);

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = ['Descrição', 'Valor', 'Tipo', 'Inclusão', 'Vencimento', 'Categoria', 'Conta', 'Forma', 'Situação'];
    const rows = transactions.map(t => [
      t.description,
      t.amount.toString().replace('.', ','),
      t.type === 'income' ? 'Receita' : t.type === 'expense' ? 'Despesa' : t.type === 'transfer' ? 'Transferência' : 'Investimento',
      t.date,
      t.due_date || '',
      t.categories?.name || '',
      t.accounts?.name || '',
      t.payment_method || '',
      t.status === 'completed' ? 'Realizado' : 'Em Aberto'
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `lancamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    document.getElementById('import-excel-input')?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });

        // Try to find the 'Movimento' sheet, otherwise use the first one
        let wsname = wb.SheetNames.find(n => n.toLowerCase().includes('movimento'));
        if (!wsname) wsname = wb.SheetNames[0];

        const ws = wb.Sheets[wsname];

        // Get data as array of arrays to find the header row
        const jsonData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find the row that contains our headers
        let headerRowIndex = -1;
        const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');

        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          if (row.some(cell => {
            const normalizedCell = normalize(String(cell));
            return normalizedCell.includes('datalancamento') ||
              normalizedCell.includes('nome') ||
              normalizedCell.includes('descricao');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          alert('Não foi possível encontrar o cabeçalho "Data de Lançamento" ou "Nome" na planilha.');
          return;
        }

        // Re-parse from that row
        const data = XLSX.utils.sheet_to_json(ws, {
          range: headerRowIndex,
          raw: false,
          dateNF: 'yyyy-mm-dd',
          defval: ''
        });

        const result = await importTransactionsFromExcel(data);
        if (result.error) {
          alert('Erro ao importar: ' + result.error);
        } else {
          alert(`Sucesso! ${result.count} lançamentos importados.`);
          fetchTransactions();
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      alert('Erro ao ler o arquivo: ' + err);
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Lançamentos</h1>
          <p className="text-[#92adc9] mt-1">Gerencie e acompanhe todas as suas movimentações financeiras.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="px-6 h-12 rounded-xl border border-[#324d67] text-[#92adc9] font-bold text-sm hover:text-white hover:border-white transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">file_download</span>
            Exportar Excel
          </button>
          <button
            onClick={handleImportClick}
            className="px-6 h-12 rounded-xl border border-[#324d67] text-[#92adc9] font-bold text-sm hover:text-white hover:border-white transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">file_upload</span>
            Importar Planilha
          </button>
          <input
            id="import-excel-input"
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={handleOpenModal}
            className="px-6 h-12 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* Summary Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-lg flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Total Receitas</span>
            <span className="material-symbols-outlined text-emerald-400 text-[20px]">trending_up</span>
          </div>
          <p className="text-white text-2xl font-black">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl p-6 border border-red-500/20 shadow-lg flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-red-400 text-[10px] font-black uppercase tracking-widest">Total Despesas</span>
            <span className="material-symbols-outlined text-red-400 text-[20px]">trending_down</span>
          </div>
          <p className="text-white text-2xl font-black">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-lg flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-primary text-[10px] font-black uppercase tracking-widest">Saldo Líquido</span>
            <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
          </div>
          <p className="text-white text-2xl font-black">{formatCurrency(totalIncome - totalExpense)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-[#324d67]/50">
        <div className="flex flex-col gap-8">
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
                <option value="">Todas</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
              </button>
            </div>
          </div>

          {/* Row 2: Value Range & Date Ranges */}
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

          <div className="lg:col-span-12 flex items-center justify-between pointer-events-none">
            <div className="h-[1px] flex-1 bg-[#324d67]/30"></div>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-[#1c2a38] border border-[#324d67] rounded-xl text-[#92adc9] text-[10px] font-black uppercase tracking-widest hover:text-white transition-all mx-4"
            >
              <span className="material-symbols-outlined text-[16px]">{showAdvancedFilters ? 'expand_less' : 'expand_more'}</span>
              {showAdvancedFilters ? 'Ocultar Filtros Avançados' : 'Filtros Avançados'}
            </button>
            <div className="h-[1px] flex-1 bg-[#324d67]/30"></div>
          </div>

          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                  <span className="material-symbols-outlined text-[16px]">category</span>
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Categoria</span>
                </div>
                <select
                  className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  value={filterCategoryId}
                  onChange={(e) => { setFilterCategoryId(e.target.value); setFilterSubcategoryId(''); }}
                >
                  <option value="">Todas</option>
                  {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                  <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_right</span>
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Subcategoria</span>
                </div>
                <select
                  disabled={!filterCategoryId}
                  className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm disabled:opacity-50"
                  value={filterSubcategoryId}
                  onChange={(e) => setFilterSubcategoryId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {categories.filter(c => c.parent_id === filterCategoryId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                  <span className="material-symbols-outlined text-[16px]">payments</span>
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Forma</span>
                </div>
                <select
                  className="w-full h-[46px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="debito">Débito</option>
                  <option value="pix">Pix</option>
                  <option value="credito_v">Crédito</option>
                  <option value="credito">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[#92adc9] h-4">
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Tipos</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['income', 'expense', 'transfer', 'investment'].map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${filterTypes.includes(type) ? 'bg-primary/20 border-primary text-white' : 'bg-[#111a22] border-[#324d67] text-[#6384a3]'}`}
                    >
                      {type === 'income' ? 'Receita' : type === 'expense' ? 'Despesa' : type === 'transfer' ? 'Transf.' : 'Inv.'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-primary font-bold text-sm">{selectedIds.length} item(s) selecionado(s)</span>
          <div className="flex gap-3">
            <button onClick={() => setIsBulkEditOpen(true)} className="bg-primary text-white px-6 h-10 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Alterar Selecionados
            </button>
            <button onClick={handleBulkDelete} className="bg-red-500 text-white px-6 h-10 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-[#324d67]/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#111a22]/50 border-b border-[#324d67]/50">
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" checked={transactions.length > 0 && selectedIds.length === transactions.length} onChange={toggleSelectAll} className="rounded bg-[#111a22] border-[#324d67] text-primary" />
                </th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Descrição / Categoria</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Data / Venc.</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Conta</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Situação</th>
                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#324d67]/30">
              {transactions.length > 0 ? transactions.map(t => (
                <tr key={t.id} className="hover:bg-[#111a22]/30 transition-colors group">
                  <td className="px-6 py-4">
                    <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelection(t.id)} className="rounded bg-[#111a22] border-[#324d67] text-primary" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-[#111a22] flex items-center justify-center text-white"><span className="material-symbols-outlined text-[20px]">{t.categories?.icon || (t.transfer_id ? 'sync_alt' : 'receipt_long')}</span></div>
                      <div>
                        <p className="text-white font-bold text-sm truncate max-w-[200px]">{t.description}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[#92adc9] text-[10px] uppercase tracking-wider">{t.categories?.name || 'Sem categoria'}</p>
                          {isBusiness && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                              {t.store_name || 'Geral'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-xs">
                        {new Date((t.due_date || t.date) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-[#92adc9] text-[10px] font-bold uppercase tracking-tighter">
                        Inc: {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-[#92adc9] uppercase font-bold tracking-widest">
                    {t.accounts?.name || 'Sem conta'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[8px] font-black uppercase tracking-widest inline-flex items-center px-1.5 py-0.5 rounded border ${t.status === 'completed' ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-orange-400/10 text-orange-400 border-orange-400/20'}`}>
                        {t.status === 'completed' ? 'Realizado' : 'Em Aberto'}
                      </span>
                      <span className="text-[#6384a3] text-[9px] font-bold uppercase tracking-widest opacity-60">
                        {t.payment_method || 'debito'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <p className={`font-black text-sm ${t.type === 'expense' ? 'text-white' : 'text-green-400'}`}>{t.type === 'expense' ? '-' : '+'} {formatCurrency(t.amount)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(t)} className="size-8 rounded-lg text-[#92adc9] hover:text-white hover:bg-white/10 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                      <button onClick={() => handleDelete(t.id)} className="size-8 rounded-lg text-[#92adc9] hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-[#92adc9] text-sm">Nenhum lançamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          fetchTransactions();
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

export default Transactions;
