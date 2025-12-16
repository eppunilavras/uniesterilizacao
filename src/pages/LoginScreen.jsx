import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { ShieldAlert, Loader2 } from 'lucide-react';

// Imports internos
import { auth, db, appId } from '../config/firebase';
import { LOGOS } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { logEvent } from '../utils/logger';
import { translateFirebaseError } from '../utils/formatters';

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
            // Buscamos o perfil manualmente aqui para garantir que não logamos sucesso se estiver inativo
            const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Se a conta estiver inativa (active === false)
                if (userData.active === false) {
                    // REGISTRA O LOG DE FALHA DE SEGURANÇA
                    // (Possível agora pois temos um UID autenticado temporariamente)
                    await logEvent(
                        'LOGIN_FAIL', 
                        'Tentativa de acesso de conta inativa', 
                        { email: email, reason: 'Account Inactive' },
                        cred.user
                    );

                    // Desloga imediatamente para bloquear o acesso
                    await signOut(auth); 
                    
                    // Lança o erro para cair no catch abaixo
                    throw { code: 'auth/account-inactive' }; 
                }
            }
            
            // 3. Se passou pela verificação, registra o sucesso
			const userAgent = navigator.userAgent; // Captura info do navegador

			await logEvent(
				'LOGIN', 
				'Usuário fez login com sucesso', 
				{ 
					email, 
					device: /Mobile/i.test(userAgent) ? 'Mobile' : 'Desktop', // Detecção simples
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
            // Se o erro foi lançado manualmente acima, ele será tratado aqui
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
        <div className="min-h-screen bg-[#021D34] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#009DE0] rounded-full blur-[150px] opacity-20"/>
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl relative z-10">
                <div className="text-center mb-8">
                    <img src={LOGOS.color} className="h-16 mx-auto mb-6" alt="Logo Unilavras" />
                    <h1 className="text-2xl font-bold text-[#021D34]">{mode === 'login' ? 'Portal de Esterilização' : 'Recuperar Senha'}</h1>
                </div>

                {globalError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-700 text-sm items-start">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                        <span>{globalError}</span>
                    </div>
                )}

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
                            <input 
                                type="email" 
                                className="w-full p-3 border border-slate-200 rounded-lg focus:border-[#009DE0] outline-none" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase">Senha</label>
                            <input 
                                type="password" 
                                className="w-full p-3 border border-slate-200 rounded-lg focus:border-[#009DE0] outline-none" 
                                value={pass} 
                                onChange={e => setPass(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={keepSigned} 
                                    onChange={e => setKeepSigned(e.target.checked)} 
                                    className="rounded text-[#009DE0] focus:ring-[#009DE0]" 
                                    disabled={isSubmitting}
                                />
                                <span className="text-slate-600">Manter conectado</span>
                            </label>
                            <button 
                                type="button" 
                                onClick={() => setMode('forgot')} 
                                className="text-[#009DE0] hover:underline font-medium" 
                                disabled={isSubmitting}
                            >
                                Esqueceu a senha?
                            </button>
                        </div>

                        <button 
                            disabled={isSubmitting} 
                            className="w-full bg-[#009DE0] text-white p-3.5 rounded-lg font-bold hover:bg-[#008bc5] transition-all flex justify-center items-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'Entrar'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <input 
                            type="email" 
                            placeholder="Email cadastrado" 
                            className="w-full p-3 border border-slate-200 rounded-lg focus:border-[#009DE0] outline-none" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                            disabled={isSubmitting}
                        />
                        <button 
                            disabled={isSubmitting} 
                            className="w-full bg-[#021D34] text-white p-3.5 rounded-lg font-bold"
                        >
                            Enviar Link
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setMode('login')} 
                            className="w-full text-center text-sm text-slate-500 hover:text-[#009DE0] mt-2"
                        >
                            Voltar para Login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}