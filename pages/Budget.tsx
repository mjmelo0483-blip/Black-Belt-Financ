import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { useBudgets, ParentCategorySpending, CategorySpending } from '../hooks/useBudgets';
import { useCategories } from '../hooks/useCategories';

const Budget: React.FC = () => {
  const { spending, loading, setBudgetLimit } = useBudgets();
  const { categories } = useCategories();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ category_id: '', amount: '' });
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Get current view data (parent or children)
  const currentViewData = selectedCategory
    ? (spending.find(s => s.category_id === selectedCategory)?.children || [])
    : spending;

  const currentViewTitle = selectedCategory
    ? spending.find(s => s.category_id === selectedCategory)?.name || ''
    : '';

  const totalPlanned = spending.reduce((acc, s) => acc + s.planned, 0);
  const totalActual = spending.reduce((acc, s) => acc + s.actual, 0);
  const remaining = totalPlanned - totalActual;
  const percentUsed = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData.category_id || !modalData.amount) return;

    setSaving(true);
    const amount = parseFloat(modalData.amount.replace(',', '.'));
    const { error } = await setBudgetLimit(modalData.category_id, amount);

    if (error) {
      alert('Erro ao salvar meta: ' + (error as any).message);
    } else {
      setIsModalOpen(false);
      setModalData({ category_id: '', amount: '' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[400px]">
        <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const overBudgetCategories = spending.filter(s => s.actual > s.planned && s.planned > 0);
  const healthyCategories = spending.filter(s => s.actual < s.planned * 0.5 && s.planned > 0);

  // Get only parent categories for the modal
  const parentCategories = categories.filter(c => c.type === 'expense' && !c.parent_id);

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-white text-3xl font-black tracking-tight">Orçamento Mensal</h1>
          <p className="text-[#92adc9] mt-1">Planeje seus gastos e monitore o progresso em tempo real.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add_task</span>
            Definir Meta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Orçamento Total', val: formatCurrency(totalPlanned), icon: 'account_balance_wallet', detail: 'Planejado para o mês', color: 'text-primary' },
          { label: 'Total Gasto', val: formatCurrency(totalActual), icon: 'payments', detail: `${percentUsed}% do total planejado`, color: 'text-orange-500' },
          { label: 'Restante', val: formatCurrency(remaining), icon: 'savings', detail: remaining < 0 ? 'Meta excedida' : 'Disponível para gastar', color: remaining < 0 ? 'text-red-500' : 'text-emerald-500' }
        ].map((s, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl p-6 border border-[#324d67]/50 bg-[#1c2a38]/80 backdrop-blur-xl shadow-lg relative overflow-hidden group">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">{s.label}</p>
              <span className={`material-symbols-outlined ${s.color} text-[24px]`}>{s.icon}</span>
            </div>
            <p className="text-white text-3xl font-black mt-2 tracking-tight relative z-10">{s.val}</p>
            <p className="text-[#6384a3] text-xs font-medium mt-1 relative z-10">{s.detail}</p>
            <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all group-hover:h-full group-hover:opacity-5"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl border border-[#324d67]/50 p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-1 text-primary hover:text-blue-400 text-sm font-bold transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Voltar
                </button>
              )}
              <h3 className="text-white text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">bar_chart</span>
                {selectedCategory ? `Subcategorias de ${currentViewTitle}` : 'Realizado vs. Planejado por Categoria'}
              </h3>
            </div>
          </div>

          {currentViewData.length > 0 ? (
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentViewData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#324d67" horizontal={true} vertical={false} />
                  <XAxis dataKey="name" stroke="#92adc9" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#92adc9" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip
                    cursor={{ fill: '#111a22', opacity: 0.5 }}
                    contentStyle={{ backgroundColor: '#111a22', border: '1px solid #324d67', borderRadius: '12px', padding: '12px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'black', textTransform: 'uppercase', padding: '2px 0' }}
                    labelStyle={{ color: '#92adc9', fontSize: '11px', fontWeight: 'black', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '0', paddingBottom: '24px' }}
                    formatter={(value: string, entry: any) => (
                      <span style={{ color: entry.color }} className="text-[10px] font-black uppercase tracking-widest ml-2">
                        {value}
                      </span>
                    )}
                  />
                  <Bar dataKey="planned" name="Previsto" fill="#475569" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="actual" name="Realizado" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40}>
                    {currentViewData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#ef4444" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-[#92adc9]">
              <span className="material-symbols-outlined text-[48px] mb-4">category</span>
              <p>Nenhuma subcategoria com gastos neste período</p>
            </div>
          )}

          {/* Category Cards with drill-down */}
          {!selectedCategory && (
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
              {spending.map((cat) => {
                const percent = cat.planned > 0 ? Math.round((cat.actual / cat.planned) * 100) : 0;
                const isOver = cat.actual > cat.planned && cat.planned > 0;

                return (
                  <div
                    key={cat.category_id}
                    onClick={() => cat.children.length > 0 && setSelectedCategory(cat.category_id)}
                    className={`p-4 rounded-xl border transition-all ${cat.children.length > 0
                        ? 'cursor-pointer hover:bg-[#111a22] border-[#324d67]/50'
                        : 'border-[#324d67]/30'
                      } ${isOver ? 'bg-red-500/10 border-red-500/30' : 'bg-[#111a22]/50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: cat.color + '20', color: cat.color }}
                        >
                          <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                        </div>
                        <span className="text-white font-medium text-sm truncate">{cat.name}</span>
                      </div>
                      {cat.children.length > 0 && (
                        <span className="material-symbols-outlined text-[#92adc9] text-[16px]">chevron_right</span>
                      )}
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className={`text-lg font-bold ${isOver ? 'text-red-400' : 'text-white'}`}>
                          {formatCurrency(cat.actual)}
                        </p>
                        <p className="text-[#92adc9] text-xs">
                          de {formatCurrency(cat.planned)}
                        </p>
                      </div>
                      <span className={`text-xs font-bold ${isOver ? 'text-red-400' : percent > 80 ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {percent}%
                      </span>
                    </div>
                    {cat.children.length > 0 && (
                      <p className="text-[#6384a3] text-[10px] mt-2 uppercase tracking-wider">
                        {cat.children.length} subcategoria(s)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl border border-[#324d67]/50 p-6 shadow-xl flex flex-col gap-6">
            <h3 className="text-white text-lg font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400">lightbulb</span>
              Insights Reais
            </h3>

            {overBudgetCategories.length > 0 ? (
              overBudgetCategories.map(s => (
                <div key={s.category_id} className="flex gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <span className="material-symbols-outlined text-red-400">warning</span>
                  <div>
                    <p className="text-xs text-red-200 font-bold uppercase tracking-wider mb-1">Atenção: {s.name}</p>
                    <p className="text-sm text-red-200 leading-relaxed">
                      Você excedeu o planejado em <span className="font-bold text-white">{formatCurrency(s.actual - s.planned)}</span>.
                    </p>
                  </div>
                </div>
              ))
            ) : healthyCategories.length > 0 ? (
              <div className="flex gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                <div>
                  <p className="text-xs text-emerald-200 font-bold uppercase tracking-wider mb-1">Bom Trabalho!</p>
                  <p className="text-sm text-emerald-200 leading-relaxed">
                    Seu orçamento está sob controle. Você ainda tem <span className="font-bold text-white">{formatCurrency(remaining)}</span> disponíveis.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[#92adc9] text-sm text-center py-4">Defina suas metas para receber insights personalizados.</p>
            )}

            {healthyCategories.length > 0 && healthyCategories.slice(0, 2).map(s => (
              <div key={s.category_id} className="flex gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <span className="material-symbols-outlined text-primary">eco</span>
                <div>
                  <p className="text-xs text-blue-200 font-bold uppercase tracking-wider mb-1">Economia: {s.name}</p>
                  <p className="text-sm text-blue-200 leading-relaxed">
                    Você está apenas em <span className="font-bold text-white">{Math.round((s.actual / s.planned) * 100)}%</span> do limite. Ótima gestão!
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-primary to-[#094b8e] rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold text-lg mb-2">Dica Financeira</h4>
              <p className="text-white/80 text-sm leading-relaxed">
                Defina metas nas categorias principais. Os gastos das subcategorias são somados automaticamente.
              </p>
            </div>
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-[100px] opacity-10">trending_up</span>
          </div>
        </div>
      </div>

      {/* Modal para Definir Meta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-[#1c2a38]">
              <h2 className="text-white text-xl font-black">Definir Meta de Gasto</h2>
              <button onClick={() => setIsModalOpen(false)} className="size-8 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white transition-all flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveLimit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Categoria Principal</label>
                <select
                  required
                  className="w-full h-14 bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                  value={modalData.category_id}
                  onChange={(e) => setModalData({ ...modalData, category_id: e.target.value })}
                >
                  <option value="">Selecione uma categoria principal...</option>
                  {parentCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <p className="text-[#6384a3] text-xs">Os gastos das subcategorias serão somados automaticamente.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Limite Mensal</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">R$</span>
                  <input
                    required
                    type="text"
                    placeholder="0,00"
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 pl-12 pr-4 text-white text-lg font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={modalData.amount}
                    onChange={(e) => setModalData({ ...modalData, amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 rounded-xl text-[#92adc9] font-bold text-sm hover:bg-[#233648] transition-all">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 h-14 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                  {saving ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">save</span>
                      Salvar Meta
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

export default Budget;

