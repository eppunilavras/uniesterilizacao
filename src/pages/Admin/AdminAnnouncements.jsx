import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  X, 
  Clock, 
  CalendarClock, 
  ArrowRightLeft, 
  Eye, 
  Edit2, 
  Trash2 
} from 'lucide-react';

// Imports internos (Voltando 2 níveis)
import { db, appId } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';

export default function AdminAnnouncements() {
    const [anns, setAnns] = useState([]);
    const [form, setForm] = useState({ title: '', content: '', imageUrl: '', validFrom: '', validUntil: '' });
    const [editingId, setEditingId] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    
    const { addToast } = useToast();
    const { confirm } = useDialog();

	useEffect(() => {
		const q = query(
			collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), 
			orderBy('createdAt', 'desc'),
			limit(20)
		);
		const unsub = onSnapshot(q, s => setAnns(s.docs.map(d => ({id: d.id, ...d.data()}))));
		return () => unsub();
	}, []);

    const save = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'announcements', editingId), { 
                    ...form, 
                    updatedAt: serverTimestamp() 
                });
                addToast('Recado atualizado!', 'success');
                setEditingId(null);
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), { 
                    ...form, 
                    createdAt: serverTimestamp() 
                });
                addToast('Recado publicado!', 'success');
            }
            setForm({ title: '', content: '', imageUrl: '', validFrom: '', validUntil: '' });
        } catch (error) {
            console.error(error);
            addToast('Erro ao salvar recado.', 'error');
        }
    };

    const handleEdit = (item) => {
        setForm({
            title: item.title,
            content: item.content,
            imageUrl: item.imageUrl || '',
            validFrom: item.validFrom || '',
            validUntil: item.validUntil || ''
        });
        setEditingId(item.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const remove = async (id) => {
        if(await confirm({ title: 'Excluir Recado', message: 'Tem certeza que deseja apagar este recado?', isDestructive: true })) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'announcements', id));
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setForm({ title: '', content: '', imageUrl: '', validFrom: '', validUntil: '' });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {previewItem && (
                <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewItem(null)}>
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-[#021D34]">Pré-visualização</h3>
                            <button onClick={() => setPreviewItem(null)} className="p-1 hover:bg-slate-100 rounded"><X size={20}/></button>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            {previewItem.imageUrl ? (
                                <div className="h-32 overflow-hidden relative">
                                    <img src={previewItem.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                    <span className="absolute bottom-2 left-3 text-white text-xs font-bold bg-[#009DE0] px-2 py-0.5 rounded shadow">Comunicado</span>
                                </div>
                            ) : (
                                <div className="h-2 bg-[#009DE0] w-full"/>
                            )}
                            <div className="p-5">
                                <h4 className="font-bold text-[#021D34] text-lg mb-2">{previewItem.title}</h4>
                                <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{previewItem.content}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={save} className="space-y-4 border-r-0 md:border-r md:pr-6 border-slate-100 order-last md:order-first">
                <div className="flex justify-between items-center md:hidden">
                    <h4 className="font-bold text-[#021D34]">{editingId ? 'Editar Recado' : 'Novo Recado'}</h4>
                    {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-red-500">Cancelar</button>}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Título</label>
                    <input className="w-full p-3 border rounded-lg text-sm" placeholder="Título do Aviso" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required/>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Mensagem</label>
                    <textarea className="w-full p-3 border rounded-lg text-sm h-32" placeholder="Conteúdo do recado..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} required/>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">URL da Imagem (Opcional)</label>
                    <input className="w-full p-3 border rounded-lg text-sm" placeholder="https://..." value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Início da Exibição</label>
                        <input type="datetime-local" className="w-full p-3 border rounded-lg text-xs" value={form.validFrom} onChange={e => setForm({...form, validFrom: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Fim da Exibição</label>
                        <input type="datetime-local" className="w-full p-3 border rounded-lg text-xs" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})}/>
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    {editingId && (
                        <button type="button" onClick={cancelEdit} className="flex-1 bg-slate-100 text-slate-600 p-3 rounded-lg font-bold">Cancelar</button>
                    )}
                    <button className="flex-1 bg-[#021D34] text-white p-3 rounded-lg font-bold">{editingId ? 'Salvar Alterações' : 'Publicar Recado'}</button>
                </div>
            </form>

            <div className="md:col-span-2 space-y-4">
                <h4 className="font-bold text-[#021D34] mb-2 md:hidden">Recados Existentes</h4>
                {anns.map(a => (
                    <div key={a.id} className={`flex flex-col md:flex-row justify-between items-start bg-slate-50 p-4 rounded-xl border transition-all ${editingId === a.id ? 'border-[#009DE0] ring-2 ring-blue-100' : 'border-slate-200'}`}>
                        <div className="mb-2 md:mb-0 flex-1">
                            <h4 className="font-bold text-[#009DE0]">{a.title}</h4>
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                                <CalendarClock size={12}/>
                                {a.validFrom ? new Date(a.validFrom).toLocaleString() : 'Imediato'} 
                                <ArrowRightLeft size={10} className="mx-1"/> 
                                {a.validUntil ? new Date(a.validUntil).toLocaleString() : 'Indefinido'}
                            </div>
                        </div>
                        <div className="flex gap-1 self-end md:self-start ml-4">
                            <button onClick={() => setPreviewItem(a)} className="text-slate-400 hover:text-[#009DE0] p-2 hover:bg-white rounded-lg transition-colors" title="Pré-visualizar">
                                <Eye size={16}/>
                            </button>
                            <button onClick={() => handleEdit(a)} className="text-blue-400 hover:text-blue-600 p-2 hover:bg-white rounded-lg transition-colors" title="Editar">
                                <Edit2 size={16}/>
                            </button>
                            <button onClick={() => remove(a.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-white rounded-lg transition-colors" title="Excluir">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
                {anns.length === 0 && <p className="text-center text-slate-400 py-4">Nenhum recado publicado.</p>}
            </div>
        </div>
    );
}