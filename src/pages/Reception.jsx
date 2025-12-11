import React, { useState, useEffect } from 'react';
import { writeBatch, doc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Search, Ban, PackagePlus, X, CheckCircle2, Printer, ChevronLeft, ChevronRight, Trash2, Monitor, Loader2 } from 'lucide-react';

import { db, appId } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { usePrint } from '../contexts/PrintContext';
import { logEvent } from '../utils/logger';
import { maskCPF, generateUniqueId } from '../utils/formatters';

import { useDebounce } from '../hooks/useDebounce';
import { useUserSearch } from '../hooks/useUserSearch';
import { useMaterialTypes } from '../hooks/useMaterialTypes';

export default function Reception({ userProfile }) {
    const [step, setStep] = useState(1);
    
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 500); 
    const { data: studentResults = [], isLoading: searching } = useUserSearch(debouncedSearch);
    const [selectedStudent, setSelectedStudent] = useState(null);
    
    const { data: types = [] } = useMaterialTypes();
    
    const [cart, setCart] = useState([]);
    const [createdItems, setCreatedItems] = useState([]);

    const [itemSearch, setItemSearch] = useState('');
    const [itemPage, setItemPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 6 : 15);
    const [isMobileBlock, setIsMobileBlock] = useState(window.innerWidth < 768);

    const { addToast } = useToast();
    const { printItems } = usePrint();

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setItemsPerPage(width < 768 ? 6 : 15);
            setIsMobileBlock(width < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => { setItemPage(0); }, [itemSearch, itemsPerPage]);

    const filteredTypes = types.filter(t => t.name.toLowerCase().includes(itemSearch.toLowerCase()));
    const totalItemPages = Math.ceil(filteredTypes.length / itemsPerPage);
    const visibleTypes = filteredTypes.slice(itemPage * itemsPerPage, (itemPage + 1) * itemsPerPage);

    const nextPage = () => setItemPage(p => (p + 1) % totalItemPages);
    const prevPage = () => setItemPage(p => (p - 1 + totalItemPages) % totalItemPages);

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
            
            // --- CORREÇÃO DO LOG: Loop para gerar uma entrada por item ---
            await Promise.all(newItems.map(item => 
                logEvent('ITEM_ENTRY', `Recebido item ${item.code} (${item.type})`, {
                    student: selectedStudent.name,
                    code: item.code,
                    type: item.type,
                    itemId: item.id
                })
            ));

            setCreatedItems(newItems);
            setStep(3);
            addToast('Materiais registrados!', 'success');
        } catch(e) {
            console.error(e);
            addToast('Erro ao registrar.', 'error');
        }
    };

    if (isMobileBlock) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in zoom-in-95">
                <div className="bg-blue-50 p-6 rounded-full mb-6"><Monitor className="w-16 h-16 text-[#009DE0]" /></div>
                <h2 className="text-2xl font-bold text-[#021D34] mb-3">Acesso Restrito</h2>
                <p className="text-slate-500 max-w-md mx-auto">Acesse a Recepção via computador.</p>
            </div>
        );
    }

    if (step === 3) return (
        <div className="animate-in zoom-in">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-3xl mx-auto">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4"/>
                <h2 className="text-2xl font-bold text-[#021D34]">Sucesso!</h2>
                <div className="flex justify-center gap-4 mb-8 mt-6">
                    <button onClick={() => printItems(createdItems)} className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-[#032d50]"><Printer size={20}/> Imprimir TODAS</button>
                    <button onClick={() => { setStep(1); setSelectedStudent(null); setSearch(''); setCart([]); }} className="border px-6 py-3 rounded-lg font-bold hover:bg-slate-50">Novo Atendimento</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2"><PackagePlus className="text-[#009DE0]"/> Recepção</h2>
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* PASSO 1: ALUNO */}
                    <div className={`bg-white p-6 rounded-2xl border transition-all ${selectedStudent ? 'border-[#009DE0]' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">1</span> Identificação</h3>
                             {selectedStudent && <button onClick={() => { setSelectedStudent(null); setSearch(''); }} className="text-xs text-red-500 hover:underline">Alterar</button>}
                        </div>
                        {!selectedStudent ? (
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                                    <input className="w-full pl-10 p-3 border rounded-lg outline-none focus:border-[#009DE0]" placeholder="Nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                                    {searching && <div className="absolute right-3 top-3 w-5 h-5"><Loader2 className="animate-spin text-[#009DE0]"/></div>}
                                </div>
                                {studentResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border mt-2 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto">
                                        {studentResults.map(s => (
                                            <button key={s.uid} onClick={() => { 
                                                if (s.active === false) { addToast('Aluno inativo.', 'error'); return; }
                                                setSelectedStudent(s); 
                                            }} className={`w-full text-left p-3 hover:bg-blue-50 border-b ${s.active === false ? 'opacity-60' : ''}`}>
                                                <div className="flex justify-between"><div><p className="font-bold text-[#021D34]">{s.name}</p><p className="text-xs text-slate-500">{maskCPF(s.cpf)}</p></div>{s.active === false && <span className="text-red-600 text-[10px] font-bold flex items-center gap-1"><Ban size={10}/> INATIVO</span>}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="w-12 h-12 rounded-full bg-[#009DE0] text-white flex items-center justify-center font-bold text-lg">{selectedStudent.name.substring(0,2)}</div>
                                <div><p className="font-bold text-[#021D34] text-lg">{selectedStudent.name}</p><p className="text-sm text-slate-600">{maskCPF(selectedStudent.cpf)}</p></div>
                            </div>
                        )}
                    </div>

                    {/* PASSO 2: MATERIAIS */}
                    <div className={`bg-white p-6 rounded-2xl border border-slate-200 transition-opacity ${!selectedStudent ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex justify-between items-center mb-4 gap-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">2</span> Materiais</h3>
                            {types.length > itemsPerPage && <div className="relative w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/><input className="w-full pl-9 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" placeholder="Filtrar..." value={itemSearch} onChange={e => setItemSearch(e.target.value)}/></div>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-h-[300px]">
                            {visibleTypes.map(t => (
                                <button key={t.id} onClick={() => setCart([...cart, { ...t, uid: Math.random() }])} className="p-4 border rounded-xl hover:bg-[#009DE0] hover:text-white transition-all flex flex-col items-center gap-2 group">
                                    <PackagePlus size={24} className="text-slate-300 group-hover:text-white"/><span className="font-medium text-sm">{t.name}</span>
                                </button>
                            ))}
                        </div>
                        {totalItemPages > 1 && (
                            <div className="flex items-center justify-between mt-4 bg-slate-50 p-2 rounded-xl">
                                <button onClick={prevPage} className="p-2 rounded hover:bg-white"><ChevronLeft/></button>
                                <div className="flex gap-1">{Array.from({ length: totalItemPages }).map((_, idx) => <div key={idx} className={`w-2 h-2 rounded-full ${idx === itemPage ? 'bg-[#009DE0]' : 'bg-slate-300'}`}/>)}</div>
                                <button onClick={nextPage} className="p-2 rounded hover:bg-white"><ChevronRight/></button>
                            </div>
                        )}
                    </div>
                </div>

                {/* RESUMO */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 h-fit sticky top-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-[#021D34]">Resumo</h3>{cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={12}/> Limpar</button>}</div>
                    <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? <p className="text-slate-400 text-center text-sm py-4">Nenhum item.</p> : cart.map(item => (
                            <div key={item.uid} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100"><span className="text-sm font-medium text-slate-700">{item.name}</span><button onClick={() => setCart(cart.filter(x => x.uid !== item.uid))} className="text-red-400"><X size={16}/></button></div>
                        ))}
                    </div>
                    <button onClick={finish} disabled={!selectedStudent || cart.length === 0} className="w-full bg-[#009DE0] text-white py-3 rounded-lg font-bold hover:bg-[#008bc5] disabled:opacity-50 shadow-lg shadow-blue-500/20">Finalizar e Imprimir</button>
                </div>
            </div>
        </div>
    );
}