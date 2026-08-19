import React, { useState, useMemo } from 'react';
import {
  ArrowUp,
  ArrowDown,
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
 */
const DataTable = ({ columns, data, actions, emptyMsg, mobileRender, loading }) => {
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

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
    };

    // --- RENDERIZAÇÃO DE LOADING (SKELETON) ---
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden w-full max-w-full transition-colors">
                {/* Desktop Skeleton */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left table-fixed">
                        <thead className="bg-[#021D34] dark:bg-slate-950 text-white">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={col.key || idx} className="p-4 font-semibold">
                                        {col.label}
                                    </th>
                                ))}
                                {actions && <th className="p-4 text-center w-32">Ações</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
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
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
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
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                {emptyMsg || 'Nenhum registro encontrado.'}
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden w-full max-w-full transition-colors">
            
            {/* --- VISÃO DESKTOP (TABELA TRADICIONAL) --- */}
            <div className={`hidden md:block overflow-x-auto`}>
                <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-[#021D34] dark:bg-slate-950 text-white">
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
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sortedData.map((row, i) => (
                            <tr key={row.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                {columns.map((col, idx) => (
                                    <td key={col.key || idx} className={`p-4 text-slate-700 dark:text-slate-300 ${col.className ? col.className : 'truncate max-w-[200px]'}`}>
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
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sortedData.map((row, i) => (
                            <div key={row.id || i} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors w-full max-w-full overflow-hidden">
                                {mobileRender(row)}
                                {actions && (
                                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                                        {actions(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    // Fallback Genérico Mobile
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sortedData.map((row, i) => (
                            <div key={row.id || i} className="p-4 space-y-2 w-full max-w-full overflow-hidden">
                                {columns.map((col, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm gap-4">
                                        <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">{col.label}</span>
                                        <div className="text-right truncate min-w-0 flex-1 text-slate-700 dark:text-slate-200">
                                            {col.render ? col.render(row) : row[col.key]}
                                        </div>
                                    </div>
                                ))}
                                {actions && (
                                    <div className="flex justify-end pt-2 mt-2 border-t border-slate-100 dark:border-slate-700 gap-2">
                                        {actions(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};

export default DataTable;