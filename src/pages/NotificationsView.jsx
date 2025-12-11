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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#021D34] flex items-center gap-2 w-full md:w-auto">
                    <Bell className="text-[#009DE0]"/> Meus Avisos
                </h2>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                    <input 
                        className="w-full pl-10 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" 
                        placeholder="Pesquisar avisos..." 
                        value={search} 
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            <div className="space-y-4">
                {paginated.length > 0 ? paginated.map(n => (
                    <div key={n.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-[#021D34]">{n.title}</h4>
                            <span className="text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{n.message}</p>
                    </div>
                )) : (
                    <div className="text-center py-12 text-slate-400">Nenhum aviso encontrado.</div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => p - 1)} 
                        className="p-2 bg-white border rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                        <ChevronLeft size={16}/>
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-600 font-medium">
                        Página {page} de {totalPages}
                    </span>
                    <button 
                        disabled={page === totalPages} 
                        onClick={() => setPage(p => p + 1)} 
                        className="p-2 bg-white border rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                        <ChevronRight size={16}/>
                    </button>
                </div>
            )}
        </div>
    );
}