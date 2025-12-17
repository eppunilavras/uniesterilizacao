import React from 'react';
import { 
  Mail, 
  ScanBarcode, 
  Calendar, 
  KeyRound 
} from 'lucide-react';

// Imports internos
import { ROLE_LABELS } from '../constants';
import { maskCPF, formatDate } from '../utils/formatters';

export default function ProfileView({ userProfile }) {
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 transition-colors">
            <h2 className="text-2xl font-bold text-[#021D34] dark:text-white mb-6 transition-colors">Meu Perfil</h2>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden max-w-3xl mx-auto transition-colors">
                {/* Header Gradient */}
                <div className="h-32 bg-gradient-to-r from-[#021D34] to-[#009DE0] relative">
                    <div className="absolute inset-0 bg-white/5 pattern-dots"/>
                </div>

                <div className="px-8 pb-8 relative">
                    {/* Avatar */}
                    <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 mb-6 gap-6">
                        <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 p-1.5 shadow-xl transition-colors">
                            <div className="w-full h-full rounded-full bg-[#021D34] text-white flex items-center justify-center text-3xl font-bold">
                                {userProfile.name.substring(0,2).toUpperCase()}
                            </div>
                        </div>
                        <div className="text-center md:text-left flex-1 md:translate-y-4">
                            <h1 className="text-2xl font-bold text-[#021D34] dark:text-white transition-colors">{userProfile.name}</h1>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                                    userProfile.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                    userProfile.role === 'tech' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}>
                                    {ROLE_LABELS[userProfile.role]}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full transition-colors">
                                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"/> Ativo
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detalhes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2 transition-colors">
                                <Mail size={14}/> Email Cadastrado
                            </label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                                {userProfile.email}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2 transition-colors">
                                <ScanBarcode size={14}/> CPF
                            </label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium font-mono transition-colors">
                                {maskCPF(userProfile.cpf)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2 transition-colors">
                                <Calendar size={14}/> Membro Desde
                            </label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors">
                                {userProfile.createdAt ? formatDate(userProfile.createdAt) : 'Data não disponível'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2 transition-colors">
                                <KeyRound size={14}/> Senha
                            </label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-medium flex justify-between items-center transition-colors">
                                <span>••••••••••••</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 italic">Gerenciada no Login</span>
                            </div>
                        </div>
                    </div>
                    
                    {userProfile.role !== 'admin' && (
						<div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center md:text-left transition-colors">
							<p className="text-xs text-slate-400 dark:text-slate-500 transition-colors">
								Para alterar dados sensíveis como CPF ou Email, entre em contato com a administração do sistema.
							</p>
						</div>
					)}

                </div>
            </div>
        </div>
    );
}