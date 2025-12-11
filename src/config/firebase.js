import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuração oficial do Projeto
const firebaseConfig = {
  apiKey: "AIzaSyDZRzV_S2GCRWFteklzdGjaO8ZB7j5ct2U", 
  authDomain: "uniesterilizacao.firebaseapp.com",
  projectId: "uniesterilizacao",
  storageBucket: "uniesterilizacao.firebasestorage.app",
  messagingSenderId: "357777665758",
  appId: "1:357777665758:web:fda95ec0f6188cd5ee5c4f",
  measurementId: "G-CQ921DK3GX"
};

// Lógica de Inicialização (Singleton)
// Verifica se já existe uma instância para evitar erros de "App already exists"
// Mantém a compatibilidade com a variável global __firebase_config se ela existir no ambiente
const app = !getApps().length 
    ? initializeApp(JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(firebaseConfig))) 
    : getApp();

// Inicialização dos serviços
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// ID da Aplicação (usado para separar dados no Firestore se necessário)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'unilavras-main';

// Exportações
export { 
    app, 
    analytics, 
    auth, 
    db, 
    appId, 
    firebaseConfig // Necessário exportar para criar usuários secundários no UserManagement
};