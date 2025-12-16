import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db, appId } from '../config/firebase';
import { ExternalLink, LogIn, Search } from 'lucide-react';
import { ICON_MAP } from '../utils/iconMap';
import { LOGOS } from '../constants';

const CATEGORIES_CONFIG = [
    { id: 'todos', label: 'Todos' },
    { id: 'clinico', label: 'Área Clínica' },
    { id: 'academico', label: 'Acadêmico' },
    { id: 'utilidades', label: 'Utilidades & RH' },
    { id: 'pesquisa', label: 'Pesquisa' },
    { id: 'geral', label: 'Outros' }
];

export default function SystemsPortal() {
  const [links, setLinks] = useState([]);
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('todos');

  useEffect(() => {
      const q = query(
          collection(db, 'artifacts', appId, 'public', 'data', 'external_links'),
          orderBy('order', 'asc')
      );

      const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.active !== false);
        
        setLinks(data);
        setLoading(false);
      });
      return () => unsub();
  }, []);

  const visibleCategories = CATEGORIES_CONFIG.filter(cat => {
      if (cat.id === 'todos') return true;
      return links.some(link => link.category === cat.id);
  });

  useEffect(() => {
    let result = links;
    if (activeCategory !== 'todos') {
        result = result.filter(link => link.category === activeCategory);
    }
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(link => 
            link.name.toLowerCase().includes(lowerTerm) || 
            (link.description && link.description.toLowerCase().includes(lowerTerm))
        );
    }
    setFilteredLinks(result);
  }, [searchTerm, links, activeCategory]);

  const handleLinkClick = async (linkId) => {
      try {
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'external_links', linkId);
          await updateDoc(docRef, { clicks: increment(1) });
      } catch (error) { console.error(error); }
  };

  // Classes Visuais
  const CARD_CLASSES = "bg-gradient-to-br from-white to-blue-50/50 rounded-2xl p-6 shadow-sm border border-blue-100 hover:border-[#009DE0] hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col relative overflow-hidden ring-1 ring-blue-100/50 h-full text-left";
  const DECORATION_CLASSES = "absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#009DE0]/10 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500 z-0";
  const ICON_CONTAINER_CLASSES = "relative z-10 w-14 h-14 rounded-xl bg-[#009DE0] text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300";
  const BUTTON_CLASSES = "relative z-10 mt-auto inline-flex items-center gap-2 px-4 py-2 bg-[#021D34] text-white text-xs font-bold rounded-lg w-fit group-hover:bg-[#009DE0] transition-colors shadow-lg shadow-blue-900/10";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 relative overflow-hidden">
        
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        </div>
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-white via-white/80 to-transparent z-0 pointer-events-none"/>

        <div className="relative z-10 flex flex-col items-center p-6 md:p-12 w-full max-w-7xl mx-auto flex-1">

            <div className="flex flex-col items-center text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                <img src={LOGOS.color} alt="Logo" className="h-16 w-auto mb-6 hover:scale-105 transition-transform duration-500" />
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#021D34] mb-3 tracking-tight">Odontologia Unilavras</h1>
                <p className="text-slate-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">Central de portais e sistemas do curso de Odontologia</p>

                <div className="mt-8 w-full max-w-md relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#009DE0] transition-colors">
                        <Search size={20} />
                    </div>
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="O que você procura hoje?"
                        className="w-full pl-11 pr-4 py-3.5 rounded-full border border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm focus:bg-white focus:ring-4 focus:ring-[#009DE0]/10 focus:border-[#009DE0] outline-none transition-all"
                    />
                </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                {visibleCategories.map(cat => {
                    const isActive = activeCategory === cat.id;
                    let activeClass = "";
                    if (isActive) {
                        if (cat.id === 'clinico') activeClass = "bg-teal-600 text-white shadow-teal-500/30 border-teal-600";
                        else if (cat.id === 'academico') activeClass = "bg-indigo-600 text-white shadow-indigo-500/30 border-indigo-600";
                        else if (cat.id === 'utilidades') activeClass = "bg-amber-500 text-white shadow-amber-500/30 border-amber-500";
                        else if (cat.id === 'pesquisa') activeClass = "bg-rose-600 text-white shadow-rose-500/30 border-rose-600";
                        else activeClass = "bg-[#021D34] text-white shadow-blue-900/30 border-[#021D34]";
                    }

                    return (
                        <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                            className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all border shadow-sm ${isActive ? `${activeClass} scale-105 shadow-md` : `bg-white text-slate-500 hover:bg-slate-50 border-slate-200`}`}>
                            {cat.label}
                        </button>
                    )
                })}
            </div>

            <div className="w-full">
                {loading ? (
                   <div className="flex flex-col items-center py-20 animate-pulse opacity-60">
                       <div className="w-16 h-16 bg-slate-200 rounded-2xl mb-4"/>
                       <div className="h-4 w-48 bg-slate-200 rounded"/>
                   </div>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500 pb-20">
                      
                      {/* NÃO TEM MAIS CARD FIXO AQUI. TUDO É DINÂMICO AGORA. */}

                      {filteredLinks.map(link => {
                          const IconComp = ICON_MAP[link.icon] || ICON_MAP['globe'];
                          // Verifica se é link interno (começa com /)
                          const isInternal = link.url && link.url.startsWith('/');
                          
                          // Conteúdo interno do Card (para evitar duplicação)
                          const CardContent = () => (
                              <>
                                  <div className={DECORATION_CLASSES}/>
                                  <div className={ICON_CONTAINER_CLASSES}>
                                      <IconComp size={28} />
                                  </div>
                                  <h3 className="relative z-10 font-bold text-lg text-[#021D34] mb-1">{link.name}</h3>
                                  <p className="relative z-10 text-sm text-slate-500 mb-6 line-clamp-2 leading-relaxed">{link.description}</p>
                                  <span className={BUTTON_CLASSES}>
                                      {link.btnText || 'ACESSAR'} {isInternal ? <LogIn size={12}/> : <ExternalLink size={12} />}
                                  </span>
                              </>
                          );

                          // Renderização Condicional: Link (Router) vs A (Href)
                          if (isInternal) {
                              return (
                                  <Link 
                                    key={link.id} 
                                    to={link.url}
                                    onClick={() => handleLinkClick(link.id)}
                                    className={CARD_CLASSES}
                                  >
                                      <CardContent />
                                  </Link>
                              )
                          }

                          return (
                              <a 
                                key={link.id} 
                                href={link.url} 
                                target="_blank" 
                                rel="noreferrer"
                                onClick={() => handleLinkClick(link.id)}
                                className={CARD_CLASSES}
                              >
                                  <CardContent />
                              </a>
                          )
                      })}

                      {filteredLinks.length === 0 && (
                          <div className="col-span-full py-12 text-center text-slate-400">
                              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                              <p>Nenhum sistema encontrado.</p>
                          </div>
                      )}
                   </div>
                )}
            </div>
        </div>

        <footer className="py-6 text-center w-full relative z-10 opacity-60 hover:opacity-100 transition-opacity mt-auto">
            <p className="text-slate-400 text-[10px] uppercase tracking-widest">© {new Date().getFullYear()} Centro Universitário de Lavras - Unilavras</p>
        </footer>
    </div>
  );
}