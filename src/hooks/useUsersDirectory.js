import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// Fonte única do users_directory para toda a aplicação. Antes cada tela baixava
// a coleção por conta própria (e a busca de usuários a cada tecla), o que
// estourava a cota diária de leituras do Firestore.
export const DIRECTORY_QUERY_KEY = ['users_directory'];

// O cache é persistido no IndexedDB (ver main.jsx), então Timestamps viram
// milissegundos para sobreviverem à serialização.
const normalizeEntry = (id, data) => ({
    uid: id,
    ...data,
    createdAt: data.createdAt?.toMillis?.() ?? (typeof data.createdAt === 'number' ? data.createdAt : null),
});

export function useUsersDirectory({ enabled = true, select } = {}) {
    return useQuery({
        queryKey: DIRECTORY_QUERY_KEY,
        enabled,
        select,
        queryFn: async () => {
            const snap = await getDocs(
                collection(db, 'artifacts', appId, 'public', 'data', 'users_directory')
            );
            return snap.docs.map((d) => normalizeEntry(d.id, d.data()));
        },
        // Recarregar a página não refaz a leitura: o cache persistido vale por
        // algumas horas. Alterações feitas aqui atualizam o cache na hora
        // (upsertDirectoryEntry); as de outra máquina chegam no próximo ciclo
        // ou pelo botão de atualizar.
        staleTime: 1000 * 60 * 60 * 4,
        gcTime: 1000 * 60 * 60 * 24,
        networkMode: 'offlineFirst',
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}

// Aplica no cache uma alteração já gravada no Firestore, sem reler a coleção.
export function upsertDirectoryEntry(queryClient, uid, data) {
    queryClient.setQueryData(DIRECTORY_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        const entry = normalizeEntry(uid, { createdAt: Date.now(), ...data });
        const exists = prev.some((u) => u.uid === uid);
        return exists
            ? prev.map((u) => (u.uid === uid ? { ...u, ...data, uid, createdAt: u.createdAt } : u))
            : [...prev, entry];
    });
}

export function refreshDirectory(queryClient) {
    return queryClient.invalidateQueries({ queryKey: DIRECTORY_QUERY_KEY });
}
