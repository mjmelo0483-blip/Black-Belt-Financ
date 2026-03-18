import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSales } from '../hooks/useSales';
import { useCompany } from '../contexts/CompanyContext';
import * as XLSX from 'xlsx';

interface ReportRow {
    date: string;
    time: string;
    productCode: string;
    productName: string;
    category: string;
    subCategory: string;
    totalValue: number;
}

const SalesReportView: React.FC = () => {
    const { fetchSales, loading } = useSales();
    const { activeCompany } = useCompany();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: keyof ReportRow; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');

    const ITEMS_PER_PAGE = 50;

    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
    }, []);

    const handleGenerateReport = useCallback(async () => {
        if (!startDate || !endDate) return;
        const result = await fetchSales({ startDate, endDate });
        if (result.data) {
            const rows: ReportRow[] = [];
            result.data.forEach((sale: any) => {
                if (sale.sale_items) {
                    sale.sale_items.forEach((item: any) => {
                        rows.push({
                            date: sale.date || '',
                            time: sale.time || '',
                            productCode: item.products?.code || '-',
                            productName: item.products?.name || 'Produto não identificado',
                            category: item.products?.category || '-',
                            subCategory: item.products?.sub_category || '-',
                            totalValue: Number(item.total_price) || 0,
                        });
                    });
                }
            });
            rows.sort((a, b) => {
                const d = a.date.localeCompare(b.date);
                if (d !== 0) return d;
                return (a.time || '').localeCompare(b.time || '');
            });
            setReportData(rows);
            setCurrentPage(1);
        }
        setHasSearched(true);
    }, [fetchSales, startDate, endDate]);

    const processedData = useMemo(() => {
        let filtered = reportData;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = reportData.filter(
                (r) =>
                    r.productName.toLowerCase().includes(term) ||
                    r.productCode.toLowerCase().includes(term) ||
                    r.category.toLowerCase().includes(term) ||
                    r.subCategory.toLowerCase().includes(term)
            );
        }
        return [...filtered].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            const dir = sortConfig.direction === 'asc' ? 1 : -1;
            if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
            return String(aVal).localeCompare(String(bVal)) * dir;
        });
    }, [reportData, searchTerm, sortConfig]);

    const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);
    const paginatedData = processedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalValue = processedData.reduce((s, r) => s + r.totalValue, 0);

    const handleSort = (key: keyof ReportRow) => {
        setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const formatDateBR = (d: string) => {
        if (!d) return '-';
        const p = d.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
    };

    const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const handleExportExcel = () => {
        const rows = processedData.map((r) => ({
            'Data da Compra': formatDateBR(r.date),
            'Hora da Compra': r.time || '-',
            'Código do Produto': r.productCode,
            'Nome do Produto': r.productName,
            Categoria: r.category,
            'Sub-categoria': r.subCategory,
            'Valor Total': r.totalValue,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório de Vendas');
        ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({
            wch: Math.max(k.length + 2, ...rows.map((r) => String((r as any)[k]).length + 2)),
        }));
        XLSX.writeFile(wb, `relatorio_vendas_${startDate}_a_${endDate}.xlsx`);
    };

    const columns: { key: keyof ReportRow; label: string }[] = [
        { key: 'date', label: 'Data da Compra' },
        { key: 'time', label: 'Hora da Compra' },
        { key: 'productCode', label: 'Código do Produto' },
        { key: 'productName', label: 'Nome do Produto' },
        { key: 'category', label: 'Categoria' },
        { key: 'subCategory', label: 'Sub-categoria' },
        { key: 'totalValue', label: 'Valor Total' },
    ];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-[#1c2a38] p-6 rounded-2xl border border-[#324d67]/50 shadow-xl">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">filter_alt</span>
                    Filtros do Relatório
                </h2>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[#526a81] text-[10px] font-black uppercase tracking-widest">Data Início</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-[#111a22] border border-[#324d67] rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[#526a81] text-[10px] font-black uppercase tracking-widest">Data Fim</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-[#111a22] border border-[#324d67] rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading || !startDate || !endDate}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-[18px]">search</span>
                        {loading ? 'Gerando...' : 'Gerar Relatório'}
                    </button>
                    {reportData.length > 0 && (
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-600/20 ml-auto"
                        >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                            Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {hasSearched && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-[#1c2a38] p-4 rounded-xl border border-[#324d67]/30">
                        <p className="text-[#526a81] text-[10px] font-black uppercase tracking-widest mb-1">Total de Itens</p>
                        <p className="text-white text-2xl font-black">{processedData.length.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#1c2a38] p-4 rounded-xl border border-[#324d67]/30">
                        <p className="text-[#526a81] text-[10px] font-black uppercase tracking-widest mb-1">Valor Total</p>
                        <p className="text-emerald-400 text-2xl font-black">{formatCurrency(totalValue)}</p>
                    </div>
                    <div className="bg-[#1c2a38] p-4 rounded-xl border border-[#324d67]/30">
                        <p className="text-[#526a81] text-[10px] font-black uppercase tracking-widest mb-1">Ticket Médio</p>
                        <p className="text-primary text-2xl font-black">{processedData.length > 0 ? formatCurrency(totalValue / processedData.length) : 'R$ 0,00'}</p>
                    </div>
                    <div className="bg-[#1c2a38] p-4 rounded-xl border border-[#324d67]/30">
                        <p className="text-[#526a81] text-[10px] font-black uppercase tracking-widest mb-1">Categorias</p>
                        <p className="text-amber-400 text-2xl font-black">{new Set(processedData.map((r) => r.category)).size}</p>
                    </div>
                </div>
            )}

            {/* Search */}
            {reportData.length > 0 && (
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#526a81] text-[18px]">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Buscar por produto, código ou categoria..."
                            className="w-full bg-[#1c2a38] border border-[#324d67]/50 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder:text-[#526a81] focus:border-primary outline-none transition-all"
                        />
                    </div>
                    <span className="text-[#526a81] text-xs font-bold">{processedData.length} resultado(s)</span>
                </div>
            )}

            {/* Table */}
            {hasSearched && (
                <div className="bg-[#111a22] rounded-2xl border border-[#324d67]/50 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-[#1c2a38]/50">
                                    {columns.map((col) => (
                                        <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className="p-3 text-[#526a81] text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors select-none"
                                        >
                                            <div className="flex items-center gap-1">
                                                {col.label}
                                                {sortConfig.key === col.key && (
                                                    <span className="material-symbols-outlined text-primary text-[14px]">
                                                        {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#324d67]/20">
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <span className="material-symbols-outlined text-4xl text-[#324d67]">receipt_long</span>
                                                <p className="text-[#526a81] text-sm italic">Nenhuma venda encontrada no período selecionado.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3 text-[#92adc9] text-xs font-medium whitespace-nowrap">{formatDateBR(row.date)}</td>
                                            <td className="p-3 text-[#92adc9] text-xs font-medium whitespace-nowrap">{row.time || '-'}</td>
                                            <td className="p-3 text-white text-xs font-mono">{row.productCode}</td>
                                            <td className="p-3 text-white text-xs font-medium max-w-[300px] truncate" title={row.productName}>{row.productName}</td>
                                            <td className="p-3">
                                                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{row.category}</span>
                                            </td>
                                            <td className="p-3 text-[#92adc9] text-xs">{row.subCategory}</td>
                                            <td className="p-3 text-emerald-400 text-xs font-bold text-right whitespace-nowrap">{formatCurrency(row.totalValue)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {paginatedData.length > 0 && (
                                <tfoot>
                                    <tr className="bg-[#1c2a38]/30 border-t border-[#324d67]/50">
                                        <td colSpan={6} className="p-3 text-white text-xs font-black text-right uppercase tracking-widest">Total da Página</td>
                                        <td className="p-3 text-emerald-400 text-xs font-black text-right">{formatCurrency(paginatedData.reduce((s, r) => s + r.totalValue, 0))}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-[#324d67]/30">
                            <span className="text-[#526a81] text-xs">Página {currentPage} de {totalPages} ({processedData.length} registros)</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="size-8 rounded-lg text-[#92adc9] hover:bg-white/5 disabled:opacity-30 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined text-[16px]">first_page</span>
                                </button>
                                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="size-8 rounded-lg text-[#92adc9] hover:bg-white/5 disabled:opacity-30 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let page: number;
                                    if (totalPages <= 5) page = i + 1;
                                    else if (currentPage <= 3) page = i + 1;
                                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                                    else page = currentPage - 2 + i;
                                    return (
                                        <button key={page} onClick={() => setCurrentPage(page)} className={`size-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${currentPage === page ? 'bg-primary text-white' : 'text-[#92adc9] hover:bg-white/5'}`}>
                                            {page}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="size-8 rounded-lg text-[#92adc9] hover:bg-white/5 disabled:opacity-30 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                </button>
                                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="size-8 rounded-lg text-[#92adc9] hover:bg-white/5 disabled:opacity-30 flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined text-[16px]">last_page</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SalesReportView;
