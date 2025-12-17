import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { 
  Trash2, 
  Search,
  AlertTriangle 
} from 'lucide-react';

import { db, appId } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import DataTable from '../../components/DataTable';
import { logEvent } from '../../utils/logger';

export default function AdminMaterials() {
    const [mats, setMats] = useState([]);
    const [name, setName] = useState('');
    const [search, setSearch] = useState(''); 
    const [verifying, setVerifying] = useState(false);
    
    const { addToast } = useToast();
    const { confirm } = useDialog();

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), 
            s => setMats(s.docs.map(d => ({id: d.id, ...d.data()})))
        );
        return () => unsub();
    }, []);

    const add = async () => {
        if (!name) return;
        
        const exists = mats.some(m => m.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            addToast('Já existe um material com este nome.', 'warning');
            return;
        }

        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), { name });
            await logEvent('ADMIN_OPT', 'Material Criado', { name });
            setName('');
            addToast('Tipo adicionado!', 'success');
        } catch (error) {
            console.error(error);
            addToast('Erro ao adicionar.', 'error');
        }
    };

    const remove = async (id, materialName) => {
        setVerifying(true);
        try {
            // 1. VERIFICAÇÃO DE DEPENDÊNCIA
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'items'),
                where('type', '==', materialName),
                limit(1)
            );

            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // BLOQUEIA A EXCLUSÃO
                await confirm({
                    title: 'Exclusão Bloqueada',
                    message: (
                        <div className="space-y-3">
                            {/* CORREÇÃO AQUI: Classes de cor para Dark Mode */}
                            <p className="text-slate-700 dark:text-slate-300">
                                Não é possível remover o tipo <strong className="text-slate-900 dark:text-white">"{materialName}"</strong>.
                            </p>
                            
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex gap-2 items-start transition-colors">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span>Existem itens registrados usando este material!</span>
                            </div>
                        </div>
                    ),
                    confirmText: 'Entendi',
                    cancelText: null,
                    isDestructive: false
                });
                return;
            }

            // 2. CONFIRMAÇÃO NORMAL
            const confirmed = await confirm({ 
                title: 'Remover Tipo', 
                message: (
                    <span className="text-slate-700 dark:text-slate-300">
                        Deseja remover <strong className="text-slate-900 dark:text-white">"{materialName}"</strong>?
                    </span>
                ), 
                isDestructive: true 
            });

            if(confirmed) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materialTypes', id));
                await logEvent('ADMIN_OPT', 'Material Removido', { id, name: materialName });
                addToast('Tipo removido.', 'success');
            }

        } catch (error) {
            console.error(error);
            addToast('Erro ao verificar dependências.', 'error');
        } finally {
            setVerifying(false);
        }
    };

    const filteredAndSortedMats = useMemo(() => {
        return mats
            .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [mats, search]);

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in relative">
            
            {/* Overlay de carregamento */}
            {verifying && (
                <div className="absolute inset-0 z-50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg text-xs font-bold text-slate-600 dark:text-slate-300 animate-pulse border border-slate-200 dark:border-slate-700">
                        Verificando registros...
                    </div>
                </div>
            )}

            {/* Barra de Pesquisa */}
            <div className="flex flex-col md:flex-row gap-4">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500"/>
                    <input 
                        className="w-full pl-10 p-3 border rounded-lg text-sm outline-none focus:border-[#009DE0] focus:ring-1 focus:ring-[#009DE0] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                        placeholder="Pesquisar material..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                    />
                 </div>
            </div>

            {/* Adicionar Novo */}
            <div className="flex flex-col md:flex-row gap-2">
                <input 
                    className="flex-1 p-3 border rounded-lg outline-none focus:border-[#009DE0] focus:ring-1 focus:ring-[#009DE0] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                    placeholder="Nome do Novo Material (ex: Kit Ortodontia)" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                />
                <button 
                    onClick={add} 
                    className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold w-full md:w-auto hover:bg-[#009DE0] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                    disabled={verifying || !name}
                >
                    Adicionar
                </button>
            </div>
            
            <DataTable 
                columns={[{ key: 'name', label: 'Nome do Material', sortable: true }]}
                data={filteredAndSortedMats} 
                emptyMsg="Nenhum material encontrado."
                mobileRender={(m) => <div className="font-medium text-[#021D34] dark:text-white">{m.name}</div>}
                actions={(m) => (
                    <button 
                        onClick={() => remove(m.id, m.name)} 
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remover"
                        disabled={verifying}
                    >
                        <Trash2 size={16}/>
                    </button>
                )}
            />
        </div>
    );
}