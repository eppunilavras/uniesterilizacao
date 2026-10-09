import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import {
    collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer,
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';

// Consultas do modal da página Alunos. Tudo sob demanda e paginado: abrir um
// aluno nunca baixa o histórico inteiro dele. Nenhuma delas é persistida em
// disco (ver PERSISTED_KEYS em main.jsx), porque status de material muda o
// tempo todo.

export const ACTIVE_STATUSES = ['recebido', 'em_esterilizacao', 'pronto', 'problema'];
export const HISTORY_PAGE_SIZE = 20;

const itemsCollection = () =>
    collection(db, 'artifacts', appId, 'public', 'data', 'items');

const toItem = (d) => ({ id: d.id, ...d.data() });

// Datas de <input type="date"> (YYYY-MM-DD) no fuso local, como no relatório.
const parseDay = (value, endOfDay = false) => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
};

// Materiais no setor agora. Mesmo índice que a Retirada já usa.
export function useStudentActiveItems(uid) {
    return useQuery({
        queryKey: ['student_active_items', uid],
        enabled: !!uid,
        staleTime: 1000 * 60,
        queryFn: async () => {
            const snap = await getDocs(query(
                itemsCollection(),
                where('studentId', '==', uid),
                where('status', 'in', ACTIVE_STATUSES),
            ));
            return snap.docs
                .map(toItem)
                .sort((a, b) => (b.lastUpdated?.toMillis?.() ?? 0) - (a.lastUpdated?.toMillis?.() ?? 0));
        },
    });
}

// Histórico paginado (20 por vez), opcionalmente restrito a um período.
export function useStudentHistory(uid, { start = '', end = '' } = {}) {
    return useInfiniteQuery({
        queryKey: ['student_history', uid, start, end],
        enabled: !!uid,
        staleTime: 1000 * 60,
        initialPageParam: null,
        queryFn: async ({ pageParam }) => {
            const constraints = [where('studentId', '==', uid)];
            const startDate = parseDay(start);
            const endDate = parseDay(end, true);
            if (startDate) constraints.push(where('createdAt', '>=', startDate));
            if (endDate) constraints.push(where('createdAt', '<=', endDate));
            constraints.push(orderBy('createdAt', 'desc'));
            if (pageParam) constraints.push(startAfter(pageParam));
            constraints.push(limit(HISTORY_PAGE_SIZE));

            const snap = await getDocs(query(itemsCollection(), ...constraints));
            return {
                items: snap.docs.map(toItem),
                cursor: snap.docs.length === HISTORY_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
            };
        },
        getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    });
}

// Quantos materiais o aluno já retirou. Contagem no servidor (~1 leitura).
// Se falhar (ex.: índice ausente), o modal apenas esconde o contador.
export function useStudentRetiredCount(uid) {
    return useQuery({
        queryKey: ['student_retired_count', uid],
        enabled: !!uid,
        staleTime: 1000 * 60 * 5,
        retry: false,
        queryFn: async () => {
            const snap = await getCountFromServer(query(
                itemsCollection(),
                where('studentId', '==', uid),
                where('status', '==', 'retirado'),
            ));
            return snap.data().count;
        },
    });
}

// Busca um material pelo código (1 leitura), como no Rastrear Item.
export async function findItemByCode(code) {
    const snap = await getDocs(query(
        itemsCollection(),
        where('code', '==', code.trim().toUpperCase()),
        limit(1),
    ));
    return snap.empty ? null : toItem(snap.docs[0]);
}
