
import React, { useState } from 'react';
import { useCategories } from '../hooks/useCategories';

const Categories: React.FC = () => {
  const { categories, loading, addCategory, updateCategory, deleteCategory } = useCategories();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', type: 'expense', icon: 'payments', color: '#3b82f6', parent_id: null as string | null });
  const [saving, setSaving] = useState(false);

  // Helper to build hierarchy
  const buildHierarchy = (cats: any[]) => {
    const map = new Map();
    const roots: any[] = [];

    // Initialize map
    cats.forEach(c => map.set(c.id, { ...c, children: [] }));

    // Build tree
    cats.forEach(c => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id).children.push(map.get(c.id));
      } else {
        roots.push(map.get(c.id));
      }
    });

    return roots;
  };

  const hierarchy = buildHierarchy(categories);

  const handleEditClick = (cat: any) => {
    setSelectedCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type || 'expense',
      icon: cat.icon || 'payments',
      color: cat.color || '#3b82f6',
      parent_id: cat.parent_id || null
    });
    setIsEditing(true);
  };

  const handleNewClick = () => {
    setSelectedCategory(null);
    setFormData({ name: '', type: activeTab, icon: 'payments', color: '#3b82f6', parent_id: null });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setSaving(true);
    let result;
    if (selectedCategory) {
      result = await updateCategory(selectedCategory.id, formData);
    } else {
      result = await addCategory(formData);
    }

    if (result.error) {
      alert('Erro ao salvar: ' + (result.error as any).message);
    } else {
      setIsEditing(false);
      setSelectedCategory(null);
      setFormData({ name: '', type: 'expense', icon: 'payments', color: '#3b82f6', parent_id: null });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta categoria?')) return;
    const { error } = await deleteCategory(id);
    if (error) alert('Erro ao excluir: ' + error.message);
  };

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  const filteredHierarchy = hierarchy.filter(cat => cat.type === activeTab);

  const handleAddSubClick = (parent: any) => {
    setFormData({
      name: '',
      type: parent.type,
      icon: parent.icon || 'payments',
      color: parent.color || '#3b82f6',
      parent_id: parent.id
    });
    setSelectedCategory(null);
    setIsEditing(true);
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Categorias</h1>
          <p className="text-[#92adc9] text-base">Gerencie suas categorias de receitas e despesas.</p>
        </div>
        <button
          onClick={handleNewClick}
          className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="material-symbols-outlined">add</span> Nova Categoria
        </button>
      </div>

      <div className="flex gap-4 p-1 bg-[#1c2a38]/50 border border-[#324d67]/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
        >
          <span className="material-symbols-outlined text-[20px]">payments</span>
          Despesas
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'income' ? 'bg-green-500 text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
        >
          <span className="material-symbols-outlined text-[20px]">monetization_on</span>
          Receitas
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {filteredHierarchy.length > 0 ? (
            filteredHierarchy.map((root) => (
              <div key={root.id} className="flex flex-col">
                {/* Parent */}
                <div className="bg-[#1c2a38]/80 backdrop-blur-xl border border-[#324d67]/50 rounded-2xl overflow-hidden hover:border-primary/50 transition-all group shadow-sm">
                  <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => handleEditClick(root)}>
                    <div className="flex items-center gap-5">
                      <div className="size-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: root.color }}>
                        <span className="material-symbols-outlined text-2xl">{root.icon || 'label'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white text-lg font-black">{root.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md bg-white/10" style={{ color: root.color }}>
                            {root.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                          <span className="text-[10px] text-[#92adc9] font-bold">
                            {root.children.length} {root.children.length === 1 ? 'Subcategoria' : 'Subcategorias'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddSubClick(root); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#233648] hover:bg-primary text-[#92adc9] hover:text-white rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all opacity-0 group-hover:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Subcategoria
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleEditClick(root); }} className="p-2 text-[#92adc9] hover:text-white hover:bg-[#233648] rounded-lg transition-all"><span className="material-symbols-outlined text-[22px]">edit</span></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(root.id); }} className="p-2 text-[#92adc9] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><span className="material-symbols-outlined text-[22px]">delete</span></button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Children */}
                {root.children.length > 0 && (
                  <div className="ml-10 mt-3 pl-6 border-l-2 border-[#233648]/50 space-y-2 mb-4">
                    {root.children.map((child: any) => (
                      <div key={child.id} className="bg-[#1c2a38]/40 border border-[#324d67]/30 rounded-xl overflow-hidden hover:border-primary/40 transition-all group-sub shadow-sm">
                        <div className="flex items-center justify-between p-3.5 cursor-pointer" onClick={() => handleEditClick(child)}>
                          <div className="flex items-center gap-4">
                            <div className="size-9 rounded-xl flex items-center justify-center text-white shadow-md opacity-90" style={{ backgroundColor: child.color }}>
                              <span className="material-symbols-outlined text-base">{child.icon || 'label'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white text-sm font-bold">{child.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleEditClick(child); }} className="p-1.5 text-[#92adc9] hover:text-white hover:bg-[#233648] rounded-lg transition-all"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(child.id); }} className="p-1.5 text-[#92adc9] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-20 text-center bg-[#1c2a38]/50 rounded-2xl border-2 border-dashed border-[#324d67]/50">
              <span className="material-symbols-outlined text-6xl text-[#324d67] mb-4">label_off</span>
              <p className="text-[#92adc9]">Nenhuma categoria de {activeTab === 'expense' ? 'despesa' : 'receita'} cadastrada.</p>
              <button
                onClick={handleNewClick}
                className="mt-4 px-6 py-2 bg-[#233648] hover:bg-primary text-white rounded-xl font-bold text-sm transition-all"
              >
                Criar Primeira Categoria
              </button>
            </div>
          )}

          {/* New Principal Category Quick Button */}
          {filteredHierarchy.length > 0 && (
            <button
              onClick={handleNewClick}
              className="w-full py-4 border-2 border-dashed border-[#324d67]/30 rounded-2xl hover:border-primary/50 hover:bg-primary/5 text-[#92adc9] hover:text-primary font-bold transition-all flex items-center justify-center gap-2 group"
            >
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform">add_circle</span>
              Nova Categoria {activeTab === 'expense' ? 'de Despesa' : 'de Receita'} Principal
            </button>
          )}
        </div>

        {/* Form Panel */}
        <div className={`transition-all ${isEditing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="bg-[#1c2a38] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#324d67]/50 flex items-center justify-between bg-gradient-to-r from-[#1c2a38] to-[#111a22]">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  {selectedCategory ? 'edit_square' : 'add_circle'}
                </span>
                {selectedCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-[#92adc9] hover:text-white">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 flex flex-col gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Nome</label>
                <input
                  required
                  className="w-full bg-[#111a22] border border-[#324d67] rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  type="text"
                  placeholder="Ex: Supermercado"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Tipo</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#111a22] rounded-xl border border-[#324d67]">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                    className={`py-2 text-[10px] font-bold rounded-lg transition-all ${formData.type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
                  >
                    DESPESA
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income' })}
                    className={`py-2 text-[10px] font-bold rounded-lg transition-all ${formData.type === 'income' ? 'bg-green-500 text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
                  >
                    RECEITA
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Categoria Pai (Opcional)</label>
                <select
                  className="w-full bg-[#111a22] border border-[#324d67] rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                  value={formData.parent_id || ''}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value === '' ? null : e.target.value })}
                >
                  <option value="">Nenhuma (Categoria Principal)</option>
                  {categories
                    .filter(c => c.id !== selectedCategory?.id && !c.parent_id && c.type === formData.type) // Prevent self-select and deep nesting for now
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Ícone</label>
                  <select
                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  >
                    <option value="payments">Pagamentos</option>
                    <option value="home">Moradia</option>
                    <option value="restaurant">Alimentação</option>
                    <option value="directions_car">Transporte</option>
                    <option value="shopping_bag">Compras</option>
                    <option value="health_and_safety">Saúde</option>
                    <option value="school">Educação</option>
                    <option value="sports_esports">Lazer</option>
                    <option value="receipt_long">Impostos/Taxas</option>
                    <option value="pets">Pets</option>
                    <option value="electrical_services">Serviços</option>
                    <option value="work">Trabalho</option>
                    <option value="savings">Reserva/Investimento</option>
                    <option value="monetization_on">Recebimento/Salário</option>
                    <option value="celebration">Presentes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest">Cor</label>
                  <input
                    className="w-full h-11 bg-[#111a22] border border-[#324d67] rounded-xl px-1 py-1 text-white text-sm outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-4 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Salvar Categoria'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 rounded-xl border border-[#324d67] text-[#92adc9] font-bold text-sm hover:text-white hover:bg-[#233648] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Categories;
