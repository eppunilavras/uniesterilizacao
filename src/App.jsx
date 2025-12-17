import React, { useState, useEffect, Suspense, lazy } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { Routes, Route, Navigate } from 'react-router-dom';

import { auth, db, appId } from './config/firebase';
import { LOGOS } from './constants';
import { ToastProvider } from './contexts/ToastContext';
import { DialogProvider } from './contexts/DialogContext';
import { PrintProvider } from './contexts/PrintContext';
import { usePageTitle } from './hooks/usePageTitle';

import ReloadPrompt from './components/ReloadPrompt';
import Reception from './pages/Reception'; 
import SystemsPortal from './pages/SystemsPortal';

// Lazy Loading
const LoginScreen = lazy(() => import('./pages/LoginScreen'));
const MainLayout = lazy(() => import('./components/MainLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Movement = lazy(() => import('./pages/Movement'));
const HistoryView = lazy(() => import('./pages/HistoryView'));
const NotificationsView = lazy(() => import('./pages/NotificationsView'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ProfileView = lazy(() => import('./pages/ProfileView'));
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel'));
const AdminPortal = lazy(() => import('./pages/Admin/AdminPortal'));

const LoadingScreen = () => (
    <div className="h-full w-full min-h-[50vh] flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="w-10 h-10 border-4 border-[#009DE0] border-t-transparent rounded-full animate-spin mb-4"/>
        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Carregando...</span>
    </div>
);

const InitialLoader = () => (
    <div className="h-screen flex flex-col items-center justify-center bg-white dark:bg-[#020617] no-print">
        {/* Logo Colorida: Aparece no modo claro, some no escuro */}
        <img 
            src={LOGOS.color} 
            className="h-24 w-auto animate-bounce mb-4 dark:hidden" 
            alt="Carregando" 
        />
        
        {/* Logo Branca: Aparece apenas no modo escuro */}
        <img 
            src={LOGOS.white} 
            className="h-24 w-auto animate-bounce mb-4 hidden dark:block" 
            alt="Carregando" 
        />
        
        <div className="w-8 h-8 border-4 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>
    </div>
);

// Componente auxiliar para rodar o hook de título dentro do Router
function TitleManager() {
    usePageTitle();
    return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [authError, setAuthError] = useState(null);
  
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
                 setUser(null); setUserProfile(null);
             } else {
                 setAuthError(null);
                 setUser(u); setUserProfile({ uid: u.uid, ...data });
             }
          } else { 
             setAuthError("Perfil não encontrado.");
             await signOut(auth);
             setUser(null); setUserProfile(null);
          }
        } catch (e) { 
            console.error("Erro perfil:", e);
            setAuthError("Erro de conexão.");
            await signOut(auth); 
        }
      } else { 
          setUser(null); setUserProfile(null); 
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <InitialLoader />;

  return (
    <ToastProvider>
        <DialogProvider>
            <PrintProvider user={user}>
                <ReloadPrompt />
                
                {/* Gerenciador de Títulos (Aba do Navegador) */}
                <TitleManager /> 

                <style>{`
                    @media print {
                        @page { size: 50mm 30mm; margin: 0; }
                        html, body { margin: 0 !important; padding: 0 !important; width: 50mm; height: 30mm; }
                        .no-print { display: none !important; }
                    }
                `}</style>

                <Suspense fallback={<InitialLoader />}>
                    <Routes>
                        {/* ROTA PÚBLICA (HOME) */}
                        <Route path="/" element={<SystemsPortal />} />

                        {/* ROTA DE LOGIN */}
                        <Route path="/login" element={
                            !user || !userProfile ? (
                                <div className="no-print"><LoginScreen globalError={authError} /></div>
                            ) : (
                                <Navigate to="/dashboard" replace />
                            )
                        } />

                        {/* ROTAS PROTEGIDAS */}
                        <Route path="/*" element={
                            (!user || !userProfile) ? <Navigate to="/login" replace /> : (
                                <div className="no-print">
                                    <Routes>
                                        <Route path="/" element={<MainLayout user={user} userProfile={userProfile} />}>
                                            <Route index element={<Navigate to="dashboard" replace />} />
                                            
                                            <Route path="dashboard" element={<Suspense fallback={<LoadingScreen />}><Dashboard userProfile={userProfile} /></Suspense>} />
                                            <Route path="reception" element={<Reception userProfile={userProfile} />} />
                                            <Route path="movement" element={<Suspense fallback={<LoadingScreen />}><Movement userProfile={userProfile} /></Suspense>} />
                                            <Route path="history" element={<Suspense fallback={<LoadingScreen />}><HistoryView userProfile={userProfile} /></Suspense>} />
                                            <Route path="notifications" element={<Suspense fallback={<LoadingScreen />}><NotificationsView userProfile={userProfile} /></Suspense>} />
                                            <Route path="users" element={<Suspense fallback={<LoadingScreen />}><UserManagement userProfile={userProfile} /></Suspense>} />
                                            <Route path="profile" element={<Suspense fallback={<LoadingScreen />}><ProfileView userProfile={userProfile} /></Suspense>} />
                                            <Route path="admin" element={<Suspense fallback={<LoadingScreen />}><AdminPanel userProfile={userProfile} /></Suspense>} />
                                            <Route path="portal-config" element={<Suspense fallback={<LoadingScreen />}><AdminPortal /></Suspense>} />
                                        </Route>
                                    </Routes>
                                </div>
                            )
                        } />
                    </Routes>
                </Suspense>
            </PrintProvider>
        </DialogProvider>
    </ToastProvider>
  );
}