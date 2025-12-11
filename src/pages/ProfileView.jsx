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
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-[#021D34] mb-6">Meu Perfil</h2>
            
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-3xl mx-auto">
                {/* Header Gradient */}
                <div className="h-32 bg-gradient-to-r from-[#021D34] to-[#009DE0] relative">
                    <div className="absolute inset-0 bg-white/5 pattern-dots"/>
                </div>

                <div className="px-8 pb-8 relative">
                    {/* Avatar */}
                    <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 mb-6 gap-6">
                        <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-xl">
                            <div className="w-full h-full rounded-full bg-[#021D34] text-white flex items-center justify-center text-3xl font-bold">
                                {userProfile.name.substring(0,2).toUpperCase()}
                            </div>
                        </div>
                        <div className="text-center md:text-left flex-1 md:translate-y-4">
                            <h1 className="text-2xl font-bold text-[#021D34]">{userProfile.name}</h1>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                    userProfile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                    userProfile.role === 'tech' ? 'bg-orange-100 text-orange-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {ROLE_LABELS[userProfile.role]}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> Ativo
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detalhes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Mail size={14}/> Email Cadastrado
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                {userProfile.email}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <ScanBarcode size={14}/> CPF
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium font-mono">
                                {maskCPF(userProfile.cpf)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Calendar size={14}/> Membro Desde
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                {userProfile.createdAt ? formatDate(userProfile.createdAt) : 'Data não disponível'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <KeyRound size={14}/> Senha
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 font-medium flex justify-between items-center">
                                <span>••••••••••••</span>
                                <span className="text-xs text-slate-400 italic">Gerenciada no Login</span>
                            </div>
                        </div>
                    </div>
                    
                    {userProfile.role !== 'admin' && (
						<div className="mt-8 pt-6 border-t border-slate-100 text-center md:text-left">
							<p className="text-xs text-slate-400">
								Para alterar dados sensíveis como CPF ou Email, entre em contato com a administração do sistema.
							</p>
						</div>
					)}

                </div>
            </div>
        </div>
    );
}