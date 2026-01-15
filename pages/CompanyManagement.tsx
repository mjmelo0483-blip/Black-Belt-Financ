import React, { useState } from 'react';
import { useCompany, Company } from '../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';

const CompanyManagement: React.FC = () => {
    const { companies, activeCompany, setActiveCompany, createCompany, addMember, removeMember, members } = useCompany();
    const [newCompanyName, setNewCompanyName] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSelectCompany = (company: Company) => {
        setActiveCompany(company);
        navigate('/dashboard');
    };

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCompanyName.trim()) return;
        setLoading(true);
        try {
            const company = await createCompany(newCompanyName, cnpj);
            if (company) {
                handleSelectCompany(company);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Gestão de Empresas</h1>
                <p className="text-[#92adc9] text-sm">Gerencie suas organizações e convide sua equipe.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Selection Section */}
                <div className="bg-[#1a2632]/50 backdrop-blur-xl border border-[#324d67]/30 rounded-3xl p-8 space-y-6">
                    <h2 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">corporate_fare</span>
                        Suas Empresas
                    </h2>

                    <div className="space-y-3">
                        {companies.length > 0 ? (
                            companies.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleSelectCompany(c)}
                                    className={`w-full p-4 border rounded-2xl text-left transition-all flex items-center justify-between group ${activeCompany?.id === c.id ? 'bg-[#2d445a] border-primary shadow-lg shadow-primary/10' : 'bg-[#111a22] border-[#324d67] hover:bg-[#1c2a38]'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-10 rounded-xl flex items-center justify-center text-sm font-black ${activeCompany?.id === c.id ? 'bg-primary text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'}`}>
                                            {c.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm">{c.name}</p>
                                            {c.cnpj && <p className="text-[10px] text-[#92adc9]">{c.cnpj}</p>}
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">arrow_forward</span>
                                </button>
                            ))
                        ) : (
                            <div className="text-center py-8 bg-[#111a22]/50 rounded-2xl border border-dashed border-[#324d67]">
                                <span className="material-symbols-outlined text-[#324d67] text-[40px] mb-2">business_messages</span>
                                <p className="text-[#92adc9] text-xs">Nenhuma empresa encontrada.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Creation Section */}
                <div className="bg-[#1a2632]/50 backdrop-blur-xl border border-[#324d67]/30 rounded-3xl p-8 space-y-6">
                    <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        Nova Empresa
                    </h2>

                    <form onSubmit={handleCreateCompany} className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest ml-1">Nome da Organização</label>
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-2xl py-4 px-5 text-white placeholder-[#4a6b8a] font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                    placeholder="Ex: Minha Empresa LTDA"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[#92adc9] uppercase tracking-widest ml-1">CNPJ (Opcional)</label>
                                <input
                                    type="text"
                                    value={cnpj}
                                    onChange={(e) => setCnpj(e.target.value)}
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-2xl py-4 px-5 text-white placeholder-[#4a6b8a] font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                    placeholder="00.000.000/0000-00"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !newCompanyName.trim()}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {loading ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Criar Empresa'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Member Management */}
            {activeCompany && (
                <div className="bg-[#1a2632]/50 backdrop-blur-xl border border-[#324d67]/30 rounded-3xl p-8 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Equipe: {activeCompany.name}</h2>
                        <p className="text-[#92adc9] text-xs font-medium">Gerencie quem tem acesso aos dados desta empresa.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Invite Form */}
                        <div className="lg:col-span-1 border-r border-[#324d67]/30 pr-10">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Adicionar Colaborador</h3>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const emailInput = (e.currentTarget.elements.namedItem('email') as HTMLInputElement);
                                if (emailInput.value) {
                                    setLoading(true);
                                    try {
                                        await addMember(emailInput.value);
                                        emailInput.value = '';
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[#4a6b8a] uppercase ml-1">E-mail do Usuário</label>
                                    <input
                                        name="email"
                                        type="email"
                                        placeholder="colaborador@nexo.com"
                                        className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-primary transition-all"
                                        required
                                    />
                                </div>
                                <button
                                    disabled={loading}
                                    className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30 font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    Enviar Convite
                                </button>
                            </form>
                        </div>

                        {/* Members List */}
                        <div className="lg:col-span-2">
                            <div className="bg-[#111a22] rounded-2xl border border-[#324d67] overflow-hidden shadow-2xl">
                                {members.length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-[#324d67] text-[10px] font-black text-[#92adc9] uppercase tracking-widest bg-[#1a2b3a]/50">
                                                <th className="px-6 py-4 text-left font-black">Membro</th>
                                                <th className="px-6 py-4 text-left font-black">Papel</th>
                                                <th className="px-6 py-4 text-right font-black">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {members.map(m => (
                                                <tr key={m.id} className="border-b border-[#324d67]/30 last:border-0 hover:bg-[#1a2632]/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-8 rounded-lg bg-[#233648] flex items-center justify-center text-xs text-white">
                                                                <span className="material-symbols-outlined text-sm">person</span>
                                                            </div>
                                                            <span className="text-white font-medium">{m.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${m.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                            {m.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {m.user_id !== activeCompany.owner_id ? (
                                                            <button
                                                                onClick={() => removeMember(m.id)}
                                                                className="size-8 rounded-lg items-center justify-center hover:bg-red-500/10 text-[#4a6b8a] hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-[#4a6b8a] uppercase font-black pr-2">Dono</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-12 text-center text-[#92adc9] space-y-4">
                                        <div className="size-16 rounded-3xl bg-[#233648] mx-auto flex items-center justify-center">
                                            <span className="material-symbols-outlined text-4xl opacity-20">group</span>
                                        </div>
                                        <p className="text-sm font-medium">Buscando equipe...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyManagement;
