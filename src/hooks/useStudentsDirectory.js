import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export function useStudentsDirectory({ enabled = true } = {}) {
    return useQuery({
        queryKey: ['students_full_directory_v2'], 
        
        // Só executa se o componente pai permitir
        enabled: enabled,

        queryFn: async () => {
            try {
                // ESTRATÉGIA SIMPLIFICADA (Para evitar erros de índice):
                // 1. Buscamos APENAS pelo papel 'student'. Isso usa o índice automático padrão.
                const q = query(
                    collection(db, 'artifacts', appId, 'public', 'data', 'users_directory'),
                    where('role', '==', 'student')
                );
                
                const snap = await getDocs(q);
                
                // 2. Fazemos a filtragem de 'active' e ordenação por 'name' via JavaScript (Client-side)
                // Isso é extremamente rápido para listas de até alguns milhares de alunos e infalível.
                const data = snap.docs
                    .map(d => ({ uid: d.id, ...d.data() }))
                    .filter(student => student.active === true) // Filtra apenas ativos
                    .sort((a, b) => {
                        // Ordenação segura (trata nomes nulos ou minúsculas/maiúsculas)
                        const nameA = (a.name || '').toLowerCase();
                        const nameB = (b.name || '').toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return 0;
                    });
                
                console.log(`[CACHE] Diretório baixado e processado: ${data.length} alunos ativos.`);
                return data;

            } catch (error) {
                console.error("Erro CRÍTICO ao baixar diretório de alunos:", error);
                throw error;
            }
        },
        
        // --- CONFIGURAÇÃO DE CACHE ---
        staleTime: Infinity, 
        cacheTime: 1000 * 60 * 60 * 24, 
        networkMode: 'offlineFirst',
        refetchOnMount: false, 
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
    });
}