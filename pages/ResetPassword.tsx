import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const ResetPassword: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                navigate('/auth');
            }, 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1218] overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] size-[60%] blur-[120px] rounded-full bg-primary/20"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

            <div className="w-full max-w-md p-8 bg-[#1a2632]/80 backdrop-blur-2xl border border-[#324d67]/50 rounded-3xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="size-24 rounded-2xl bg-[#1c2a38] flex items-center justify-center p-4 mb-6 shadow-xl border border-[#324d67]">
                        <img src={logo} alt="Logo" className="size-full object-contain" />
                    </div>
                    <h1 className="text-xl font-black text-white uppercase tracking-tight">Nova Senha</h1>
                    <p className="text-[#92adc9] text-xs font-medium uppercase tracking-widest opacity-60 mt-2">Defina sua nova senha de acesso</p>
                </div>

                {success ? (
                    <div className="text-center space-y-6 py-8">
                        <div className="size-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50">
                            <span className="material-symbols-outlined text-emerald-400 text-4xl">check_circle</span>
                        </div>
                        <h2 className="text-emerald-400 font-bold text-lg">Senha Alterada!</h2>
                        <p className="text-[#92adc9] text-sm">Sua senha foi atualizada com sucesso. Redirecionando para o login...</p>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-[#92adc9] mb-2">Nova Senha</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#92adc9] text-[20px]">lock_reset</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#111a22] border border-[#324d67] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#4a6b8a] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#92adc9] mb-2">Confirmar Nova Senha</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#92adc9] text-[20px]">lock</span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                            className="w-full bg-primary hover:bg-blue-600 text-white font-black uppercase tracking-widest text-[11px] py-4 rounded-xl shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Atualizar Senha
                                    <span className="material-symbols-outlined text-[20px]">vpn_key</span>
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
