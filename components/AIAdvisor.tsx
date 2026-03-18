import React, { useState, useEffect } from 'react';
import { useAIAdvisor, AIInsight } from '../hooks/useAIAdvisor';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIAdvisorProps {
    month: number;
    year: number;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ month, year }) => {
    const { insights, loading, generateInsights, extraContext } = useAIAdvisor();
    const [isOpen, setIsOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = React.useRef<HTMLDivElement>(null);

    // Gemini API Setup
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [isConfiguringApi, setIsConfiguringApi] = useState(false);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim()) return;

        if (!apiKey) {
            setIsConfiguringApi(true);
            return;
        }

        const newMsg = chatInput.trim();
        setChatMessages(prev => [...prev, { role: 'user', text: newMsg }]);
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'ai', text: '...' }]);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            const contextString = insights.map((i, idx) => `Alerta/Dica ${idx+1}: ${i.title} - ${i.description} (Impacto: ${i.impact || 'N/A'})`).join('\n');
            const systemPrompt = `Você é o Mentor IA, um experiente e direto consultor financeiro focado em ajudar empresas/pessoas na tomada de decisão rápida e assertiva. Responda o usuário SEMPRE em Português do Brasil. Mantenha as respostas concisas.
Se houverem dados provisórios relevantes gerados por análise estrutural prévia deste mês, eles são:
${contextString || 'Ainda sem alertas computados neste mês.'}
${extraContext ? `\n${extraContext}` : ''}

Baseado nesse dashboard atual (se houver), seja extremamente útil para o usuário.`;

            const history = chatMessages.filter(m => m.text !== '...').map(m => ({ 
                role: m.role === 'ai' ? 'model' : 'user', 
                parts: [{ text: m.text }] 
            }));

            // Adiciona pre-prompt se não tem histórico para dar contexto da pergunta
            if (history.length === 0) {
                history.push({ role: 'user', parts: [{ text: systemPrompt }] });
                history.push({ role: 'model', parts: [{ text: 'Entendido. Estou pronto para ajudar. O que você precisa saber?' }] });
            }

            const chat = model.startChat({ history });
            const result = await chat.sendMessage(newMsg);
            const textResponse = result.response.text();

            setChatMessages(prev => {
                const temp = [...prev];
                temp.pop(); // remove '...'
                temp.push({ role: 'ai', text: textResponse });
                return temp;
            });
        } catch (error: any) {
            setChatMessages(prev => {
                const temp = [...prev];
                temp.pop(); // remove '...'
                temp.push({ role: 'ai', text: `Erro de conexão com Gemini: verifique se sua chave API é válida. (${error.message})` });
                return temp;
            });
            if (error.message.includes('API key not valid')) {
                localStorage.removeItem('gemini_api_key');
                setApiKey('');
            }
        }
    };

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
                            
                            <div className="pt-8 pb-4 text-center border-b border-[#324d67]/30">
                                <button 
                                    onClick={() => generateInsights(month, year)}
                                    className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline flex items-center justify-center gap-2 mx-auto"
                                >
                                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                                    Recalcular Insights
                                </button>
                            </div>

                            {/* Chat interaction block */}
                            {chatMessages.length > 0 && (
                                <div className="space-y-4 pt-4">
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-[#1e293b] text-slate-300 border border-[#334155] rounded-bl-none'}`}>
                                                {msg.text === '...' ? (
                                                    <span className="animate-pulse flex items-center gap-1">
                                                        <span className="size-1.5 bg-primary rounded-full animate-bounce"></span>
                                                        <span className="size-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                                        <span className="size-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                                    </span>
                                                ) : msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                            )}
                        </div>
                    )}
                </main>

                <footer className="bg-[#111a22] border-t border-[#324d67]/30 flex flex-col">
                    {!loading && insights.length > 0 && (
                        <div className="flex flex-col border-b border-[#324d67]/30">
                            {isConfiguringApi ? (
                                <div className="p-4 bg-[#1e293b]/50 flex flex-col gap-2">
                                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">
                                        <span className="material-symbols-outlined text-sm align-middle mr-1">key</span>
                                        Conectar Gemini API
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Cole sua Chave do Google Gemini (AI Studio)" 
                                            className="flex-1 bg-[#0f172a] text-white text-xs font-medium rounded-xl px-4 py-3 outline-none border border-[#334155] focus:border-amber-500 transition-colors"
                                        />
                                        <button 
                                            onClick={() => {
                                                localStorage.setItem('gemini_api_key', apiKey);
                                                setIsConfiguringApi(false);
                                            }}
                                            disabled={!apiKey.trim()}
                                            className="h-10 px-4 bg-amber-600 rounded-xl flex items-center justify-center text-white text-[10px] font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-500 transition-colors"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[9px] text-primary hover:underline self-end">Gerar chave gratuita &rarr;</a>
                                </div>
                            ) : (
                                <form onSubmit={handleSendMessage} className="p-4 flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder={apiKey ? "Dúvidas sobre os insights? Pergunte aqui..." : "Configure a API para interagir com a IA"} 
                                        className="flex-1 bg-[#1e293b] text-white text-xs font-medium rounded-xl px-4 py-3 outline-none border border-[#334155] focus:border-primary transition-colors placeholder:text-slate-500"
                                    />
                                    {apiKey ? (
                                        <button 
                                            type="submit" 
                                            disabled={!chatInput.trim()}
                                            className="size-10 bg-primary rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/80 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm font-bold">send</span>
                                        </button>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={() => setIsConfiguringApi(true)}
                                            className="size-10 border border-primary text-primary rounded-xl flex items-center justify-center hover:bg-primary/20 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm font-bold">settings</span>
                                        </button>
                                    )}
                                </form>
                            )}
                        </div>
                    )}
                    
                    <div className="p-6">
                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                            <p className="text-[9px] text-amber-500/60 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                Aviso Legal
                            </p>
                            <p className="text-[#526a81] text-[9px] leading-relaxed">
                                Esta análise é gerada por inteligência artificial e deve ser usada apenas como suporte à decisão. Consulte sempre um profissional contábil.
                            </p>
                        </div>
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
