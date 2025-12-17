import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { ShieldAlert, Loader2, ArrowLeft } from 'lucide-react'; // Adicionado ArrowLeft
import { Link } from 'react-router-dom'; // Adicionado Link

// Imports internos
import { auth, db, appId } from '../config/firebase';
import { LOGOS } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { logEvent } from '../utils/logger';
import { translateFirebaseError } from '../utils/formatters';
import ThemeToggle from '../components/ThemeToggle'; 

export default function LoginScreen({ globalError }) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [mode, setMode] = useState('login');
    const [keepSigned, setKeepSigned] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    // Se houver erro global (ex: conta inativa), forçamos o fim do loading
    useEffect(() => {
        if (globalError) setIsSubmitting(false);
    }, [globalError]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Tenta autenticar no Firebase Auth
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            
            // 2. Verificação extra de segurança: Status da conta no Firestore
            const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Se a conta estiver inativa (active === false)
                if (userData.active === false) {
                    await logEvent(
                        'LOGIN_FAIL', 
                        'Tentativa de acesso de conta inativa', 
                        { email: email, reason: 'Account Inactive' },
                        cred.user
                    );
                    await signOut(auth); 
                    throw { code: 'auth/account-inactive' }; 
                }
            }
            
            // 3. Se passou pela verificação, registra o sucesso
            const userAgent = navigator.userAgent;
            await logEvent(
                'LOGIN', 
                'Usuário fez login com sucesso', 
                { 
                    email, 
                    device: /Mobile/i.test(userAgent) ? 'Mobile' : 'Desktop', 
                    browser: userAgent 
                }, 
                cred.user
            );
            
            // Lógica de "Manter conectado"
            if (keepSigned) {
                localStorage.setItem('unilavras_keep_signed_in', 'true');
            } else {
                localStorage.removeItem('unilavras_keep_signed_in');
            }

        } catch (error) {
            addToast(translateFirebaseError(error), 'error');
            setIsSubmitting(false);
        }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await sendPasswordResetEmail(auth, email);
            addToast('Link de recuperação enviado!', 'success');
            setMode('login');
        } catch (error) {
            addToast(translateFirebaseError(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#021D34] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500">
            
            {/* Botão de Voltar (ADICIONADO) */}
            <div className="absolute top-4 left-4 z-50">
                <Link 
                    to="/" 
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#009DE0] dark:hover:text-sky-400 transition-all font-bold text-sm group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform"/>
                    Voltar para o Portal
                </Link>
            </div>

            {/* Botão de Tema (Absoluto) */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-200 dark:bg-[#009DE0] rounded-full blur-[100px] md:blur-[150px] opacity-40 dark:opacity-20 transition-all duration-500"/>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200 dark:bg-blue-900 rounded-full blur-[100px] opacity-40 dark:opacity-20 transition-all duration-500"/>
            
            {/* Login Card */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-full max-w-md shadow-2xl shadow-blue-900/10 dark:shadow-black/50 relative z-10 transition-all duration-300 border border-white/50 dark:border-slate-800">
                <div className="text-center mb-8">
                    
                    {/* LOGO DINÂMICO (Branco no Dark / Colorido no Light) */}
                    <div className="h-16 mx-auto mb-6 flex items-center justify-center">
                        <img 
                            src={LOGOS.color} 
                            className="h-full w-auto block dark:hidden" 
                            alt="Logo Unilavras" 
                        />
                        <img 
                            src={LOGOS.white} 
                            className="h-full w-auto hidden dark:block" 
                            alt="Logo Unilavras White" 
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-[#021D34] dark:text-white transition-colors">
                        {mode === 'login' ? 'Portal de Esterilização' : 'Recuperar Senha'}
                    </h1>
                </div>

                {globalError && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg flex gap-3 text-red-700 dark:text-red-300 text-sm items-start animate-in fade-in slide-in-from-top-2">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                        <span>{globalError}</span>
                    </div>
                )}

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Email</label>
                            <input 
                                type="email" 
                                className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:border-[#009DE0] dark:focus:border-[#009DE0] outline-none transition-all" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Senha</label>
                            <input 
                                type="password" 
                                className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:border-[#009DE0] dark:focus:border-[#009DE0] outline-none transition-all" 
                                value={pass} 
                                onChange={e => setPass(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <input 
                                    type="checkbox" 
                                    checked={keepSigned} 
                                    onChange={e => setKeepSigned(e.target.checked)} 
                                    className="rounded text-[#009DE0] focus:ring-[#009DE0] dark:bg-slate-800 dark:border-slate-600" 
                                    disabled={isSubmitting}
                                />
                                <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">Manter conectado</span>
                            </label>
                            <button 
                                type="button" 
                                onClick={() => setMode('forgot')} 
                                className="text-[#009DE0] dark:text-[#38bdf8] hover:underline font-medium transition-colors" 
                                disabled={isSubmitting}
                            >
                                Esqueceu a senha?
                            </button>
                        </div>

                        <button 
                            disabled={isSubmitting} 
                            className="w-full bg-[#009DE0] hover:bg-[#008bc5] text-white p-3.5 rounded-lg font-bold shadow-lg shadow-blue-500/30 dark:shadow-blue-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'Entrar'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Email de Recuperação</label>
                            <input 
                                type="email" 
                                placeholder="exemplo@unilavras.edu.br" 
                                className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:border-[#009DE0] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                            />
                        </div>
                        <button 
                            disabled={isSubmitting} 
                            className="w-full bg-[#021D34] dark:bg-slate-800 hover:bg-[#032b4b] dark:hover:bg-slate-700 text-white p-3.5 rounded-lg font-bold transition-all shadow-lg"
                        >
                            Enviar Link
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setMode('login')} 
                            className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-[#009DE0] dark:hover:text-[#38bdf8] mt-2 transition-colors"
                        >
                            Voltar para Login
                        </button>
                    </form>
                )}
            </div>
            
            <div className="absolute bottom-4 text-center w-full text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-widest font-bold">
                © {new Date().getFullYear()} Centro Universitario de Lavras - Unilavras
            </div>
        </div>
    );
}