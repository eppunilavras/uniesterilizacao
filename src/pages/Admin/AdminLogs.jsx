import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs 
} from 'firebase/firestore';
import { 
  Search, 
  RotateCw, 
  ArrowDown, 
  Loader2 
} from 'lucide-react';

// Imports internos (Voltando 2 níveis)
import { db, appId } from '../../config/firebase';
import { formatDate } from '../../utils/formatters';
import { LOG_TYPES, LOG_COLORS } from '../../constants';
import DataTable from '../../components/DataTable';

export default function AdminLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [searchText, setSearchText] = useState('');
    
    // Estado que serve apenas como "gatilho" para recarregar
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Carregamento inicial e Refresh
    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            try {
                // Limpa estados anteriores para garantir uma lista fresca
                setHasMore(true); 
                setLogs([]); // Limpa visualmente antes de carregar
                
                const q = query(
                    collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), 
                    orderBy('timestamp', 'desc'), 
                    limit(50)
                );
                const s = await getDocs(q);
                
                setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLastDoc(s.docs[s.docs.length - 1]);
                if (s.docs.length < 50) setHasMore(false);
            } catch (error) {
                console.error("Erro ao carregar logs:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitial();
    }, [refreshTrigger]); // Roda sempre que o número do trigger mudar

    // Função Carregar Mais (Paginação)
    const loadMore = async () => {
        if (!lastDoc) return;
        setLoadingMore(true);
        try {
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), 
                orderBy('timestamp', 'desc'), 
                startAfter(lastDoc),
                limit(50)
            );
            const s = await getDocs(q);
            
            if (!s.empty) {
                const newLogs = s.docs.map(d => ({ id: d.id, ...d.data() }));
                setLogs(prev => [...prev, ...newLogs]);
                setLastDoc(s.docs[s.docs.length - 1]);
                if (s.docs.length < 50) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Erro ao carregar mais logs:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Filtro no Front-end (filtra apenas o que já foi baixado)
    const filteredLogs = logs.filter(l => {
        const matchesType = filterType === 'all' || l.type === filterType;
        const matchesText = searchText === '' || 
            (l.message && l.message.toLowerCase().includes(searchText.toLowerCase())) ||
            (l.userName && l.userName.toLowerCase().includes(searchText.toLowerCase())) ||
            (l.type && l.type.toLowerCase().includes(searchText.toLowerCase()));
        return matchesType && matchesText;
    });

    // Função do Botão de Atualizar
    const handleRefresh = () => {
        setLogs([]); // Limpa visualmente para dar feedback imediato
        setLastDoc(null);
        setRefreshTrigger(prev => prev + 1); // Muda o número, forçando o useEffect a rodar
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input 
                            className="w-full pl-10 p-2 border rounded-lg text-sm focus:border-[#009DE0] outline-none" 
                            placeholder="Filtrar nos logs carregados..." 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>
                    {/* Botão de Atualizar Manual */}
                    <button 
                        onClick={handleRefresh} 
                        className="p-2 border rounded-lg hover:bg-slate-50 text-slate-500 active:scale-95 transition-transform"
                        title="Atualizar Lista Agora"
                    >
                        <RotateCw size={18}/>
                    </button>
                </div>
                <select 
                    className="p-2 border rounded-lg text-sm bg-white outline-none w-full md:w-auto" 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="all">Todos os Tipos</option>
                    {Object.keys(LOG_TYPES).map(t => (
                        <option key={t} value={t}>{LOG_TYPES[t]}</option>
                    ))}
                </select>
            </div>

            <DataTable 
                columns={[
                    { 
                        key: 'timestamp', 
                        label: 'Data/Hora', 
                        sortable: true, 
                        width: '150px', // Define largura fixa
                        render: (l) => formatDate(l.timestamp) 
                    },
                    { 
                        key: 'type', 
                        label: 'Tipo', 
                        sortable: true, 
                        width: '120px', // Define largura fixa
                        render: (l) => <span className={`text-[10px] font-bold px-2 py-1 rounded border ${LOG_COLORS[l.type] || 'bg-slate-100'}`}>{LOG_TYPES[l.type] || l.type}</span> 
                    },
                    { 
                        key: 'message', 
                        label: 'Descrição', 
                        sortable: true,
                        // Configuração para quebrar o texto e não cortar
                        className: 'whitespace-pre-wrap break-words text-xs leading-relaxed',
                        render: (l) => (
                            <span title={l.message}>
                                {l.message}
                            </span>
                        )
                    },
                    { 
                        key: 'userName', 
                        label: 'Usuário', 
                        sortable: true,
                        width: '180px' // Define largura fixa
                    }
                ]}
                data={filteredLogs}
                mobileRender={(l) => (
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-400">{formatDate(l.timestamp)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${LOG_COLORS[l.type] || 'bg-slate-100'}`}>{LOG_TYPES[l.type] || l.type}</span>
                        </div>
                        <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap break-words">{l.message}</p>
                        <p className="text-xs text-slate-500">Por: {l.userName}</p>
                    </div>
                )}
                emptyMsg={loading ? 'Carregando auditoria...' : 'Nenhum log encontrado.'}
            />

            {/* Botão Carregar Mais */}
            {!loading && hasMore && filteredLogs.length > 0 && (
                <div className="flex justify-center pt-2">
                    <button 
                        onClick={loadMore} 
                        disabled={loadingMore}
                        className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                        {loadingMore ? 'Buscando...' : 'Carregar logs mais antigos'}
                    </button>
                </div>
            )}
            
            {!loading && !hasMore && logs.length > 0 && (
                <p className="text-center text-xs text-slate-400 pt-2">Todos os registros foram carregados.</p>
            )}
        </div>
    );
}