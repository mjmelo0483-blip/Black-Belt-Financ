import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useCompany, Company } from '../contexts/CompanyContext';
import { useView } from '../contexts/ViewContext';

const AuthPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isBusinessLogin, setIsBusinessLogin] = useState(true);
    const [showCompanySelection, setShowCompanySelection] = useState(false);
    const [showCompanyManager, setShowCompanyManager] = useState(false); // To force manager if needed
    const [error, setError] = useState<string | null>(null);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyCNPJ, setNewCompanyCNPJ] = useState('');

    const navigate = useNavigate();
    const { companies, setActiveCompany, createCompany, refreshCompanies } = useCompany();
    const { setIsBusiness } = useView();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Verifique seu e-mail para confirmar o cadastro!');
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                if (isBusinessLogin) {
                    await refreshCompanies();
                    setShowCompanySelection(true);
                    setIsBusiness(true);
                } else {
                    setIsBusiness(false);
                    navigate('/dashboard');
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectCompany = (company: Company) => {
        setActiveCompany(company);
        navigate('/dashboard');
    };

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCompanyName.trim()) return;
        setLoading(true);
        try {
            const company = await createCompany(newCompanyName, newCompanyCNPJ);
            if (company) {
                handleSelectCompany(company);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (showCompanySelection) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1218] overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] size-[40%] bg-primary/20 blur-[120px] rounded-full"></div>
                <div className="w-full max-w-md p-8 bg-[#1a2632]/80 backdrop-blur-xl border border-[#324d67]/50 rounded-2xl shadow-2xl relative z-10">
                    <h2 className="text-xl font-black text-white mb-6 uppercase tracking-tight">Selecione sua Empresa</h2>

                    <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-2">
                        {companies.map(c => (
                            <button
                                key={c.id}
                                onClick={() => handleSelectCompany(c)}
                                className="w-full p-4 bg-[#111a22] hover:bg-[#2d445a] border border-[#324d67] rounded-xl text-left text-white font-bold transition-all flex items-center justify-between group"
                            >
                                {c.name}
                                <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                            </button>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-[#324d67]/30">
                        <label className="block text-sm font-medium text-[#92adc9] mb-4 uppercase tracking-widest text-[10px] font-black">Ou crie uma nova organização</label>
                        <form onSubmit={handleCreateCompany} className="space-y-3">
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white placeholder-[#4a6b8a] text-sm font-bold outline-none focus:border-primary"
                                    placeholder="Nome da Empresa"
                                    required
                                />
                                <input
                                    type="text"
                                    value={newCompanyCNPJ}
                                    onChange={(e) => setNewCompanyCNPJ(e.target.value)}
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 px-4 text-white placeholder-[#4a6b8a] text-sm font-bold outline-none focus:border-primary"
                                    placeholder="CNPJ (Opcional)"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !newCompanyName.trim()}
                                className="w-full bg-primary hover:bg-blue-600 py-3 rounded-xl text-white font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                            >
                                {loading ? (
                                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        Cadastrar Empresa
                                        <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1218] overflow-hidden transition-colors duration-500">
            {/* Background elements */}
            <div className={`absolute top-[-10%] left-[-10%] size-[60%] blur-[120px] rounded-full transition-all duration-700 ${isBusinessLogin ? 'bg-indigo-600/30' : 'bg-primary/20'}`}></div>
            <div className={`absolute bottom-[-10%] right-[-10%] size-[50%] blur-[130px] rounded-full transition-all duration-700 ${isBusinessLogin ? 'bg-purple-600/10' : 'bg-blue-600/10'}`}></div>

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

            <div className="w-full max-w-md p-8 bg-[#1a2632]/80 backdrop-blur-2xl border border-[#324d67]/50 rounded-3xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className={`size-32 rounded-[2rem] bg-gradient-to-br p-px mb-6 shadow-2xl transition-all duration-500 ${isBusinessLogin ? 'from-indigo-400 to-purple-600' : 'from-primary to-blue-600'}`}>
                        <div className="size-full rounded-[1.95rem] bg-[#1c2a38] flex items-center justify-center overflow-hidden">
                            <img
                                src={logo}
                                alt="Black Belt Financ Logo"
                                className="size-20 object-contain drop-shadow-2xl"
                            />
                        </div>
                    </div>

                    <div className="text-center space-y-1">
                        <h1 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-2">
                            Black Belt Financ
                            {isBusinessLogin && <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black tracking-widest">PRO</span>}
                        </h1>
                        <p className="text-[#92adc9] text-xs font-medium uppercase tracking-widest opacity-60">
                            {isBusinessLogin ? 'Business Intelligence System' : 'Personal Finance Control'}
                            <span className="ml-2 px-1 bg-white/10 rounded text-[8px]">v1.1.0</span>
                        </p>
                    </div>

                    <div className="flex w-full mt-8 bg-[#111a22] p-1.5 rounded-2xl border border-[#324d67] shadow-inner">
                        <button
                            onClick={() => setIsBusinessLogin(false)}
                            className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${!isBusinessLogin ? 'bg-primary text-white shadow-xl scale-[1.02]' : 'text-[#92adc9] hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">person</span>
                            Pessoal
                        </button>
                        <button
                            onClick={() => setIsBusinessLogin(true)}
                            className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${isBusinessLogin ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' : 'text-[#92adc9] hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">business_center</span>
                            Empresarial
                        </button>
                    </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-[#92adc9] mb-2">E-mail</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#92adc9] text-[20px]">mail</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#4a6b8a] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#92adc9] mb-2">Senha</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#92adc9] text-[20px]">lock</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#4a6b8a] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-95 ${isBusinessLogin ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-primary hover:bg-blue-600 shadow-primary/20'}`}
                    >
                        {loading ? (
                            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                {isSignUp ? 'Cadastrar' : 'Entrar'}
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-[#324d67]/30">
                    <p className="text-[#92adc9]">
                        {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-2 text-primary font-bold hover:underline"
                        >
                            {isSignUp ? 'Fazer login' : 'Criar conta'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
