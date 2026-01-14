import React, { useState, useEffect, useMemo } from 'react';
import { useCards } from '../hooks/useCards';
import { ResponsiveContainer, PieChart, Pie, Tooltip, Cell, Legend } from 'recharts';

const Cards: React.FC = () => {
  const { cards, loading, addCard, updateCard, deleteCard, getCardTransactions, getCardOpenTransactions } = useCards();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    brand: 'Visa',
    last_digits: '',
    credit_limit: '',
    closing_day: '1',
    due_day: '10',
    color: '#1e293b'
  });
  const [saving, setSaving] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cardTransactions, setCardTransactions] = useState<any[]>([]);
  const [usedLimit, setUsedLimit] = useState(0); // Total de TODAS as faturas em aberto
  const [invoiceTotal, setInvoiceTotal] = useState(0); // Total da fatura do mês selecionado
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Estado para navegação de fatura por mês
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Dados para o gráfico de categorias
  const categoryChartData = useMemo(() => {
    const totals: Record<string, { name: string; value: number; color: string }> = {};

    cardTransactions.forEach(t => {
      const categoryName = t.categories?.name || 'Geral';
      const categoryColor = t.categories?.color || '#94a3b8';

      if (!totals[categoryName]) {
        totals[categoryName] = { name: categoryName, value: 0, color: categoryColor };
      }
      totals[categoryName].value += t.amount;
    });

    return Object.values(totals).sort((a, b) => b.value - a.value);
  }, [cardTransactions]);

  const currentCard = cards[activeCardIndex] || null;

  // Funções de navegação de mês
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[month];
  };

  // Buscar limite utilizado (todas as transações em aberto do cartão)
  useEffect(() => {
    const loadUsedLimit = async () => {
      if (currentCard) {
        const { data } = await getCardOpenTransactions(currentCard.id);
        const openTransactions = data || [];
        const totalOpen = openTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        setUsedLimit(totalOpen);
      } else {
        setUsedLimit(0);
      }
    };
    loadUsedLimit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.id]);

  // Buscar transações da fatura do mês selecionado
  useEffect(() => {
    const loadCardData = async () => {
      if (currentCard) {
        setLoadingTransactions(true);
        // Buscar transações filtradas pelo mês/ano selecionado
        const { data } = await getCardTransactions(currentCard.id, selectedMonth, selectedYear);
        const transactions = (data || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setCardTransactions(transactions);

        // Total da fatura do mês selecionado
        const monthTotal = transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        setInvoiceTotal(monthTotal);
        setLoadingTransactions(false);
      } else {
        setCardTransactions([]);
        setInvoiceTotal(0);
        setLoadingTransactions(false);
      }
    };
    loadCardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.id, selectedMonth, selectedYear]);

  const handleNewClick = () => {
    setFormData({
      name: '',
      brand: 'Visa',
      last_digits: '',
      credit_limit: '',
      closing_day: '1',
      due_day: '10',
      color: '#1e293b'
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEditClick = (card: any) => {
    setSelectedCard(card);
    setFormData({
      name: card.name,
      brand: card.brand,
      last_digits: card.last_digits,
      credit_limit: card.credit_limit.toString(),
      closing_day: card.closing_day.toString(),
      due_day: card.due_day.toString(),
      color: card.color
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.credit_limit) return;

    setSaving(true);
    const cardData = {
      ...formData,
      credit_limit: parseFloat(formData.credit_limit.toString().replace(',', '.')),
      closing_day: parseInt(formData.closing_day.toString()),
      due_day: parseInt(formData.due_day.toString())
    };

    let result;
    if (isEditing && selectedCard) {
      result = await updateCard(selectedCard.id, cardData);
    } else {
      result = await addCard(cardData);
    }

    if (result.error) {
      alert('Erro ao salvar: ' + (result.error as any).message);
    } else {
      setIsModalOpen(false);
      setSelectedCard(null);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!currentCard) return;
    if (!confirm(`Deseja excluir o cartão "${currentCard.name}"?`)) return;

    const { error } = await deleteCard(currentCard.id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      setActiveCardIndex(0);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cartões de Crédito</h1>
          <p className="text-[#92adc9] mt-1">Gerencie seus limites, faturas e cartões virtuais.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleNewClick}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#233648] px-4 py-2 text-sm font-medium text-white hover:bg-[#324d67] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add_card</span> Adicionar Cartão
          </button>
        </div>
      </div>

      {cards.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div
              className="group relative overflow-hidden rounded-2xl border border-[#233648] p-8 shadow-xl transition-all cursor-pointer hover:scale-[1.01]"
              style={{ background: currentCard.color === '#1e293b' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : currentCard.color }}
            >
              <div className="relative z-10 flex h-full flex-col justify-between min-h-[220px]">
                <div className="flex justify-between items-start">
                  <div className="text-white font-bold text-xl tracking-wider">{currentCard.name}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClick(currentCard)} className="text-white/60 hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <span className="material-symbols-outlined text-white/80 text-3xl">contactless</span>
                  </div>
                </div>
                <div className="mt-auto">
                  <p className="text-xs text-white/60 uppercase tracking-widest mb-1">Número do Cartão</p>
                  <p className="text-white font-mono text-xl tracking-widest">•••• •••• •••• {currentCard.last_digits}</p>
                  <div className="mt-6 flex justify-between">
                    <div>
                      <p className="text-[10px] text-white/60 uppercase mb-1">Bandeira</p>
                      <p className="text-white text-sm font-medium uppercase">{currentCard.brand}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/60 uppercase mb-1">Fechamento / Vencimento</p>
                      <p className="text-white text-sm font-medium uppercase">Dia {currentCard.closing_day} / {currentCard.due_day}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col justify-between rounded-xl bg-[#1c2a38] border border-[#324d67]/30 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                  </div>
                  <span className="text-[#92adc9] text-sm font-medium">Limite Total</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{formatCurrency(currentCard.credit_limit)}</h3>
                <div className="mt-3 w-full bg-[#111a22] rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((usedLimit / currentCard.credit_limit) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-[#92adc9] mt-2 font-medium">
                  {formatCurrency(usedLimit)} utilizado ({((usedLimit / currentCard.credit_limit) * 100).toFixed(1)}%)
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl bg-[#1c2a38] border border-[#324d67]/30 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                    <span className="material-symbols-outlined">check_circle</span>
                  </div>
                  <span className="text-[#92adc9] text-sm font-medium">Limite Disponível</span>
                </div>
                <h3 className="text-2xl font-bold text-white">{formatCurrency(currentCard.credit_limit - usedLimit)}</h3>
                <p className="text-xs text-[#92adc9] mt-2 italic text-[10px] uppercase font-bold tracking-widest">Liberado para compras</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-white">Meus Cartões</h3>
                <span className="text-xs text-[#92adc9]">{cards.length} cartões</span>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {cards.map((c, i) => (
                  <div
                    key={c.id}
                    onClick={() => setActiveCardIndex(i)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${activeCardIndex === i ? 'border-primary bg-[#233648] shadow-lg scale-[1.02]' : 'border-[#324d67]/50 bg-[#111a22] opacity-70 hover:opacity-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: c.color }}>
                        {c.brand.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${activeCardIndex === i ? 'text-white' : 'text-[#92adc9]'}`}>{c.name}</p>
                        <p className="text-[10px] text-[#92adc9] uppercase tracking-wider">•••• {c.last_digits}</p>
                      </div>
                    </div>
                    {activeCardIndex === i && (
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleDelete}
                className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Remover Cartão Atual
              </button>
            </div>

            <div className="lg:col-span-8 overflow-hidden rounded-xl border border-[#233648] bg-[#16212a] shadow-xl">
              <div className="p-6 border-b border-[#233648]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Fatura</h2>
                  <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-[10px] font-black uppercase tracking-widest">
                    {cardTransactions.length > 0 ? 'Aberta' : 'Sem lançamentos'}
                  </div>
                </div>

                {/* Seletor de Mês */}
                <div className="flex items-center justify-between bg-[#111a22] rounded-xl p-4">
                  <button
                    onClick={goToPreviousMonth}
                    className="size-10 rounded-lg bg-[#1c2a38] hover:bg-[#233648] text-[#92adc9] hover:text-white transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>

                  <div className="text-center">
                    <p className="text-white font-bold text-lg">
                      {getMonthName(selectedMonth)} {selectedYear}
                    </p>
                    <p className="text-[#92adc9] text-xs">
                      Vencimento: dia {currentCard?.due_day || 10}
                    </p>
                  </div>

                  <button
                    onClick={goToNextMonth}
                    className="size-10 rounded-lg bg-[#1c2a38] hover:bg-[#233648] text-[#92adc9] hover:text-white transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>

                {/* Total da Fatura */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[#92adc9] text-sm">Total da fatura:</span>
                  <span className="text-white font-bold text-xl">{formatCurrency(invoiceTotal)}</span>
                </div>

                {/* Gráfico de Categorias */}
                {cardTransactions.length > 0 && (
                  <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-8 min-h-[250px] w-full bg-[#111a22]/30 rounded-2xl p-6 border border-[#233648]/50">
                    <div className="w-full md:w-1/2 h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#111a22',
                              border: '1px solid #233648',
                              borderRadius: '12px',
                              fontSize: '12px',
                              color: '#fff',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                            }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => formatCurrency(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="w-full md:w-1/2 space-y-3">
                      <p className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest mb-4">Gastos por Categoria</p>
                      <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {categoryChartData.map((category, index) => (
                          <div key={index} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className="size-2 rounded-full" style={{ backgroundColor: category.color }}></div>
                              <span className="text-xs text-[#92adc9] font-medium group-hover:text-white transition-colors">{category.name}</span>
                            </div>
                            <span className="text-xs text-white font-bold">{formatCurrency(category.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                {loadingTransactions ? (
                  <div className="p-10 flex justify-center">
                    <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : cardTransactions.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#111a22]/30 border-b border-[#233648]">
                        <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Data</th>
                        <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Descrição</th>
                        <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Categoria</th>
                        <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#233648]/50">
                      {cardTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-[#111a22]/30 transition-colors">
                          <td className="px-6 py-4 text-white text-xs whitespace-nowrap">
                            {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-white font-bold text-xs truncate max-w-[200px]">{t.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[#92adc9] text-[10px] font-bold uppercase">{t.categories?.name || 'Geral'}</span>
                          </td>
                          <td className="px-6 py-4 text-right text-white font-black text-xs">
                            {formatCurrency(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-4">
                    <div className="size-20 rounded-full bg-[#111a22] flex items-center justify-center text-[#324d67] border border-[#233648] mb-2">
                      <span className="material-symbols-outlined text-[40px]">history</span>
                    </div>
                    <h4 className="text-white font-bold opacity-80">Nenhuma transação registrada neste cartão</h4>
                    <p className="text-[#92adc9] text-sm max-w-xs">As compras realizadas com este cartão aparecerão aqui automaticamente.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-[#1c2a38]/40 border-2 border-dashed border-[#324d67] rounded-3xl gap-6">
          <div className="size-24 rounded-full bg-[#111a22] flex items-center justify-center text-primary shadow-2xl border border-[#324d67]">
            <span className="material-symbols-outlined text-[48px]">credit_card_off</span>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-white font-bold text-2xl">Nenhum cartão cadastrado</h3>
            <p className="text-[#92adc9] max-w-md mx-auto">Adicione seus cartões de crédito para ter um controle total sobre seus limites e faturas em um só lugar.</p>
          </div>
          <button
            onClick={handleNewClick}
            className="h-14 px-8 bg-primary hover:bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center gap-3 scale-110"
          >
            <span className="material-symbols-outlined">add_card</span>
            Adicionar meu primeiro cartão
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-gradient-to-r from-[#1c2a38] to-[#1a2632]">
              <h2 className="text-white text-xl font-bold">{isEditing ? 'Editar Cartão' : 'Novo Cartão'}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="size-8 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white transition-all flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Nome do Cartão</label>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="Ex: Nexo Black, Nubank, Inter"
                  className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-[#4a6b8a]"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Bandeira</label>
                  <select
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Elo">Elo</option>
                    <option value="American Express">Amex</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Últimos 4 Dígitos</label>
                  <input
                    required
                    maxLength={4}
                    type="text"
                    placeholder="1234"
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-[#4a6b8a] font-mono"
                    value={formData.last_digits}
                    onChange={(e) => setFormData({ ...formData, last_digits: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Limite de Crédito</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">R$</span>
                  <input
                    required
                    type="text"
                    placeholder="0,00"
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 pl-12 pr-4 text-white text-lg font-bold focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-[#4a6b8a]"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Dia Fechamento</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="31"
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={formData.closing_day}
                    onChange={(e) => setFormData({ ...formData, closing_day: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Dia Vencimento</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="31"
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={formData.due_day}
                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Cor do Cartão</label>
                <input
                  type="color"
                  className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl px-1 py-1 cursor-pointer"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
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
                  className="flex-1 h-14 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Salvar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cards;
