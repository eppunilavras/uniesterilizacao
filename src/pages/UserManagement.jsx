import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  collection, query, where, orderBy, limit, startAt, endAt, 
  startAfter, getDocs, updateDoc, doc, setDoc, serverTimestamp,
  writeBatch // <--- IMPORTADO
} from 'firebase/firestore';
import { 
  Search, Edit2, Trash2, Loader2, ArrowDown, Upload, 
  FileUp, X, CheckSquare, Square, AlertTriangle, 
  CheckCircle2, XCircle, Users 
} from 'lucide-react';

// --- NOVOS IMPORTS DE VALIDAÇÃO ---
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Imports internos
import { db, appId, firebaseConfig } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { logEvent } from '../utils/logger';
import { maskCPF, translateFirebaseError } from '../utils/formatters';
import { ROLE_LABELS } from '../constants';
import DataTable from '../components/DataTable';

// --- DEFINIÇÃO DO SCHEMA ZOD ---
const userSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z.string().min(14, "CPF incompleto"), // Espera formato 000.000.000-00
  role: z.enum(['student', 'tech', 'admin']),
  active: z.boolean(),
  password: z.string().optional(), // Senha é opcional na edição, obrigatória na criação (validado no submit)
});

export default function UserManagement({ userProfile }) {
    const [view, setView] = useState('list');
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [filterRole, setFilterRole] = useState('all');
    
    // Configuração do React Hook Form
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
    
    // Estados para paginação
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Estados para Importação CSV
    const [importing, setImporting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [csvPreview, setCsvPreview] = useState([]); 
    const [selectedImportIndices, setSelectedImportIndices] = useState(new Set()); 
    const [importStats, setImportStats] = useState({ ignored: 0 }); 
    const fileInputRef = useRef(null);

    const { addToast } = useToast();
    const { confirm, alert } = useDialog();

    // Helpers de Busca e Firebase
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
        if (excludeUid) return snap.docs.some(d => d.id !== excludeUid);
        return true;
    };

    // --- CARREGAMENTO DE USUÁRIOS ---
    const fetchUsers = async (searchTerm = '') => {
        setLoading(true); setHasMore(true); setLastDoc(null);
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const constraints = [];
            if (filterRole !== 'all') constraints.push(where('role', '==', filterRole));

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
        } catch (error) { console.error("Erro usuários:", error); } finally { setLoading(false); }
    };

    const loadMore = async () => {
        if (!lastDoc || loadingMore) return;
        setLoadingMore(true);
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const constraints = [];
            if (filterRole !== 'all') constraints.push(where('role', '==', filterRole));
            constraints.push(orderBy('createdAt', 'desc')); constraints.push(startAfter(lastDoc)); constraints.push(limit(20));
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
    }, [search, filterRole]);

    // --- FUNÇÃO DE SAVE COM CORREÇÃO DE BATCH ---
    const onSubmit = async (data) => {
        if (!editing && (!data.password || data.password.length < 6)) {
            addToast('Senha deve ter no mínimo 6 caracteres para novos usuários.', 'error');
            return;
        }

        try {
            const cleanCpf = data.cpf.replace(/\D/g, '');
            const batch = writeBatch(db); // <--- INICIA BATCH

            if (editing) {
                // Lógica de Edição
                if (!data.active) {
                    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('studentId', '==', editing.uid), where('status', '!=', 'retirado'));
                    const snap = await getDocs(q);
                    if (!snap.empty) { addToast(`Não é possível inativar. Usuário tem itens pendentes.`, 'error'); return; }
                }
                
                if (await checkCpfExists(cleanCpf, editing.uid)) {
                    addToast('Este CPF já está sendo usado por outro usuário.', 'error');
                    return;
                }

                const updates = { name: data.name, email: data.email, cpf: cleanCpf, role: data.role, active: data.active };
                
                // Adiciona operações ao Batch
                batch.update(doc(db, 'artifacts', appId, 'users', editing.uid, 'profile', 'data'), updates);
                batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', editing.uid), updates);
                
                await batch.commit(); // <--- EXECUTA TUDO JUNTO

                await logEvent('USER_MGMT', `Usuário atualizado: ${data.name}`, { uid: editing.uid, changes: updates, executor: userProfile.email });
                addToast('Dados atualizados!', 'success');
            } else {
                // Lógica de Criação
                if (await checkCpfExists(cleanCpf)) {
                    addToast('Este CPF já está cadastrado no sistema.', 'error');
                    return;
                }

                const secondaryApp = getSecondaryApp();
                const secondaryAuth = getAuth(secondaryApp);
                const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
                
                const newData = { 
                    name: data.name, email: data.email, cpf: cleanCpf, role: data.role, active: true, createdAt: serverTimestamp() 
                };
                
                // Adiciona operações ao Batch
                batch.set(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'), newData);
                batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', cred.user.uid), newData);
                
                await batch.commit(); // <--- EXECUTA TUDO JUNTO
                
                await logEvent('USER_MGMT', `Novo usuário cadastrado: ${data.name}`, { email: data.email, role: data.role, executor: userProfile.email });
                await signOut(secondaryAuth);
                addToast('Usuário criado!', 'success');
            }
            
            reset();
            setEditing(null);
            setView('list');
            fetchUsers(search); 

        } catch(e) { 
            addToast(translateFirebaseError(e), 'error'); 
        }
    };

    // Handler para abrir o formulário de edição
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

    // Handler de exclusão COM BATCH
    const handleDelete = async (u) => {
        if (u.uid === userProfile.uid) { addToast('Não pode excluir a si mesmo.', 'error'); return; }
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('studentId', '==', u.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty && snap.docs[0].data().status !== 'retirado') { addToast(`Não é possível excluir. Usuário possui itens pendentes.`, 'error'); return; }

        if(!await confirm({ title: 'Desativar Usuário', message: `Deseja realmente excluir/desativar ${u.name}?`, isDestructive: true })) return;
        
        try {
            const batch = writeBatch(db); // <--- INICIA BATCH
            batch.update(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), { active: false });
            batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', u.uid), { active: false });
            await batch.commit(); // <--- EXECUTA

            await logEvent('USER_MGMT', `Usuário desativado: ${u.name}`, { targetUid: u.uid, executor: userProfile.email });
            addToast('Usuário desativado.', 'success');
            fetchUsers(search);
        } catch(e) {
            addToast('Erro ao desativar usuário.', 'error');
            console.error(e);
        }
    };

    // --- FUNÇÕES DE IMPORTAÇÃO CSV ---
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
                 addToast(ignoredCount > 0 ? 'Nenhum usuário válido para seu nível de permissão.' : 'Arquivo inválido.', 'error');
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
         const errorDetails = [];
         const secondaryApp = getSecondaryApp();
         const secondaryAuth = getAuth(secondaryApp);
         const toImport = csvPreview.filter(item => selectedImportIndices.has(item.id));
 
         for (const user of toImport) {
             if (await checkCpfExists(user.cpf)) {
                 errors++; errorDetails.push(`${user.name}: CPF ${user.cpf} já cadastrado.`); continue;
             }
             try {
                 const cred = await createUserWithEmailAndPassword(secondaryAuth, user.email, user.password);
                 const data = { name: user.name, email: user.email, cpf: user.cpf, role: user.role, active: true, createdAt: serverTimestamp() };
                 
                 // CORREÇÃO: BATCH POR USUÁRIO NA IMPORTAÇÃO
                 const batch = writeBatch(db);
                 batch.set(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'), data);
                 batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', cred.user.uid), data);
                 await batch.commit();

                 await logEvent('USER_MGMT', `Importação CSV: Criado ${user.name}`, { email: user.email, role: user.role, executor: userProfile.email });
                 success++;
             } catch (err) {
                 errors++; console.error(`Erro ao importar ${user.email}:`, err);
                 const msg = err.code === 'auth/email-already-in-use' ? 'Email já cadastrado.' : translateFirebaseError(err);
                 errorDetails.push(`${user.email}: ${msg}`);
             }
         }
 
         await signOut(secondaryAuth);
         setImporting(false);
         setShowImportModal(false);
         setCsvPreview([]);
 
         if (errors > 0) {
             await alert({ 
                 title: 'Resultado da Importação', 
                 message: (
                     <div className="space-y-4">
                         <div className="flex gap-4">
                             <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100 flex-1 justify-center"><CheckCircle2 size={18}/> <div className="flex flex-col leading-none"><span className="font-bold text-lg">{success}</span><span className="text-[10px] uppercase">Sucessos</span></div></div>
                             <div className="flex items-center gap-2 text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex-1 justify-center"><XCircle size={18}/> <div className="flex flex-col leading-none"><span className="font-bold text-lg">{errors}</span><span className="text-[10px] uppercase">Falhas</span></div></div>
                         </div>
                         <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                             <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Detalhes dos Erros</div>
                             <div className="max-h-48 overflow-y-auto p-2 space-y-2 custom-scrollbar">{errorDetails.map((err, i) => (<div key={i} className="text-xs flex gap-2 items-start text-slate-600 border-b border-slate-100 last:border-0 pb-1 last:pb-0"><span className="text-slate-400 font-mono select-none">{i+1}.</span><span>{err}</span></div>))}</div>
                         </div>
                     </div>
                 ) 
             });
         } else { addToast(`${success} usuários importados com sucesso!`, 'success'); }
         fetchUsers(search);
     };

     const toggleSelect = (id) => { const newSet = new Set(selectedImportIndices); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedImportIndices(newSet); };
     const toggleAll = () => { if (selectedImportIndices.size === csvPreview.length) setSelectedImportIndices(new Set()); else setSelectedImportIndices(new Set(csvPreview.map(i => i.id))); };


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2 w-full md:w-auto">
                    <Users className="text-[#009DE0]"/> Gestão de Usuários
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative">
                        <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
                            <FileUp size={16}/> Importar CSV
                        </button>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => { setView('list'); setEditing(null); reset(); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold ${view === 'list' ? 'bg-[#021D34] text-white' : 'bg-white border'}`}>Listar</button>
                        <button onClick={handleNewClick} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold ${view === 'form' ? 'bg-[#021D34] text-white' : 'bg-white border'}`}>Novo</button>
                    </div>
                </div>
            </div>

            {view === 'list' && (
                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-200 mb-2 flex items-center gap-2">
                    <Upload size={12}/> Formato CSV: <strong>Nome, Email, CPF, Perfil (Aluno/Técnico/Admin), Senha</strong>
                </div>
            )}

            {showImportModal && (
                 <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-[#021D34]/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div><h3 className="text-xl font-bold text-[#021D34]">Confirmar Importação</h3><p className="text-sm text-slate-500">Selecione os usuários que deseja cadastrar.</p></div>
                            <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-auto p-0 bg-slate-50">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm text-slate-600">
                                    <tr>
                                        <th className="p-4 w-12 text-center"><button onClick={toggleAll} className="text-[#009DE0]">{selectedImportIndices.size === csvPreview.length ? <CheckSquare size={20}/> : <Square size={20}/>}</button></th>
                                        <th className="p-4 font-bold">Nome</th><th className="p-4 font-bold">Email</th><th className="p-4 font-bold">Perfil</th><th className="p-4 font-bold">CPF</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {csvPreview.map((item) => (
                                        <tr key={item.id} className={`transition-colors ${selectedImportIndices.has(item.id) ? 'bg-white' : 'bg-slate-100 opacity-60'}`}>
                                            <td className="p-4 text-center"><button onClick={() => toggleSelect(item.id)} className={`${selectedImportIndices.has(item.id) ? 'text-[#009DE0]' : 'text-slate-400'}`}>{selectedImportIndices.has(item.id) ? <CheckSquare size={20}/> : <Square size={20}/>}</button></td>
                                            <td className="p-4 font-medium text-[#021D34]">{item.name}</td><td className="p-4 text-slate-600">{item.email}</td>
                                            <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${item.role === 'admin' ? 'bg-purple-100 text-purple-700' : item.role === 'tech' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{ROLE_LABELS[item.role] || item.role}</span></td>
                                            <td className="p-4 text-slate-500 font-mono text-xs">{maskCPF(item.cpf)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 rounded-b-2xl">
                            <div className="text-sm"><span className="font-bold text-[#009DE0]">{selectedImportIndices.size}</span> selecionados de <span className="font-bold">{csvPreview.length}</span>.{importStats.ignored > 0 && <span className="ml-2 text-orange-600 text-xs flex items-center gap-1 inline-flex"><AlertTriangle size={12}/> {importStats.ignored} ignorados (permissão).</span>}</div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button onClick={() => setShowImportModal(false)} className="flex-1 md:flex-none px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors" disabled={importing}>Cancelar</button>
                                <button onClick={executeImport} disabled={importing || selectedImportIndices.size === 0} className="flex-1 md:flex-none px-6 py-3 bg-[#021D34] text-white rounded-xl font-bold hover:bg-[#009DE0] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20">{importing ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar Importação'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'list' ? (
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                         <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <input className="w-full pl-10 p-2 border rounded-lg outline-none focus:border-[#009DE0]" placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)}/>
                            {loading && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>}
                         </div>
                         <select className="p-2 border rounded-lg bg-white w-full md:w-auto" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                            <option value="all">Todos os Perfis</option>
                            <option value="student">Alunos</option>
                            <option value="tech">Técnicos</option>
                            <option value="admin">Administradores</option>
                         </select>
                    </div>
                    {search.length > 2 && <div className="text-xs text-slate-400 px-2 mb-2">Buscando por: <span className="font-bold">"{formatSearchTerm(search)}"</span></div>}
                    <DataTable 
                        columns={[
                            { key: 'name', label: 'Nome', sortable: true, render: (u) => <div><p className="font-medium text-[#021D34]">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div> },
                            { key: 'cpf', label: 'CPF', render: (u) => maskCPF(u.cpf) },
                            { key: 'role', label: 'Perfil', sortable: true, render: (u) => <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='tech'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{ROLE_LABELS[u.role] || u.role}</span> },
                            { key: 'active', label: 'Status', render: (u) => <span className={`text-xs font-bold px-2 py-1 rounded ${u.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active !== false ? 'Ativo' : 'Inativo'}</span> }
                        ]}
                        data={users} 
                        emptyMsg={loading ? 'Buscando...' : 'Nenhum usuário encontrado.'}
                        mobileRender={(u) => (
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-[#021D34]">{u.name}</h4>
                                    <p className="text-xs text-slate-500 mb-1">{u.email}</p>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='tech'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{ROLE_LABELS[u.role] || u.role}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${u.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active !== false ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        actions={(u) => {
                            const canEdit = userProfile.role === 'admin' || (userProfile.role === 'tech' && u.role === 'student');
                            const canDelete = userProfile.role === 'admin';
                            if (!canEdit && !canDelete) return null;
                            return (
                                <div className="flex gap-2 justify-center">
                                    {canEdit && <button onClick={() => handleEditClick(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded bg-slate-50 border border-blue-100"><Edit2 size={16}/></button>}
                                    {canDelete && <button onClick={() => handleDelete(u)} className="p-2 text-red-600 hover:bg-red-50 rounded bg-slate-50 border border-red-100"><Trash2 size={16}/></button>}
                                </div>
                            );
                        }}
                    />
                    {!loading && hasMore && search.length <= 2 && (
                        <div className="flex justify-center pt-4">
                            <button onClick={loadMore} disabled={loadingMore} className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50">
                                {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                                {loadingMore ? 'Buscando...' : 'Ver Mais Usuários'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-8 rounded-xl border border-slate-200 max-w-2xl mx-auto shadow-sm">
                    <h3 className="font-bold text-lg mb-6 border-b pb-2">{editing ? 'Editar Usuário' : 'Cadastrar Novo'}</h3>
                    
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Nome</label>
                                <input 
                                    className={`w-full p-3 border rounded-lg ${errors.name ? 'border-red-500' : ''}`} 
                                    {...register("name")}
                                />
                                {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">CPF</label>
                                <input 
                                    className={`w-full p-3 border rounded-lg ${errors.cpf ? 'border-red-500' : ''}`} 
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
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Email</label>
                                <input 
                                    type="email" 
                                    className={`w-full p-3 border rounded-lg ${errors.email ? 'border-red-500' : ''} ${editing ? 'bg-slate-100 cursor-not-allowed' : ''}`} 
                                    {...register("email")}
                                    disabled={!!editing}
                                />
                                {errors.email && <span className="text-xs text-red-500">{errors.email.message}</span>}
                            </div>
                            
                            {!editing ? (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Senha Inicial</label>
                                    <input 
                                        type="password" 
                                        className={`w-full p-3 border rounded-lg ${errors.password ? 'border-red-500' : ''}`} 
                                        {...register("password")}
                                    />
                                    {errors.password && <span className="text-xs text-red-500">{errors.password.message}</span>}
                                </div>
                            ) : (
                                <div className="flex items-center text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <span className="italic">Para alterar a senha, utilize a função "Esqueci a Senha" na tela de login.</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Função</label>
                                <select 
                                    className="w-full p-2 border rounded bg-white" 
                                    {...register("role")}
                                >
                                    <option value="student">Aluno</option>
                                    {userProfile.role === 'admin' && <><option value="tech">Técnico</option><option value="admin">Administrador</option></>}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-0 md:mt-5">
                                <input 
                                    type="checkbox" 
                                    className="rounded text-[#009DE0] focus:ring-[#009DE0]"
                                    {...register("active")}
                                />
                                <span className="font-bold text-sm">Conta Ativa</span>
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => { setView('list'); reset(); }} className="flex-1 border p-4 rounded-lg font-bold hover:bg-slate-50">Cancelar</button>
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