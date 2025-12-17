import React, { useState, useRef } from 'react';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  writeBatch, 
  Timestamp 
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { 
  Database, 
  FileDown, 
  FileUp, 
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Package,
  Users,
  FileText,
  Calendar,
  X,
  Lock,
  Activity,
  ShieldCheck,
  History
} from 'lucide-react';

// Imports internos
import { db, appId, auth } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import { logEvent } from '../../utils/logger';
import { STATUS_CONFIG } from '../../constants';

export default function AdminData() {
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [restorePreview, setRestorePreview] = useState(null);
    const fileInputRef = useRef(null);
    
    // --- ESTADOS PARA RE-AUTENTICAÇÃO ---
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [password, setPassword] = useState('');
    const [verifyingPass, setVerifyingPass] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // 'BACKUP', 'RESTORE' ou 'WIPE_SEQUENCE'
    
    const { addToast } = useToast();
    const { confirm } = useDialog();

    const reviveTimestamps = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (obj.type === 'firestore/timestamp/1.0' || (obj.seconds !== undefined && obj.nanoseconds !== undefined)) {
            return new Timestamp(obj.seconds, obj.nanoseconds);
        }
        if (Array.isArray(obj)) return obj.map(reviveTimestamps);
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, reviveTimestamps(v)]));
    };

    // --- FUNÇÃO DE BACKUP (Núcleo) ---
    const performBackup = async () => {
        setStatusMsg('Lendo coleções...');
        const collections = ['items', 'materialTypes', 'announcements', 'users_directory', 'system_logs'];
        const data = {};
        
        for (const c of collections) {
            const s = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', c));
            data[c] = s.docs.map(d => ({id: d.id, ...d.data()}));
            setStatusMsg(`Lendo ${c} (${s.size} itens)...`);
        }
        
        setStatusMsg('Lendo perfis de usuário...');
        const userDir = data['users_directory'] || [];
        const profiles = [];
        for (const user of userDir) {
            try {
                const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.id, 'profile', 'data'));
                if (snap.exists()) {
                    profiles.push({ uid: user.id, ...snap.data() });
                }
            } catch(e) { console.warn(`Falha ao pegar perfil de ${user.id}`, e); }
        }
        data['user_profiles_backup'] = profiles;
        data['metadata'] = { exportedAt: new Date().toISOString(), version: '1.0' };

        setStatusMsg('Gerando arquivo...');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); 
        const a = document.createElement('a');
        a.href = url; a.download = `backup_unilavras_${timestamp}.json`;
        a.click();
        
        setStatusMsg('');
        return true;
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setStatusMsg('Analisando arquivo...');
        setLoading(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const rawJSON = JSON.parse(ev.target.result);
                if (!rawJSON.items && !rawJSON.users_directory) throw new Error("Estrutura inválida.");
                
                // Estatísticas para Preview
                let totalHistoryEvents = 0;
                const statusCounts = {};
                Object.keys(STATUS_CONFIG).forEach(k => statusCounts[k] = 0);

                if (rawJSON.items && Array.isArray(rawJSON.items)) {
                    rawJSON.items.forEach(item => {
                        const st = item.status || 'desconhecido';
                        statusCounts[st] = (statusCounts[st] || 0) + 1;
                        if (item.history && Array.isArray(item.history)) {
                            totalHistoryEvents += item.history.length;
                        }
                    });
                }

                setRestorePreview({
                    fileName: file.name,
                    fileSize: (file.size / 1024).toFixed(1) + ' KB',
                    date: rawJSON.metadata?.exportedAt ? new Date(rawJSON.metadata.exportedAt).toLocaleString() : 'Desconhecida',
                    counts: {
                        items: rawJSON.items?.length || 0,
                        users: rawJSON.users_directory?.length || 0,
                        logs: rawJSON.system_logs?.length || 0,
                        profiles: rawJSON.user_profiles_backup?.length || 0
                    },
                    detailedStats: { statusCounts, totalHistoryEvents },
                    rawData: rawJSON
                });
            } catch (err) {
                console.error(err);
                addToast('Erro ao ler arquivo: ' + err.message, 'error');
            } finally {
                setLoading(false);
                setStatusMsg('');
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    // --- EXECUÇÃO: RESTAURAR ---
    const executeRestore = async () => {
        if (!restorePreview) return;
        setLoading(true);
        setStatusMsg('Iniciando restauração...');

        try {
            const data = reviveTimestamps(restorePreview.rawData);
            const batchLimit = 400;
            let operationCount = 0;
            let currentBatch = writeBatch(db);
            let totalItemsProcessed = 0;
            const collectionsToRestore = ['items', 'materialTypes', 'announcements', 'users_directory', 'system_logs'];

            for (const key of collectionsToRestore) {
                if (data[key]) {
                    for (const item of data[key]) {
                        const { id, ...rest } = item;
                        if (id) {
                            currentBatch.set(doc(db, 'artifacts', appId, 'public', 'data', key, id), rest);
                            operationCount++; totalItemsProcessed++;
                        }
                        if (operationCount >= batchLimit) {
                            await currentBatch.commit(); currentBatch = writeBatch(db); operationCount = 0;
                            setStatusMsg(`Restaurando ${key}: ${totalItemsProcessed} ok...`);
                        }
                    }
                }
            }
            if (data['user_profiles_backup']) {
                for (const profile of data['user_profiles_backup']) {
                    const { uid, ...pData } = profile;
                    if (uid) {
                        currentBatch.set(doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data'), pData);
                        operationCount++; totalItemsProcessed++;
                    }
                    if (operationCount >= batchLimit) {
                        await currentBatch.commit(); currentBatch = writeBatch(db); operationCount = 0;
                        setStatusMsg(`Restaurando perfis: ${totalItemsProcessed} ok...`);
                    }
                }
            }
            if (operationCount > 0) await currentBatch.commit();
            await logEvent('DATA_OP', `Restauração realizada: ${restorePreview.fileName}`);
            addToast(`Sucesso! ${totalItemsProcessed} registros restaurados.`, 'success');
            setRestorePreview(null);
        } catch (e) {
            console.error(e);
            addToast('Erro crítico: ' + e.message, 'error');
        } finally {
            setLoading(false);
            setStatusMsg('');
        }
    };

    // --- EXECUÇÃO: BACKUP ISOLADO ---
    const executeBackupOnly = async () => {
        setLoading(true);
        try {
            await performBackup();
            addToast('Backup realizado com sucesso!', 'success');
        } catch (e) {
            console.error(e);
            addToast('Erro ao gerar backup: ' + e.message, 'error');
        } finally {
            setLoading(false);
            setStatusMsg('');
        }
    };

    // --- EXECUÇÃO: FLUXO DE WIPE COMPLETO ---
    const executeWipeSequence = async () => {
        setLoading(true);
        try {
            // 1. Gera Backup (Agora autorizado pela senha)
            await performBackup();
            
            await new Promise(r => setTimeout(r, 1500)); // Delay visual para o download iniciar
            setLoading(false);
            setStatusMsg('');

            // 2. Confirmação de Download (Trava de Segurança)
            const backupConfirmed = await confirm({
                title: 'Confirmação de Segurança',
                message: (
                    <div className="space-y-3">
                        <p className="text-red-600 font-bold">⚠️ Verifique sua pasta de Downloads!</p>
                        <p>O arquivo JSON foi salvo? Se você não tiver o arquivo, NÃO prossiga.</p>
                        <p>Podemos apagar todos os dados?</p>
                    </div>
                ),
                confirmText: 'SIM, APAGAR TUDO',
                cancelText: 'Cancelar',
                isDestructive: true
            });

            if (!backupConfirmed) {
                addToast('Operação cancelada. Nada foi apagado.', 'info');
                return;
            }

            // 3. Executa Limpeza Real
            setLoading(true);
            setStatusMsg('Limpando sistema...');

            const collectionsToDelete = ['items', 'system_logs', 'announcements'];
            let totalDeleted = 0;
            const batchLimit = 400; 

            for (const colName of collectionsToDelete) {
                setStatusMsg(`Buscando ${colName}...`);
                const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
                const snapshot = await getDocs(colRef);
                if (snapshot.empty) continue;
                const chunks = [];
                for (let i = 0; i < snapshot.docs.length; i += batchLimit) chunks.push(snapshot.docs.slice(i, i + batchLimit));
                for (const [index, chunk] of chunks.entries()) {
                    setStatusMsg(`Apagando ${colName}: lote ${index + 1}/${chunks.length}...`);
                    const batch = writeBatch(db);
                    chunk.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    totalDeleted += chunk.length;
                }
            }

            await logEvent('DATA_OP', `RESET TOTAL REALIZADO. ${totalDeleted} removidos.`); 
            addToast(`Limpeza concluída! ${totalDeleted} registros apagados.`, 'success');

        } catch(e) { 
            addToast('Erro: ' + e.message, 'error'); 
        } finally {
            setLoading(false);
            setStatusMsg('');
        }
    };

    // --- CONTROLADOR CENTRAL DE SENHA ---
    const handlePasswordSuccess = async () => {
        setVerifyingPass(true);
        try {
            // Re-autenticar
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // Sucesso: Fecha modal e limpa senha
            setShowPasswordModal(false);
            setPassword('');
            setVerifyingPass(false);
            
            // Roteia para a ação correta
            if (pendingAction === 'BACKUP') {
                await executeBackupOnly();
            } else if (pendingAction === 'RESTORE') {
                await executeRestore();
            } else if (pendingAction === 'WIPE_SEQUENCE') {
                await executeWipeSequence();
            }
            
            setPendingAction(null);

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                addToast('Senha incorreta.', 'error');
            } else {
                addToast('Erro na verificação: ' + error.message, 'error');
            }
            setVerifyingPass(false);
        }
    };

    // --- GATILHOS DE UI (Pedem Senha) ---
    const requestBackup = () => {
        setPendingAction('BACKUP');
        setShowPasswordModal(true);
    };

    const requestRestore = () => {
        if (!restorePreview) return;
        setPendingAction('RESTORE');
        setShowPasswordModal(true);
    };

    const requestWipe = async () => {
        // Aviso inicial de intenção
        if (!await confirm({ 
            title: 'RESET TOTAL DE DADOS', 
            message: 'Você solicitou a limpeza total. Vamos gerar um backup OBRIGATÓRIO antes. Continuar?', 
            confirmText: 'Iniciar Processo',
            isDestructive: false 
        })) return;

        setPendingAction('WIPE_SEQUENCE');
        setShowPasswordModal(true);
    };

    // --- TEXTOS DINÂMICOS DO MODAL ---
    const getModalTitle = () => {
        if (pendingAction === 'BACKUP') return 'Proteção de Dados';
        if (pendingAction === 'RESTORE') return 'Confirmar Restauração';
        return 'Segurança Máxima';
    };

    const getModalDescription = () => {
        if (pendingAction === 'BACKUP') return 'Para exportar os dados sensíveis do sistema, confirme sua senha.';
        if (pendingAction === 'RESTORE') return 'Para sobrescrever o banco de dados com o backup, confirme sua senha.';
        return 'Para apagar permanentemente todos os dados, confirme sua senha.';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
             
             {/* MODAL DE PREVIEW DO RESTORE */}
             {restorePreview && (
                <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-[#021D34]/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col transition-colors">
                        <div className="bg-[#021D34] dark:bg-slate-900 p-6 text-white flex justify-between items-center shrink-0 transition-colors">
                            <h3 className="text-xl font-bold flex items-center gap-2"><FileUp size={24}/> Restaurar Backup</h3>
                            <button onClick={() => setRestorePreview(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            <div className="bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 p-4 rounded-xl transition-colors">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Arquivo Selecionado</p>
                                <p className="font-bold text-[#021D34] dark:text-white text-lg truncate">{restorePreview.fileName}</p>
                                <div className="flex gap-4 mt-2 text-sm text-slate-600 dark:text-slate-300">
                                    <span className="flex items-center gap-1"><Database size={14}/> {restorePreview.fileSize}</span>
                                    <span className="flex items-center gap-1"><Calendar size={14}/> {restorePreview.date}</span>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2"><Activity size={16}/> Resumo Geral:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Cards de Estatística */}
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center dark:bg-slate-700 dark:border-slate-600 transition-colors">
                                        <div className="text-blue-600 dark:text-blue-400 mb-1 flex justify-center"><Package size={20}/></div>
                                        <span className="block font-bold text-lg leading-none dark:text-white">{restorePreview.counts.items}</span>
                                        <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">Itens</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center dark:bg-slate-700 dark:border-slate-600 transition-colors">
                                        <div className="text-green-600 dark:text-green-400 mb-1 flex justify-center"><Users size={20}/></div>
                                        <span className="block font-bold text-lg leading-none dark:text-white">{restorePreview.counts.users}</span>
                                        <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">Usuários</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center dark:bg-slate-700 dark:border-slate-600 transition-colors">
                                        <div className="text-purple-600 dark:text-purple-400 mb-1 flex justify-center"><FileText size={20}/></div>
                                        <span className="block font-bold text-lg leading-none dark:text-white">{restorePreview.counts.logs}</span>
                                        <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">Logs</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center dark:bg-slate-700 dark:border-slate-600 transition-colors">
                                        <div className="text-orange-600 dark:text-orange-400 mb-1 flex justify-center"><History size={20}/></div>
                                        <span className="block font-bold text-lg leading-none dark:text-white">{restorePreview.detailedStats.totalHistoryEvents}</span>
                                        <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">Históricos</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detalhes dos Itens por Status */}
                            {restorePreview.counts.items > 0 && (
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2"><Package size={16}/> Detalhes dos Itens:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(restorePreview.detailedStats.statusCounts).map(([status, count]) => {
                                            const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200' };
                                            if (count === 0) return null;
                                            return (
                                                <div key={status} className={`flex justify-between items-center p-2 rounded border text-xs font-bold uppercase ${config.color}`}>
                                                    <span>{config.label}</span>
                                                    <span className="bg-white/50 px-2 py-0.5 rounded text-sm">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex gap-3 text-yellow-800 text-sm dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200 transition-colors">
                                <AlertTriangle className="shrink-0"/>
                                <p>Ao confirmar, os dados atuais serão <strong>substituídos</strong>. Será solicitada sua senha.</p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700 flex gap-3 shrink-0 transition-colors">
                            <button onClick={() => setRestorePreview(null)} className="flex-1 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancelar</button>
                            <button onClick={requestRestore} className="flex-1 py-3 font-bold text-white bg-[#009DE0] hover:bg-[#008bc5] dark:bg-sky-600 dark:hover:bg-sky-500 rounded-xl shadow-lg shadow-blue-200 dark:shadow-sky-900/20 transition-colors">Continuar...</button>
                        </div>
                    </div>
                </div>
             )}

             {/* MODAL DE SENHA UNIFICADO */}
             {showPasswordModal && (
                <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-[#021D34]/80 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 p-6 text-center transition-colors">
                        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${pendingAction === 'BACKUP' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                            {pendingAction === 'BACKUP' ? <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400"/> : <Lock className="w-8 h-8 text-red-600 dark:text-red-400"/>}
                        </div>
                        <h3 className="text-xl font-bold text-[#021D34] dark:text-white mb-2">{getModalTitle()}</h3>
                        
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            {getModalDescription()}
                        </p>
                        
                        <input 
                            type="password" 
                            autoFocus
                            placeholder="Sua senha atual"
                            className={`w-full p-3 border rounded-xl mb-4 text-center text-lg outline-none transition-all 
                                bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600
                                ${pendingAction === 'BACKUP' ? 'focus:border-blue-500 focus:ring-2 focus:ring-blue-100' : 'focus:border-red-500 focus:ring-2 focus:ring-red-100'}
                            `}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSuccess()}
                        />
                        
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPasswordModal(false); setPassword(''); setPendingAction(null); }} className="flex-1 py-3 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancelar</button>
                            <button 
                                onClick={handlePasswordSuccess} 
                                disabled={!password || verifyingPass}
                                className={`flex-1 py-3 font-bold text-white rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2 ${pendingAction === 'BACKUP' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:bg-blue-600 dark:hover:bg-blue-500' : 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:bg-red-600 dark:hover:bg-red-500'}`}
                            >
                                {verifyingPass ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
             )}

             <div className="space-y-4">
                 {/* Card Backup Manual */}
                 <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                     <h3 className="font-bold text-[#021D34] dark:text-white flex items-center gap-2 mb-2"><Database size={20}/> Backup Manual</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Salva todos os materiais, logs e permissões de usuários.</p>
                     <button onClick={requestBackup} disabled={loading} className="w-full bg-[#009DE0] dark:bg-sky-600 text-white py-3 rounded-lg font-bold flex justify-center gap-2 hover:bg-[#008bc5] dark:hover:bg-sky-500 disabled:opacity-50 transition-colors">
                         {loading && pendingAction === 'BACKUP' ? <Loader2 className="animate-spin"/> : <FileDown size={20}/>} 
                         {loading && pendingAction === 'BACKUP' ? 'Processando...' : 'Baixar JSON'}
                     </button>
                 </div>

                 {/* Card Restaurar */}
                 <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                     <h3 className="font-bold text-[#021D34] dark:text-white flex items-center gap-2 mb-2"><FileUp size={20}/> Restaurar</h3>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Recupera o sistema a partir de um arquivo JSON.</p>
                     <label className={`w-full border border-dashed border-slate-300 dark:border-slate-600 py-3 rounded-lg font-bold flex justify-center gap-2 text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                         {loading && statusMsg.includes('Analisando') ? <Loader2 className="animate-spin"/> : <FileUp size={20}/>}
                         <span>{loading && statusMsg.includes('Analisando') ? 'Lendo...' : 'Selecionar Arquivo'}</span>
                         <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" disabled={loading}/>
                     </label>
                 </div>
             </div>
             
             {/* Zona de Perigo */}
             <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl border border-red-200 dark:border-red-900/30 flex flex-col justify-center relative overflow-hidden transition-colors">
                 {/* Feedback visual de progresso (Overlay) */}
                 {loading && statusMsg && (
                     <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4 text-center animate-in fade-in transition-colors">
                         <Loader2 className="w-10 h-10 text-[#009DE0] dark:text-sky-400 animate-spin mb-3"/>
                         <p className="text-[#021D34] dark:text-white font-bold text-lg">{statusMsg}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Por favor, não feche a página.</p>
                     </div>
                 )}

                 <div className="flex items-center gap-2 text-red-800 dark:text-red-400 mb-2">
                    <AlertTriangle size={24}/>
                    <h3 className="font-bold text-lg">Zona de Perigo</h3>
                 </div>
                 <p className="text-sm text-red-700 dark:text-red-300 mb-6 leading-relaxed">
                     Esta ação irá <strong>ZERAR</strong> todas as movimentações e logs.<br/><br/>
                     <span className="font-bold">O que será APAGADO:</span> Itens, Históricos, Logs e Avisos.<br/>
                     <span className="font-bold">O que será MANTIDO:</span> Usuários, Tipos e Configurações.
                 </p>
                 
                 <button onClick={requestWipe} disabled={loading} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition-colors">
                     <Trash2 size={20}/> RESETAR TUDO E BAIXAR BACKUP
                 </button>
             </div>
        </div>
    );
}