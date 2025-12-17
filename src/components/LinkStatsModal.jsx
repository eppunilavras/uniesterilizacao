import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { X, Calendar, Activity, Loader2, AlertCircle } from 'lucide-react';
import { db, appId } from '../config/firebase';

export default function LinkStatsModal({ isOpen, onClose, linkData }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && linkData?.id) {
            fetchStats();
        }
    }, [isOpen, linkData]);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            // Busca os logs na subcoleção 'click_logs'
            const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'external_links', linkData.id, 'click_logs');
            const q = query(logsRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const logs = snapshot.docs.map(doc => ({
                ...doc.data(),
                date: doc.data().createdAt?.toDate() || new Date()
            }));

            setTotalLogs(logs.length);
            processChartData(logs);

        } catch (err) {
            console.error("Erro ao buscar estatísticas:", err);
            // Se der erro de permissão (ex: aluno tentando ver), mostramos msg amigável
            setError("Não foi possível carregar os detalhes. Talvez você não tenha permissão de visualização.");
        } finally {
            setLoading(false);
        }
    };

    const processChartData = (logs) => {
        // Agrupa por Mês/Ano
        const grouped = logs.reduce((acc, log) => {
            const key = log.date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Formata para o Recharts (e inverte para ordem cronológica se necessário)
        const chartData = Object.entries(grouped).map(([name, value]) => ({
            name,
            value
        })).reverse(); // Logs vêm DESC, então reverse põe o mês antigo primeiro (esquerda)

        setStats(chartData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#021D34]/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header do Modal */}
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-[#009DE0]">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">{linkData?.name}</h3>
                            <p className="text-xs text-slate-500">Relatório de Acessos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="animate-spin" size={32} />
                            <p className="text-sm">Analisando dados...</p>
                        </div>
                    ) : error ? (
                        <div className="h-64 flex flex-col items-center justify-center text-red-500 gap-3 bg-red-50 rounded-xl border border-red-100">
                            <AlertCircle size={32} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Resumo Rápido */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                                        <Activity size={14}/> Total de Cliques
                                    </span>
                                    <p className="text-2xl font-black text-[#021D34] mt-1">{totalLogs}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <Calendar size={14}/> Período
                                    </span>
                                    <p className="text-sm font-medium text-slate-700 mt-2">
                                        {stats.length > 0 ? `${stats[0].name} - ${stats[stats.length-1].name}` : 'Sem dados'}
                                    </p>
                                </div>
                            </div>

                            {/* Gráfico */}
                            <div className="h-64 w-full">
                                {stats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis 
                                                dataKey="name" 
                                                tick={{ fill: '#64748B', fontSize: 11 }} 
                                                axisLine={false} 
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                tick={{ fill: '#64748B', fontSize: 11 }} 
                                                axisLine={false} 
                                                tickLine={false} 
                                            />
                                            <Tooltip 
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="value" name="Acessos" fill="#009DE0" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                        Nenhum acesso registrado ainda.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}