import React, { useState, useEffect, useMemo } from 'react';
import { useProposals, ServiceProposal } from '../hooks/useProposals';

interface ServiceProposalsViewProps {
    companyName: string;
}

const ServiceProposalsView: React.FC<ServiceProposalsViewProps> = ({ companyName }) => {
    const { fetchProposals, saveProposal, deleteProposal, updateStatus, loading } = useProposals();
    const [proposals, setProposals] = useState<ServiceProposal[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProposal, setSelectedProposal] = useState<Partial<ServiceProposal> | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const loadProposals = async () => {
        const { data } = await fetchProposals();
        if (data) setProposals(data);
    };

    useEffect(() => {
        loadProposals();
    }, []);

    const metrics = useMemo(() => {
        const total = proposals.length;
        const approvedValue = proposals.filter(p => p.status === 'approved').reduce((acc, p) => acc + (p.total_amount || 0), 0);
        const pendingValue = proposals.filter(p => p.status === 'draft' || p.status === 'sent').reduce((acc, p) => acc + (p.total_amount || 0), 0);
        const statusCounts = {
            draft: proposals.filter(p => p.status === 'draft').length,
            sent: proposals.filter(p => p.status === 'sent').length,
            approved: proposals.filter(p => p.status === 'approved').length,
            rejected: proposals.filter(p => p.status === 'rejected').length,
            cancelled: proposals.filter(p => p.status === 'cancelled').length,
        };
        return { total, approvedValue, pendingValue, statusCounts };
    }, [proposals]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProposal) return;
        if (!selectedProposal.id && !selectedFile) {
            alert('Por favor, selecione um arquivo PDF da proposta.');
            return;
        }

        const { error } = await saveProposal(selectedProposal, selectedFile || undefined);
        if (!error) {
            setIsModalOpen(false);
            setSelectedProposal(null);
            setSelectedFile(null);
            loadProposals();
        } else {
            alert('Erro ao salvar: ' + error);
        }
    };

    const handleDelete = async (p: ServiceProposal) => {
        if (window.confirm('Tem certeza que deseja excluir esta proposta e seu arquivo anexo?')) {
            const { success } = await deleteProposal(p.id, p.file_url);
            if (success) loadProposals();
        }
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
        <div className="space-y-8 animate-in fade-in duration-500 tracking-tight">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-4xl">inventory</span>
                        Gestão de Propostas
                    </h1>
                    <p className="text-[#92adc9] text-sm mt-1">Repositório de propostas em PDF com acompanhamento de status.</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedProposal({
                            customer_name: '',
                            date: new Date().toISOString().split('T')[0],
                            status: 'draft',
                            total_amount: 0
                        });
                        setSelectedFile(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all uppercase"
                >
                    <span className="material-symbols-outlined font-bold">upload_file</span>
                    Subir Proposta (PDF)
                </button>
            </header>

            {/* Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#1c2a38]/50 border border-[#324d67]/30 p-6 rounded-2xl flex flex-col gap-1">
                    <span className="text-[#526a81] text-[10px] font-black uppercase tracking-widest">Total de Propostas</span>
                    <span className="text-2xl font-black text-white">{metrics.total}</span>
                    <div className="h-1 w-full bg-[#111a22] rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: '100%' }}></div>
                    </div>
                </div>
                <div className="bg-[#1c2a38]/50 border border-emerald-500/20 p-6 rounded-2xl flex flex-col gap-1">
                    <span className="text-emerald-500/60 text-[10px] font-black uppercase tracking-widest">Valor Aprovado</span>
                    <span className="text-2xl font-black text-emerald-400">{formatCurrency(metrics.approvedValue)}</span>
                    <div className="h-1 w-full bg-[#111a22] rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: metrics.total > 0 ? `${(metrics.statusCounts.approved / metrics.total) * 100}%` : '0%' }}></div>
                    </div>
                </div>
                <div className="bg-[#1c2a38]/50 border border-amber-500/20 p-6 rounded-2xl flex flex-col gap-1">
                    <span className="text-amber-500/60 text-[10px] font-black uppercase tracking-widest">Valor Pendente</span>
                    <span className="text-2xl font-black text-amber-400">{formatCurrency(metrics.pendingValue)}</span>
                    <div className="h-1 w-full bg-[#111a22] rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: metrics.total > 0 ? `${((metrics.statusCounts.draft + metrics.statusCounts.sent) / metrics.total) * 100}%` : '0%' }}></div>
                    </div>
                </div>
                <div className="bg-[#1c2a38]/50 border border-blue-500/20 p-6 rounded-2xl flex flex-col gap-1 text-center">
                    <div className="flex justify-between items-center h-full gap-2">
                        <div className="flex flex-col">
                            <span className="text-white font-black text-lg">{metrics.statusCounts.approved}</span>
                            <span className="text-emerald-500 text-[8px] font-black uppercase">Aprovadas</span>
                        </div>
                        <div className="w-[1px] h-8 bg-[#324d67]/30"></div>
                        <div className="flex flex-col">
                            <span className="text-white font-black text-lg">{metrics.statusCounts.sent + metrics.statusCounts.draft}</span>
                            <span className="text-amber-500 text-[8px] font-black uppercase">Pendentes</span>
                        </div>
                        <div className="w-[1px] h-8 bg-[#324d67]/30"></div>
                        <div className="flex flex-col">
                            <span className="text-white font-black text-lg">{metrics.statusCounts.rejected}</span>
                            <span className="text-red-500 text-[8px] font-black uppercase">Recusadas</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="bg-[#111a22] rounded-3xl border border-[#324d67]/50 shadow-2xl overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1c2a38]/50">
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Data</th>
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Cliente</th>
                                    <th className="p-5 text-[#526a81] text-[10px] font-black uppercase tracking-widest border-b border-[#324d67]/30">Valor Bruto</th>
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
                                                <span className="material-symbols-outlined text-6xl">cloud_upload</span>
                                                <p className="font-black text-sm uppercase tracking-widest">Suba seus PDFs de proposta para começar</p>
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
                                            <td className="p-5 text-white text-sm font-bold truncate max-w-[200px] uppercase">
                                                {p.customer_name}
                                            </td>
                                            <td className="p-5 text-primary text-sm font-black">
                                                {formatCurrency(p.total_amount)}
                                            </td>
                                            <td className="p-5">
                                                <select
                                                    value={p.status}
                                                    onChange={(e) => updateStatus(p.id, e.target.value as any).then(() => loadProposals())}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(p.status)} bg-transparent outline-none focus:ring-1 focus:ring-primary h-8`}
                                                >
                                                    <option value="draft" className="bg-[#111a22]">RASCUNHO</option>
                                                    <option value="sent" className="bg-[#111a22]">ENVIADA</option>
                                                    <option value="approved" className="bg-[#111a22]">APROVADA</option>
                                                    <option value="rejected" className="bg-[#111a22]">RECUSADA</option>
                                                    <option value="cancelled" className="bg-[#111a22]">CANCELADA</option>
                                                </select>
                                            </td>
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {p.file_url && (
                                                        <a 
                                                            href={p.file_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="size-9 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center border border-blue-500/20"
                                                            title="Ver PDF"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                                                        </a>
                                                    )}
                                                    <button 
                                                        onClick={() => { setSelectedProposal(p); setSelectedFile(null); setIsModalOpen(true); }}
                                                        className="size-9 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center border border-orange-500/20"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(p)}
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="w-full max-w-2xl bg-[#1a2632] border border-[#324d67] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-[#324d67]/50 flex justify-between items-center bg-[#1c2a38]">
                            <h2 className="text-white text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">upload_file</span>
                                {selectedProposal?.id ? 'Editar Dados da Proposta' : 'Subir Nova Proposta'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="size-10 rounded-full bg-[#111a22] text-[#92adc9] hover:text-white transition-all flex items-center justify-center border border-[#324d67]/30">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Data da Proposta</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold"
                                        value={selectedProposal?.date || ''}
                                        onChange={(e) => setSelectedProposal({ ...selectedProposal, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Valor Total (R$)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        placeholder="0,00"
                                        className="w-full h-12 bg-[#111a22] border border-[#324d67] rounded-xl px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold"
                                        value={selectedProposal?.total_amount || ''}
                                        onChange={(e) => setSelectedProposal({ ...selectedProposal, total_amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Arquivo PDF da Proposta</label>
                                <div className={`relative h-24 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${selectedFile ? 'border-primary bg-primary/5' : 'border-[#324d67] hover:border-[#526a81]'}`}>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    {selectedFile ? (
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-primary text-3xl">picture_as_pdf</span>
                                            <div className="flex flex-col">
                                                <span className="text-white text-xs font-bold truncate max-w-[300px]">{selectedFile.name}</span>
                                                <span className="text-primary text-[10px] font-black uppercase tracking-widest">Arquivo Selecionado</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 opacity-40">
                                            <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Clique ou arraste o PDF aqui</span>
                                        </div>
                                    )}
                                </div>
                                {selectedProposal?.file_url && !selectedFile && (
                                    <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                        Já possui PDF vinculado. Selecione outro se desejar alterar.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest">Observações Rápidas (opcional)</label>
                                <textarea
                                    rows={2}
                                    placeholder="BREVE NOTA SOBRE A PROPOSTA..."
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold uppercase resize-none"
                                    value={selectedProposal?.notes || ''}
                                    onChange={(e) => setSelectedProposal({ ...selectedProposal, notes: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="flex-1 h-12 rounded-xl text-[#92adc9] font-black text-xs hover:bg-[#233648] transition-all uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    className="flex-1 h-12 bg-primary hover:bg-blue-600 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                                >
                                    {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                                        <>
                                            <span className="material-symbols-outlined text-[20px]">save</span>
                                            Salvar Dados
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

export default ServiceProposalsView;

