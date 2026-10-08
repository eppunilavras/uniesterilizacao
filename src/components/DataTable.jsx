import React, { useState, useMemo } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import Skeleton from './Skeleton';

/**
 * Componente de Tabela de Dados Universal
 * @param {Array} columns - Configuração das colunas [{ key, label, sortable, render, width, className }]
 * @param {Array} data - Array de objetos com os dados a serem exibidos
 * @param {Function} actions - (Opcional) Função que retorna botões de ação (JSX) para cada linha
 * @param {string} emptyMsg - Mensagem para exibir quando não há dados
 * @param {Function} mobileRender - (Opcional) Função que retorna o layout de Card para mobile
 * @param {boolean} loading - Estado de carregamento
 * @param {number} pageSize - Linhas por página (padrão 25)
 */
const PAGE_SIZES = [25, 50, 100];

const DataTable = ({ columns, data, actions, emptyMsg, mobileRender, loading, pageSize: initialPageSize = 25 }) => {
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);

    // --- LÓGICA DE ORDENAÇÃO ---
    const sortedData = useMemo(() => {
        if (!sortCol) return data;
        return [...data].sort((a, b) => {
            let valA = a[sortCol];
            let valB = b[sortCol];

            // Tratamento seguro para strings (Case Insensitive)
            if(typeof valA === 'string') valA = valA.toLowerCase();
            if(typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortCol, sortDir]);

    const handleSort = (key) => {
        if (sortCol === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortCol(key); setSortDir('asc'); }
        setPage(1);
    };

    // --- PAGINAÇÃO ---
    // A página é limitada ao total atual: se um filtro reduzir a lista, cai na última página válida.
    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const firstIndex = (currentPage - 1) * pageSize;
    const pageData = sortedData.slice(firstIndex, firstIndex + pageSize);
    const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));

    // --- RENDERIZAÇÃO DE LOADING (SKELETON) ---
    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full transition-colors">
                {/* Desktop Skeleton */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left table-fixed">
                        <thead className="bg-[#021D34] text-white">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={col.key || idx} className="p-4 font-semibold">
                                        {col.label}
                                    </th>
                                ))}
                                {actions && <th className="p-4 text-center w-32">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    {columns.map((_, cIdx) => (
                                        <td key={cIdx} className="p-4">
                                            <Skeleton className="h-4 w-full" />
                                        </td>
                                    ))}
                                    {actions && (
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <Skeleton className="h-8 w-8 rounded-lg" />
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Skeleton */}
                <div className="md:hidden divide-y divide-slate-100">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-4 space-y-3">
                            <div className="flex justify-between gap-4">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-3 w-2/3" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // --- RENDERIZAÇÃO DE ESTADO VAZIO ---
    if (sortedData.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl transition-colors">
                {emptyMsg || 'Nenhum registro encontrado.'}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full transition-colors">
            
            {/* --- VISÃO DESKTOP (TABELA TRADICIONAL) --- */}
            <div className={`hidden md:block overflow-x-auto`}>
                <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-[#021D34] text-white">
                        <tr>
                            {columns.map((col, idx) => (
                                <th 
                                    key={col.key || idx} 
                                    onClick={() => col.sortable && handleSort(col.key)} 
                                    style={col.width ? { width: col.width } : {}} 
                                    className={`p-4 font-semibold ${col.sortable ? 'cursor-pointer hover:bg-white/10 select-none' : ''} ${col.key === 'select' ? 'w-12' : ''}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        {col.label}
                                        {sortCol === col.key && (
                                            sortDir === 'asc' ? <ArrowUp size={14} className="shrink-0"/> : <ArrowDown size={14} className="shrink-0"/>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && <th className="p-4 text-center w-32">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pageData.map((row, i) => (
                            <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                                {columns.map((col, idx) => (
                                    <td key={col.key || idx} className={`p-4 text-slate-700 ${col.className ? col.className : 'truncate max-w-[200px]'}`}>
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                                {actions && <td className="p-4 text-center">{actions(row)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- VISÃO MOBILE (LISTA DE CARDS) --- */}
            <div className="md:hidden">
                {mobileRender ? (
                    <div className="divide-y divide-slate-100">
                        {pageData.map((row, i) => (
                            <div key={row.id || i} className="p-4 hover:bg-slate-50 transition-colors w-full max-w-full overflow-hidden">
                                {mobileRender(row)}
                                {actions && (
                                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end gap-2">
                                        {actions(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // Fallback Genérico Mobile
                    <div className="divide-y divide-slate-100">
                        {pageData.map((row, i) => (
                            <div key={row.id || i} className="p-4 space-y-2 w-full max-w-full overflow-hidden">
                                {columns.map((col, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm gap-4">
                                        <span className="font-bold text-slate-500 shrink-0">{col.label}</span>
                                        <div className="text-right truncate min-w-0 flex-1 text-slate-700">
                                            {col.render ? col.render(row) : row[col.key]}
                                        </div>
                                    </div>
                                ))}
                                {actions && (
                                    <div className="flex justify-end pt-2 mt-2 border-t border-slate-100 gap-2">
                                        {actions(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* --- PAGINAÇÃO --- */}
            {sortedData.length > PAGE_SIZES[0] && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-600 transition-colors">
                    <div className="flex items-center gap-2">
                        <span>
                            {firstIndex + 1}–{firstIndex + pageData.length} de {sortedData.length}
                        </span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="p-1 border border-slate-200 rounded-lg bg-white text-slate-700 text-xs outline-none focus:border-[#009DE0] transition-colors"
                            title="Linhas por página"
                        >
                            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} por página</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-1">
                        <PagerButton onClick={() => goTo(1)} disabled={currentPage === 1} title="Primeira página"><ChevronsLeft size={16} /></PagerButton>
                        <PagerButton onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1} title="Página anterior"><ChevronLeft size={16} /></PagerButton>
                        <span className="px-3 font-semibold text-slate-700 whitespace-nowrap">
                            Página {currentPage} de {totalPages}
                        </span>
                        <PagerButton onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages} title="Próxima página"><ChevronRight size={16} /></PagerButton>
                        <PagerButton onClick={() => goTo(totalPages)} disabled={currentPage === totalPages} title="Última página"><ChevronsRight size={16} /></PagerButton>
                    </div>
                </div>
            )}

        </div>
    );
};

const PagerButton = ({ children, ...props }) => (
    <button
        {...props}
        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#009DE0] hover:border-[#009DE0] disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
        {children}
    </button>
);

export default DataTable;