import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export function useMaterialTypes() {
    return useQuery({
        queryKey: ['materialTypes'],
        queryFn: async () => {
            const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Ordenação alfabética
            return data.sort((a, b) => a.name.localeCompare(b.name));
        },
        
        // --- CONFIGURAÇÃO AJUSTADA PARA ATUALIZAR NO LOGIN ---
        
        // 1. staleTime: 0 significa que os dados são considerados "velhos" imediatamente.
        // Isso força o React Query a tentar buscar novos dados sempre que o componente montar.
        staleTime: 0, 
        
        // 2. Mantemos o cache por 24h para garantir que funcione offline
        cacheTime: 1000 * 60 * 60 * 24, 
        
        // 3. 'offlineFirst': Tenta buscar no servidor (porque staleTime é 0).
        // Se falhar (sem internet), ele entrega os dados do cache silenciosamente sem dar erro.
        networkMode: 'offlineFirst', 
        
        // 4. Garante a busca ao montar o componente (Login/MainLayout)
        refetchOnMount: true, 
        
        // 5. Evita recarregar só porque trocou de aba (economiza leituras)
        refetchOnWindowFocus: false 
    });
}