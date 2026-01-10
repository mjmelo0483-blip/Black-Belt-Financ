import React, { useState } from 'react';

interface BulkEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updates: any) => Promise<void>;
    accounts: any[];
    categories: any[];
    selectedCount: number;
}

const BulkEditModal: React.FC<BulkEditModalProps> = ({
    isOpen,
    onClose,
    onSave,
    accounts,
    categories,
    selectedCount
}) => {
    const [loading, setLoading] = useState(false);

    // States for which fields to update
    const [updateStatus, setUpdateStatus] = useState(false);
    const [updateCategory, setUpdateCategory] = useState(false);
    const [updateAccount, setUpdateAccount] = useState(false);
    const [updateDate, setUpdateDate] = useState(false);
    const [updateDueDate, setUpdateDueDate] = useState(false);
    const [updatePaymentMethod, setUpdatePaymentMethod] = useState(false);

    // Values for the fields
    const [status, setStatus] = useState<'open' | 'completed'>('open');
    const [categoryId, setCategoryId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [date, setDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('debito');

    if (!isOpen) return null;

    const handleSave = async () => {
        const updates: any = {};
        if (updateStatus) updates.status = status;
        if (updateCategory) updates.category_id = categoryId || null;
        if (updateAccount) updates.account_id = accountId;
        if (updateDate) updates.date = date;
        if (updateDueDate) updates.due_date = dueDate;
        if (updatePaymentMethod) updates.payment_method = paymentMethod;

        if (Object.keys(updates).length === 0) {
            alert('Selecione ao menos um campo para alterar.');
            return;
        }

        setLoading(true);
        try {
            await onSave(updates);
            onClose();
        } catch (error) {
            console.error('Error in bulk edit:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#111a22] w-full max-w-xl max-h-[90vh] rounded-3xl border border-[#324d67]/50 shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 md:p-8 shrink-0 border-b border-[#324d67]/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-white text-2xl font-black tracking-tight">Alteração em Massa</h2>
                            <p className="text-[#92adc9] text-sm mt-1">Alterando {selectedCount} lançamentos simultaneamente.</p>
                        </div>
                        <button onClick={onClose} className="size-10 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center text-[#92adc9]">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="grid gap-6">
                        {/* Status */}
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={updateStatus} onChange={e => setUpdateStatus(e.target.checked)} className="size-5 rounded border-[#324d67] bg-[#1c2a38] text-primary focus:ring-primary" />
                                <span className="text-white font-bold text-sm group-hover:text-primary transition-colors">Alterar Situação</span>
                            </label>
                            {updateStatus && (
                                <div className="flex gap-2 p-1 bg-[#1c2a38] border border-[#324d67] rounded-xl h-[54px] ml-8">
                                    <button onClick={() => setStatus('completed')} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${status === 'completed' ? 'bg-green-500 text-white shadow-lg' : 'text-[#6384a3] hover:text-white'}`}>Realizado</button>
                                    <button onClick={() => setStatus('open')} className={`flex-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${status === 'open' ? 'bg-[#111a22] text-[#92adc9]' : 'text-[#6384a3] hover:text-white'}`}>Em Aberto</button>
                                </div>
                            )}
                        </div>

                        {/* Account */}
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={updateAccount} onChange={e => setUpdateAccount(e.target.checked)} className="size-5 rounded border-[#324d67] bg-[#1c2a38] text-primary focus:ring-primary" />
                                <span className="text-white font-bold text-sm group-hover:text-primary transition-colors">Alterar Conta</span>
                            </label>
                            {updateAccount && (
                                <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm ml-8 w-[calc(100%-2rem)]" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Category */}
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={updateCategory} onChange={e => setUpdateCategory(e.target.checked)} className="size-5 rounded border-[#324d67] bg-[#1c2a38] text-primary focus:ring-primary" />
                                <span className="text-white font-bold text-sm group-hover:text-primary transition-colors">Alterar Categoria</span>
                            </label>
                            {updateCategory && (
                                <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm ml-8 w-[calc(100%-2rem)]" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                                    <option value="">Sem categoria</option>
                                    {(() => {
                                        const roots = categories.filter(c => !c.parent_id);
                                        const childrenMap = new Map();
                                        categories.forEach(c => {
                                            if (c.parent_id) {
                                                const existing = childrenMap.get(c.parent_id) || [];
                                                childrenMap.set(c.parent_id, [...existing, c]);
                                            }
                                        });

                                        return roots.map(root => {
                                            const subcats = (childrenMap.get(root.id) || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
                                            if (subcats.length === 0) {
                                                return <option key={root.id} value={root.id}>{root.name}</option>;
                                            }
                                            return (
                                                <optgroup key={root.id} label={root.name}>
                                                    <option value={root.id}>{root.name} (Principal)</option>
                                                    {subcats.map((child: any) => (
                                                        <option key={child.id} value={child.id}>&nbsp;&nbsp;{child.name}</option>
                                                    ))}
                                                </optgroup>
                                            );
                                        });
                                    })()}
                                </select>
                            )}
                        </div>

                        {/* Payment Method */}
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={updatePaymentMethod} onChange={e => setUpdatePaymentMethod(e.target.checked)} className="size-5 rounded border-[#324d67] bg-[#1c2a38] text-primary focus:ring-primary" />
                                <span className="text-white font-bold text-sm group-hover:text-primary transition-colors">Alterar Forma</span>
                            </label>
                            {updatePaymentMethod && (
                                <select className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-primary transition-all text-sm ml-8 w-[calc(100%-2rem)]" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                    <option value="debito">Débito</option>
                                    <option value="pix">Pix</option>
                                    <option value="credito_v">Crédito</option>
                                    <option value="credito">Cartão</option>
                                    <option value="dinheiro">Dinheiro</option>
                                </select>
                            )}
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={updateDate} onChange={e => setUpdateDate(e.target.checked)} className="size-5 rounded border-[#324d67] bg-[#1c2a38] text-primary focus:ring-primary" />
                                    <span className="text-white font-bold text-sm group-hover:text-primary transition-colors">Nova Data Inc.</span>
                                </label>
                                {updateDate && (
                                    <input className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none [color-scheme:dark] transition-all text-sm ml-8 w-[calc(100%-2rem)]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                )}
                            </div>
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={updateDueDate} onChange={e => setUpdateDueDate(e.target.checked)} className="size-5 rounded border-[#324d67] bg-[#1c2a38] text-primary focus:ring-primary" />
                                    <span className="text-white font-bold text-sm group-hover:text-primary transition-colors">Nova Data Venc.</span>
                                </label>
                                {updateDueDate && (
                                    <input className="w-full bg-[#1c2a38] border border-[#324d67] rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary outline-none [color-scheme:dark] transition-all text-sm ml-8 w-[calc(100%-2rem)]" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 md:p-8 border-t border-[#324d67]/50 flex gap-4 justify-end">
                    <button onClick={onClose} className="px-6 h-12 rounded-xl text-[#92adc9] font-bold text-sm hover:text-white transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={loading} className="px-10 h-12 rounded-xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">done_all</span>
                                Aplicar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
