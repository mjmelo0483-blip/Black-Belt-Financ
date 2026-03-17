import React, { useState, useEffect } from 'react';
import { useProposals, ServiceProposal } from '../hooks/useProposals';

interface ServiceProposalsViewProps {
    companyName: string;
}

const ServiceProposalsView: React.FC<ServiceProposalsViewProps> = ({ companyName }) => {
    const { fetchProposals, saveProposal, deleteProposal, updateStatus, loading } = useProposals();
    const [proposals, setProposals] = useState<ServiceProposal[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState<Partial<ServiceProposal> | null>(null);
    const [viewingProposal, setViewingProposal] = useState<ServiceProposal | null>(null);

    const loadProposals = async () => {
        const { data } = await fetchProposals();
        if (data) setProposals(data);
    };

    useEffect(() => {
        loadProposals();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProposal) return;

        const { error } = await saveProposal(selectedProposal);
        if (!error) {
            setIsModalOpen(false);
            setSelectedProposal(null);
            loadProposals();
        } else {
            alert(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta proposta?')) {
            const { success } = await deleteProposal(id);
            if (success) loadProposals();
        }
    };

    const addItem = () => {
        const items = [...(selectedProposal?.items || []), { description: '', quantity: 1, unit_price: 0 }];
        setSelectedProposal({ ...selectedProposal, items });
    };

    const updateItem = (index: number, field: string, value: any) => {
        const items = [...(selectedProposal?.items || [])];
        items[index] = { ...items[index], [field]: value };
        
        const total = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
        setSelectedProposal({ ...selectedProposal, items, total_amount: total });
    };

    const removeItem = (index: number) => {
        const items = [...(selectedProposal?.items || [])].filter((_, i) => i !== index);
        const total = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
        setSelectedProposal({ ...selectedProposal, items, total_amount: total });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'sent': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'cancelled': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 uppercase tracking-tight">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">description</span>
                        Propostas de Serviço
                    </h1>
                    <p className="text-[#92adc9] text-sm mt-1">Gere propostas personalizadas para seus clientes de forma profissional.</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedProposal({
                            customer_name: '',
                            date: new Date().toISOString().split('T')[0],
                            status: 'draft',
                            items: [{ description: '', quantity: 1, unit_price: 0 }],
                            total_amount: 0
                        });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined font-bold">add</span>
                    Nova Proposta
                </button>
            </header>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-[#111a22] rounded-3xl border border-[#324d67]/50 shadow-2xl overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1c2a38]/50">
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Data</th>
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Cliente</th>
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Valor Total</th>
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Status</th>
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#324d67]/20">
                                {loading && proposals.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center">
                                            <div className="size-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
                                        </td>
                                    </tr>
                                ) : proposals.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <span className="material-symbols-outlined text-6xl">drafts</span>
                                                <p className="font-black text-sm uppercase tracking-widest">Nenhuma proposta encontrada</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    proposals.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="p-5">
                                                <span className="text-white text-sm font-bold">
                                                    {new Date(p.date).toLocaleDateString('pt-BR')}
                                                </span>
                                            </td>
                                            <td className="p-5 text-white text-sm font-bold truncate max-w-[200px]">
                                                {p.customer_name}
                                            </td>
                                            <td className="p-5 text-primary text-sm font-black">
                                                {formatCurrency(p.total_amount)}
                                            </td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(p.status)}`}>
                                                    {p.status === 'draft' ? 'Rascunho' : 
                                                     p.status === 'sent' ? 'Enviada' : 
                                                     p.status === 'approved' ? 'Aprovada' : 
                                                     p.status === 'rejected' ? 'Recusada' : 'Cancelada'}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => setViewingProposal(p)}
                                                        className="size-9 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center border border-blue-500/20"
                                                        title="Visualizar/Imprimir"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => { setSelectedProposal(p); setIsModalOpen(true); }}
                                                        className="size-9 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center border border-orange-500/20"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(p.id)}
                                                        className="size-9 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-500/20"
                                                        title="Excluir"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de Edição/Criação */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-4xl bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-[#1c2a38]">
                            <h2 className="text-white text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">add_notes</span>
                                {selectedProposal?.id ? 'Editar Proposta' : 'Nova Proposta'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="size-10 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white transition-all flex items-center justify-center border border-[#324d67]/30">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Nome do Cliente</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="EX: JOÃO DA SILVA"
                                        className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold uppercase"
                                        value={selectedProposal?.customer_name || ''}
                                        onChange={(e) => setSelectedProposal({ ...selectedProposal, customer_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Data</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold"
                                        value={selectedProposal?.date || ''}
                                        onChange={(e) => setSelectedProposal({ ...selectedProposal, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Status</label>
                                    <select
                                        className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold uppercase"
                                        value={selectedProposal?.status || 'draft'}
                                        onChange={(e) => setSelectedProposal({ ...selectedProposal, status: e.target.value as any })}
                                    >
                                        <option value="draft">RASCUNHO</option>
                                        <option value="sent">ENVIADA</option>
                                        <option value="approved">APROVADA</option>
                                        <option value="rejected">RECUSADA</option>
                                        <option value="cancelled">CANCELADA</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-[#324d67]/30 pb-2">
                                    <h3 className="text-white text-xs font-black uppercase tracking-widest">Itens do Serviço</h3>
                                    <button 
                                        type="button" 
                                        onClick={addItem}
                                        className="text-xs font-black text-primary hover:text-blue-400 uppercase tracking-widest flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                        Adicionar Item
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {(selectedProposal?.items || []).map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 items-end group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                            <div className="col-span-12 md:col-span-6 space-y-1">
                                                <label className="text-[#526a81] text-[9px] font-black uppercase tracking-widest">Descrição do Serviço</label>
                                                <input
                                                    required
                                                    type="text"
                                                    placeholder="EX: MONTAGEM DE ESTRUTURA METÁLICA"
                                                    className="w-full h-10 bg-[#111a22] border border-[#324d67] rounded-lg px-3 text-white outline-none focus:border-primary transition-all text-xs font-bold uppercase"
                                                    value={item.description}
                                                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-4 md:col-span-2 space-y-1">
                                                <label className="text-[#526a81] text-[9px] font-black uppercase tracking-widest">Qtd</label>
                                                <input
                                                    required
                                                    type="number"
                                                    className="w-full h-10 bg-[#111a22] border border-[#324d67] rounded-lg px-3 text-white outline-none focus:border-primary transition-all text-xs font-bold"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="col-span-6 md:col-span-3 space-y-1">
                                                <label className="text-[#526a81] text-[9px] font-black uppercase tracking-widest">Preço Unitário</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-[10px]">R$</span>
                                                    <input
                                                        required
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full h-10 bg-[#111a22] border border-[#324d67] rounded-lg pl-8 pr-3 text-white outline-none focus:border-primary transition-all text-xs font-bold"
                                                        value={item.unit_price}
                                                        onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-2 md:col-span-1 pb-1">
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeItem(idx)}
                                                    className="size-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6 border-t border-[#324d67]/30">
                                <div className="space-y-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Observações (opcional)</label>
                                    <textarea
                                        rows={4}
                                        placeholder="CONDIÇÕES DE PAGAMENTO, PRAZOS, ETC..."
                                        className="w-full bg-[#111a22] border border-[#324d67] rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold uppercase resize-none"
                                        value={selectedProposal?.notes || ''}
                                        onChange={(e) => setSelectedProposal({ ...selectedProposal, notes: e.target.value })}
                                    />
                                </div>
                                <div className="p-6 rounded-2xl bg-[#111a22] border border-primary/20 space-y-4">
                                    <div className="flex justify-between items-center text-[#92adc9]">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
                                        <span className="text-sm font-bold">{formatCurrency(selectedProposal?.total_amount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-white border-t border-[#324d67]/30 pt-4">
                                        <span className="text-xs font-black uppercase tracking-widest">Total da Proposta</span>
                                        <span className="text-2xl font-black text-primary">{formatCurrency(selectedProposal?.total_amount || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="flex-1 h-14 rounded-2xl text-[#92adc9] font-black text-xs hover:bg-[#233648] transition-all uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    className="flex-1 h-14 bg-primary hover:bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                                >
                                    {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                                        <>
                                            <span className="material-symbols-outlined text-[20px]">save</span>
                                            Salvar Proposta
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Visualização (PDF Like) */}
            {viewingProposal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl overflow-y-auto">
                    <div className="w-full max-w-3xl bg-white text-slate-900 rounded-lg shadow-2xl p-0 animate-in zoom-in-95 duration-500 flex flex-col my-auto h-[90vh]">
                        {/* Fake Browser Toolbar */}
                        <div className="bg-slate-100 p-4 flex justify-between items-center border-b border-slate-200 sticky top-0 z-10">
                            <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Visualização da Proposta</h3>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => window.print()}
                                    className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[16px]">print</span>
                                    Imprimir
                                </button>
                                <button onClick={() => setViewingProposal(null)} className="size-9 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-all flex items-center justify-center">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Proposal Body */}
                        <div className="flex-1 p-12 overflow-y-auto print:p-0 bg-white" id="printable-proposal">
                            <div className="flex justify-between items-start mb-16">
                                <div>
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 uppercase">{companyName}</h2>
                                    <p className="text-slate-500 text-sm font-bold opacity-70 uppercase">Proposta de Prestação de Serviços</p>
                                </div>
                                <div className="text-right">
                                    <div className="bg-slate-900 text-white px-4 py-2 rounded-md mb-4 inline-block text-xs font-black uppercase tracking-widest">
                                        PROPOSTA #{viewingProposal.id.substring(0, 8).toUpperCase()}
                                    </div>
                                    <p className="text-slate-500 text-xs font-bold uppercase">Data: {new Date(viewingProposal.date).toLocaleDateString('pt-BR')}</p>
                                    <p className="text-slate-500 text-xs font-bold uppercase mt-1">Status: {viewingProposal.status}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12 mb-16">
                                <div>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Emitente</p>
                                    <p className="text-slate-900 font-black text-lg uppercase">{companyName}</p>
                                    <p className="text-slate-500 text-sm mt-1 uppercase">RESPONSÁVEL PELA EXECUÇÃO</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Cliente</p>
                                    <p className="text-slate-900 font-black text-lg uppercase">{viewingProposal.customer_name}</p>
                                    <p className="text-slate-500 text-sm mt-1 uppercase">INTERESSADO NOS SERVIÇOS</p>
                                </div>
                            </div>

                            <table className="w-full border-collapse mb-16">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="p-4 text-left text-slate-400 text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-200">Descrição do Serviço</th>
                                        <th className="p-4 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-200">Qtd</th>
                                        <th className="p-4 text-right text-slate-400 text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-200">Unitário</th>
                                        <th className="p-4 text-right text-slate-900 text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-900">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewingProposal.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-4 py-6 text-slate-800 font-bold text-sm uppercase">{item.description}</td>
                                            <td className="p-4 text-center text-slate-500 font-bold text-sm">{item.quantity}</td>
                                            <td className="p-4 text-right text-slate-500 font-bold text-sm">{formatCurrency(item.unit_price)}</td>
                                            <td className="p-4 text-right text-slate-900 font-black text-sm">{formatCurrency(item.quantity * item.unit_price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={2}></td>
                                        <td className="p-6 text-right text-slate-400 text-xs font-black uppercase tracking-widest">Total Geral:</td>
                                        <td className="p-6 text-right text-slate-900 text-2xl font-black">{formatCurrency(viewingProposal.total_amount)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {viewingProposal.notes && (
                                <div className="bg-slate-50 p-8 rounded-xl border-l-4 border-slate-900 mb-16">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Informações Adicionais / Observações</p>
                                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap uppercase font-bold">{viewingProposal.notes}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-12 mt-32">
                                <div className="text-center">
                                    <div className="border-t border-slate-300 pt-3">
                                        <p className="text-slate-900 font-black text-sm uppercase">{companyName}</p>
                                        <p className="text-slate-400 text-[10px] font-black uppercase mt-1">CONTRATADA</p>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="border-t border-slate-300 pt-3">
                                        <p className="text-slate-900 font-black text-sm uppercase">{viewingProposal.customer_name}</p>
                                        <p className="text-slate-400 text-[10px] font-black uppercase mt-1">CONTRATANTE</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-proposal, #printable-proposal * { visibility: visible; }
                    #printable-proposal { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%;
                        padding: 0 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ServiceProposalsView;
