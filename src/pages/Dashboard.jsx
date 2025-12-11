import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { 
  Activity, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  CheckSquare, 
  TrendingUp, 
  Lightbulb, 
  BarChart3, 
  UserCog 
} from 'lucide-react';

// Imports internos
import { db, appId } from '../config/firebase';
import StatCard from '../components/StatCard'; 

const COLORS = ['#009DE0', '#021D34', '#F97316', '#22C55E', '#64748B'];

export default function Dashboard({ userProfile }) {
    const [stats, setStats] = useState({ 
        current: { rec:0, em:0, pront:0, ret:0 }, 
        previous: { rec:0, em:0, pront:0, ret:0 },
        types: [],
        timeline: [],
        topStudents: [] 
    });
    const [anns, setAnns] = useState([]);
    const [period, setPeriod] = useState('7d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [insights, setInsights] = useState([]);
    
    // --- Recados (Otimizado: Limitado aos últimos 10) ---
    useEffect(() => {
        const now = new Date();
        // Traz apenas anúncios ativos ou recentes para não ler o banco todo
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

    // --- Dados Principais (CORREÇÃO DE LEITURA: Filtro no Banco) ---
    useEffect(() => {
        let startDate = new Date();
        let endDate = new Date(2100, 11, 31); // Futuro distante
        const now = new Date();

        // Configuração das datas de filtro
        if (period === '7d') startDate.setDate(now.getDate() - 7);
        if (period === '30d') startDate.setDate(now.getDate() - 30);
        if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
        if (period === 'custom') {
            if (!customStart) return; // Não busca se não tiver data
            startDate = new Date(customStart);
            if (customEnd) endDate = new Date(customEnd + 'T23:59:59');
        }

        // Zera as horas para garantir comparação correta do dia
        if (period !== 'custom') startDate.setHours(0,0,0,0);

        // Montagem da Query Otimizada
        let constraints = [
            orderBy('createdAt', 'desc') // Ordena por data
        ];

        // Adiciona filtros de segurança
        // Nota: O Firestore exige que o filtro de intervalo (<, >) seja no mesmo campo do orderBy
        constraints.push(where('createdAt', '>=', startDate));
        constraints.push(where('createdAt', '<=', endDate));

        if (userProfile.role === 'student') {
            constraints.push(where('studentId', '==', userProfile.uid));
        }

        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
            ...constraints
        );

        const unsubItems = onSnapshot(q, (s) => {
            processData(s.docs);
        }, (error) => {
            console.error("Erro no Dashboard (Provavelmente falta índice):", error);
            // Se der erro de índice, o console mostrará o link para criar.
        });

        return () => unsubItems();
    }, [userProfile, period, customStart, customEnd]);

    const processData = (docs) => {
        const counts = { rec:0, em:0, pront:0, ret:0 };
        const typeCount = {};
        const dailyCount = {};
        const studentCount = {};

        docs.forEach(d => {
            const data = d.data();
            // A data já foi filtrada no banco, podemos confiar
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

            if (data.status === 'recebido') counts.rec++;
            if (data.status === 'em_esterilizacao') counts.em++;
            if (data.status === 'pronto') counts.pront++;
            if (data.status === 'retirado') counts.ret++;

            typeCount[data.type] = (typeCount[data.type] || 0) + 1;

            const dayKey = date.toLocaleDateString('pt-BR');
            dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;

            if (userProfile.role !== 'student') {
                studentCount[data.studentName] = (studentCount[data.studentName] || 0) + 1;
            }
        });

        const typesData = Object.entries(typeCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        const timelineData = Object.entries(dailyCount).map(([name, value]) => ({ name, value })).sort((a,b) => {
            const [da, ma, ya] = a.name.split('/');
            const [db, mb, yb] = b.name.split('/');
            return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
        });
        const topStudentsData = Object.entries(studentCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);

        const newInsights = [];
        if (typesData.length > 0) newInsights.push(`Material mais comum: "${typesData[0].name}" (${typesData[0].value} itens).`);
        if (timelineData.length > 0) {
            const busiestDay = timelineData.reduce((prev, current) => (prev.value > current.value) ? prev : current);
            newInsights.push(`Pico de movimento: ${busiestDay.name} (${busiestDay.value} itens).`);
        }
        if (userProfile.role === 'student' && counts.ret > 0) {
            newInsights.push(`Você já retirou ${counts.ret} materiais.`);
        }

        setStats({
            current: counts,
            previous: { rec:0, em:0, pront:0, ret:0 }, 
            types: typesData,
            timeline: timelineData,
            topStudents: topStudentsData
        });
        setInsights(newInsights);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[#021D34]">Olá, {userProfile.name.split(' ')[0]}</h2>
                    <p className="text-slate-500 flex items-center gap-2">
                        <Activity size={16}/> Resumo em tempo real da central de esterilização.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-lg border shadow-sm w-full md:w-auto">
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-2 bg-slate-50 border rounded text-sm outline-none focus:border-[#009DE0] font-medium text-slate-700 w-full md:w-auto">
                        <option value="7d">Últimos 7 dias</option>
                        <option value="30d">Últimos 30 dias</option>
                        <option value="year">Este Ano</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    
                    {period === 'custom' && (
                        <div className="flex gap-2">
                            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="p-2 border rounded text-sm"/>
                            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="p-2 border rounded text-sm"/>
                        </div>
                    )}
                </div>
            </div>

            {anns.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {anns.map(a => (
                        <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full">
                            {a.imageUrl ? (
                                <div className="h-32 overflow-hidden relative shrink-0">
                                    <img src={a.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Aviso" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                    <span className="absolute bottom-2 left-3 text-white text-xs font-bold bg-[#009DE0] px-2 py-0.5 rounded shadow">Comunicado</span>
                                </div>
                            ) : (
                                <div className="h-2 bg-[#009DE0] w-full shrink-0"/>
                            )}
                            <div className="p-5 flex-1 flex flex-col">
                                <h4 className="font-bold text-[#021D34] text-lg mb-2">{a.title}</h4>
                                <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap mb-2">{a.content}</p>
                                
                                {userProfile.role === 'admin' && (a.validUntil || a.validFrom) && (
                                    <div className="mt-auto pt-3 border-t flex items-center gap-2 text-xs text-slate-400">
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Recebidos" count={stats.current.rec} icon={Clock} color="text-slate-600" bg="bg-slate-100" />
                <StatCard title="Em Processo" count={stats.current.em} icon={AlertCircle} color="text-orange-600" bg="bg-orange-50" />
                <StatCard title="Prontos" count={stats.current.pront} icon={CheckCircle2} color="text-green-600" bg="bg-green-50" />
                <StatCard title="Retirados" count={stats.current.ret} icon={CheckSquare} color="text-[#009DE0]" bg="bg-blue-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-[#021D34] mb-6 flex items-center gap-2">
                        <TrendingUp className="text-[#009DE0]"/> Fluxo de Entrada ({period === 'custom' ? 'Período' : period})
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.timeline}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#009DE0" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#009DE0" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} minTickGap={30}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}}/>
                                <Tooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    formatter={(value) => [value, "Quantidade"]}
                                />
                                <Area type="monotone" dataKey="value" stroke="#009DE0" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-[#021D34] to-[#009DE0] p-6 rounded-2xl shadow-lg text-white">
                        <h3 className="font-bold flex items-center gap-2 mb-4 text-white/90">
                            <Lightbulb className="text-yellow-400"/> Insights
                        </h3>
                        <ul className="space-y-3 text-sm text-white/80">
                            {insights.length > 0 ? insights.map((ins, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="mt-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"/>
                                    {ins}
                                </li>
                            )) : (
                                <li>Sem dados suficientes no período.</li>
                            )}
                        </ul>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px] flex flex-col">
                        <h3 className="font-bold text-[#021D34] mb-2 flex items-center gap-2">
                            <BarChart3 className="text-[#009DE0]"/> Por Tipo
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={stats.types.slice(0, 10)}
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0"/>
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={100} 
                                        tick={{fill: '#64748B', fontSize: 10}}
                                        interval={0}
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#F1F5F9'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        formatter={(value) => [value, "Quantidade"]}
                                    />
                                    <Bar dataKey="value" fill="#009DE0" radius={[0, 4, 4, 0]} barSize={16}>
                                        {stats.types.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {userProfile.role !== 'student' && stats.topStudents.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-[#021D34] mb-6 flex items-center gap-2">
                        <UserCog className="text-[#009DE0]"/> Top 5 Alunos Mais Ativos
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topStudents} layout="vertical" margin={{left: 20}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0"/>
                                <XAxis type="number" hide/>
                                <YAxis dataKey="name" type="category" width={150} tick={{fill: '#64748B', fontSize: 12}}/>
                                <Tooltip 
                                    cursor={{fill: '#F1F5F9'}} 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    formatter={(value, name, props) => [value, "Materiais"]}
                                />
                                <Bar dataKey="value" fill="#009DE0" radius={[0, 4, 4, 0]} barSize={20}>
                                    { stats.topStudents.map((entry, index) => <Cell key={`cell-${index}`} fill={['#009DE0', '#021D34', '#F97316', '#22C55E', '#64748B'][index % 5]} />) }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}