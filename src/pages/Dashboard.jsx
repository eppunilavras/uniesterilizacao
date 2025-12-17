import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, limit, onSnapshot 
} from 'firebase/firestore';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';
import { 
  Activity, Clock, AlertCircle, CheckCircle2, 
  CheckSquare, TrendingUp, Lightbulb, BarChart3, 
  UserCog, RotateCw, Loader2, Calendar
} from 'lucide-react';

// Imports internos
import { db, appId } from '../config/firebase';
import StatCard from '../components/StatCard'; 
import Skeleton from '../components/Skeleton';
import { useDashboardStats } from '../hooks/useDashboardStats'; 

const COLORS = ['#009DE0', '#021D34', '#F97316', '#22C55E', '#64748B'];

export default function Dashboard({ userProfile }) {
    const [period, setPeriod] = useState('7d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [anns, setAnns] = useState([]);

    // --- HOOK COM CACHE AGRESSIVO ---
    const { 
        data: stats, 
        isLoading, 
        refetch, 
        isRefetching 
    } = useDashboardStats({ userProfile, period, customStart, customEnd });

    // --- Recados (Mantido em Tempo Real) ---
    useEffect(() => {
        const now = new Date();
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), 
            orderBy('createdAt', 'desc'),
            limit(10) 
        );

        const unsubAnn = onSnapshot(q, (s) => {
            const all = s.docs.map(d => ({id: d.id, ...d.data()}));
            const active = all.filter(a => {
                const start = a.validFrom ? new Date(a.validFrom) : null;
                const end = a.validUntil ? new Date(a.validUntil) : null;
                if (start && now < start) return false;
                if (end && now > end) return false;
                return true;
            });
            setAnns(active);
        });
        return () => unsubAnn();
    }, []);

    // Helper para evitar erro de undefined enquanto carrega
    const safeStats = stats || { 
        current: { rec:0, em:0, pront:0, ret:0 }, 
        types: [], timeline: [], topStudents: [], insights: [],
        lastUpdated: new Date()
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 w-full max-w-full overflow-x-hidden">
            {/* Header e Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-[#021D34] dark:text-white transition-colors">
                        Olá, {userProfile.name.split(' ')[0]}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 text-sm md:text-base transition-colors">
                        <Activity size={16}/> Visão geral da central.
                        
                        {!isLoading && stats && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-2 border-l border-slate-300 dark:border-slate-700 pl-2 flex items-center gap-1">
                                Última verificação: 
                                <span className="font-bold text-slate-600 dark:text-slate-300">
                                    {stats.lastUpdated.toLocaleString('pt-BR', { 
                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                                    })}
                                </span>
                            </span>
                        )}
                    </p>
                </div>
                
                {/* Barra de Filtros - Adaptada Dark Mode */}
                <div className="flex flex-col sm:flex-row gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto items-center transition-colors">
                    <select 
                        value={period} 
                        onChange={(e) => setPeriod(e.target.value)} 
                        className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:border-[#009DE0] dark:focus:border-[#009DE0] font-medium text-slate-700 dark:text-slate-200 w-full md:w-auto transition-colors"
                    >
                        <option value="7d">Últimos 7 dias</option>
                        <option value="30d">Últimos 30 dias</option>
                        <option value="year">Este Ano</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    
                    {period === 'custom' && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <input 
                                type="date" 
                                value={customStart} 
                                onChange={e=>setCustomStart(e.target.value)} 
                                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm w-full text-slate-700 dark:text-slate-200 outline-none focus:border-[#009DE0]"
                            />
                            <input 
                                type="date" 
                                value={customEnd} 
                                onChange={e=>setCustomEnd(e.target.value)} 
                                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-sm w-full text-slate-700 dark:text-slate-200 outline-none focus:border-[#009DE0]"
                            />
                        </div>
                    )}

                    <button 
                        onClick={() => refetch()} 
                        disabled={isLoading || isRefetching}
                        className={`p-2 rounded text-white transition-all disabled:opacity-50 ${isRefetching ? 'bg-[#009DE0] ring-2 ring-blue-200 dark:ring-blue-900' : 'bg-[#021D34] dark:bg-slate-700 hover:bg-[#009DE0] dark:hover:bg-[#009DE0]'}`}
                        title="Atualizar Dados Agora"
                    >
                        {(isLoading || isRefetching) ? <Loader2 className="animate-spin" size={18}/> : <RotateCw size={18}/>}
                    </button>
                </div>
            </div>

            {/* Announcements (Recados) - Adaptado Dark Mode */}
            {anns.length > 0 && (
                <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {anns.map(a => (
                        <div key={a.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all group relative flex flex-col h-full">
                            {a.imageUrl ? (
                                <div className="h-32 overflow-hidden relative shrink-0">
                                    <img src={a.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Aviso" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                    <span className="absolute bottom-2 left-3 text-white text-xs font-bold bg-[#009DE0] px-2 py-0.5 rounded shadow">Comunicado</span>
                                </div>
                            ) : (
                                <div className="h-2 bg-[#009DE0] w-full shrink-0"/>
                            )}
                            <div className="p-4 md:p-5 flex-1 flex flex-col">
                                <h4 className="font-bold text-[#021D34] dark:text-white text-lg mb-2">{a.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap mb-2">{a.content}</p>
                                
                                {userProfile.role === 'admin' && (a.validUntil || a.validFrom) && (
                                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                        <Clock size={12}/>
                                        <span>
                                            {a.validFrom ? new Date(a.validFrom).toLocaleDateString() : 'Agora'} até {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Sempre'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* StatCards - Passando cores Dark Mode */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {isLoading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
                            <div className="flex justify-between items-start mb-4">
                                <Skeleton className="w-12 h-12 rounded-xl" />
                            </div>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    ))
                ) : (
                    <>
                        <StatCard 
                            title="Recebidos" 
                            count={safeStats.current.rec} 
                            icon={Clock} 
                            color="text-slate-600 dark:text-slate-300" 
                            bg="bg-slate-100 dark:bg-slate-700/50" 
                        />
                        <StatCard 
                            title="Em Processo" 
                            count={safeStats.current.em} 
                            icon={AlertCircle} 
                            color="text-orange-600 dark:text-orange-400" 
                            bg="bg-orange-50 dark:bg-orange-900/20" 
                        />
                        <StatCard 
                            title="Prontos" 
                            count={safeStats.current.pront} 
                            icon={CheckCircle2} 
                            color="text-green-600 dark:text-green-400" 
                            bg="bg-green-50 dark:bg-green-900/20" 
                        />
                        <StatCard 
                            title="Retirados" 
                            count={safeStats.current.ret} 
                            icon={CheckSquare} 
                            color="text-[#009DE0] dark:text-sky-400" 
                            bg="bg-blue-50 dark:bg-sky-900/20" 
                        />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* AreaChart Container */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full min-w-0 flex flex-col transition-colors">
                    <h3 className="font-bold text-[#021D34] dark:text-white mb-6 flex items-center gap-2 text-sm md:text-base">
                        <TrendingUp className="text-[#009DE0]"/> Fluxo Recente ({safeStats.timeline.length} dias)
                    </h3>
                    <div className="h-64 md:h-72 w-full min-w-0 flex-1 relative" style={{ minHeight: '250px' }}>
                        {isLoading ? (
                            <Skeleton className="w-full h-full rounded-lg" />
                        ) : (
                            <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={safeStats.timeline}>
                                        <defs>
                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#009DE0" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#009DE0" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#94a3b8', fontSize: 10}} 
                                            dy={10} 
                                            minTickGap={30}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{fill: '#94a3b8', fontSize: 10}}
                                        />
                                        <Tooltip 
                                            contentStyle={{
                                                borderRadius: '12px', 
                                                border: 'none', 
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)', // Mantendo fundo claro no tooltip para contraste
                                                color: '#1e293b'
                                            }}
                                            formatter={(value) => [value, "Quantidade"]}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#009DE0" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6 w-full min-w-0">
                    {/* Insights */}
                    {isLoading ? (
                        <Skeleton className="h-40 w-full rounded-2xl" />
                    ) : (
                        <div className="bg-gradient-to-br from-[#021D34] to-[#009DE0] dark:from-slate-900 dark:to-slate-800 p-4 md:p-6 rounded-2xl shadow-lg text-white border border-transparent dark:border-slate-700">
                            <h3 className="font-bold flex items-center gap-2 mb-4 text-white/90 text-sm md:text-base">
                                <Lightbulb className="text-yellow-400"/> Insights
                            </h3>
                            <ul className="space-y-3 text-xs md:text-sm text-white/80">
                                {safeStats.insights.length > 0 ? safeStats.insights.map((ins, i) => (
                                    <li key={i} className="flex gap-2">
                                        <span className="mt-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"/>
                                        {ins}
                                    </li>
                                )) : (
                                    <li>Sem dados suficientes no período.</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* BarChart Container */}
                    <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-[300px] flex flex-col w-full min-w-0 relative transition-colors">
                        <h3 className="font-bold text-[#021D34] dark:text-white mb-2 flex items-center gap-2 text-sm md:text-base">
                            <BarChart3 className="text-[#009DE0]"/> Tipos (Amostra Recente)
                        </h3>
                        <div className="flex-1 w-full min-h-0 relative" style={{ minHeight: '200px' }}>
                             {isLoading ? (
                                <div className="space-y-3 pt-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-4 flex-1" />
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={safeStats.types.slice(0, 10)}
                                            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" strokeOpacity={0.2}/>
                                            <XAxis type="number" hide />
                                            <YAxis 
                                                dataKey="name" 
                                                type="category" 
                                                width={80} 
                                                tick={{fill: '#94a3b8', fontSize: 10}}
                                                interval={0}
                                            />
                                            <Tooltip 
                                                cursor={{fill: '#F1F5F9', opacity: 0.2}}
                                                contentStyle={{
                                                    borderRadius: '8px', 
                                                    border: 'none', 
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                }}
                                                formatter={(value) => [value, "Quantidade"]}
                                            />
                                            <Bar dataKey="value" fill="#009DE0" radius={[0, 4, 4, 0]} barSize={16}>
                                                {safeStats.types.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                             )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Students - Apenas para Admins/Techs */}
            {userProfile.role !== 'student' && safeStats.topStudents.length > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full min-w-0 transition-colors">
                    <h3 className="font-bold text-[#021D34] dark:text-white mb-6 flex items-center gap-2 text-sm md:text-base">
                        <UserCog className="text-[#009DE0]"/> Top Alunos (Atividade Recente)
                    </h3>
                    <div className="h-64 w-full min-w-0 relative">
                        {isLoading ? (
                             <div className="space-y-4 pt-4">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-6 flex-1" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={safeStats.topStudents} layout="vertical" margin={{left: 0}}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#94a3b8" strokeOpacity={0.2}/>
                                        <XAxis type="number" hide/>
                                        <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8', fontSize: 10}}/>
                                        <Tooltip 
                                            cursor={{fill: '#F1F5F9', opacity: 0.2}} 
                                            contentStyle={{
                                                borderRadius: '12px', 
                                                border: 'none', 
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                            }}
                                            formatter={(value) => [value, "Materiais"]}
                                        />
                                        <Bar dataKey="value" fill="#009DE0" radius={[0, 4, 4, 0]} barSize={20}>
                                            { safeStats.topStudents.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % 5]} />) }
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}