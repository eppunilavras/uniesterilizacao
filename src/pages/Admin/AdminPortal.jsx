import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { 
  Trash2, Plus, Save, Link as LinkIcon, 
  Edit2, ArrowUp, ArrowDown, Eye, EyeOff, X, BarChart2,
  ChevronLeft, ExternalLink
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { logEvent } from '../../utils/logger';
import { ICON_MAP, AVAILABLE_ICONS } from '../../utils/iconMap';
import LinkStatsModal from '../../components/LinkStatsModal';

const CATEGORIES = [
    { id: 'geral', label: 'Geral', color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' },
    { id: 'academico', label: 'Acadêmico', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' },
    { id: 'clinico', label: 'Clínica', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800' },
    { id: 'pesquisa', label: 'Pesquisa', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' },
    { id: 'admin', label: 'Admin', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' }
];

const DEFAULT_FORM = { 
    name: '', 
    url: '', 
    description: '', 
    icon: 'globe', 
    btnText: 'ACESSAR SISTEMA', 
    active: true,
    order: 0,
    category: 'geral'
};

export default function AdminPortal() {
  const [links, setLinks] = useState([]);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [statsLink, setStatsLink] = useState(null);
  
  // Controle de Visualização Mobile
  const [mobileMode, setMobileMode] = useState('list'); // 'list' | 'form'
  
  const { addToast } = useToast();

  useEffect(() => {
    const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'external_links'), 
        orderBy('order', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Ao editar, força abertura do form
  useEffect(() => {
    if (editingId) setMobileMode('form');
  }, [editingId]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.url) return addToast('Preencha nome e URL', 'error');
    
    try {
        const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'external_links');
        const dataToSave = {
            ...formData,
            order: editingId ? formData.order : (links.length > 0 ? Math.max(...links.map(l => l.order || 0)) + 1 : 0)
        };

        if (editingId) {
            await updateDoc(doc(collectionRef, editingId), { ...dataToSave, updatedAt: new Date() });
            await logEvent('ADMIN_OPT', `Editou sistema: ${formData.name}`, {});
            addToast('Sistema atualizado!', 'success');
        } else {
            await addDoc(collectionRef, { ...dataToSave, clicks: 0, createdAt: new Date() });
            await logEvent('ADMIN_OPT', `Criou sistema: ${formData.name}`, {});
            addToast('Sistema criado!', 'success');
        }
        resetForm();
    } catch (error) {
        console.error(error);
        addToast('Erro ao salvar.', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Remover "${name}" permanentemente?`)) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'external_links', id));
      addToast('Sistema removido.', 'info');
    }
  };

  const handleEdit = (item) => {
      setFormData({ ...DEFAULT_FORM, ...item });
      setEditingId(item.id);
      setMobileMode('form'); 
  };

  const handleToggleActive = async (item) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'external_links', item.id), { active: !item.active });
  };

  const moveItem = async (index, direction) => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === links.length - 1) return;

      const newLinks = [...links];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]];

      const batch = writeBatch(db);
      newLinks.forEach((item, idx) => {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'external_links', item.id);
          batch.update(docRef, { order: idx });
      });
      await batch.commit();
  };

  const resetForm = () => {
      setFormData(DEFAULT_FORM);
      setEditingId(null);
      setMobileMode('list');
  };

  // --- COMPONENTES AUXILIARES ---

  const IconSelector = () => (
    <div className="w-full">
        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block px-1">Ícone</label>
        <div className="flex gap-2 overflow-x-auto pb-2 w-full no-scrollbar">
            {AVAILABLE_ICONS.map(iconKey => {
            const IconComp = ICON_MAP[iconKey];
            const isSelected = formData.icon === iconKey;
            return (
                <button 
                key={iconKey}
                onClick={() => setFormData({...formData, icon: iconKey})}
                type="button"
                className={`p-2 rounded-lg border transition-all shrink-0 ${
                    isSelected 
                    ? 'bg-[#009DE0] text-white border-[#009DE0] shadow-sm' 
                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
                >
                <IconComp size={20} />
                </button>
            )
            })}
        </div>
    </div>
  );

  // --- MOBILE VIEWS ---

  // 1. Tela de Formulário Mobile (OVERLAY FIXO - Resolve estouro e tamanho)
  const MobileFormView = () => (
    <div className="fixed inset-0 z-[60] bg-[#F8FAFC] dark:bg-[#0b1120] flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Header Compacto */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-3 flex items-center justify-between shrink-0 shadow-sm">
            <button 
                onClick={resetForm} 
                className="p-1.5 -ml-1 text-slate-500 active:bg-slate-100 rounded-lg dark:text-slate-400 dark:active:bg-slate-800"
            >
                <ChevronLeft size={24}/>
            </button>
            <h2 className="text-sm font-bold text-[#021D34] dark:text-white uppercase tracking-wide">
                {editingId ? 'Editar' : 'Novo Sistema'}
            </h2>
            <div className="w-8"/> {/* Espaçador */}
        </div>

        {/* Corpo Scrollável */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
            
            {/* Inputs Compactos */}
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block px-1">Nome</label>
                    <input 
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-[#021D34] dark:text-white focus:border-[#009DE0] focus:ring-1 focus:ring-[#009DE0] outline-none"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: Biblioteca"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block px-1">URL</label>
                    <input 
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 focus:border-[#009DE0] focus:ring-1 focus:ring-[#009DE0] outline-none font-mono"
                        value={formData.url}
                        onChange={e => setFormData({...formData, url: e.target.value})}
                        placeholder="https://..."
                    />
                </div>
            </div>

            {/* Grid de Categorias (Evita estouro) */}
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block px-1">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => {
                        const isSelected = formData.category === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setFormData({...formData, category: cat.id})}
                                type="button"
                                className={`py-2 rounded-lg text-[10px] font-bold border transition-all text-center truncate px-1 ${
                                    isSelected 
                                    ? 'bg-[#021D34] text-white border-[#021D34] dark:bg-sky-600 dark:border-sky-600' 
                                    : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}
                            >
                                {cat.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            <IconSelector />

            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block px-1">Descrição</label>
                    <textarea 
                        className="w-full h-20 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 focus:border-[#009DE0] focus:ring-1 focus:ring-[#009DE0] outline-none resize-none"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Opcional..."
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block px-1">Texto do Botão</label>
                    <input 
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-[#009DE0] focus:ring-1 focus:ring-[#009DE0] outline-none uppercase"
                        value={formData.btnText}
                        onChange={e => setFormData({...formData, btnText: e.target.value})}
                        placeholder="ACESSAR"
                    />
                </div>
            </div>
        </div>

        {/* Footer Fixo */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 pb-safe">
            <button 
                onClick={handleSubmit}
                className="w-full py-3 bg-[#009DE0] text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
                <Save size={18} /> {editingId ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
        </div>
    </div>
  );

  // 2. Tela de Lista Mobile
  const MobileListView = () => (
    <div className="md:hidden flex flex-col w-full pb-20">
        <div className="flex items-center justify-between mb-4 mt-2 px-1">
            <div>
                <h2 className="text-lg font-bold text-[#021D34] dark:text-white">Sistemas</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{links.length} cadastrados</p>
            </div>
            <button 
                onClick={() => { resetForm(); setMobileMode('form'); }}
                className="h-9 px-3 bg-[#021D34] dark:bg-white text-white dark:text-[#021D34] rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
            >
                <Plus size={16}/> Novo
            </button>
        </div>

        <div className="space-y-3">
            {links.map((link, idx) => {
                const IconComp = ICON_MAP[link.icon] || ICON_MAP['globe'];
                const isActive = link.active !== false;
                const catConfig = CATEGORIES.find(c => c.id === link.category) || CATEGORIES[0];

                return (
                    <div key={link.id} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 relative w-full overflow-hidden">
                        
                        {!isActive && (
                            <div className="absolute top-0 right-0 bg-slate-100 dark:bg-slate-700 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg border-l border-b border-slate-200 dark:border-slate-600">
                                OCULTO
                            </div>
                        )}

                        <div className="flex items-start gap-3 mb-2">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-50 text-[#009DE0] dark:bg-slate-700 dark:text-sky-400' : 'bg-slate-100 text-slate-300'}`}>
                                <IconComp size={18} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-[#021D34] dark:text-white text-sm truncate pr-8">{link.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-bold uppercase px-1 py-px rounded border ${catConfig.color}`}>
                                        {catConfig.label}
                                    </span>
                                    <a href={link.url} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 truncate max-w-[100px]">
                                        {link.url.replace(/^https?:\/\//, '')}
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-50 dark:border-slate-700/50 justify-between">
                            <div className="flex gap-1">
                                <button onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="p-1.5 rounded-md text-slate-400 bg-slate-50 dark:bg-slate-700/50 disabled:opacity-20"><ArrowUp size={14}/></button>
                                <button onClick={() => moveItem(idx, 'down')} disabled={idx === links.length - 1} className="p-1.5 rounded-md text-slate-400 bg-slate-50 dark:bg-slate-700/50 disabled:opacity-20"><ArrowDown size={14}/></button>
                            </div>
                            
                            <div className="flex gap-2">
                                <button onClick={() => setStatsLink(link)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md"><BarChart2 size={16}/></button>
                                <button onClick={() => handleToggleActive(link)} className={`p-1.5 rounded-md ${isActive ? 'text-slate-400' : 'text-green-600'}`}>{isActive ? <Eye size={16}/> : <EyeOff size={16}/>}</button>
                                <button onClick={() => handleEdit(link)} className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-md"><Edit2 size={16}/></button>
                                <button onClick={() => handleDelete(link.id, link.name)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-md"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
        
        {links.length === 0 && (
             <div className="text-center py-8 text-slate-400 text-xs">Nenhum sistema cadastrado.</div>
        )}
    </div>
  );

  // --- DESKTOP RENDER (MANTIDO) ---
  const DesktopLayout = () => (
    <div className="hidden md:block w-full max-w-5xl mx-auto px-0">
        <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-[#009DE0] dark:text-sky-400 rounded-xl">
                <LinkIcon size={24}/>
            </div>
            <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#021D34] dark:text-white">Portal de Sistemas</h2>
                <p className="text-base text-slate-500 dark:text-slate-400">Gerencie os links e visualize as estatísticas.</p>
            </div>
        </div>

        <div className={`p-5 rounded-xl border shadow-sm transition-colors w-full mb-8 ${editingId ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-[#021D34] dark:text-white flex items-center gap-2">
                    {editingId ? <><Edit2 size={18}/> Editando</> : <><Plus size={18}/> Novo Sistema</>}
                </h3>
                {editingId && (
                    <button onClick={resetForm} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-red-100"><X size={14}/> CANCELAR</button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nome</label>
                    <input className="w-full h-11 px-3 border rounded-lg outline-none focus:border-[#009DE0] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">URL</label>
                    <input className="w-full h-11 px-3 border rounded-lg outline-none focus:border-[#009DE0] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} />
                </div>
            </div>

            <div className="mb-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Categoria</label>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setFormData({...formData, category: cat.id})} className={`px-3 py-2 rounded-lg text-xs font-bold border ${formData.category === cat.id ? 'bg-[#021D34] text-white border-[#021D34] dark:bg-sky-600 dark:border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'}`}>
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            <IconSelector />

            <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Descrição</label>
                    <input className="w-full h-11 px-3 border rounded-lg outline-none focus:border-[#009DE0] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Botão</label>
                    <input className="w-full h-11 px-3 border rounded-lg outline-none focus:border-[#009DE0] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" value={formData.btnText} onChange={e => setFormData({...formData, btnText: e.target.value})} />
                </div>
            </div>

            <button onClick={handleSubmit} className={`w-full text-white py-3 rounded-xl font-bold mt-6 flex items-center justify-center gap-2 shadow-lg active:scale-95 ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#021D34] hover:bg-[#009DE0] dark:bg-sky-600 dark:hover:bg-sky-500'}`}>
                <Save size={20} /> {editingId ? 'Salvar' : 'Cadastrar'}
            </button>
        </div>

        <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-4">Sistemas Cadastrados ({links.length})</h3>
        <div className="space-y-3">
            {links.map((link, index) => {
                const IconComp = ICON_MAP[link.icon] || ICON_MAP['globe'];
                const isActive = link.active !== false;
                const catConfig = CATEGORIES.find(c => c.id === link.category) || CATEGORIES[0];
                return (
                    <div key={link.id} className={`flex p-4 rounded-xl border items-center gap-4 transition-all ${isActive ? 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700' : 'bg-slate-50 border-slate-200 opacity-70 dark:bg-slate-900/50 dark:border-slate-800'}`}>
                        <div className="flex flex-col gap-1 shrink-0">
                            <button onClick={() => moveItem(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-[#009DE0] disabled:opacity-20"><ArrowUp size={16}/></button>
                            <button onClick={() => moveItem(index, 'down')} disabled={index === links.length - 1} className="p-1 text-slate-400 hover:text-[#009DE0] disabled:opacity-20"><ArrowDown size={16}/></button>
                        </div>
                        <div className={`w-12 h-12 shrink-0 rounded-lg flex items-center justify-center ${isActive ? 'bg-blue-50 text-[#009DE0] dark:bg-blue-900/20 dark:text-sky-400' : 'bg-slate-200 text-slate-400'}`}>
                            <IconComp size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${catConfig.color}`}>{catConfig.label}</span>
                                {!isActive && <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded">INATIVO</span>}
                            </div>
                            <h4 className={`font-bold truncate ${isActive ? 'text-[#021D34] dark:text-white' : 'text-slate-500 line-through'}`}>{link.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{link.description}</p>
                        </div>
                        <div className="flex items-center gap-2 border-l pl-4 border-slate-100 dark:border-slate-700">
                            <button onClick={() => setStatsLink(link)} className="p-2 text-[#009DE0] bg-blue-50 hover:bg-[#009DE0] hover:text-white rounded-lg transition-colors flex items-center gap-2"><BarChart2 size={18}/> <span className="text-xs font-bold">{link.clicks || 0}</span></button>
                            <button onClick={() => handleToggleActive(link)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">{isActive ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
                            <button onClick={() => handleEdit(link)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/> </button>
                            <button onClick={() => handleDelete(link.id, link.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      
      {!!statsLink && (
        <LinkStatsModal 
            isOpen={!!statsLink} 
            onClose={() => setStatsLink(null)} 
            link={statsLink} 
        />
      )}

      {/* MOBILE */}
      {mobileMode === 'form' ? <MobileFormView /> : <MobileListView />}
      
      {/* DESKTOP */}
      <DesktopLayout />

    </div>
  );
}