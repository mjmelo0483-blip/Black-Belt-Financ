
import React, { useState } from 'react';
import { useSales } from '../hooks/useSales';
import * as XLSX from 'xlsx';

const Sales: React.FC = () => {
    const { importSalesFromExcel, loading } = useSales();
    const [importStatus, setImportStatus] = useState<string>('');

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportStatus('Lendo arquivo...');
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });

                setImportStatus('Importando ' + data.length + ' registros...');
                const result = await importSalesFromExcel(data);

                if (result.success) {
                    setImportStatus('Sucesso: ' + data.length + ' registros processados.');
                } else {
                    setImportStatus('Erro: ' + (result.error?.message || 'Desconhecido'));
                }
            } catch (err) {
                setImportStatus('Erro ao ler Excel.');
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 text-white">Importação de Vendas</h1>

            <div className="bg-[#1c2a38] p-8 rounded-xl border border-[#233648] max-w-2xl">
                <div className="mb-6">
                    <p className="text-[#92adc9] mb-4">
                        Selecione o arquivo Excel exportado do sistema de vendas para importar os dados diários.
                    </p>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#233648] rounded-lg cursor-pointer hover:bg-[#233648]/50 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <span className="material-symbols-outlined text-4xl text-[#92adc9] mb-2">upload_file</span>
                            <p className="text-sm text-[#92adc9]">Clique para selecionar ou arraste o arquivo</p>
                            <p className="text-xs text-[#526a81] mt-1">Excel (.xlsx, .xls)</p>
                        </div>
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} />
                    </label>
                </div>

                {importStatus && (
                    <div className={`p-4 rounded-lg text-sm font-medium ${importStatus.includes('Erro') ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}>
                        {importStatus}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sales;
