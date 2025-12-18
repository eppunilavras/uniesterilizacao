import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  collection, query, where, orderBy, limit, startAt, endAt, 
  startAfter, getDocs, updateDoc, doc, setDoc, serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { 
  Search, Edit2, Ban, Loader2, ArrowDown, Upload, 
  FileUp, X, CheckSquare, Square, AlertTriangle, 
  CheckCircle2, XCircle, Users, Eye, EyeOff 
} from 'lucide-react';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query'; 

import { db, appId, firebaseConfig } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { logEvent } from '../utils/logger';
import { maskCPF, translateFirebaseError } from '../utils/formatters';
import { ROLE_LABELS } from '../constants';
import DataTable from '../components/DataTable';

const userSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(14, "CPF incompleto"), 
  role: z.enum(['student', 'tech', 'admin']),
  active: z.boolean(),
  password: z.string().optional(),
});

export default function UserManagement({ userProfile }) {
    const [view, setView] = useState('list');
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [filterRole, setFilterRole] = useState('all');
    
    // Novo estado para controlar a visibilidade de inativos
    const [showInactive, setShowInactive] = useState(false);
    
    // Client para gerir o Cache
    const queryClient = useQueryClient();

    const { 
        register, 
        handleSubmit, 
        setValue, 
        reset, 
        formState: { errors, isSubmitting } 
    } = useForm({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: '', email: '', cpf: '', role: 'student', password: '', active: true
        }
    });

    const [editing, setEditing] = useState(null);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [importing, setImporting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [csvPreview, setCsvPreview] = useState([]); 
    const [selectedImportIndices, setSelectedImportIndices] = useState(new Set()); 
    const [importStats, setImportStats] = useState({ ignored: 0 }); 
    const fileInputRef = useRef(null);

    const { addToast } = useToast();
    const { confirm, alert } = useDialog();

    const formatSearchTerm = (text) => {
		if (!text) return '';
		if (text.startsWith('"') && text.endsWith('"') && text.length > 2) return text.slice(1, -1);
		const trimmed = text.trim();
		if (/\d/.test(trimmed)) return trimmed.replace(/\D/g, ''); 
		return trimmed.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
	};

    const getSecondaryApp = () => {
        return !getApps().some(app => app.name === 'Secondary') 
            ? initializeApp(firebaseConfig, "Secondary") 
            : getApp("Secondary");
    };

    const checkCpfExists = async (cpf, excludeUid = null) => {
        const cleanCpf = cpf.replace(/\D/g, ''); 
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users_directory'), where('cpf', '==', cleanCpf));
        const snap = await getDocs(q);
        
        if (snap.empty) return false;
        
        if (excludeUid) {
            return snap.docs.some(d => d.id !== excludeUid);
        }
        
        return true;
    };

    const fetchUsers = async (searchTerm = '') => {
        setLoading(true); setHasMore(true); setLastDoc(null);
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const constraints = [];
            
            if (filterRole !== 'all') constraints.push(where('role', '==', filterRole));

            if (!showInactive) {
                constraints.push(where('active', '==', true));
            }

            if (searchTerm.length > 2) {
                const term = formatSearchTerm(searchTerm);
                const isNumeric = /^\d+$/.test(term); 
                if (isNumeric) {
                    constraints.push(orderBy('cpf')); constraints.push(startAt(term)); constraints.push(endAt(term + '\uf8ff'));
                } else {
                    constraints.push(orderBy('name')); constraints.push(startAt(term)); constraints.push(endAt(term + '\uf8ff'));
                }
                constraints.push(limit(20));
            } else {
                constraints.push(orderBy('createdAt', 'desc')); constraints.push(limit(20));
            }

            const q = query(usersRef, ...constraints);
            const snapshot = await getDocs(q);
            setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            
            if (snapshot.docs.length < 20) setHasMore(false);
            if (searchTerm.length > 2) setHasMore(false);

        } catch (error) { 
            console.error("Erro utilizadores:", error); 
            if (error.code === 'failed-precondition') {
                 console.warn("Falta índice composto. Verifique a consola do Firebase.");
            }
        } finally { setLoading(false); }
    };

    const loadMore = async () => {
        if (!lastDoc || loadingMore) return;
        setLoadingMore(true);
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const constraints = [];
            
            if (filterRole !== 'all') constraints.push(where('role', '==', filterRole));
            if (!showInactive) constraints.push(where('active', '==', true));
            
            constraints.push(orderBy('createdAt', 'desc')); 
            constraints.push(startAfter(lastDoc)); 
            constraints.push(limit(20));
            
            const q = query(usersRef, ...constraints);
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const newUsers = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
                setUsers(prev => [...prev, ...newUsers]);
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
                if (snapshot.docs.length < 20) setHasMore(false);
            } else { setHasMore(false); }
        } catch (e) { console.error(e); } setLoadingMore(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => { fetchUsers(search); }, 500);
        return () => clearTimeout(timer);
    }, [search, filterRole, showInactive]);

    const onSubmit = async (data) => {
        if (!editing && (!data.password || data.password.length < 6)) {
            addToast('A senha deve ter no mínimo 6 caracteres para novos utilizadores.', 'error');
            return;
        }

        try {
            const cleanCpf = data.cpf.replace(/\D/g, '');
            const batch = writeBatch(db);
            const isStudent = data.role === 'student'; // Verifica se é aluno para invalidar cache

            if (editing) {
                if (!data.active) {
                    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('studentId', '==', editing.uid), where('status', '!=', 'retirado'));
                    const snap = await getDocs(q);
                    if (!snap.empty) { addToast(`Não é possível inativar. Utilizador tem itens pendentes.`, 'error'); return; }
                }
                
                if (await checkCpfExists(cleanCpf, editing.uid)) {
                    addToast('Este CPF já está a ser usado.', 'error');
                    return;
                }

                const updates = { name: data.name, email: data.email, cpf: cleanCpf, role: data.role, active: data.active };
                
                // --- DETECÇÃO DE MUDANÇAS PARA LOG (MELHORIA) ---
                const changesDetected = [];
                if (editing.role !== data.role) changesDetected.push(`Perfil: ${editing.role} -> ${data.role}`);
                if (editing.active !== data.active) changesDetected.push(`Status: ${editing.active ? 'Ativo' : 'Inativo'} -> ${data.active ? 'Ativo' : 'Inativo'}`);
                if (editing.name !== data.name) changesDetected.push(`Nome alterado`);
                if (editing.email !== data.email) changesDetected.push(`Email alterado`);
                if (editing.cpf !== cleanCpf) changesDetected.push(`CPF alterado`);
                // ------------------------------------------------

                batch.update(doc(db, 'artifacts', appId, 'users', editing.uid, 'profile', 'data'), updates);
                batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', editing.uid), updates);
                
                await batch.commit();

                // --- CACHE UPDATE ---
                if (isStudent || editing.role === 'student') {
                    console.log("Aluno editado. Invalidando cache...");
                    await queryClient.invalidateQueries({ queryKey: ['students_full_directory_v2'] });
                }

                // --- LOG MELHORADO COM DETALHES ---
                await logEvent('USER_MGMT', `Utilizador atualizado: ${data.name}`, { 
                    targetUid: editing.uid, 
                    updates: updates,
                    changesSummary: changesDetected.join(', ') || 'Atualização de dados cadastrais',
                    executor: userProfile.email 
                });
                
                addToast('Dados atualizados!', 'success');
            } else {
                if (await checkCpfExists(cleanCpf)) {
                    addToast('Este CPF já está registado.', 'error');
                    return;
                }

                const secondaryApp = getSecondaryApp();
                const secondaryAuth = getAuth(secondaryApp);
                const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
                
                const newData = { 
                    name: data.name, email: data.email, cpf: cleanCpf, role: data.role, active: true, createdAt: serverTimestamp() 
                };
                
                batch.set(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'), newData);
                batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', cred.user.uid), newData);
                
                await batch.commit();

                // --- CACHE UPDATE ---
                if (isStudent) {
                    console.log("Novo aluno criado. Invalidando cache...");
                    await queryClient.invalidateQueries({ queryKey: ['students_full_directory_v2'] });
                }
                
                await logEvent('USER_MGMT', `Novo utilizador registado: ${data.name}`, { 
                    targetUid: cred.user.uid,
                    email: data.email, 
                    role: data.role, 
                    executor: userProfile.email 
                });

                await signOut(secondaryAuth);
                addToast('Utilizador criado!', 'success');
            }
            
            reset();
            setEditing(null);
            setView('list');
            fetchUsers(search); 

        } catch(e) { 
            addToast(translateFirebaseError(e), 'error'); 
        }
    };

    const handleEditClick = (u) => {
        setEditing(u);
        reset({
            name: u.name,
            email: u.email,
            cpf: maskCPF(u.cpf),
            role: u.role,
            active: u.active !== false,
            password: ''
        });
        setView('form');
    };

    const handleNewClick = () => {
        setEditing(null);
        reset({ name: '', email: '', cpf: '', role: 'student', password: '', active: true });
        setView('form');
    };

    const handleInactivate = async (u) => {
        if (u.uid === userProfile.uid) { addToast('Não pode inativar a si mesmo.', 'error'); return; }
        
        // Verifica pendências antes de inativar (status != 'retirado')
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
            where('studentId', '==', u.uid), 
            where('status', '!=', 'retirado'), // <-- Query melhorada
            limit(1)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) { 
            // Mensagem padronizada com a edição
            addToast(`Não é possível inativar. Utilizador tem itens pendentes.`, 'error'); 
            return; 
        }

        if(!await confirm({ 
            title: 'Inativar Acesso', 
            message: `Deseja suspender o acesso de ${u.name}? O histórico será mantido, mas o login será bloqueado.`, 
            isDestructive: true, 
            confirmText: 'Inativar'
        })) return;
        
        try {
            const batch = writeBatch(db);
            // Atualiza perfil privado e diretório público
            batch.update(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), { active: false });
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', u.uid), { active: false });
            await batch.commit();

            // Invalida cache se for aluno
            if (u.role === 'student') {
                await queryClient.invalidateQueries({ queryKey: ['students_full_directory_v2'] });
            }

            await logEvent('USER_MGMT', `Utilizador inativado: ${u.name}`, { targetUid: u.uid, executor: userProfile.email });
            addToast('Acesso suspenso com sucesso.', 'success');
            
            fetchUsers(search);
        } catch(e) {
            addToast('Erro ao inativar utilizador.', 'error');
            console.error(e);
        }
    };

    const handleFileSelect = (e) => {
         const file = e.target.files[0];
         if (!file) return;
 
         const reader = new FileReader();
         reader.onload = (event) => {
             const text = event.target.result;
             const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
             if (rows[0].toLowerCase().includes('email')) rows.shift();
 
             const parsedData = [];
             let ignoredCount = 0;
 
             rows.forEach((row, index) => {
                 const cols = row.split(',').map(c => c.trim());
                 if (cols.length < 5) return; 
 
                 const [name, email, cpfRaw, roleRaw, password] = cols;
                 let role = roleRaw.toLowerCase();
                 if (['aluno', 'student'].includes(role)) role = 'student';
                 if (['técnico', 'tecnico', 'tech'].includes(role)) role = 'tech';
                 if (['administrador', 'admin'].includes(role)) role = 'admin';
 
                 if (userProfile.role === 'tech' && role !== 'student') {
                     ignoredCount++;
                     return;
                 }
 
                 parsedData.push({
                     id: index,
                     name,
                     email,
                     cpf: cpfRaw.replace(/\D/g, ''),
                     role,
                     password
                 });
             });
 
             if (parsedData.length === 0) {
                 addToast(ignoredCount > 0 ? 'Nenhum utilizador válido.' : 'Arquivo inválido.', 'error');
                 e.target.value = '';
                 return;
             }
 
             setCsvPreview(parsedData);
             setImportStats({ ignored: ignoredCount });
             setSelectedImportIndices(new Set(parsedData.map(p => p.id)));
             setShowImportModal(true);
             e.target.value = '';
         };
         reader.readAsText(file);
     };

     const executeImport = async () => {
         if (selectedImportIndices.size === 0) return;
         setImporting(true);
         
         let success = 0;
         let errors = 0;
         
         // Categorização dos erros para melhor feedback
         const conflicts = []; // Para CPFs ou Emails já existentes
         const systemFailures = []; // Para outros erros (senha fraca, conexão, etc)
         
         const secondaryApp = getSecondaryApp();
         const secondaryAuth = getAuth(secondaryApp);
         const toImport = csvPreview.filter(item => selectedImportIndices.has(item.id));
         let importedStudents = 0;
 
         for (const user of toImport) {
             // 1. Verificação prévia de CPF (Firestore)
             if (await checkCpfExists(user.cpf)) {
                 errors++; 
                 conflicts.push({
                     name: user.name,
                     reason: `CPF ${maskCPF(user.cpf)} já está em uso.`,
                     type: 'CPF'
                 });
                 continue;
             }

             try {
                 // 2. Tentativa de criação no Auth
                 const cred = await createUserWithEmailAndPassword(secondaryAuth, user.email, user.password);
                 
                 const data = { 
                     name: user.name, 
                     email: user.email, 
                     cpf: user.cpf, 
                     role: user.role, 
                     active: true, 
                     createdAt: serverTimestamp() 
                 };
                 
                 const batch = writeBatch(db);
                 batch.set(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'), data);
                 batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', cred.user.uid), data);
                 await batch.commit();

                 await logEvent('USER_MGMT', `Importação CSV: Criado ${user.name}`, { 
                     targetUid: cred.user.uid,
                     email: user.email, 
                     role: user.role, 
                     executor: userProfile.email 
                 });
                 
                 success++;
                 if (user.role === 'student') importedStudents++;

             } catch (err) {
                 errors++; 
                 if (err.code === 'auth/email-already-in-use') {
                     conflicts.push({
                        name: user.name,
                        reason: `Email ${user.email} já está em uso.`,
                        type: 'Email'
                     });
                 } else {
                     systemFailures.push({
                        name: user.name,
                        reason: translateFirebaseError(err)
                     });
                 }
             }
         }
 
         await signOut(secondaryAuth);
         
         if (importedStudents > 0) {
             await queryClient.invalidateQueries({ queryKey: ['students_full_directory_v2'] });
         }

         setImporting(false);
         setShowImportModal(false);
         setCsvPreview([]);
 
         if (errors > 0) {
             await alert({ 
                 title: 'Resultado da Importação', 
                 message: (
                     <div className="space-y-4">
                         <div className="flex gap-4">
                             <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-100 dark:border-green-900 flex-1 justify-center">
                                 <CheckCircle2 size={18}/> 
                                 <div className="flex flex-col leading-none text-left">
                                     <span className="font-bold text-lg">{success}</span>
                                     <span className="text-[10px] uppercase">Sucessos</span>
                                 </div>
                             </div>
                             <div className="flex items-center gap-2 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900 flex-1 justify-center">
                                 <XCircle size={18}/> 
                                 <div className="flex flex-col leading-none text-left">
                                     <span className="font-bold text-lg">{errors}</span>
                                     <span className="text-[10px] uppercase">Falhas</span>
                                 </div>
                             </div>
                         </div>

                         {/* Seção de Usuários já cadastrados (Conflitos) */}
                         {conflicts.length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900 rounded-lg overflow-hidden">
                                <div className="bg-orange-100 dark:bg-orange-900/30 px-3 py-2 border-b border-orange-200 dark:border-orange-900 text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase flex items-center gap-2">
                                    <AlertTriangle size={14}/> Utilizadores já existentes
                                </div>
                                <div className="max-h-32 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {conflicts.map((c, i) => (
                                        <div key={i} className="text-xs flex flex-col border-b border-orange-100 dark:border-orange-900 last:border-0 pb-1 mb-1 last:mb-0">
                                            <span className="font-bold text-orange-900 dark:text-orange-200">{c.name}</span>
                                            <span className="text-orange-700 dark:text-orange-400 opacity-80">{c.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}

                         {/* Seção de Erros Diversos */}
                         {systemFailures.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    Outras Falhas de Registo
                                </div>
                                <div className="max-h-32 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {systemFailures.map((f, i) => (
                                        <div key={i} className="text-xs flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 last:border-0 pb-1 mb-1 last:mb-0">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{f.name}:</span>
                                            <span className="text-red-500">{f.reason}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         )}
                     </div>
                 ) 
             });
         } else { 
             addToast(`${success} utilizadores importados com sucesso!`, 'success'); 
         }
         fetchUsers(search);
     };

     const toggleSelect = (id) => { const newSet = new Set(selectedImportIndices); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedImportIndices(newSet); };
     const toggleAll = () => { if (selectedImportIndices.size === csvPreview.length) setSelectedImportIndices(new Set()); else setSelectedImportIndices(new Set(csvPreview.map(i => i.id))); };

    return (
        <div className="space-y-6 transition-colors">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-bold text-[#021D34] dark:text-white text-2xl flex items-center gap-2 w-full md:w-auto transition-colors">
                    <Users className="text-[#009DE0]"/> Gestão de Utilizadores
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative">
                        <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">
                            <FileUp size={16}/> Importar CSV
                        </button>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => { setView('list'); setEditing(null); reset(); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'list' ? 'bg-[#021D34] text-white shadow-sm' : 'bg-white dark:bg-slate-800 dark:text-slate-200 border dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Listar</button>
                        <button onClick={handleNewClick} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'form' ? 'bg-[#021D34] text-white shadow-sm' : 'bg-white dark:bg-slate-800 dark:text-slate-200 border dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Novo</button>
                    </div>
                </div>
            </div>

            {view === 'list' && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 mb-2 flex items-center gap-2 transition-colors">
                    <Upload size={12}/> Formato CSV: <strong>Nome, Email, CPF, Perfil (Aluno/Técnico/Admin), Senha</strong>
                </div>
            )}

            {showImportModal && (
                 <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-[#021D34]/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 border dark:border-slate-700 transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div><h3 className="text-xl font-bold text-[#021D34] dark:text-white">Confirmar Importação</h3><p className="text-sm text-slate-500 dark:text-slate-400">Selecione os utilizadores que deseja registar.</p></div>
                            <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-300"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-auto p-0 bg-slate-50 dark:bg-slate-900">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white dark:bg-slate-800 sticky top-0 z-10 shadow-sm text-slate-600 dark:text-slate-300">
                                    <tr>
                                        <th className="p-4 w-12 text-center"><button onClick={toggleAll} className="text-[#009DE0]">{selectedImportIndices.size === csvPreview.length ? <CheckSquare size={20}/> : <Square size={20}/>}</button></th>
                                        <th className="p-4 font-bold">Nome</th><th className="p-4 font-bold">Email</th><th className="p-4 font-bold">Perfil</th><th className="p-4 font-bold">CPF</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {csvPreview.map((item) => (
                                        <tr key={item.id} className={`transition-colors ${selectedImportIndices.has(item.id) ? 'bg-white dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-900 opacity-60'}`}>
                                            <td className="p-4 text-center"><button onClick={() => toggleSelect(item.id)} className={`${selectedImportIndices.has(item.id) ? 'text-[#009DE0]' : 'text-slate-400 dark:text-slate-500'}`}>{selectedImportIndices.has(item.id) ? <CheckSquare size={20}/> : <Square size={20}/>}</button></td>
                                            <td className="p-4 font-medium text-[#021D34] dark:text-white">{item.name}</td><td className="p-4 text-slate-600 dark:text-slate-300">{item.email}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${item.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : item.role === 'tech' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{ROLE_LABELS[item.role] || item.role}</span></td>
                                            <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{maskCPF(item.cpf)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 rounded-b-2xl transition-colors">
                            <div className="text-sm dark:text-slate-300"><span className="font-bold text-[#009DE0]">{selectedImportIndices.size}</span> selecionados de <span className="font-bold">{csvPreview.length}</span>.{importStats.ignored > 0 && <span className="ml-2 text-orange-600 dark:text-orange-400 text-xs flex items-center gap-1 inline-flex"><AlertTriangle size={12}/> {importStats.ignored} ignorados (permissão).</span>}</div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button onClick={() => setShowImportModal(false)} className="flex-1 md:flex-none px-6 py-3 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" disabled={importing}>Cancelar</button>
                                <button onClick={executeImport} disabled={importing || selectedImportIndices.size === 0} className="flex-1 md:flex-none px-6 py-3 bg-[#021D34] text-white rounded-xl font-bold hover:bg-[#009DE0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20">{importing ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar Importação'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'list' ? (
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                         <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <input className="w-full pl-10 p-2 border dark:border-slate-600 rounded-lg outline-none focus:border-[#009DE0] bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors" placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)}/>
                            {loading && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>}
                         </div>
                         <div className="flex gap-2">
                             <select className="p-2 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full md:w-auto transition-colors" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                                <option value="all">Todos os Perfis</option>
                                <option value="student">Alunos</option>
                                <option value="tech">Técnicos</option>
                                <option value="admin">Administradores</option>
                             </select>
                             <button 
                                onClick={() => setShowInactive(!showInactive)}
                                className={`p-2 border rounded-lg transition-colors flex items-center gap-2 ${showInactive ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                title={showInactive ? "Ocultar Inativos" : "Mostrar Inativos"}
                             >
                                {showInactive ? <EyeOff size={20}/> : <Eye size={20}/>}
                                <span className="text-xs font-bold hidden sm:inline">Inativos</span>
                             </button>
                         </div>
                    </div>
                    {search.length > 2 && <div className="text-xs text-slate-400 px-2 mb-2">A pesquisar por: <span className="font-bold">"{formatSearchTerm(search)}"</span></div>}
                    <DataTable 
                        columns={[
                            { key: 'name', label: 'Nome', sortable: true, render: (u) => <div><p className="font-medium text-[#021D34] dark:text-white">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div> },
                            { key: 'cpf', label: 'CPF', render: (u) => maskCPF(u.cpf) },
                            { key: 'role', label: 'Perfil', sortable: true, render: (u) => <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300':u.role==='tech'?'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300':'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{ROLE_LABELS[u.role] || u.role}</span> },
                            { key: 'active', label: 'Status', render: (u) => <span className={`text-xs font-bold px-2 py-1 rounded ${u.active !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{u.active !== false ? 'Ativo' : 'Inativo'}</span> }
                        ]}
                        data={users} 
                        emptyMsg={loading ? 'A pesquisar...' : 'Nenhum utilizador encontrado.'}
                        mobileRender={(u) => (
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-[#021D34] dark:text-white">{u.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{u.email}</p>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300':u.role==='tech'?'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300':'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{ROLE_LABELS[u.role] || u.role}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${u.active !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>{u.active !== false ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        actions={(u) => {
                            const canEdit = userProfile.role === 'admin' || (userProfile.role === 'tech' && u.role === 'student');
                            
                            if (!canEdit) return null;
                            return (
                                <div className="flex gap-2 justify-center">
                                    <button onClick={() => handleEditClick(u)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded bg-slate-50 dark:bg-slate-900 border border-blue-100 dark:border-blue-900" title="Editar"><Edit2 size={16}/></button>
                                    
                                    {/* Botão de Inativar (Ban) - Só aparece se estiver ATIVO */}
                                    {u.active !== false && (
                                        <button onClick={() => handleInactivate(u)} className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded bg-slate-50 dark:bg-slate-900 border border-orange-100 dark:border-orange-900" title="Inativar/Bloquear Acesso">
                                            <Ban size={16}/>
                                        </button>
                                    )}
                                </div>
                            );
                        }}
                    />
                    {!loading && hasMore && search.length <= 2 && (
                        <div className="flex justify-center pt-4">
                            <button onClick={loadMore} disabled={loadingMore} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50">
                                {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                                {loadingMore ? 'A pesquisar...' : 'Ver Mais Utilizadores'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 max-w-2xl mx-auto shadow-sm transition-colors">
                    <h3 className="font-bold text-lg mb-6 border-b border-slate-100 dark:border-slate-700 pb-2 text-[#021D34] dark:text-white">{editing ? 'Editar Utilizador' : 'Registar Novo'}</h3>
                    
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nome</label>
                                <input 
                                    className={`w-full p-3 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${errors.name ? 'border-red-500' : ''}`} 
                                    {...register("name")}
                                />
                                {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">CPF</label>
                                <input 
                                    className={`w-full p-3 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${errors.cpf ? 'border-red-500' : ''}`} 
                                    {...register("cpf")}
                                    onChange={(e) => {
                                        const masked = maskCPF(e.target.value);
                                        setValue('cpf', masked);
                                    }}
                                    maxLength={14}
                                />
                                {errors.cpf && <span className="text-xs text-red-500">{errors.cpf.message}</span>}
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Email</label>
                                <input 
                                    type="email" 
                                    className={`w-full p-3 border dark:border-slate-600 rounded-lg text-slate-900 dark:text-white ${errors.email ? 'border-red-500' : ''} ${editing ? 'bg-slate-100 dark:bg-slate-900 cursor-not-allowed text-slate-500' : 'bg-white dark:bg-slate-900'}`} 
                                    {...register("email")}
                                    disabled={!!editing}
                                />
                                {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                            </div>
                            
                            {!editing ? (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Senha Inicial</label>
                                    <input 
                                        type="password" 
                                        className={`w-full p-3 border dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${errors.password ? 'border-red-500' : ''}`} 
                                        {...register("password")}
                                    />
                                    {errors.password && <span className="text-xs text-red-500">{errors.password.message}</span>}
                                </div>
                            ) : (
                                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <span className="italic">Para alterar a senha, utilize a função "Esqueci a Senha" na tela de login.</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 border border-slate-100 dark:border-slate-700">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Função</label>
                                <select 
                                    className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white" 
                                    {...register("role")}
                                >
                                    <option value="student">Aluno</option>
                                    {userProfile.role === 'admin' && <><option value="tech">Técnico</option><option value="admin">Administrador</option></>}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-0 md:mt-5">
                                <input 
                                    type="checkbox" 
                                    className="rounded text-[#009DE0] focus:ring-[#009DE0] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                    {...register("active")}
                                />
                                <span className="font-bold text-sm text-[#021D34] dark:text-white">Conta Ativa</span>
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => { setView('list'); reset(); }} className="flex-1 border dark:border-slate-600 p-4 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                            <button 
                                disabled={isSubmitting} 
                                className="flex-1 bg-[#021D34] text-white p-4 rounded-lg font-bold hover:bg-[#009DE0] transition-colors flex justify-center items-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="animate-spin w-5 h-5"/>}
                                {editing ? 'Salvar Alterações' : 'Criar Conta'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}