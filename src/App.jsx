import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

// Imports de Configuração e Constantes
import { auth, db, appId } from './config/firebase';
import { LOGOS } from './constants';

// Imports dos Contextos (Providers)
import { ToastProvider } from './contexts/ToastContext';
import { DialogProvider } from './contexts/DialogContext';
import { PrintProvider } from './contexts/PrintContext';

// Imports das Telas Principais
import LoginScreen from './pages/LoginScreen';
import MainLayout from './components/MainLayout';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // --- MONITORAMENTO DE AUTENTICAÇÃO ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          // Busca o perfil estendido no Firestore
          const snap = await getDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'));
          
          if (snap.exists()) {
             const data = snap.data();
             
             // Verificação de Segurança: Bloqueio de conta
             if (data.active === false) {
                 setAuthError("Esta conta foi desativada pelo administrador.");
                 await signOut(auth);
                 setUser(null); 
                 setUserProfile(null);
             } else {
                 setAuthError(null);
                 setUser(u); 
                 setUserProfile({ uid: u.uid, ...data });
             }
          } else { 
             setAuthError("Perfil de usuário não encontrado no sistema.");
             await signOut(auth);
             setUser(null); 
             setUserProfile(null);
          }
        } catch (e) { 
            console.error("Erro ao carregar perfil:", e);
            setAuthError("Erro de conexão ao carregar perfil.");
            await signOut(auth); 
        }
      } else { 
          // Usuário deslogado
          setUser(null); 
          setUserProfile(null); 
      }
      setLoading(false);
    });
    
    // Limpeza do listener ao desmontar
    return () => unsub();
  }, []);

  return (
    <ToastProvider>
        <DialogProvider>
            {/* O PrintProvider precisa do user para carregar as configs do banco */}
            <PrintProvider user={user}>
                
                {/* CSS Global de Reset para Impressão */}
                <style>{`
                    @media print {
                        @page { size: 50mm 30mm; margin: 0; }
                        html, body { 
                            margin: 0 !important; 
                            padding: 0 !important;
                            width: 50mm;
                            height: 30mm;
                        }
                        .no-print { display: none !important; }
                    }
                `}</style>

                {/* --- RENDERIZAÇÃO CONDICIONAL --- */}
                
                {loading ? (
                    // TELA DE CARREGAMENTO
                    <div className="h-screen flex flex-col items-center justify-center bg-white no-print">
                        <img src={LOGOS.color} className="h-24 w-auto animate-bounce mb-4" alt="Carregando" />
                        <div className="w-8 h-8 border-4 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>
                    </div>
                ) : !user || !userProfile ? (
                    // TELA DE LOGIN (Ou Erro de Auth)
                    <div className="no-print">
                        <LoginScreen globalError={authError} />
                    </div>
                ) : (
                    // APLICAÇÃO PRINCIPAL (Logado)
                    <div className="no-print">
                        <MainLayout user={user} userProfile={userProfile} />
                    </div>
                )}
                
            </PrintProvider>
        </DialogProvider>
    </ToastProvider>
  );
}