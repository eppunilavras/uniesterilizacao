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
        
        // Tipos mudam raramente. Antes (staleTime 0) cada montagem de tela
        // relia a coleção; o botão de atualizar da Recepção força a busca.
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 24,
        networkMode: 'offlineFirst',
        refetchOnWindowFocus: false 
    });
}