import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Routes, Route, Navigate } from 'react-router-dom'; // <--- Imports do Router

// Imports de Configuração e Constantes
import { auth, db, appId } from './config/firebase';
import { LOGOS } from './constants';

// Imports dos Contextos
import { ToastProvider } from './contexts/ToastContext';
import { DialogProvider } from './contexts/DialogContext';
import { PrintProvider } from './contexts/PrintContext';

// Imports das Telas
import LoginScreen from './pages/LoginScreen';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import Reception from './pages/Reception';
import Movement from './pages/Movement';
import HistoryView from './pages/HistoryView';
import NotificationsView from './pages/NotificationsView';
import UserManagement from './pages/UserManagement';
import ProfileView from './pages/ProfileView';
import AdminPanel from './pages/Admin/AdminPanel';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // --- MONITORAMENTO DE AUTENTICAÇÃO (MANTIDO IGUAL) ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'));
          
          if (snap.exists()) {
             const data = snap.data();
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
          setUser(null); 
          setUserProfile(null); 
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <ToastProvider>
        <DialogProvider>
            <PrintProvider user={user}>
                <style>{`
                    @media print {
                        @page { size: 50mm 30mm; margin: 0; }
                        html, body { margin: 0 !important; padding: 0 !important; width: 50mm; height: 30mm; }
                        .no-print { display: none !important; }
                    }
                `}</style>

                {loading ? (
                    <div className="h-screen flex flex-col items-center justify-center bg-white no-print">
                        <img src={LOGOS.color} className="h-24 w-auto animate-bounce mb-4" alt="Carregando" />
                        <div className="w-8 h-8 border-4 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>
                    </div>
                ) : !user || !userProfile ? (
                    <div className="no-print">
                        <LoginScreen globalError={authError} />
                    </div>
                ) : (
                    <div className="no-print">
                        {/* SISTEMA DE ROTAS AQUI */}
                        <Routes>
                            <Route path="/" element={<MainLayout user={user} userProfile={userProfile} />}>
                                {/* Redireciona a raiz para dashboard */}
                                <Route index element={<Navigate to="dashboard" replace />} />
                                
                                <Route path="dashboard" element={<Dashboard userProfile={userProfile} />} />
                                <Route path="reception" element={<Reception userProfile={userProfile} />} />
                                <Route path="movement" element={<Movement userProfile={userProfile} />} />
                                <Route path="history" element={<HistoryView userProfile={userProfile} />} />
                                <Route path="notifications" element={<NotificationsView userProfile={userProfile} />} />
                                <Route path="users" element={<UserManagement userProfile={userProfile} />} />
                                <Route path="profile" element={<ProfileView userProfile={userProfile} />} />
                                <Route path="admin" element={<AdminPanel userProfile={userProfile} />} />
                                
                                {/* Rota para 404 - Redireciona para dashboard */}
                                <Route path="*" element={<Navigate to="dashboard" replace />} />
                            </Route>
                        </Routes>
                    </div>
                )}
            </PrintProvider>
        </DialogProvider>
    </ToastProvider>
  );
}