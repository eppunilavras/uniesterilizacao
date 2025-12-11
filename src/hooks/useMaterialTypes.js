import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export function useMaterialTypes() {
    return useQuery({
        queryKey: ['materialTypes'],
        queryFn: async () => {
            const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },
        staleTime: 1000 * 60 * 60, // Cache longo (1 hora), pois tipos mudam pouco
    });
}