
import React, { useState, useEffect, useCallback } from 'react';
import { useSales } from '../hooks/useSales';
import * as XLSX from 'xlsx';

const Sales: React.FC = () => {
    const { importSalesFromExcel, fetchImports, deleteSalesByFilename, loading } = useSales();
    const [importStatus, setImportStatus] = useState<string>('');
    const [history, setHistory] = useState<any[]>([]);

    const loadHistory = useCallback(async () => {
        const { data } = await fetchImports();
        if (data) setHistory(data);
    }, [fetchImports]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportStatus('Lendo arquivo: ' + file.name);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Use the same robust parsing as Transactions
                const data = XLSX.utils.sheet_to_json(ws, {
                    raw: false,
                    dateNF: 'yyyy-mm-dd',
                    defval: ''
                });

                if (data.length === 0) {
                    setImportStatus('Erro: Nenhuma linha encontrada no arquivo.');
                    return;
                }

                setImportStatus('Importando ' + data.length + ' registros de "' + file.name + '"...');
                const result = await importSalesFromExcel(data, file.name);

                if (result.success) {
                    setImportStatus('Sucesso: ' + data.length + ' registros processados.');
                    loadHistory();
                    // Clear input
                    e.target.value = '';
                } else {
                    const errorMsg = typeof result.error === 'string'
                        ? result.error
                        : (result.error?.message || 'Erro ao processar dados. Verifique o formato das colunas.');
                    setImportStatus('Erro: ' + errorMsg);
                }
            } catch (err) {
                console.error(err);
                setImportStatus('Erro ao ler Excel. Verifique se o arquivo não está corrompido.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDeleteImport = async (item: any) => {
        const name = item.isLegacy ? 'os dados antigos (Sem Nome)' : `o arquivo "${item.name}"`;
        if (window.confirm(`Tem certeza que deseja excluir ${name}? Esta ação apagará ${item.count} vendas.`)) {
            setImportStatus('Excluindo...');
            const result = await deleteSalesByFilename(item.isLegacy ? null : item.name);
            if (result.success) {
                setImportStatus('Importação removida com sucesso.');
                loadHistory();
            } else {
                setImportStatus('Erro ao excluir: ' + (result.error?.message || 'Erro desconhecido'));
            }
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-white tracking-tight uppercase">Importação de Vendas</h1>
                <p className="text-[#92adc9] text-sm">Gerencie o histórico de vendas importadas do seu sistema.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#324d67]/50 shadow-xl">
                        <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">upload</span>
                            Novo Upload
                        </h2>

                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#324d67] rounded-xl cursor-pointer hover:bg-[#233648]/50 transition-all group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                <span className="material-symbols-outlined text-5xl text-[#526a81] group-hover:text-primary transition-colors mb-3">cloud_upload</span>
                                <p className="text-sm text-[#92adc9] font-medium leading-relaxed">
                                    Arraste ou clique para selecionar o arquivo Excel
                                </p>
                                <p className="text-[10px] text-[#526a81] mt-2 font-bold uppercase tracking-widest">XLSX, XLS</p>
                            </div>
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} />
                        </label>

                        {importStatus && (
                            <div className={`mt-6 p-4 rounded-xl text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${importStatus.includes('Erro') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                <span className="material-symbols-outlined text-[18px]">
                                    {importStatus.includes('Erro') ? 'error' : importStatus.includes('Sucesso') ? 'check_circle' : 'info'}
                                </span>
                                {importStatus}
                            </div>
                        )}
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-2xl">
                        <h3 className="text-amber-500 text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                            Dica de Importação
                        </h3>
                        <p className="text-[#92adc9] text-[11px] leading-relaxed">
                            O sistema identifica automaticamente as colunas. Para evitar duplicações, certifique-se de que a coluna de <strong>Código da Venda</strong> ou <strong>Nº Pedido</strong> esteja preenchida corretamente.
                        </p>
                    </div>
                </div>

                {/* History Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-[#111a22] rounded-2xl border border-[#324d67]/50 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-[#324d67]/50 flex items-center justify-between">
                            <h2 className="text-white font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">history</span>
                                Histórico de Arquivos
                            </h2>
                            <span className="bg-[#1c2a38] text-[#92adc9] text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                                {history.length} Arquivos
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#1c2a38]/30">
                                        <th className="p-4 text-[#526a81] text-[10px] font-black uppercase tracking-widest">Arquivo</th>
                                        <th className="p-4 text-[#526a81] text-[10px] font-black uppercase tracking-widest">Período</th>
                                        <th className="p-4 text-[#526a81] text-[10px] font-black uppercase tracking-widest">Registros</th>
                                        <th className="p-4 text-[#526a81] text-[10px] font-black uppercase tracking-widest text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#324d67]/30">
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <span className="material-symbols-outlined text-4xl text-[#1c2a38]">folder_open</span>
                                                    <p className="text-[#526a81] text-sm italic">Nenhuma importação encontrada.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`size-8 rounded-lg flex items-center justify-center ${item.isLegacy ? 'bg-slate-500/10 text-slate-400' : 'bg-primary/10 text-primary'}`}>
                                                            <span className="material-symbols-outlined text-[20px]">description</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-white text-sm font-bold truncate max-w-[200px]" title={item.name}>
                                                                {item.name}
                                                            </span>
                                                            <span className="text-[10px] text-[#526a81] font-medium">
                                                                Importado em {new Date(item.importedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2 text-[#92adc9] text-[11px] font-bold">
                                                        <span>{new Date(item.firstDate).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                                                        <span className="text-primary opacity-50">→</span>
                                                        <span>{new Date(item.lastDate).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="bg-[#1c2a38] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                                        {item.count}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteImport(item)}
                                                        className="size-8 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center"
                                                        title="Excluir apenas esta importação"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sales;
