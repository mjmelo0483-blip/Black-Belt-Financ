import React, { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';

const Accounts: React.FC = () => {
  const { accounts, loading, addAccount, updateAccount, deleteAccount, getAccountTransactions, getAccountStatement, getTransactionsAfterDate } = useAccounts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [accountTransactions, setAccountTransactions] = useState<any[]>([]);
  const [statementData, setStatementData] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'statement'>('summary');
  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'checking',
    balance: '',
    initial_balance_date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Simulation State
  const [simulationDate, setSimulationDate] = useState(new Date().toISOString().split('T')[0]);
  const [simulatedBalance, setSimulatedBalance] = useState<number | null>(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);

  React.useEffect(() => {
    const calculateSimulatedBalance = async () => {
      if (!simulationDate || accounts.length === 0) return;
      setLoadingSimulation(true);

      // Saldo na data de referência = Saldo Atual - lançamentos realizados com due_date > data de referência
      // (Subtraímos as transações que ainda não haviam ocorrido na data de referência)
      let totalBalance = 0;

      const promises = accounts.map(acc => getTransactionsAfterDate(acc.id, simulationDate));
      const results = await Promise.all(promises);

      results.forEach((res, index) => {
        const acc = accounts[index];
        let accountBalance = acc.balance; // Saldo atual

        if (res.data) {
          res.data.forEach((t: any) => {
            // Reverter as transações que ocorreram DEPOIS da data de referência
            // Se foi receita, subtrair; se foi despesa, adicionar de volta
            if (t.type === 'income') accountBalance -= t.amount;
            else accountBalance += t.amount;
          });
        }

        totalBalance += accountBalance;
      });

      setSimulatedBalance(totalBalance);
      setLoadingSimulation(false);
    };

    calculateSimulatedBalance();
  }, [simulationDate, accounts]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name || !newAccount.balance) return;

    setSaving(true);
    const accountData = {
      name: newAccount.name,
      type: newAccount.type,
      balance: parseFloat(newAccount.balance.toString().replace(',', '.')),
      initial_balance_date: newAccount.initial_balance_date,
    };

    let result;
    if (isEditing && selectedAccount) {
      result = await updateAccount(selectedAccount.id, accountData);
      // Update selected account in detail modal if open
      if (result.data) setSelectedAccount(result.data[0]);
    } else {
      result = await addAccount(accountData);
    }

    if (result.error) {
      alert('Erro: ' + (result.error as any).message);
    } else {
      setIsModalOpen(false);
      setNewAccount({
        name: '',
        type: 'checking',
        balance: '',
        initial_balance_date: new Date().toISOString().split('T')[0]
      });
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleEditClick = () => {
    if (!selectedAccount) return;
    setNewAccount({
      name: selectedAccount.name,
      type: selectedAccount.type,
      balance: selectedAccount.balance.toString().replace('.', ','),
      initial_balance_date: selectedAccount.initial_balance_date,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    if (!confirm(`Tem certeza que deseja excluir a conta "${selectedAccount.name}"? Esta ação não pode ser desfeita.`)) return;

    const { error } = await deleteAccount(selectedAccount.id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      setIsDetailModalOpen(false);
      setSelectedAccount(null);
    }
  };

  const handleViewDetails = async (account: any) => {
    setSelectedAccount(account);
    setIsDetailModalOpen(true);
    setLoadingTransactions(true);

    const { data, error } = await getAccountTransactions(account.id);
    if (!error) {
      setAccountTransactions(data || []);
    }
    setLoadingTransactions(false);

    // Fetch Statement
    setLoadingStatement(true);
    const { data: statement, error: stError } = await getAccountStatement(account.id);
    if (!stError && statement) {
      // Extrato: mostra todas as transações realizadas
      // Saldo é calculado retroativamente: Saldo Atual - transações (do mais recente ao mais antigo)
      // OU calculado progressivamente: saldo inicial + transações

      // Ordenar por due_date (data de vencimento) para melhor visualização
      const sortedStatement = [...statement].sort((a, b) => {
        const dateA = a.due_date || a.date;
        const dateB = b.due_date || b.date;
        return dateA.localeCompare(dateB);
      });

      // Calcular saldo progressivamente
      // Saldo inicial + transações em ordem cronológica
      let runningBalance = account.balance;

      // Primeiro, subtrair todas as transações para voltar ao "saldo inicial"
      sortedStatement.forEach((t: any) => {
        if (t.type === 'income') runningBalance -= t.amount;
        else runningBalance += t.amount;
      });

      // Agora recalcular progressivamente
      const statementWithBalance = sortedStatement.map((t: any) => {
        if (t.type === 'income') runningBalance += t.amount;
        else runningBalance -= t.amount;
        return { ...t, balanceAfter: runningBalance };
      });

      setStatementData(statementWithBalance);
    }
    setLoadingStatement(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getAccountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      checking: 'Conta Corrente',
      savings: 'Poupança',
      investment: 'Investimentos',
      cash: 'Dinheiro',
      credit: 'Cartão de Crédito'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background-dark">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <h1 className="text-white text-3xl font-bold tracking-tight">Minhas Contas</h1>
          <p className="text-[#92adc9] text-base">Gerencie seus saldos e integrações bancárias em um só lugar.</p>
        </div>
        <button
          onClick={() => {
            setIsEditing(false);
            setNewAccount({ name: '', type: 'checking', balance: '' });
            setIsModalOpen(true);
          }}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary hover:bg-blue-600 text-white px-5 font-semibold text-sm transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Nova Conta</span>
        </button>
      </div>

      {/* Balance Simulator Card */}
      <div className="p-6 rounded-2xl bg-[#1c2a38]/50 border border-[#324d67]/50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-500/5 pointer-events-none"></div>

        <div className="flex items-center gap-4 z-10 w-full md:w-auto">
          <div className="size-12 rounded-xl bg-[#233648] flex items-center justify-center text-primary shadow-lg border border-[#324d67]">
            <span className="material-symbols-outlined text-[24px]">history_edu</span>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Simulador de Saldo</h3>
            <p className="text-[#92adc9] text-sm hidden md:block">Verifique o saldo acumulado de todas as contas em uma data passada.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 z-10 w-full md:w-auto bg-[#111a22]/50 p-2 md:p-3 rounded-xl border border-[#324d67]/30">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[10px] font-bold text-[#92adc9] uppercase tracking-wider pl-1">Data de Referência</label>
            <input
              type="date"
              value={simulationDate}
              onChange={(e) => setSimulationDate(e.target.value)}
              className="bg-[#1c2a38] border border-[#324d67] rounded-lg px-3 py-2 text-white text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="hidden md:block w-px h-10 bg-[#324d67]"></div>

          <div className="flex flex-col gap-1 w-full md:w-auto items-end md:items-start text-right md:text-left min-w-[150px]">
            <label className="text-[10px] font-bold text-[#92adc9] uppercase tracking-wider">Saldo Calculado</label>
            {loadingSimulation ? (
              <div className="h-6 w-24 bg-[#324d67]/50 rounded animate-pulse"></div>
            ) : (
              <p className="text-white font-black text-xl tracking-tight">
                {simulatedBalance !== null ? formatCurrency(simulatedBalance) : '---'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc, i) => (
          <div
            key={acc.id}
            onClick={() => handleViewDetails(acc)}
            className="group relative flex flex-col p-6 rounded-2xl bg-[#1c2a38]/80 backdrop-blur-xl border border-[#324d67]/50 hover:border-primary/50 transition-all shadow-sm hover:shadow-md cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative z-10 flex justify-between items-start mb-6">
              <div className={`size-12 rounded-xl bg-gradient-to-br from-primary to-[#094b8e] flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20`}>
                {acc.name.substring(0, 2).toUpperCase()}
              </div>
              <button className="text-[#92adc9] hover:text-white transition-colors">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
            <div className="relative z-10 flex flex-col gap-1 mb-6">
              <h3 className="text-white font-semibold text-lg">{acc.name}</h3>
              <span className="text-xs text-[#92adc9] px-2 py-0.5 rounded-full bg-[#111a22] w-fit border border-[#324d67]/30">{getAccountTypeLabel(acc.type)}</span>
            </div>
            <div className="relative z-10 mt-auto pt-4 border-t border-[#324d67]/30 flex items-end justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-[#92adc9] mb-0.5 uppercase tracking-wider font-semibold">Saldo Atual</span>
                <span className="text-white font-bold text-xl tracking-tight">{formatCurrency(acc.balance)}</span>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-[#324d67] hover:border-primary hover:bg-[#233648]/30 transition-all group min-h-[220px]"
        >
          <div className="size-14 rounded-full bg-[#111a22] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg border border-[#324d67]/50">
            <span className="material-symbols-outlined text-primary text-3xl">add</span>
          </div>
          <h3 className="text-white font-medium text-lg">Adicionar Nova Conta</h3>
        </button>
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-8 border-b border-[#324d67]/50 bg-gradient-to-r from-[#1c2a38] to-[#1a2632] flex justify-between items-start">
              <div className="flex gap-4 items-center">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-[#094b8e] flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-primary/20">
                  {selectedAccount.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">{selectedAccount.name}</h2>
                  <p className="text-[#92adc9] text-sm uppercase tracking-widest font-semibold mt-1">{getAccountTypeLabel(selectedAccount.type)}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="size-10 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white hover:bg-[#233648] transition-all flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* View Toggle */}
            <div className="px-8 pb-4 flex gap-4 border-b border-[#324d67]/30 mb-6">
              <button
                onClick={() => setViewMode('summary')}
                className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${viewMode === 'summary' ? 'text-primary border-primary' : 'text-[#92adc9] border-transparent hover:text-white'}`}
              >
                Visão Geral
              </button>
              <button
                onClick={() => setViewMode('statement')}
                className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${viewMode === 'statement' ? 'text-primary border-primary' : 'text-[#92adc9] border-transparent hover:text-white'}`}
              >
                Extrato Detalhado
              </button>
            </div>

            {viewMode === 'summary' ? (
              <div className="p-8 pt-0">
                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="p-6 rounded-2xl bg-[#111a22] border border-[#324d67]/30">
                    <p className="text-[#92adc9] text-xs font-bold uppercase tracking-wider mb-2">Saldo Total</p>
                    <p className="text-white text-3xl font-black tracking-tight">{formatCurrency(selectedAccount.balance)}</p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[#111a22] border border-[#324d67]/30">
                    <p className="text-[#92adc9] text-xs font-bold uppercase tracking-wider mb-2">Última Movimentação</p>
                    <p className="text-white text-lg font-bold">
                      {accountTransactions.length > 0
                        ? new Date(accountTransactions[0].date + 'T12:00:00').toLocaleDateString('pt-BR')
                        : 'Nenhuma'
                      }
                    </p>
                  </div>
                </div>

                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                  Histórico Recente
                </h3>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {loadingTransactions ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3">
                      <div className="size-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                      <p className="text-[#92adc9] text-sm">Carregando transações...</p>
                    </div>
                  ) : accountTransactions.length > 0 ? (
                    accountTransactions.map((t, i) => (
                      <div key={i} className={`flex items-center justify-between p-4 rounded-xl bg-[#111a22] hover:bg-[#1c2a38] transition-all border-l-4 ${t.type === 'expense' ? 'border-red-500' : 'border-green-500'}`}>
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-full bg-[#233648] flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-[20px]">{t.categories?.icon || 'receipt_long'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-bold text-sm leading-tight truncate">{t.description || 'Sem descrição'}</p>
                              {t.payment_method && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#233648] text-[#92adc9] text-[9px] font-black uppercase tracking-wider">
                                  {t.payment_method === 'credito' ? '💳 Cartão' : t.payment_method === 'pix' ? '💎 Pix' : '💰 Débito'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-[#92adc9] text-[10px] flex items-center gap-1 uppercase font-bold">
                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                Inc: {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </p>
                              {t.due_date && (
                                <p className="text-[#92adc9] text-[10px] flex items-center gap-1 uppercase font-bold">
                                  <span className="material-symbols-outlined text-[12px]">event_busy</span>
                                  Venc: {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className={`font-black ${t.type === 'expense' ? 'text-white' : 'text-green-400'}`}>
                          {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.amount)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center bg-[#111a22]/50 rounded-2xl border border-dashed border-[#324d67]/50">
                      <span className="material-symbols-outlined text-[48px] text-[#324d67] mb-2">inbox</span>
                      <p className="text-[#92adc9] text-sm">Nenhuma transação nesta conta</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 pt-0">
                <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3 items-start">
                  <span className="material-symbols-outlined text-blue-400">info</span>
                  <div className="text-sm text-blue-200">
                    <p className="font-bold mb-1">Sobre o Extrato</p>
                    <p className="opacity-80">Este extrato reconstrói o saldo histórico baseando-se no saldo atual da conta e nas transações marcadas como "Realizadas". Transações futuras ou pendentes não afetam o cálculo.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#324d67]/50 max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#111a22] sticky top-0 z-10">
                      <tr>
                        <th className="p-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Data</th>
                        <th className="p-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Descrição</th>
                        <th className="p-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                        <th className="p-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#324d67]/30 bg-[#1c2a38]/30">
                      {loadingStatement ? (
                        <tr><td colSpan={4} className="p-8 text-center text-[#92adc9]">Carregando extrato...</td></tr>
                      ) : statementData.length > 0 ? (
                        statementData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#111a22]/50 transition-colors">
                            <td className="p-4 text-white text-xs font-medium border-l-2 border-transparent hover:border-primary">
                              {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-[#92adc9]">{row.categories?.icon || 'receipt'}</span>
                                <span className="text-white text-sm font-medium">{row.description}</span>
                              </div>
                            </td>
                            <td className={`p-4 text-right font-bold text-sm ${row.type === 'income' ? 'text-green-400' : 'text-white'}`}>
                              {row.type === 'income' ? '+' : '-'} {formatCurrency(row.amount)}
                            </td>
                            <td className="p-4 text-right font-bold text-sm text-[#92adc9]">
                              {formatCurrency(row.balanceAfter)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="p-8 text-center text-[#92adc9]">Nenhuma movimentação realizada encontrada.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="p-8 bg-[#111a22]/50 border-t border-[#324d67]/50 flex justify-between items-center px-8">
              <button
                onClick={handleDeleteAccount}
                className="h-11 px-6 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all text-sm font-bold flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Excluir
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleEditClick}
                  className="h-11 px-6 rounded-xl border border-[#324d67] text-[#92adc9] hover:text-white hover:bg-[#233648] transition-all text-sm font-bold flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Editar Conta
                </button>
                <button onClick={() => setIsDetailModalOpen(false)} className="h-11 px-8 rounded-xl bg-primary hover:bg-blue-600 text-white transition-all text-sm font-bold">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-gradient-to-r from-[#1c2a38] to-[#1a2632]">
              <h2 className="text-white text-xl font-bold">{isEditing ? 'Editar Conta' : 'Nova Conta'}</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIsEditing(false);
                  setNewAccount({ name: '', type: 'checking', balance: '' });
                }}
                className="size-8 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white transition-all flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#92adc9] uppercase tracking-wider text-[10px]">Nome da Conta</label>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="Ex: Nubank, Itaú, Carteira"
                  className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-[#4a6b8a]"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#92adc9] uppercase tracking-wider text-[10px]">Tipo de Conta</label>
                <select
                  className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={newAccount.type}
                  onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                >
                  <option value="checking">Conta Corrente</option>
                  <option value="savings">Poupança</option>
                  <option value="investment">Investimentos</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit">Cartão de Crédito</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#92adc9] uppercase tracking-wider text-[10px]">Saldo Inicial</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">R$</span>
                  <input
                    required
                    type="text"
                    placeholder="0,00"
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 pl-12 pr-4 text-white text-lg font-bold focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-[#4a6b8a]"
                    value={newAccount.balance}
                    onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#92adc9] uppercase tracking-wider text-[10px]">Data do Saldo Inicial</label>
                <input
                  required
                  type="date"
                  className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={newAccount.initial_balance_date}
                  onChange={(e) => setNewAccount({ ...newAccount, initial_balance_date: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-14 rounded-xl text-[#92adc9] font-bold text-sm hover:bg-[#233648] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-14 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check</span>
                      Salvar Conta
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
