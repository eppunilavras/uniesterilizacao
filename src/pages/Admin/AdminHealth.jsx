import React from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { 
  Activity, 
  Database, 
  Users, 
  FileText, 
  HardDrive, 
  Loader2, 
  AlertCircle,
  RotateCw,
  Megaphone
} from 'lucide-react';
import { db, appId } from '../../config/firebase';

export default function AdminHealth() {
    // Hook do React Query configurado para NÃO iniciar automaticamente
    const { data: health, isLoading, error, refetch, isFetched, isRefetching } = useQuery({
        queryKey: ['system_health_metrics'],
        queryFn: async () => {
            const collections = [
                { id: 'items', ref: collection(db, 'artifacts', appId, 'public', 'data', 'items') },
                { id: 'users', ref: collection(db, 'artifacts', appId, 'public', 'data', 'users_directory') },
                { id: 'logs', ref: collection(db, 'artifacts', appId, 'public', 'data', 'system_logs') },
                { id: 'announcements', ref: collection(db, 'artifacts', appId, 'public', 'data', 'announcements') }
            ];

            const results = {};
            
            // Executa contagens otimizadas no servidor (getCountFromServer)
            for (const col of collections) {
                const snapshot = await getCountFromServer(col.ref);
                results[col.id] = snapshot.data().count;
            }

            // Métrica extra: Usuários Ativos
            const activeUsersQuery = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'users_directory'), 
                where('active', '==', true)
            );
            const activeSnap = await getCountFromServer(activeUsersQuery);
            results['activeUsers'] = activeSnap.data().count;

            return results;
        },
        enabled: false, // Estratégia de economia: só carrega ao clicar
        staleTime: 1000 * 60 * 30, // Cache de 30 minutos após carregar
    });

    const metrics = isFetched ? [
        { label: 'Total de Materiais', value: health.items, icon: HardDrive, color: 'text-blue-500', bg: 'bg-blue-50' },
        { label: 'Utilizadores Registados', value: health.users, icon: Users, color: 'text-green-500', bg: 'bg-green-50' },
        { label: 'Utilizadores Ativos', value: health.activeUsers, icon: Activity, color: 'text-orange-500', bg: 'bg-orange-50' },
        { label: 'Logs de Auditoria', value: health.logs, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50' },
        { label: 'Recados Publicados', value: health.announcements, icon: Megaphone, color: 'text-pink-500', bg: 'bg-pink-50' },
    ] : [];

    // ESTADO INICIAL: Botão de Carregamento
    if (!isFetched && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-sm mb-4">
                    <Database className="text-[#009DE0] opacity-40" size={48}/>
                </div>
                <h3 className="text-[#021D34] dark:text-white font-bold text-lg mb-2">Monitorização de Dados</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs text-center mb-6">
                    As métricas de volume do sistema não são carregadas automaticamente para poupar créditos de leitura do Firebase.
                </p>
                <button 
                    onClick={() => refetch()} 
                    className="bg-[#009DE0] hover:bg-[#008bc5] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
                >
                    <RotateCw size={18}/> Calcular Métricas Agora
                </button>
            </div>
        );
    }

    // ESTADO DE CARREGAMENTO
    if (isLoading || isRefetching) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="animate-spin text-[#009DE0] mb-3" size={40}/>
                <p className="text-sm font-bold animate-pulse">A consultar o servidor Firebase...</p>
            </div>
        );
    }

    // ESTADO DE ERRO
    if (error) {
        return (
            <div className="p-8 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 flex flex-col items-center gap-3">
                <AlertCircle size={32}/>
                <p className="font-bold">Erro ao carregar métricas.</p>
                <button onClick={() => refetch()} className="text-xs underline font-bold uppercase">Tentar novamente</button>
            </div>
        );
    }

    // ESTADO DE RESULTADOS
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resumo de Armazenamento</p>
                <button 
                    onClick={() => refetch()} 
                    className="text-xs font-bold text-[#009DE0] flex items-center gap-1 hover:underline"
                >
                    <RotateCw size={12}/> Atualizar
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.map((m, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-blue-100 dark:hover:border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-2.5 rounded-xl ${m.bg} dark:bg-opacity-10`}>
                                <m.icon className={m.color} size={22}/>
                            </div>
                        </div>
                        <span className="block text-3xl font-bold text-[#021D34] dark:text-white tabular-nums tracking-tight">
                            {m.value.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{m.label}</span>
                    </div>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-5 rounded-2xl flex gap-4 transition-colors">
                <Database className="text-blue-500 shrink-0" size={24}/>
                <div className="space-y-1">
                    <p className="font-bold text-blue-900 dark:text-blue-200 text-sm">Nota sobre o consumo</p>
                    <p className="text-blue-800/70 dark:text-blue-300/60 text-xs leading-relaxed">
						Estas métricas representam o volume de documentos no Firestore. Leituras e escritas em tempo real (custos de faturamento) devem ser consultadas diretamente no <strong>Console do Firebase</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
}