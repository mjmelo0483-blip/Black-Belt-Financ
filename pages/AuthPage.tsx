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
    const [isBusinessLogin, setIsBusinessLogin] = useState(false);
    const [showCompanySelection, setShowCompanySelection] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newCompanyName, setNewCompanyName] = useState('');

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
            const company = await createCompany(newCompanyName);
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
                        <label className="block text-sm font-medium text-[#92adc9] mb-4">Ou crie uma nova empresa</label>
                        <form onSubmit={handleCreateCompany} className="flex gap-2">
                            <input
                                type="text"
                                value={newCompanyName}
                                onChange={(e) => setNewCompanyName(e.target.value)}
                                className="flex-1 bg-[#111a22] border border-[#324d67] rounded-xl py-2 px-4 text-white placeholder-[#4a6b8a]"
                                placeholder="Nome da Empresa"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-primary hover:bg-blue-600 p-2 rounded-xl text-white transition-all"
                            >
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1218] overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] size-[40%] bg-primary/20 blur-[120px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] size-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-md p-8 bg-[#1a2632]/80 backdrop-blur-xl border border-[#324d67]/50 rounded-2xl shadow-2xl relative z-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="size-32 rounded-3xl bg-[#1c2a38] flex items-center justify-center overflow-hidden border border-[#324d67] shadow-lg shadow-black/20 mb-6">
                        <img
                            src={logo}
                            alt="Black Belt Financ Logo"
                            className="size-full object-cover"
                        />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight uppercase">Black Belt Financ</h1>

                    <div className="flex w-full mt-6 bg-[#111a22] p-1 rounded-xl border border-[#324d67]">
                        <button
                            onClick={() => setIsBusinessLogin(false)}
                            className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${!isBusinessLogin ? 'bg-primary text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
                        >
                            Pessoal
                        </button>
                        <button
                            onClick={() => setIsBusinessLogin(true)}
                            className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${isBusinessLogin ? 'bg-primary text-white shadow-lg' : 'text-[#92adc9] hover:text-white'}`}
                        >
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
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
