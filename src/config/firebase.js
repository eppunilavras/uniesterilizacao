import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { 
    getFirestore, 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from 'firebase/firestore'; // <--- NOVOS IMPORTS

// Configuração oficial do Projeto (usando variáveis de ambiente da Dica 1)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Lógica de Inicialização (Singleton)
const app = !getApps().length 
    ? initializeApp(
        typeof __firebase_config !== 'undefined' 
            ? JSON.parse(__firebase_config) 
            : firebaseConfig
      ) 
    : getApp();

// Inicialização dos serviços
const analytics = getAnalytics(app);
const auth = getAuth(app);

// --- MUDANÇA PRINCIPAL AQUI (PERSISTÊNCIA OFFLINE) ---
// Em vez de usar apenas getFirestore(app), usamos initializeFirestore com configurações de cache.
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        // O gerenciador de abas permite que múltiplas abas do navegador
        // partilhem o mesmo cache local sem conflitos.
        tabManager: persistentMultipleTabManager()
    })
});

// ID da Aplicação
const appId = typeof __app_id !== 'undefined' ? __app_id : 'unilavras-main';

// Exportações
export { 
    app, 
    analytics, 
    auth, 
    db, 
    appId, 
    firebaseConfig 
};