import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { 
  Trash2, Plus, Save, Link as LinkIcon, 
  Edit2, ArrowUp, ArrowDown, Eye, EyeOff, X, BarChart2 
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { logEvent } from '../../utils/logger';
import { ICON_MAP, AVAILABLE_ICONS } from '../../utils/iconMap';

// Definição das Categorias e suas cores (Estilo Tailwind)
const CATEGORIES = [
    { id: 'geral', label: 'Geral / Utilidades', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    { id: 'academico', label: 'Acadêmico', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { id: 'clinico', label: 'Área Clínica', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { id: 'pesquisa', label: 'Pesquisa & Extensão', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'admin', label: 'Administrativo', color: 'bg-orange-50 text-orange-700 border-orange-200' }
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
  
  const { addToast } = useToast();

  // Buscar links do Firestore (Caminho Público)
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

  // --- AÇÕES CRUD ---

  const handleSubmit = async () => {
    if (!formData.name || !formData.url) return addToast('Preencha nome e URL', 'error');
    
    try {
        const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'external_links');

        if (editingId) {
            // Atualizar
            await updateDoc(doc(collectionRef, editingId), {
                ...formData,
                updatedAt: new Date()
            });
            await logEvent('ADMIN_OPT', `Editou sistema no portal: ${formData.name}`, {});
            addToast('Sistema atualizado!', 'success');
        } else {
            // Criar Novo
            const newOrder = links.length > 0 ? Math.max(...links.map(l => l.order || 0)) + 1 : 0;
            await addDoc(collectionRef, {
                ...formData,
                clicks: 0, // Inicia analytics zerado
                order: newOrder,
                createdAt: new Date()
            });
            await logEvent('ADMIN_OPT', `Criou sistema no portal: ${formData.name}`, {});
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
      setFormData({
          name: item.name,
          url: item.url,
          description: item.description || '',
          icon: item.icon || 'globe',
          btnText: item.btnText || 'ACESSAR SISTEMA',
          active: item.active !== false,
          order: item.order || 0,
          category: item.category || 'geral'
      });
      setEditingId(item.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleActive = async (item) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'external_links', item.id), {
          active: !item.active
      });
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
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in pb-20">
      <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 text-[#009DE0] rounded-xl"><LinkIcon size={24}/></div>
          <div>
            <h2 className="text-2xl font-bold text-[#021D34]">Portal de Sistemas</h2>
            <p className="text-slate-500">Gerencie os links e visualize as estatísticas de acesso.</p>
          </div>
      </div>
      
      {/* --- FORMULÁRIO --- */}
      <div className={`p-6 rounded-xl border shadow-sm mb-8 transition-colors ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-[#021D34] flex items-center gap-2">
                {editingId ? <><Edit2 size={18}/> Editando Sistema</> : <><Plus size={18}/> Novo Sistema</>}
            </h3>
            {editingId && (
                <button onClick={resetForm} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-red-500">
                    <X size={14}/> CANCELAR EDIÇÃO
                </button>
            )}
        </div>

        {/* Inputs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nome do Sistema</label>
            <input 
              className="w-full p-2.5 border rounded-lg focus:ring-2 ring-[#009DE0]/20 outline-none bg-white" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Biblioteca Pergamum"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">URL de Acesso</label>
            <input 
              className="w-full p-2.5 border rounded-lg focus:ring-2 ring-[#009DE0]/20 outline-none bg-white" 
              value={formData.url}
              onChange={e => setFormData({...formData, url: e.target.value})}
              placeholder="https://..."
            />
          </div>
        </div>
        
        {/* Seletor de Categoria (Estilizado) */}
        <div className="mb-6">
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                    const isSelected = formData.category === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setFormData({...formData, category: cat.id})}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${
                                isSelected 
                                ? 'bg-[#021D34] text-white border-[#021D34] ring-2 ring-offset-1 ring-[#021D34]' 
                                : `bg-white text-slate-500 border-slate-200 hover:bg-slate-50`
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-300'}`}/>
                            {cat.label}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Descrição e Botão */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Descrição</label>
                <input 
                  className="w-full p-2.5 border rounded-lg focus:ring-2 ring-[#009DE0]/20 outline-none bg-white" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Ex: Acesso ao acervo de livros digitais..."
                />
            </div>
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Texto do Botão</label>
                <input 
                  className="w-full p-2.5 border rounded-lg focus:ring-2 ring-[#009DE0]/20 outline-none bg-white font-mono text-xs" 
                  value={formData.btnText}
                  onChange={e => setFormData({...formData, btnText: e.target.value})}
                  placeholder="Ex: ACESSAR AGORA"
                />
            </div>
        </div>

        {/* Seletor de Ícones */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Ícone Visual</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg custom-scrollbar bg-white">
            {AVAILABLE_ICONS.map(iconKey => {
              const IconComp = ICON_MAP[iconKey];
              const isSelected = formData.icon === iconKey;
              return (
                <button 
                  key={iconKey}
                  onClick={() => setFormData({...formData, icon: iconKey})}
                  className={`p-2 rounded-lg border transition-all ${isSelected ? 'bg-[#009DE0] text-white border-[#009DE0] ring-2 ring-offset-1 ring-[#009DE0]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  title={iconKey}
                >
                  <IconComp size={18} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-4">
            <button 
            onClick={handleSubmit}
            className={`flex-1 text-white py-3 px-8 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg 
                ${editingId ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 'bg-[#021D34] hover:bg-[#009DE0] shadow-blue-900/20'}`}
            >
            <Save size={18} /> {editingId ? 'Atualizar Sistema' : 'Salvar Novo Sistema'}
            </button>
            
            <label className="flex items-center gap-2 cursor-pointer select-none p-3 border rounded-xl hover:bg-slate-50 bg-white">
                <input 
                    type="checkbox" 
                    checked={formData.active} 
                    onChange={e => setFormData({...formData, active: e.target.checked})}
                    className="accent-[#009DE0] w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-600">Visível no Portal</span>
            </label>
        </div>
      </div>

      {/* --- LISTAGEM DE SISTEMAS --- */}
      <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider">Sistemas Cadastrados ({links.length})</h3>
      </div>
      
      <div className="space-y-3">
        {links.map((link, index) => {
          const IconComp = ICON_MAP[link.icon] || ICON_MAP['globe'];
          const isActive = link.active !== false;
          
          // Encontra a configuração da categoria para usar o label e cor
          const catConfig = CATEGORIES.find(c => c.id === link.category) || CATEGORIES[0];

          return (
            <div key={link.id} className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
              
              {/* Reordenação */}
              <div className="flex flex-col gap-1">
                  <button onClick={() => moveItem(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-[#009DE0] disabled:opacity-20"><ArrowUp size={16}/></button>
                  <button onClick={() => moveItem(index, 'down')} disabled={index === links.length - 1} className="p-1 text-slate-400 hover:text-[#009DE0] disabled:opacity-20"><ArrowDown size={16}/></button>
              </div>

              {/* Ícone */}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isActive ? 'bg-blue-50 text-[#009DE0]' : 'bg-slate-200 text-slate-400'}`}>
                  <IconComp size={24} />
              </div>

              {/* Detalhes */}
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                     {/* Badge de Categoria */}
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${catConfig.color}`}>
                        {catConfig.label}
                    </span>
                    {!isActive && <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded">INATIVO</span>}
                  </div>
                  
                  <h4 className={`font-bold truncate ${isActive ? 'text-[#021D34]' : 'text-slate-500 line-through'}`}>{link.name}</h4>
                  <p className="text-xs text-slate-500 truncate mb-1">{link.description}</p>
                  
                  <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-slate-50 px-1 rounded border">
                          {link.btnText || 'PADRÃO'}
                      </span>
                      
                      {/* ANALYTICS: Contador de Cliques */}
                      <span className="flex items-center gap-1 text-[#009DE0] font-bold bg-blue-50 px-2 py-0.5 rounded-full text-[10px]" title="Total de acessos">
                          <BarChart2 size={10}/> {link.clicks || 0} acessos
                      </span>
                  </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 border-l pl-4 border-slate-100">
                  <button 
                    onClick={() => handleToggleActive(link)}
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                    title={isActive ? "Desativar" : "Ativar"}
                  >
                    {isActive ? <Eye size={18}/> : <EyeOff size={18}/>}
                  </button>
                  <button 
                    onClick={() => handleEdit(link)}
                    className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg"
                    title="Editar"
                  >
                    <Edit2 size={18}/>
                  </button>
                  <button 
                    onClick={() => handleDelete(link.id, link.name)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}