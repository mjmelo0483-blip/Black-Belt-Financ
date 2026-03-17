import React, { useState, useEffect } from 'react';
import { useAIAdvisor, AIInsight } from '../hooks/useAIAdvisor';

interface AIAdvisorProps {
    month: number;
    year: number;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ month, year }) => {
    const { insights, loading, generateInsights } = useAIAdvisor();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen && insights.length === 0) {
            generateInsights(month, year);
        }
    }, [isOpen, month, year, insights.length, generateInsights]);

    const getTypeStyles = (type: AIInsight['type']) => {
        switch (type) {
            case 'warning': return { icon: 'warning', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
            case 'saving': return { icon: 'savings', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
            case 'opportunity': return { icon: 'bolt', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
            default: return { icon: 'lightbulb', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
        }
    };

    return (
        <>
            {/* Pulsing Floating Button */}
            <div className="fixed bottom-6 right-6 z-[90]">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`size-14 rounded-full flex items-center justify-center transition-all shadow-2xl ${isOpen ? 'bg-red-500 rotate-45' : 'bg-primary hover:scale-110 active:scale-95'}`}
                >
                    <span className="material-symbols-outlined text-white text-3xl font-bold">
                        {isOpen ? 'close' : 'smart_toy'}
                    </span>
                    {!isOpen && (
                        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></span>
                    )}
                </button>
            </div>

            {/* Sidebar AI Panel */}
            <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-[#0b1219]/95 backdrop-blur-xl z-[100] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} border-l border-[#324d67]/30 flex flex-col`}>
                <header className="p-8 border-b border-[#324d67]/30 flex flex-col gap-2 bg-[#111a22]/50">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-4xl">neurology</span>
                            Mentor IA
                        </h2>
                        <button onClick={() => setIsOpen(false)} className="text-[#92adc9] hover:text-white transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <p className="text-[#92adc9] text-[10px] font-black uppercase tracking-widest mt-2">
                        Análise de Inteligência Financeira • {new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                </header>

                <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 py-20 opacity-50">
                            <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                Processando movimentos...
                            </p>
                        </div>
                    ) : insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-10 opacity-30">
                            <span className="material-symbols-outlined text-6xl mb-4">insights</span>
                            <p className="text-sm font-black uppercase tracking-widest leading-relaxed">
                                Clique no botão abaixo para gerar uma análise inteligente do seu mês.
                            </p>
                            <button 
                                onClick={() => generateInsights(month, year)}
                                className="mt-6 px-6 py-3 bg-primary/20 text-primary border border-primary/30 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                            >
                                Iniciar Consultoria
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-10 duration-500">
                            {insights.map((insight, idx) => {
                                const styles = getTypeStyles(insight.type);
                                return (
                                    <div key={idx} className={`${styles.bg} ${styles.border} border rounded-2xl p-5 space-y-3 hover:translate-x-[-8px] transition-transform duration-300 group`}>
                                        <div className="flex items-center gap-3">
                                            <span className={`material-symbols-outlined ${styles.color} font-bold`}>{styles.icon}</span>
                                            <h3 className={`font-black text-xs uppercase tracking-widest ${styles.color}`}>
                                                {insight.title}
                                            </h3>
                                        </div>
                                        <p className="text-white text-sm font-medium leading-relaxed opacity-90">
                                            {insight.description}
                                        </p>
                                        {insight.impact && (
                                            <div className="pt-2 border-t border-white/5 flex items-start gap-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-[#526a81]">Impacto:</span>
                                                <span className="text-[9px] font-bold text-white uppercase">{insight.impact}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            <div className="pt-8 pb-4 text-center">
                                <button 
                                    onClick={() => generateInsights(month, year)}
                                    className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline flex items-center justify-center gap-2 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                                    Recalcular Insights
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="p-6 bg-[#111a22] border-t border-[#324d67]/30">
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                        <p className="text-[9px] text-amber-500/60 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            Aviso Legal
                        </p>
                        <p className="text-[#526a81] text-[9px] leading-relaxed">
                            Esta análise é gerada por inteligência artificial e deve ser usada apenas como suporte à decisão. Consulte sempre um profissional contábil.
                        </p>
                    </div>
                </footer>
            </div>

            {/* Backdrop */}
            {isOpen && (
                <div 
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] animate-in fade-in duration-300"
                />
            )}
        </>
    );
};

export default AIAdvisor;
