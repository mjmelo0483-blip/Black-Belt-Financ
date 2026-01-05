import React, { useState } from 'react';
import { supabase } from '../supabase';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    accounts: any[];
    categories: any[];
    cards: any[];
    investments?: any[];
    saveTransaction: (payload: any) => Promise<{ data: any; error: any }>;
    saveTransfer?: (payload: any) => Promise<{ data?: any; error: any }>;
    saveInvestmentTransaction?: (payload: any) => Promise<{ data?: any; error: any }>;
    updateTransaction?: (id: string, payload: any) => Promise<{ data: any; error: any }>;
    isEditing?: boolean;
    initialData?: any;
}

const TransactionModal: React.FC<TransactionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    accounts,
    categories,
    cards,
    investments = [],
    saveTransaction,
    saveTransfer,
    saveInvestmentTransaction,
    updateTransaction,
    isEditing = false,
    initialData = null
}) => {
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<'expense' | 'income' | 'transfer' | 'investment'>(initialData?.type || 'expense');
    const [investmentOperationType, setInvestmentOperationType] = useState<'application' | 'redemption'>('application');
    const [investmentId, setInvestmentId] = useState('');
    const [status, setStatus] = useState<'open' | 'completed'>(initialData?.status || 'completed');
    const [amount, setAmount] = useState(initialData?.amount?.toString() || '');

    const getLocalDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(initialData?.date || getLocalDate());
    const [dueDate, setDueDate] = useState(initialData?.due_date || getLocalDate());
    const [description, setDescription] = useState(initialData?.description || '');
    const [categoryId, setCategoryId] = useState(initialData?.category_id || '');
    const [accountId, setAccountId] = useState(initialData?.account_id || '');
    const [toAccountId, setToAccountId] = useState(''); // Conta destino para transferências
    const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method || 'debito');
    const [cardId, setCardId] = useState(initialData?.card_id || '');
    const [installments, setInstallments] = useState(initialData?.installments?.toString() || '1');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceCount, setRecurrenceCount] = useState('1');

    // Sincroniza o estado quando o initialData mudar ou o modal abrir
    React.useEffect(() => {
        if (isOpen) {
            setType(initialData?.type || 'expense');
            setStatus(initialData?.status || 'completed');
            setAmount(initialData?.amount?.toString() || '');
            setDate(initialData?.date || getLocalDate());
            setDueDate(initialData?.due_date || getLocalDate());
            setDescription(initialData?.description || '');
            setCategoryId(initialData?.category_id || '');
            setAccountId(initialData?.account_id || '');
            setToAccountId('');
            setInvestmentId('');
            setInvestmentOperationType('application');
            setPaymentMethod(initialData?.payment_method || 'debito');
            setCardId(initialData?.card_id || '');
            setInstallments(initialData?.installments?.toString() || '1');
            setIsRecurring(false);
            setRecurrenceCount('1');
        }
    }, [isOpen, initialData]);

    const addMonths = (dateStr: string, months: number) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1 + months, day);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleSave = async () => {
        // Validação para investimento
        if (type === 'investment') {
            if (!amount || !accountId || !investmentId) {
                alert('Preencha o valor, conta e investimento.');
                return;
            }
            if (!saveInvestmentTransaction) {
                alert('Erro: função de investimento não disponível.');
                return;
            }

            setLoading(true);
            const result = await saveInvestmentTransaction({
                operationType: investmentOperationType,
                amount: parseFloat(amount.replace(',', '.')),
                accountId: accountId,
                investmentId: investmentId,
                date,
                dueDate,
                description: description || (investmentOperationType === 'application' ? 'Aplicação em investimento' : 'Resgate de investimento'),
                status
            });

            if (result.error) {
                alert('Erro ao salvar: ' + result.error.message);
            } else {
                onSave();
            }
            setLoading(false);
            return;
        }

        // Validação para transferência
        if (type === 'transfer') {
            if (!amount || !accountId || !toAccountId) {
                alert('Preencha o valor, conta de débito e conta de crédito.');
                return;
            }
            if (accountId === toAccountId) {
                alert('A conta de débito e crédito não podem ser a mesma.');
                return;
            }
            if (!saveTransfer) {
                alert('Erro: função de transferência não disponível.');
                return;
            }

            setLoading(true);
            const result = await saveTransfer({
                amount: parseFloat(amount.replace(',', '.')),
                fromAccountId: accountId,
                toAccountId: toAccountId,
                date,
                dueDate,
                description: description || 'Transferência entre contas',
                status
            });

            if (result.error) {
                alert('Erro ao salvar: ' + result.error.message);
            } else {
                onSave();
            }
            setLoading(false);
            return;
        }

        // Lógica original para despesa/receita
        if (!amount || !accountId) {
            alert('Preencha o valor e a conta.');
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Usuário não autenticado.');
            setLoading(false);
            return;
        }

        const numInstallments = parseInt(installments) || 1;
        const numRecurrences = parseInt(recurrenceCount) || 1;

        const baseTransaction = {
            user_id: user.id,
            amount: parseFloat(amount.replace(',', '.')),
            date,
            due_date: dueDate,
            description,
            category_id: categoryId || null,
            account_id: accountId,
            type,
            payment_method: paymentMethod,
            card_id: paymentMethod === 'credito' ? cardId : null,
            installments: numInstallments,
            status
        };

        let result;
        if (isEditing && initialData?.id && updateTransaction) {
            result = await updateTransaction(initialData.id, baseTransaction);
        } else if (((numInstallments > 1 && paymentMethod === 'credito') || (isRecurring && numRecurrences > 1)) && !isEditing) {
            const payload = [];
            const count = (paymentMethod === 'credito') ? numInstallments : numRecurrences;
            const itemAmount = (paymentMethod === 'credito') ? baseTransaction.amount / count : baseTransaction.amount;

            for (let i = 1; i <= count; i++) {
                payload.push({
                    ...baseTransaction,
                    amount: itemAmount,
                    description: `${description} (${i}/${count})`,
                    // For credit card installments, keep the same inclusion date. 
                    // For recurring payments (non-card), both dates increment.
                    date: (paymentMethod === 'credito') ? date : addMonths(date, i - 1),
                    due_date: addMonths(dueDate, i - 1),
                    installment_number: i,
                    installments: count
                });
            }
            result = await saveTransaction(payload);
        } else {
            result = await saveTransaction(baseTransaction);
        }

        if (result.error) {
            alert('Erro ao salvar: ' + result.error.message);
        } else {
            onSave();
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#111a22] w-full max-w-2xl max-h-[90vh] rounded-3xl border border-[#324d67]/50 shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 md:p-8 pb-0 shrink-0">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-white text-2xl font-black tracking-tight">{isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
                        <button onClick={onClose} className="size-10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center text-[#92adc9]">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="flex gap-8 border-b border-[#324d67]/50 mb-8">
                        <button onClick={() => setType('expense')} className={`pb-3 border-b-2 font-bold text-sm transition-all ${type === 'expense' ? 'border-red-500 text-white' : 'border-transparent text-[#92adc9] hover:text-white'}`}>DESPESA</button>
                        <button onClick={() => setType('income')} className={`pb-3 border-b-2 font-bold text-sm transition-all ${type === 'income' ? 'border-green-500 text-white' : 'border-transparent text-[#92adc9] hover:text-white'}`}>RECEITA</button>
                        <button onClick={() => setType('transfer')} className={`pb-3 border-b-2 font-bold text-sm transition-all ${type === 'transfer' ? 'border-primary text-white' : 'border-transparent text-[#92adc9] hover:text-white'}`}>TRANSFERÊNCIA</button>
                        <button onClick={() => setType('investment')} className={`pb-3 border-b-2 font-bold text-sm transition-all ${type === 'investment' ? 'border-purple-500 text-white' : 'border-transparent text-[#92adc9] hover:text-white'}`}>INVESTIMENTO</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-6 md:pb-8">
                    <div className="grid gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <label className="flex flex-col gap-2">
                                <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Valor</span>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92adc9] font-medium">R$</span>
                                    <input className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 pl-12 pr-4 text-white text-2xl font-bold focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="0,00" type="text" value={amount} onChange={(e) => setAmount(e.target.value)} />
                                </div>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Situação</span>
                                <div className="flex gap-2 p-1 bg-[#1c2a38] border border-[#324d67] rounded-xl h-[66px]">
                                    <button onClick={() => setStatus('completed')} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${status === 'completed' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-[#6384a3] hover:text-white'}`}>Realizado</button>
                                    <button onClick={() => setStatus('open')} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${status === 'open' ? 'bg-[#111a22] text-[#92adc9]' : 'text-[#6384a3] hover:text-white'}`}>Em Aberto</button>
                                </div>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Inclusão</span>
                                    <input className="w-full h-[66px] bg-[#1c2a38] border border-[#324d67] rounded-xl px-4 text-white focus:ring-2 focus:ring-primary outline-none [color-scheme:dark] transition-all text-sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Vencimento</span>
                                    <input className="w-full h-[66px] bg-[#1c2a38] border border-[#324d67] rounded-xl px-4 text-white focus:ring-2 focus:ring-primary outline-none [color-scheme:dark] transition-all text-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                </label>
                            </div>
                        </div>

                        {type !== 'transfer' && type !== 'investment' && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Forma</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                        <option value="debito">Débito</option>
                                        <option value="pix">Pix</option>
                                        <option value="credito">Cartão</option>
                                        <option value="dinheiro">Dinheiro</option>
                                    </select>
                                </label>

                                {paymentMethod === 'credito' && (
                                    <>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Cartão</span>
                                            <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                                                <option value="">Selecionar...</option>
                                                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Parcelas</span>
                                            <div className="relative">
                                                <input
                                                    className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 pl-4 pr-10 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm font-bold"
                                                    type="number"
                                                    min="1"
                                                    value={installments}
                                                    onChange={(e) => setInstallments(e.target.value)}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#92adc9] font-bold text-xs">x</span>
                                            </div>
                                        </label>
                                    </>
                                )}

                                {paymentMethod !== 'credito' && !isEditing && (
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Repetir</span>
                                        <div className="flex gap-2 p-1 bg-[#1c2a38] border border-[#324d67] rounded-xl h-[66px]">
                                            <button
                                                onClick={() => setIsRecurring(!isRecurring)}
                                                className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isRecurring ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-[#6384a3] hover:text-white'}`}
                                            >
                                                {isRecurring ? 'Sim' : 'Não'}
                                            </button>
                                            {isRecurring && (
                                                <input
                                                    className="w-20 bg-[#111a22] border-none rounded-lg px-2 text-white text-center font-bold outline-none focus:ring-1 focus:ring-primary"
                                                    type="number"
                                                    min="1"
                                                    value={recurrenceCount}
                                                    onChange={(e) => setRecurrenceCount(e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {type === 'investment' && (
                            <div className="flex flex-col gap-2 mb-2">
                                <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Tipo de Operação</span>
                                <div className="flex gap-2 p-1 bg-[#1c2a38] border border-[#324d67] rounded-xl h-[54px]">
                                    <button onClick={() => setInvestmentOperationType('application')} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${investmentOperationType === 'application' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-[#6384a3] hover:text-white'}`}>Aplicação</button>
                                    <button onClick={() => setInvestmentOperationType('redemption')} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${investmentOperationType === 'redemption' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-[#6384a3] hover:text-white'}`}>Resgate</button>
                                </div>
                            </div>
                        )}

                        <label className="flex flex-col gap-2">
                            <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Descrição</span>
                            <input className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white placeholder:text-[#4a6b8a] outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Ex: Aluguel..." type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </label>

                        {type === 'transfer' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Conta de Débito (Origem)</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Conta de Crédito (Destino)</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </label>
                            </div>
                        ) : type === 'investment' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">{investmentOperationType === 'application' ? 'Conta de Débito' : 'Conta de Crédito'}</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Investimento</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={investmentId} onChange={(e) => setInvestmentId(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {investments.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                                    </select>
                                </label>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Categoria</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                                        <option value="">Sem categoria</option>
                                        {(() => {
                                            // Filtra apenas categorias do tipo selecionado
                                            const typeFiltered = categories.filter(c => c.type === (type === 'transfer' ? 'expense' : type));

                                            const roots = typeFiltered.filter(c => !c.parent_id);
                                            const childrenMap = new Map();
                                            typeFiltered.forEach(c => {
                                                if (c.parent_id) {
                                                    const existing = childrenMap.get(c.parent_id) || [];
                                                    childrenMap.set(c.parent_id, [...existing, c]);
                                                }
                                            });

                                            return roots.map(root => {
                                                const subcats = childrenMap.get(root.id) || [];
                                                if (subcats.length === 0) {
                                                    return <option key={root.id} value={root.id}>{root.name}</option>;
                                                }
                                                return (
                                                    <optgroup key={root.id} label={root.name} className="bg-[#111a22] font-black italic">
                                                        <option value={root.id} className="font-bold">{root.name} (Principal)</option>
                                                        {subcats.map((child: any) => (
                                                            <option key={child.id} value={child.id}>&nbsp;&nbsp;{child.name}</option>
                                                        ))}
                                                    </optgroup>
                                                );
                                            });
                                        })()}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[#92adc9] text-xs font-bold uppercase tracking-wider">Conta</span>
                                    <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-4 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </label>
                            </div>
                        )}

                        <div className="flex gap-4 justify-end mt-4">
                            <button onClick={onClose} className="px-6 h-14 rounded-xl text-[#92adc9] font-bold text-sm hover:text-white transition-all">Cancelar</button>
                            <button onClick={handleSave} disabled={loading} className="px-10 h-14 rounded-xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                                    <>
                                        <span className="material-symbols-outlined text-[20px]">save</span>
                                        Salvar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionModal;

