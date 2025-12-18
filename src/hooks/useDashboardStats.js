import { useQuery } from '@tanstack/react-query';
import { 
    collection, query, where, orderBy, getDocs 
} from 'firebase/firestore'; // REMOVIDO: select
import { db, appId } from '../config/firebase';

export function useDashboardStats({ userProfile, period, customStart, customEnd }) {
    return useQuery({
        // A chave inclui os filtros. Mudou o filtro = busca nova.
        queryKey: ['dashboard_stats', userProfile?.uid, period, customStart, customEnd],
        
        // --- CONFIGURAÇÃO DE CACHE ---
		staleTime: Infinity, // Os dados nunca ficam "velhos" automaticamente
        cacheTime: 1000 * 60 * 60 * 24, // Mantém na memória por 24 horas
        networkMode: 'offlineFirst', // Aceita dados do cache/offline
        refetchOnWindowFocus: false, 
        refetchOnMount: true, // Garante que verifique dados novos ao entrar na tela
        
        queryFn: async () => {
            // 1. Definir datas
            let startDate = new Date();
            let endDate = new Date(2100, 11, 31); 
            const now = new Date();

            // Ajuste do início do dia para garantir que pegue tudo do período
            if (period === '7d') startDate.setDate(now.getDate() - 7);
            if (period === '30d') startDate.setDate(now.getDate() - 30);
            if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
            if (period === 'custom') {
                if (!customStart) throw new Error("Data inicial necessária");
                // Corrige timezone do input date (YYYY-MM-DD) para horário local
                const [y, m, d] = customStart.split('-');
                startDate = new Date(y, m - 1, d);
                
                if (customEnd) {
                    const [yEnd, mEnd, dEnd] = customEnd.split('-');
                    endDate = new Date(yEnd, mEnd - 1, dEnd);
                    endDate.setHours(23, 59, 59, 999);
                }
            }

            if (period !== 'custom') startDate.setHours(0,0,0,0);

            // 2. Query
            const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
            
            const constraints = [
                where('createdAt', '>=', startDate), 
                where('createdAt', '<=', endDate)
            ];

            if (userProfile.role === 'student') {
                constraints.push(where('studentId', '==', userProfile.uid));
            }

            // Ordena para os gráficos
            constraints.push(orderBy('createdAt', 'desc'));

            // NOTA: O SDK Web do Firebase não suporta 'select' (projeção). 
            // Ele baixa o documento completo. A otimização fica por conta do cache (staleTime).

            const q = query(itemsRef, ...constraints);
            
            // Usa getDocs padrão para ler cache local + servidor
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(d => d.data());

            // 3. Processamento em Memória
            const newCounts = { rec: 0, em: 0, pront: 0, ret: 0 };
            const typeCount = {};
            const dailyCount = {};
            const studentCount = {};

            docs.forEach(item => {
                // Contadores
                if(item.status === 'recebido') newCounts.rec++;
                if(item.status === 'em_esterilizacao') newCounts.em++;
                if(item.status === 'pronto') newCounts.pront++;
                if(item.status === 'retirado') newCounts.ret++;

                // Dados para Gráficos
                const dateObj = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                
                // Por Tipo
                if (item.type) {
                    typeCount[item.type] = (typeCount[item.type] || 0) + 1;
                }

                // Por Dia
                const dayKey = dateObj.toLocaleDateString('pt-BR');
                dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;

                // Por Aluno (Top Students)
                if (userProfile.role !== 'student' && item.studentName) {
                    studentCount[item.studentName] = (studentCount[item.studentName] || 0) + 1;
                }
            });

            // 4. Formatação para Recharts
            const typesData = Object.entries(typeCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a,b) => b.value - a.value);
            
            // Ordena cronologicamente
            const timelineData = Object.entries(dailyCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a,b) => {
                    const [da, ma, ya] = a.name.split('/');
                    const [db, mb, yb] = b.name.split('/');
                    return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
                });
            
            const topStudentsData = Object.entries(studentCount)
                .map(([name, value]) => ({ name, value }))
                .sort((a,b) => b.value - a.value)
                .slice(0, 5);

            // Insights
            const newInsights = [];
            if (typesData.length > 0) newInsights.push(`Material mais comum no período: "${typesData[0].name}".`);
            if (timelineData.length > 0) newInsights.push(`Pico de atividade em: ${timelineData.reduce((a, b) => a.value > b.value ? a : b).name}.`);
            newInsights.push(`Total de ${docs.length} registros analisados.`);

            return {
                current: newCounts,
                types: typesData,
                timeline: timelineData,
                topStudents: topStudentsData,
                insights: newInsights,
                lastUpdated: new Date()
            };
        }
    });
}