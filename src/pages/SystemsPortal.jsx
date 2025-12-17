import React, { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, query, orderBy, doc, 
  updateDoc, increment, addDoc, serverTimestamp 
} from 'firebase/firestore'; 
import { Link } from 'react-router-dom';
import { db, appId, auth } from '../config/firebase';
import { ExternalLink, LogIn, Search, Sparkles } from 'lucide-react';
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

  // --- LÓGICA DE DADOS ---
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

  // Filtra as categorias para exibir apenas as que têm links (exceto 'todos' que sempre aparece)
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

  // --- REGISTRO DE ESTATÍSTICAS (MANTIDO) ---
  const handleLinkClick = async (linkId) => {
      try {
          // 1. Contador Rápido (para ordenação simples)
          const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'external_links', linkId);
          updateDoc(docRef, { clicks: increment(1) });

          // 2. Log Detalhado (para gráficos no Admin)
          const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'external_links', linkId, 'click_logs');
          addDoc(logsRef, {
              createdAt: serverTimestamp(),
              userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
          }).catch(err => console.error("Falha analytics:", err));

      } catch (error) { console.error(error); }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden font-sans selection:bg-blue-200 selection:text-blue-900">
        
        {/* --- Background Moderno com Textura Animada --- */}
        <div className="fixed inset-0 z-0 pointer-events-none">
            {/* Blobs coloridos de fundo */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"/>
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"/>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-teal-200/40 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"/>
            
            {/* Textura de Pontos (Health/Science feel) em movimento */}
            <div 
              className="absolute inset-0 z-10 opacity-30 animate-bg-move"
              style={{
                backgroundImage: 'radial-gradient(#009DE0 2px, transparent 2px)',
                backgroundSize: '30px 30px'
              }}
            ></div>
            
            {/* Noise overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150 z-0"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">

            {/* --- Header --- */}
            <div className="text-center max-w-3xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 border border-blue-100 backdrop-blur-md shadow-sm mb-6">
                    <Sparkles size={14} className="text-[#009DE0]" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Portal de Sistemas</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight leading-[1.1]">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#009DE0] to-blue-600">Odontologia</span> Unilavras
                </h1>
                
                <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-xl mx-auto">
                    Acesse as ferramentas, portais e recursos do curso em um único lugar.
                </p>

                {/* --- Busca --- */}
                <div className="relative group max-w-lg mx-auto w-full">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-300 to-purple-300 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <div className="relative flex items-center bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-blue-900/5 border border-white/50 overflow-hidden">
                        <div className="pl-6 text-slate-400">
                            <Search size={22} />
                        </div>
                        <input 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar sistema, portal ou serviço..."
                            className="w-full py-5 px-4 bg-transparent outline-none text-slate-700 font-medium placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* --- Filtros --- */}
            <div className="flex flex-wrap justify-center gap-3 mb-16 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                {visibleCategories.map(cat => {
                    const isActive = activeCategory === cat.id;
                    return (
                        <button 
                            key={cat.id} 
                            onClick={() => setActiveCategory(cat.id)}
                            className={`
                                relative px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300
                                ${isActive 
                                    ? 'bg-[#009DE0] text-white shadow-lg shadow-blue-500/30 scale-105' 
                                    : 'bg-white/60 text-slate-500 hover:bg-white hover:text-[#009DE0] hover:shadow-md border border-transparent hover:border-blue-100'
                                }
                            `}
                        >
                            {cat.label}
                        </button>
                    )
                })}
            </div>

            {/* --- Grid de Links --- */}
            <div className="w-full">
                {loading ? (
                   <div className="flex flex-col items-center justify-center py-20 animate-pulse opacity-50">
                       <div className="w-16 h-16 bg-slate-300/50 rounded-2xl mb-4"/>
                       <div className="h-4 w-48 bg-slate-300/50 rounded"/>
                   </div>
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
                      
                      {filteredLinks.map((link, idx) => {
                          const IconComp = ICON_MAP[link.icon] || ICON_MAP['globe'];
                          const isInternal = link.url && link.url.startsWith('/');
                          const animationDelay = `${idx * 50}ms`; 
                          
                          const CardContent = () => (
                              <div className="
                                  relative h-full p-6 flex flex-col 
                                  bg-white/70 backdrop-blur-lg border border-white/60 rounded-3xl shadow-sm 
                                  transition-all duration-300 ease-out
                                  
                                  group-hover:scale-105 
                                  group-hover:-translate-y-1
                                  group-hover:bg-white 
                                  group-hover:border-[#009DE0] 
                                  group-hover:shadow-2xl group-hover:shadow-[#009DE0]/20
                              ">
                                  
                                  <div className="
                                      w-12 h-12 rounded-2xl bg-gradient-to-br from-white to-blue-50 border border-white shadow-sm 
                                      flex items-center justify-center text-[#009DE0] mb-5 
                                      transition-all duration-300 relative z-10
                                      /* MUDANÇA AQUI: Background azul claro e ícone azul mais forte (blue-600) para legibilidade */
                                      group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-blue-500/30
                                  ">
                                      <IconComp size={24} />
                                  </div>

                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-[#009DE0] transition-colors">{link.name}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{link.description}</p>
                                  </div>

                                  <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-end">
                                      <span className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm group-hover:bg-[#009DE0] group-hover:text-white group-hover:border-[#009DE0] transition-all">
                                          {link.btnText || 'Acessar'} 
                                          {isInternal ? <LogIn size={12}/> : <ExternalLink size={12}/>}
                                      </span>
                                  </div>
                              </div>
                          );

                          const Wrapper = isInternal ? Link : 'a';
                          const props = isInternal 
                            ? { to: link.url } 
                            : { href: link.url, target: "_blank", rel: "noreferrer" };

                          return (
                              <Wrapper 
                                key={link.id} 
                                {...props}
                                onClick={() => handleLinkClick(link.id)}
                                className="group relative outline-none animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards"
                                style={{ animationDelay }}
                              >
                                  <CardContent />
                              </Wrapper>
                          )
                      })}

                      {filteredLinks.length === 0 && (
                          <div className="col-span-full py-20 text-center">
                              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                  <Search size={30} />
                              </div>
                              <h3 className="text-slate-900 font-bold text-lg mb-1">Nenhum resultado</h3>
                              <p className="text-slate-500">Tente buscar com outros termos.</p>
                          </div>
                      )}
                   </div>
                )}
            </div>
        </div>

        <footer className="py-8 text-center relative z-10 border-t border-slate-200/50 bg-white/30 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 mb-2 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                 <img src={LOGOS.color} alt="Logo" className="h-8 w-auto" />
            </div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                © {new Date().getFullYear()} Centro Universitario de Lavras - Unilavras
            </p>
        </footer>
    </div>
  );
}