import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, startAt, endAt, limit, getDocs } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export function useUserSearch(searchTerm) {
    return useQuery({
        queryKey: ['users', searchTerm], // Chave única do cache
        queryFn: async () => {
            if (!searchTerm || searchTerm.length < 3) return [];

            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const cleanSearch = searchTerm.replace(/\D/g, ''); 
            const isNumericSearch = cleanSearch.length > 2; 
            
            let q;
            if (isNumericSearch) {
                // Busca por CPF
                q = query(usersRef, where('role', '==', 'student'), orderBy('cpf'), startAt(cleanSearch), endAt(cleanSearch + '\uf8ff'), limit(5));
            } else {
                // Busca por Nome
                q = query(usersRef, where('role', '==', 'student'), orderBy('name'), startAt(searchTerm), endAt(searchTerm + '\uf8ff'), limit(5));
            }

            const snap = await getDocs(q);
            return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        },
        enabled: searchTerm.length >= 3, // Só dispara se tiver 3+ caracteres
        staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    });
}