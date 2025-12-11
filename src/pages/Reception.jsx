import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  startAt, 
  endAt, 
  limit, 
  getDocs, 
  onSnapshot, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Search, 
  Ban, 
  PackagePlus, 
  X, 
  CheckCircle2, 
  Printer,
  ChevronLeft,
  ChevronRight,
  Trash2 
} from 'lucide-react';

// Imports internos
import { db, appId } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { usePrint } from '../contexts/PrintContext';
import { logEvent } from '../utils/logger';
import { maskCPF, generateUniqueId } from '../utils/formatters';

export default function Reception({ userProfile }) {
    const [step, setStep] = useState(1);
    
    // Estados de Busca de Aluno
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [studentResults, setStudentResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    
    // Estados de Materiais
    const [types, setTypes] = useState([]);
    const [cart, setCart] = useState([]);
    const [createdItems, setCreatedItems] = useState([]);

    // Estados de Paginação e Busca de Itens (Responsivo)
    const [itemSearch, setItemSearch] = useState('');
    const [itemPage, setItemPage] = useState(0);
    
    // Define 6 itens no mobile (2x3) e 15 no desktop
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 6 : 15);

    const { addToast } = useToast();
    const { printItems } = usePrint();

    // --- MONITOR DE TAMANHO DE TELA ---
    useEffect(() => {
        const handleResize = () => {
            setItemsPerPage(window.innerWidth < 768 ? 6 : 15);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- BUSCA OTIMIZADA DE ALUNOS ---
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (search.length < 3) { 
                setStudentResults([]); 
                return; 
            }
            
            setSearching(true);
            try {
                let q;
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
                
                const cleanSearch = search.replace(/\D/g, ''); 
                const isNumericSearch = cleanSearch.length > 2; 

                if (isNumericSearch) {
                    q = query(usersRef, where('role', '==', 'student'), orderBy('cpf'), startAt(cleanSearch), endAt(cleanSearch + '\uf8ff'), limit(5));
                } else {
                    q = query(usersRef, where('role', '==', 'student'), orderBy('name'), startAt(search), endAt(search + '\uf8ff'), limit(5));
                }

                const snap = await getDocs(q);
                const res = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
                setStudentResults(res);

            } catch (error) {
                console.error("Erro na busca:", error);
            } finally {
                setSearching(false);
            }
        }, 500); 
        return () => clearTimeout(timer);
    }, [search]);

    // Carrega Tipos de Materiais
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), s => setTypes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsub();
    }, []);

    // Reinicia a página ao pesquisar item ou mudar o layout
    useEffect(() => {
        setItemPage(0);
    }, [itemSearch, itemsPerPage]);

    // LÓGICA DE PAGINAÇÃO E FILTRO DE ITENS
    const filteredTypes = types.filter(t => 
        t.name.toLowerCase().includes(itemSearch.toLowerCase())
    );
    const totalItemPages = Math.ceil(filteredTypes.length / itemsPerPage);
    const visibleTypes = filteredTypes.slice(itemPage * itemsPerPage, (itemPage + 1) * itemsPerPage);

    const nextPage = () => setItemPage(p => (p + 1) % totalItemPages); // Circular
    const prevPage = () => setItemPage(p => (p - 1 + totalItemPages) % totalItemPages); // Circular

    const finish = async () => {
        if (cart.length === 0) return;
        const batch = writeBatch(db);
        const newItems = [];
        
        try {
            for (const item of cart) {
                let code = generateUniqueId();
                let isUnique = false;
                let attempts = 0;

                while (!isUnique && attempts < 5) {
                    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('code', '==', code));
                    const snapshot = await getDocs(q);
                    if (snapshot.empty) isUnique = true;
                    else { code = generateUniqueId(); attempts++; }
                }
                if (!isUnique) throw new Error("Erro ao gerar código único.");

                const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'items'));
                const data = {
                    code,
                    type: item.name,
                    studentName: selectedStudent.name,
                    studentId: selectedStudent.uid,
                    status: 'recebido',
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp(),
                    history: [{ status: 'recebido', timestamp: new Date().toISOString(), by: userProfile.name }]
                };
                batch.set(docRef, data);
                newItems.push({...data, id: docRef.id});

                const notifRef = doc(collection(db, 'artifacts', appId, 'users', selectedStudent.uid, 'notifications'));
                batch.set(notifRef, {
                    title: 'Material Recebido',
                    message: `O item ${item.name} foi recebido com o código ${code}.`,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            await batch.commit();
            await logEvent('ITEM_ENTRY', `Recebidos ${newItems.length} materiais de ${selectedStudent.name}`, {
                student: selectedStudent.name,
                itemCount: newItems.length,
                codes: newItems.map(i => i.code)
            });

            setCreatedItems(newItems);
            setStep(3);
            addToast('Materiais registrados com sucesso!', 'success');
        } catch(e) {
            console.error(e);
            addToast('Erro ao registrar materiais.', 'error');
        }
    };

    if (step === 3) return (
        <div className="animate-in zoom-in">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-3xl mx-auto">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4"/>
                <h2 className="text-2xl font-bold text-[#021D34]">Entrada Registrada!</h2>
                <p className="text-slate-500 mb-8">Materiais recebidos com sucesso. Escolha como deseja imprimir.</p>
                
                <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
                    <button onClick={() => printItems(createdItems)} className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-[#032d50] shadow-lg shadow-blue-900/20">
                        <Printer size={20}/> Imprimir TODAS
                    </button>
                    <button onClick={() => { setStep(1); setSelectedStudent(null); setSearch(''); setCart([]); }} className="border px-6 py-3 rounded-lg font-bold hover:bg-slate-50 text-slate-700">
                        Novo Atendimento
                    </button>
                </div>

                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Impressão Individual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {createdItems.map(i => (
                        <div key={i.id} className="border border-slate-200 p-4 rounded-xl flex justify-between items-center bg-slate-50">
                            <div className="text-left">
                                <p className="text-xs font-bold text-slate-400">Cód: {i.code}</p>
                                <p className="font-bold text-[#021D34]">{i.type}</p>
                            </div>
                            <button onClick={() => printItems(i)} className="p-2 text-[#009DE0] hover:bg-white hover:shadow-md rounded-lg transition-all" title="Imprimir apenas esta">
                                <Printer size={20}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* CABEÇALHO */}
            <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2">
                <PackagePlus className="text-[#009DE0]"/> Recepção
            </h2>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* PASSO 1: ALUNO */}
                    <div className={`bg-white p-6 rounded-2xl border transition-all ${selectedStudent ? 'border-[#009DE0]' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">1</span> Identificação</h3>
                             {selectedStudent && (
                                 <button 
                                    onClick={() => { 
                                        setSelectedStudent(null); 
                                        setSearch(''); 
                                        setCart([]); 
                                    }} 
                                    className="text-xs text-red-500 hover:underline"
                                >
                                    Alterar Aluno
                                </button>
                             )}
                        </div>
                        {!selectedStudent ? (
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                                    <input className="w-full pl-10 p-3 border rounded-lg outline-none focus:border-[#009DE0]" 
                                        placeholder="Digite nome ou CPF..." 
                                        value={search} 
                                        onChange={e => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {searching && <div className="absolute right-3 top-3 w-5 h-5 border-2 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>}
                                </div>
                                {studentResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border mt-2 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto">
                                        {studentResults.map(s => (
                                            <button 
                                                key={s.uid} 
                                                onClick={() => { 
                                                    if (s.active === false) {
                                                        addToast('Aluno inativo. Não é possível realizar entregas.', 'error');
                                                        return;
                                                    }
                                                    setSelectedStudent(s); 
                                                    setStudentResults([]); 
                                                }} 
                                                className={`w-full text-left p-3 hover:bg-blue-50 border-b last:border-0 transition-colors ${s.active === false ? 'bg-slate-50 opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="font-bold text-[#021D34]">{s.name}</p>
                                                        <p className="text-xs text-slate-500">CPF: {maskCPF(s.cpf)}</p>
                                                    </div>
                                                    {s.active === false && (
                                                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                                            <Ban size={10} /> INATIVO
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {search.length > 2 && studentResults.length === 0 && !searching && (
                                    <div className="mt-2 text-sm text-slate-500 text-center">Nenhum aluno encontrado para "{search}".</div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="w-12 h-12 rounded-full bg-[#009DE0] text-white flex items-center justify-center font-bold text-lg">{selectedStudent.name.substring(0,2)}</div>
                                <div>
                                    <p className="font-bold text-[#021D34] text-lg">{selectedStudent.name}</p>
                                    <p className="text-sm text-slate-600">{selectedStudent.email} • {maskCPF(selectedStudent.cpf)}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PASSO 2: MATERIAIS */}
                    <div className={`bg-white p-6 rounded-2xl border border-slate-200 transition-opacity ${!selectedStudent ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">2</span> Materiais
                            </h3>
                            
                            {types.length > itemsPerPage && (
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                    <input 
                                        className="w-full pl-9 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]"
                                        placeholder="Filtrar item..."
                                        value={itemSearch}
                                        onChange={e => setItemSearch(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        
                        {/* GRID DE MATERIAIS - Sem padding lateral excessivo */}
                        <div className="w-full"> 
                            
                            {/* GRID DE ITENS (PÁGINA ATUAL) */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-h-[300px] md:min-h-[480px] animate-in fade-in">
                                {visibleTypes.map(t => (
                                    <button 
                                        key={t.id} 
                                        onClick={() => setCart([...cart, { ...t, uid: Math.random() }])} 
                                        className="p-4 border rounded-xl hover:bg-[#009DE0] hover:text-white hover:border-[#009DE0] active:scale-95 active:bg-blue-600 active:border-blue-600 transition-all duration-75 text-center md:text-left flex flex-col items-center md:items-start gap-2 group select-none h-full justify-center md:justify-start"
                                    >
                                        <PackagePlus size={24} className="text-slate-300 group-hover:text-white"/>
                                        <span className="font-medium text-sm md:text-base leading-tight">{t.name}</span>
                                    </button>
                                ))}
                                {/* Placeholders para manter altura consistente */}
                                {Array.from({ length: itemsPerPage - visibleTypes.length }).map((_, index) => (
                                    <div key={`placeholder-${index}`} className="opacity-0 pointer-events-none">
                                        <div className="p-4 border rounded-xl text-left flex flex-col gap-2 h-full">
                                            <PackagePlus size={24}/>
                                            <span className="font-medium text-sm md:text-base leading-tight"> </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CONTROLES DE PAGINAÇÃO (Rodapé) - Solução para o Mobile */}
                        {totalItemPages > 1 && (
                            <div className="flex items-center justify-between mt-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <button 
                                    onClick={prevPage}
                                    className="p-3 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-[#009DE0] transition-all"
                                >
                                    <ChevronLeft size={20}/>
                                </button>

                                <div className="flex gap-1.5">
                                    {Array.from({ length: totalItemPages }).map((_, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`w-2 h-2 rounded-full transition-colors ${idx === itemPage ? 'bg-[#009DE0] scale-125' : 'bg-slate-300'}`}
                                        />
                                    ))}
                                </div>

                                <button 
                                    onClick={nextPage}
                                    className="p-3 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-[#009DE0] transition-all"
                                >
                                    <ChevronRight size={20}/>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* RESUMO (CARRINHO) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 h-fit sticky top-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-[#021D34]">Resumo</h3>
                        {cart.length > 0 && (
                            <button 
                                onClick={() => setCart([])} 
                                className="text-xs text-red-500 hover:underline flex items-center gap-1 font-bold"
                            >
                                <Trash2 size={12}/> Limpar Tudo
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? <p className="text-slate-400 text-center text-sm py-4">Nenhum item.</p> : cart.map(item => (
                            <div key={item.uid} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 animate-in slide-in-from-right-2">
                                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                <button onClick={() => setCart(cart.filter(x => x.uid !== item.uid))} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="border-t pt-4">
                        <div className="flex justify-between mb-4 text-sm">
                            <span className="text-slate-500">Total</span>
                            <span className="font-bold text-[#021D34]">{cart.length} itens</span>
                        </div>
                        <button onClick={finish} disabled={!selectedStudent || cart.length === 0} className="w-full bg-[#009DE0] text-white py-3 rounded-lg font-bold hover:bg-[#008bc5] disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20">
                            Finalizar e Imprimir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}