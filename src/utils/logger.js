import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, appId, auth } from '../config/firebase';

/**
 * Registra eventos do sistema no Firestore para auditoria.
 * * @param {string} type - Tipo do evento (ex: 'LOGIN', 'ITEM_MOVE'). Use as chaves de LOG_TYPES.
 * @param {string} message - Mensagem descritiva curta.
 * @param {object} details - Objeto com detalhes técnicos adicionais (ex: IDs, códigos).
 * @param {object} user - (Opcional) Objeto do usuário. Se não passar, tenta pegar o current user do Auth.
 */
export const logEvent = async (type, message, details = {}, user = null) => {
    try {
        const currentUser = user || auth.currentUser;
        
        // Define quem executou a ação (ou SYSTEM se não houver usuário logado)
        const userId = currentUser ? currentUser.uid : 'SYSTEM';
        const userName = currentUser ? (currentUser.displayName || currentUser.email || 'Usuário') : 'Sistema';

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), {
            type,
            message,
            details,
            userId,
            userName,
            timestamp: serverTimestamp(), // Data do servidor para ordenação correta
            createdAt: new Date().toISOString() // Data legível para backup/debug
        });
    } catch (e) {
        // Ignora erros de permissão para não travar a UI se o usuário não tiver acesso de escrita em logs
        if (e.code !== 'permission-denied') {
            console.error("Falha ao gravar log:", e);
        }
    }
};