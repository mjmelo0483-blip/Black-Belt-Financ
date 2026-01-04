import React, { useState } from 'react';
import { useInvestments, Investment } from '../hooks/useInvestments';

const Investments: React.FC = () => {
    const { investments, loading, addInvestment, updateInvestment, deleteInvestment } = useInvestments();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'renda_fixa' as Investment['type'],
        value: '',
        quantity: '1'
    });
    const [saving, setSaving] = useState(false);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const getTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            renda_fixa: 'Renda Fixa',
            acoes: 'Ações',
            fiis: 'FIIs',
            cripto: 'Criptos',
            outros: 'Outros'
        };
        return types[type] || type;
    };

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            renda_fixa: 'from-blue-500 to-blue-700',
            acoes: 'from-emerald-500 to-emerald-700',
            fiis: 'from-purple-500 to-purple-700',
            cripto: 'from-orange-500 to-orange-700',
            outros: 'from-gray-500 to-gray-700'
        };
        return colors[type] || 'from-gray-500 to-gray-700';
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            name: formData.name,
            type: formData.type,
            value: parseFloat(formData.value.replace(',', '.')),
            quantity: parseFloat(formData.quantity.replace(',', '.'))
        };

        let result;
        if (isEditing && selectedInvestment) {
            result = await updateInvestment(selectedInvestment.id, payload);
        } else {
            result = await addInvestment(payload);
        }

        if (result.error) {
            alert('Erro ao salvar: ' + (result.error as any).message);
        } else {
            setIsModalOpen(false);
            setFormData({ name: '', type: 'renda_fixa', value: '', quantity: '1' });
        }
        setSaving(false);
    };

    const handleEdit = (inv: Investment) => {
        setSelectedInvestment(inv);
        setFormData({
            name: inv.name,
            type: inv.type,
            value: inv.value.toString().replace('.', ','),
            quantity: inv.quantity.toString().replace('.', ',')
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Deseja realmente excluir este investimento?')) {
            await deleteInvestment(id);
        }
    };

    const totalsByType = investments.reduce((acc, inv) => {
        acc[inv.type] = (acc[inv.type] || 0) + (inv.value * inv.quantity);
        return acc;
    }, {} as Record<string, number>);

    const totalPortfolio = investments.reduce((acc, inv) => acc + (inv.value * inv.quantity), 0);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center min-h-[400px]">
                <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 lg:p-10 flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-white text-3xl font-black leading-tight tracking-tight">Investimentos</h1>
                    <p className="text-[#92adc9] mt-1">Acompanhe e gerencie sua carteira de ativos.</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setFormData({ name: '', type: 'renda_fixa', value: '', quantity: '1' });
                        setIsModalOpen(true);
                    }}
                    className="px-6 h-12 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Novo Ativo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {['renda_fixa', 'acoes', 'fiis', 'cripto', 'outros'].map((type) => (
                    <div key={type} className={`p-6 rounded-2xl bg-[#1c2a38]/80 backdrop-blur-xl border border-[#324d67]/50 relative overflow-hidden group`}>
                        <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getTypeColor(type)}`}></div>
                        <p className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest mb-1">{getTypeLabel(type)}</p>
                        <p className="text-white text-2xl font-black tracking-tight">{formatCurrency(totalsByType[type] || 0)}</p>
                        <div className="mt-4 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#6384a3] uppercase tracking-wider">
                                {investments.filter(i => i.type === type).length} Ativos
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-[#1c2a38]/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-[#324d67]/50">
                <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-[#111a22]/30">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">list_alt</span>
                        Seus Ativos
                    </h2>
                    <div className="text-right">
                        <p className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Patrimônio Total</p>
                        <p className="text-white font-black text-xl">{formatCurrency(totalPortfolio)}</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#111a22]/50 border-b border-[#324d67]/50">
                                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Nome do Ativo</th>
                                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Qtd.</th>
                                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Preço/Val.</th>
                                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right">Total</th>
                                <th className="px-6 py-4 text-[#92adc9] text-[10px] font-black uppercase tracking-widest text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#324d67]/30">
                            {investments.length > 0 ? (
                                investments.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-[#111a22]/30 transition-colors group">
                                        <td className="px-6 py-4 px-6 py-4">
                                            <p className="text-white font-bold text-sm">{inv.name}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 bg-gradient-to-r text-white ${getTypeColor(inv.type)}`}>
                                                {getTypeLabel(inv.type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-[#92adc9] text-sm font-medium">{inv.quantity}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-white text-sm font-bold">{formatCurrency(inv.value)}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <p className="text-white font-black text-sm">{formatCurrency(inv.value * inv.quantity)}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(inv)} className="size-8 rounded-lg text-[#92adc9] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(inv.id)} className="size-8 rounded-lg text-[#92adc9] hover:text-red-400 hover:bg-red-400/10 transition-all flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-[48px] text-[#324d67]">monitoring</span>
                                            <p className="text-[#92adc9] text-sm font-medium">Nenhum ativo cadastrado.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-[#1c2a38]">
                            <h2 className="text-white text-xl font-black">{isEditing ? 'Editar Ativo' : 'Novo Ativo'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="size-8 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white transition-all flex items-center justify-center">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Nome do Ativo</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: PETR4, Bitcoin, Tesouro Direto"
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-[#4a6b8a]"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Tipo</label>
                                    <select
                                        className="w-full h-[58px] bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                    >
                                        <option value="renda_fixa">Renda Fixa</option>
                                        <option value="acoes">Ações</option>
                                        <option value="fiis">FIIs</option>
                                        <option value="cripto">Cripto</option>
                                        <option value="outros">Outros Investimentos</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Quantidade</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Preço/Valor Unitário</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">R$</span>
                                    <input
                                        required
                                        type="text"
                                        placeholder="0,00"
                                        className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-4 pl-12 pr-4 text-white text-lg font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 rounded-xl text-[#92adc9] font-bold text-sm hover:bg-[#233648] transition-all">Cancelar</button>
                                <button type="submit" disabled={saving} className="flex-1 h-14 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                    {saving ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                                        <>
                                            <span className="material-symbols-outlined text-[20px]">save</span>
                                            Salvar Ativo
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

export default Investments;
