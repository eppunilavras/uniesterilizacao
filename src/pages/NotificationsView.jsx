import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Bell, 
  Search, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

// Imports internos
import { db, appId } from '../config/firebase';
import { formatDate } from '../utils/formatters';

export default function NotificationsView({ userProfile }) {
    const [notifs, setNotifs] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        // Busca as últimas 50 notificações do usuário logado
        const q = query(
            collection(db, 'artifacts', appId, 'users', userProfile.uid, 'notifications'), 
            orderBy('createdAt', 'desc'),
			limit(50)
        );
        const unsub = onSnapshot(q, s => setNotifs(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsub();
    }, [userProfile]);

    // Filtro local
    const filtered = notifs.filter(n => 
        n.title.toLowerCase().includes(search.toLowerCase()) || 
        n.message.toLowerCase().includes(search.toLowerCase())
    );

    // Paginação local
    const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    return (
        <div className="space-y-6 transition-colors">
            {/* Header de Busca */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                <h2 className="text-xl font-bold text-[#021D34] dark:text-white flex items-center gap-2 w-full md:w-auto transition-colors">
                    <Bell className="text-[#009DE0]"/> Meus Avisos
                </h2>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                    <input 
                        className="w-full pl-10 p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-[#009DE0] dark:focus:border-[#009DE0] bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors" 
                        placeholder="Pesquisar avisos..." 
                        value={search} 
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {/* Lista de Notificações */}
            <div className="space-y-4">
                {paginated.length > 0 ? paginated.map(n => (
                    <div key={n.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in slide-in-from-bottom-2 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-[#021D34] dark:text-white transition-colors">{n.title}</h4>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(n.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 transition-colors">{n.message}</p>
                    </div>
                )) : (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500 transition-colors">Nenhum aviso encontrado.</div>
                )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => p - 1)} 
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors"
                    >
                        <ChevronLeft size={16}/>
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-medium transition-colors">
                        Página {page} de {totalPages}
                    </span>
                    <button 
                        disabled={page === totalPages} 
                        onClick={() => setPage(p => p + 1)} 
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors"
                    >
                        <ChevronRight size={16}/>
                    </button>
                </div>
            )}
        </div>
    );
}