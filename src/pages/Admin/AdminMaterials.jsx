import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Trash2, 
  Search 
} from 'lucide-react';

// Imports internos (Voltando 2 níveis)
import { db, appId } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import DataTable from '../../components/DataTable';

export default function AdminMaterials() {
    const [mats, setMats] = useState([]);
    const [name, setName] = useState('');
    const [search, setSearch] = useState(''); 
    
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
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), { name });
            setName('');
            addToast('Tipo adicionado!', 'success');
        } catch (error) {
            console.error(error);
            addToast('Erro ao adicionar.', 'error');
        }
    };

    const remove = async (id) => {
        if(await confirm({ title: 'Remover Tipo', message: 'Deseja remover este tipo de material?', isDestructive: true })) {
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materialTypes', id));
                addToast('Tipo removido.', 'success');
            } catch (error) {
                console.error(error);
                addToast('Erro ao remover.', 'error');
            }
        }
    };

    // Filtragem e ordenação local
    const filteredAndSortedMats = useMemo(() => {
        return mats
            .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [mats, search]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            
            <div className="flex flex-col md:flex-row gap-4">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                    <input 
                        className="w-full pl-10 p-3 border rounded-lg text-sm outline-none focus:border-[#009DE0]" 
                        placeholder="Pesquisar material..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                    />
                 </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
                <input 
                    className="flex-1 p-3 border rounded-lg outline-none focus:border-[#009DE0]" 
                    placeholder="Nome do Novo Material (ex: Kit Ortodontia)" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                />
                <button 
                    onClick={add} 
                    className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold w-full md:w-auto hover:bg-[#009DE0] transition-colors"
                >
                    Adicionar
                </button>
            </div>
            
            <DataTable 
                columns={[{ key: 'name', label: 'Nome do Material', sortable: true }]}
                data={filteredAndSortedMats} 
                emptyMsg="Nenhum material encontrado."
                mobileRender={(m) => <div className="font-medium text-[#021D34]">{m.name}</div>}
                actions={(m) => (
                    <button 
                        onClick={() => remove(m.id)} 
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                        title="Remover"
                    >
                        <Trash2 size={16}/>
                    </button>
                )}
            />
        </div>
    );
}