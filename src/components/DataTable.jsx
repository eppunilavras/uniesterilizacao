import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

/**
 * Componente de Tabela de Dados Universal
 * * @param {Array} columns - Configuração das colunas [{ key, label, sortable, render }]
 * @param {Array} data - Array de objetos com os dados a serem exibidos
 * @param {Function} actions - (Opcional) Função que retorna botões de ação (JSX) para cada linha
 * @param {string} emptyMsg - Mensagem para exibir quando não há dados
 * @param {Function} mobileRender - (Opcional) Função que retorna o layout de Card para mobile
 */
const DataTable = ({ columns, data, actions, emptyMsg, mobileRender }) => {
    const [page, setPage] = useState(1);
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const itemsPerPage = 10;

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

    // --- PAGINAÇÃO ---
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const currentData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const handleSort = (key) => {
        if (sortCol === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortCol(key); setSortDir('asc'); }
    };

    // Reseta para a página 1 sempre que os dados mudam (ex: ao filtrar)
    useEffect(() => { setPage(1); }, [data.length]);

    // --- RENDERIZAÇÃO DE ESTADO VAZIO ---
    if (currentData.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                {emptyMsg || 'Nenhum registro encontrado.'}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* --- VISÃO DESKTOP (TABELA TRADICIONAL) --- */}
            <div className={`hidden md:block overflow-x-auto`}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#021D34] text-white">
                        <tr>
                            {columns.map((col, idx) => (
                                <th 
                                    key={col.key || idx} 
                                    onClick={() => col.sortable && handleSort(col.key)} 
                                    className={`p-4 font-semibold ${col.sortable ? 'cursor-pointer hover:bg-white/10 select-none' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        {sortCol === col.key && (
                                            sortDir === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>
                                        )}
                                    </div>
                                </th>
                            ))}
                            {actions && <th className="p-4 text-center">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {currentData.map((row, i) => (
                            <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                                {columns.map((col, idx) => (
                                    <td key={col.key || idx} className="p-4 text-slate-700">
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
                        {currentData.map((row, i) => (
                            <div key={row.id || i} className="p-4 hover:bg-slate-50 transition-colors">
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
                    // Fallback Genérico (Caso mobileRender não seja passado)
                    <div className="divide-y divide-slate-100">
                        {currentData.map((row, i) => (
                            <div key={row.id || i} className="p-4 space-y-2">
                                {columns.map((col, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-500">{col.label}</span>
                                        <div className="text-right">
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

            {/* --- PAGINAÇÃO (RODAPÉ) --- */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <span className="text-xs text-slate-500">
                        Pág {page}/{totalPages} ({sortedData.length} itens)
                    </span>
                    <div className="flex gap-2">
                        <button 
                            disabled={page === 1} 
                            onClick={() => setPage(p => p - 1)} 
                            className="p-2 border rounded hover:bg-white disabled:opacity-50 text-slate-600"
                        >
                            <ChevronLeft size={16}/>
                        </button>
                        <button 
                            disabled={page === totalPages} 
                            onClick={() => setPage(p => p + 1)} 
                            className="p-2 border rounded hover:bg-white disabled:opacity-50 text-slate-600"
                        >
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;