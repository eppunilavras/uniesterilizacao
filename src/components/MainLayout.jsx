import React, { useState, useEffect, useRef, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { Outlet, useNavigate, useLocation } from 'react-router-dom'; // <--- Novos Imports
import { 
  LayoutDashboard, 
  PackagePlus, 
  ScanBarcode, 
  History, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  UserCircle, 
  Timer 
} from 'lucide-react';

// Imports de Configuração e Utils
import { auth } from '../config/firebase';
import { LOGOS, ROLE_LABELS } from '../constants';
import { logEvent } from '../utils/logger';
import { useDialog } from '../contexts/DialogContext';

// NOTA: Removemos os imports das Páginas daqui, pois agora estão no App.jsx

export default function MainLayout({ user, userProfile }) {
    // REMOVIDO: const [view, setView] = useState('dashboard');
    
    const navigate = useNavigate(); // <--- Hook de navegação
    const location = useLocation(); // <--- Hook para saber a URL atual
    
    const [menuOpen, setMenuOpen] = useState(false);
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
    
    const { confirm } = useDialog();
    const inactivityTimer = useRef(null);
    const warningTimer = useRef(null);
    
    // --- LÓGICA DE INATIVIDADE (MANTIDA IGUAL) ---
    const TIMEOUT_DURATION = 15 * 60 * 1000; 
    const WARNING_DURATION = 14 * 60 * 1000; 

    const handleLogout = async (auto = false) => { 
        if (!auto) {
            if (await confirm({ title: 'Sair', message: 'Deseja encerrar sua sessão?', confirmText: 'Sair' })) {
                await performLogout('Usuário clicou em sair');
            }
        } else {
             await performLogout('Logout por inatividade');
        }
    };

    const performLogout = async (reason) => {
		try {
			await logEvent('LOGOUT', reason, {}, user);
			await signOut(auth); 
		} catch (error) {
			console.error("Erro ao realizar logout:", error);
		}
	};

    const resetInactivity = useCallback(() => {
        const keep = localStorage.getItem('unilavras_keep_signed_in') === 'true';
        if (keep) return;

        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (warningTimer.current) clearTimeout(warningTimer.current);

        setShowTimeoutWarning(false);

        warningTimer.current = setTimeout(() => {
            setShowTimeoutWarning(true);
        }, WARNING_DURATION);

        inactivityTimer.current = setTimeout(() => {
            handleLogout(true);
        }, TIMEOUT_DURATION);
    }, []);

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        const handleActivity = () => resetInactivity();

        events.forEach(e => window.addEventListener(e, handleActivity));
        resetInactivity();

        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            if (warningTimer.current) clearTimeout(warningTimer.current);
        };
    }, [resetInactivity]);

    // --- CONFIGURAÇÃO DO MENU ---
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'tech', 'student'] },
        { id: 'reception', label: 'Recepção', icon: PackagePlus, roles: ['admin', 'tech'] },
        { id: 'movement', label: 'Movimentação', icon: ScanBarcode, roles: ['admin', 'tech'] },
        { id: 'history', label: 'Histórico', icon: History, roles: ['admin', 'tech', 'student'] },
        { id: 'notifications', label: 'Avisos', icon: Bell, roles: ['student'] },
        { id: 'users', label: 'Usuários', icon: Users, roles: ['admin', 'tech'] },
        { id: 'admin', label: 'Administração', icon: Settings, roles: ['admin'] },
    ];

    const allowedItems = menuItems.filter(i => i.roles.includes(userProfile.role));

    // Redireciona se o usuário tentar acessar uma URL não permitida
    useEffect(() => { 
        const currentPath = location.pathname.replace('/', ''); // ex: 'reception'
        
        // Se for profile ou dashboard (raiz), tudo bem
        if (currentPath === '' || currentPath === 'profile') return;

        // Se a rota atual não estiver na lista de permitidos, volta pro dashboard
        if (!allowedItems.find(i => i.id === currentPath)) {
            navigate('/dashboard', { replace: true });
        }
    }, [location.pathname, userProfile.role]);

    // Helper para verificar rota ativa
    const isActive = (id) => location.pathname.includes(id);

    return (
        <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800">
            
            {/* Modal de Aviso de Inatividade (MANTIDO) */}
            {showTimeoutWarning && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95">
                        <Timer className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-pulse"/>
                        <h3 className="text-xl font-bold text-[#021D34]">Sessão Expirando</h3>
                        <p className="text-slate-600 mt-2">Você está inativo há algum tempo. Sua sessão será encerrada em breve para sua segurança.</p>
                        <button 
                            onClick={resetInactivity}
                            className="mt-6 w-full bg-[#009DE0] text-white py-3 rounded-lg font-bold hover:bg-[#008bc5] transition-colors"
                        >
                            Continuar Logado
                        </button>
                    </div>
                </div>
            )}

            {/* SIDEBAR DESKTOP */}
            <aside className="hidden md:flex flex-col w-72 bg-[#021D34] shadow-xl z-20">
                <div className="p-6 border-b border-white/10 flex flex-col items-center">
                    <img src={LOGOS.white} className="h-12 w-auto mb-3 opacity-90" alt="Logo White" />
                    <span className="text-[10px] text-[#009DE0] uppercase tracking-[0.2em] font-bold">Controle de Esterilização</span>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {allowedItems.map(item => (
                        <button key={item.id} onClick={() => navigate(item.id)} // <--- Alterado para navigate
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                            ${isActive(item.id) ? 'bg-[#009DE0] text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            <item.icon size={20} className={isActive(item.id) ? 'text-white' : 'text-[#009DE0]'} />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/10 bg-[#011526]">
                    <div 
                        onClick={() => navigate('profile')} // <--- Alterado para navigate
                        className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#009DE0] to-blue-700 flex items-center justify-center text-white font-bold shadow-lg border border-white/20 group-hover:scale-105 transition-transform">
                            {userProfile.name.substring(0,2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-white truncate w-36 group-hover:text-[#009DE0] transition-colors">{userProfile.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{ROLE_LABELS[userProfile.role] || userProfile.role}</p>
                        </div>
                    </div>
                    <button onClick={() => handleLogout(false)} className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 hover:bg-red-500 hover:text-white transition-all">
                        <LogOut size={14}/> Encerrar Sessão
                    </button>
                </div>
            </aside>

            {/* ÁREA PRINCIPAL */}
            <main className="flex-1 flex flex-col h-screen relative">
                
                {/* HEADER MOBILE */}
                <header className="md:hidden flex items-center justify-between p-4 bg-white border-b z-10 shadow-sm">
                    <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2 text-[#021D34]"><Menu/></button>
                    <img src={LOGOS.color} className="h-8 w-auto" alt="Logo Color" />
                    <button onClick={() => navigate('profile')} className="w-8 h-8 rounded-full bg-[#009DE0] text-white flex items-center justify-center text-xs font-bold shadow-sm active:scale-95 transition-transform">
                        {userProfile.name.substring(0,2).toUpperCase()}
                    </button>
                </header>

                {/* MENU MOBILE (DRAWER) */}
                {menuOpen && (
                    <div className="fixed inset-0 z-50 flex">
                        <div className="fixed inset-0 bg-[#021D34]/90 backdrop-blur-sm" onClick={() => setMenuOpen(false)}/>
                        <div className="relative w-64 bg-[#021D34] h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left">
                            <button onClick={() => setMenuOpen(false)} className="self-end text-white/50 p-2"><X/></button>
                            <nav className="space-y-2 mt-4">
                                <button onClick={() => { navigate('profile'); setMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${isActive('profile') ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}>
                                    <UserCircle size={20}/> Meu Perfil
                                </button>
                                <div className="h-px bg-white/10 my-2 mx-2"/>
                                {allowedItems.map(item => (
                                    <button key={item.id} onClick={() => { navigate(item.id); setMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${isActive(item.id) ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}>
                                        <item.icon size={20}/> {item.label}
                                    </button>
                                ))}
                            </nav>
                            <button onClick={() => handleLogout(false)} className="mt-auto flex items-center gap-2 text-red-400 p-3"><LogOut size={16}/> Sair</button>
                        </div>
                    </div>
                )}

                {/* CONTEÚDO DAS PÁGINAS (RENDERIZADO PELA ROTA) */}
                <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar bg-[#F8FAFC]">
                    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-0">
                        {/* AQUI É ONDE A MÁGICA ACONTECE: O componente da rota atual é renderizado aqui */}
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}