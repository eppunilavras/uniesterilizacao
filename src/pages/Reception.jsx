import React, { useState, useEffect, useMemo } from 'react';
import { writeBatch, doc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { 
    Search, PackagePlus, X, CheckCircle2, Printer, 
    ChevronLeft, ChevronRight, Trash2, Monitor, Loader2,
    RotateCw, WifiOff, Wifi 
} from 'lucide-react';

import { db, appId } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { usePrint } from '../contexts/PrintContext';
import { maskCPF } from '../utils/formatters';

// Hooks personalizados
import { useStudentsDirectory } from '../hooks/useStudentsDirectory';
import { useMaterialTypes } from '../hooks/useMaterialTypes';
import { useOnlineStatus } from '../hooks/useOnlineStatus'; 
import { useQueryClient } from '@tanstack/react-query'; 

import { logEvent } from '../utils/logger'; 

const generateSafeId = (length = 6) => {
    const base = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; 
    const specials = '!#$*+-=?&'; 
    const chars = base + specials;

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
};

export default function Reception({ userProfile }) {
    const [step, setStep] = useState(1);
    const isOnline = useOnlineStatus(); 
    const queryClient = useQueryClient(); 

    const { 
        data: rawStudents = [], 
        isLoading: loadingStudents, 
        isRefetching: isRefetchingStudents 
    } = useStudentsDirectory({ enabled: !!userProfile });

    const allStudents = useMemo(() => {
        return rawStudents.filter(s => s.active !== false);
    }, [rawStudents]);

    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    
    const studentResults = useMemo(() => {
        if (!search || search.length < 2) return [];
        const term = search.toLowerCase();
        return allStudents.filter(s => 
            s.name.toLowerCase().includes(term) || 
            (s.cpf && s.cpf.includes(term))
        ).slice(0, 10);
    }, [search, allStudents]);

    // --- MUDANÇA: Destruturando refetch e isRefetching dos materiais ---
    const { 
        data: types = [],
        refetch: refetchTypes,
        isRefetching: isRefetchingTypes
    } = useMaterialTypes();
    
    const [cart, setCart] = useState([]);
    const [createdItems, setCreatedItems] = useState([]);

    const [itemSearch, setItemSearch] = useState('');
    const [itemPage, setItemPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(window.innerWidth < 768 ? 6 : 15);
    const [isMobileBlock, setIsMobileBlock] = useState(window.innerWidth < 768);

    const { addToast } = useToast();
    const { confirm } = useDialog();
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

    const handleManualRefreshStudents = async () => {
        if (!isOnline) { addToast('Sem conexão para atualizar.', 'error'); return; }
        addToast('Atualizando lista de alunos...', 'info');
        await queryClient.invalidateQueries({ queryKey: ['students_full_directory_v2'] });
        addToast('Solicitação de atualização enviada.', 'success');
    };

    // --- NOVA FUNÇÃO: Atualizar Materiais Manualmente ---
    const handleManualRefreshTypes = async () => {
        if (!isOnline) { addToast('Sem conexão para atualizar.', 'error'); return; }
        addToast('Atualizando tipos de materiais...', 'info');
        await refetchTypes();
        addToast('Materiais atualizados.', 'success');
    };

    const filteredTypes = types.filter(t => t.name.toLowerCase().includes(itemSearch.toLowerCase()));
    const totalItemPages = Math.ceil(filteredTypes.length / itemsPerPage);
    const visibleTypes = filteredTypes.slice(itemPage * itemsPerPage, (itemPage + 1) * itemsPerPage);

    const nextPage = () => setItemPage(p => (p + 1) % totalItemPages);
    const prevPage = () => setItemPage(p => (p - 1 + totalItemPages) % totalItemPages);

    const handleChangeStudent = async () => {
        if (cart.length > 0) {
            const confirmed = await confirm({
                title: 'Trocar Aluno?',
                message: 'Ao trocar o aluno, o carrinho atual será esvaziado. Deseja continuar?',
                confirmText: 'Sim, Trocar',
                isDestructive: true
            });
            if (!confirmed) return;
        }
        setCart([]);
        setSelectedStudent(null);
        setSearch('');
    };

    const handleAddMaterial = (t) => {
        if (!selectedStudent) {
            addToast('Identifique o aluno (Passo 1) antes de selecionar materiais.', 'error');
            const searchInput = document.getElementById('student-search-input');
            if (searchInput) searchInput.focus();
            return;
        }
        setCart([...cart, { ...t, uid: Math.random() }]);
    };

    const finish = async () => {
        if (cart.length === 0) return;

        const batch = writeBatch(db);
        const newItems = [];
        
        try {
            if (isOnline) {
                addToast('Processando materiais online...', 'info');
            } else {
                addToast('Salvando materiais OFFLINE...', 'info');
            }

            for (const item of cart) {
                let code = generateSafeId(); 
                let isUnique = false;
                let attempts = 0;

                if (isOnline) {
                    while (!isUnique && attempts < 3) {
                        try {
                            const checkPromise = new Promise(async (resolve, reject) => {
                                const timeout = setTimeout(() => reject('timeout'), 1500);
                                const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('code', '==', code));
                                const snapshot = await getDocs(q);
                                clearTimeout(timeout);
                                resolve(snapshot.empty);
                            });

                            const codeIsFree = await checkPromise;
                            if (codeIsFree) {
                                isUnique = true;
                            } else {
                                console.log(`Colisão evitada para ${code}. Gerando novo...`);
                                code = generateSafeId();
                                attempts++;
                            }
                        } catch (err) {
                            console.warn("Validação online pulada:", err);
                            isUnique = true; 
                        }
                    }
                }

                const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'items'));
                const now = new Date(); 
                const timestampISO = now.toISOString();

                const data = {
                    code,
                    type: item.name,
                    studentName: selectedStudent.name,
                    studentId: selectedStudent.uid,
                    status: 'recebido',
                    createdAt: now, 
                    lastUpdated: now, 
                    serverTimestamp: serverTimestamp(),
                    history: [{ status: 'recebido', timestamp: timestampISO, by: userProfile.name }]
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

            const backupPayload = newItems.map(item => ({
                ...item,
                tempId: item.id, 
                savedAt: new Date().toISOString()
            }));

            const existingBackup = JSON.parse(localStorage.getItem('unilavras_offline_backup') || '[]');
            const updatedBackup = [...existingBackup, ...backupPayload];
            localStorage.setItem('unilavras_offline_backup', JSON.stringify(updatedBackup));
            localStorage.setItem('unilavras_offline_count', updatedBackup.length);

            batch.commit()
				.then(async () => {
					console.log("Sincronização concluída (IndexedDB/Server).");
					if (isOnline) {
                        localStorage.removeItem('unilavras_offline_backup');
                        localStorage.removeItem('unilavras_offline_count');
						await logEvent(
							'ITEM_ENTRY', 
							`Entrada de ${cart.length} itens para ${selectedStudent.name}`, 
							{ 
								studentId: selectedStudent.uid, 
								studentName: selectedStudent.name,
								quantity: cart.length,
								itemTypes: cart.map(i => i.name) 
							}, 
							userProfile
						);
					}
				})
				.catch(err => console.error("Dados salvos localmente:", err));
            
            setCreatedItems(newItems);
            setStep(3);
            
            if (isOnline) addToast('Materiais registrados!', 'success');
            else addToast('Salvo localmente! Envio pendente.', 'success');

        } catch(e) {
            console.error(e);
            addToast('Erro ao criar registros.', 'error');
        }
    };

    if (isMobileBlock) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in zoom-in-95">
                <div className="bg-blue-50 p-6 rounded-full mb-6"><Monitor className="w-16 h-16 text-[#009DE0]" /></div>
                <h2 className="text-2xl font-bold text-[#021D34] mb-3">Acesso Restrito</h2>
                <p className="text-slate-500 max-w-md mx-auto">Aceda à Receção via computador.</p>
            </div>
        );
    }

    if (step === 3) return (
        <div className="animate-in zoom-in">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-3xl mx-auto">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4"/>
                <h2 className="text-2xl font-bold text-[#021D34]">{isOnline ? 'Sucesso!' : 'Salvo Offline!'}</h2>
                <p className="text-slate-500 mt-2">
                    {isOnline 
                        ? 'Etiquetas geradas. Clique abaixo para imprimir.' 
                        : 'Os itens foram salvos no dispositivo e serão enviados assim que a internet voltar. Pode imprimir agora.'}
                </p>
                
                <div className="flex justify-center gap-4 mb-8 mt-6">
                    <button onClick={() => printItems(createdItems)} className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-[#032d50]">
                        <Printer size={20}/> Imprimir TODAS
                    </button>
                    <button onClick={() => { setStep(1); setSelectedStudent(null); setSearch(''); setCart([]); }} className="border px-6 py-3 rounded-lg font-bold hover:bg-slate-50">
                        Novo Atendimento
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2">
                    <PackagePlus className="text-[#009DE0]"/> Receção
                </h2>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-colors duration-300 ${
                    isOnline 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                }`}>
                    {isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}
                    {isOnline ? 'Conectado' : 'Modo Offline'}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className={`bg-white p-6 rounded-2xl border transition-all ${selectedStudent ? 'border-[#009DE0]' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">1</span> Identificação</h3>
                             <div className="flex items-center gap-3">
                                 <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                                     {loadingStudents ? (
                                         <><Loader2 className="animate-spin w-3 h-3"/> Carregando...</>
                                     ) : (
                                         <span title="Número de alunos carregados" className="flex items-center gap-1 cursor-help">
                                             <CheckCircle2 className="w-3 h-3 text-green-500"/> {allStudents.length} Alunos
                                         </span>
                                     )}
                                 </div>
                                 <button 
                                    onClick={handleManualRefreshStudents} 
                                    disabled={!isOnline}
                                    className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${isRefetchingStudents ? 'animate-spin text-[#009DE0]' : 'text-slate-400'} ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="Recarregar alunos"
                                 >
                                     <RotateCw size={16}/>
                                 </button>
                                 {selectedStudent && <button onClick={handleChangeStudent} className="text-xs text-red-500 hover:underline font-bold ml-2">Alterar</button>}
                             </div>
                        </div>

                        {!selectedStudent ? (
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                                    <input 
                                        id="student-search-input"
                                        className="w-full pl-10 p-3 border rounded-lg outline-none focus:border-[#009DE0]" 
                                        placeholder="Nome ou CPF..." 
                                        value={search} 
                                        onChange={e => setSearch(e.target.value)} 
                                        autoFocus 
                                        disabled={loadingStudents && allStudents.length === 0}
                                    />
                                </div>
                                {studentResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border mt-2 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                                        {studentResults.map(s => (
                                            <button key={s.uid} onClick={() => { 
                                                if (s.active === false) { addToast('Aluno inativo.', 'error'); return; }
                                                setSelectedStudent(s); 
                                            }} className="w-full text-left p-3 hover:bg-blue-50 border-b last:border-0 transition-colors">
                                                <div className="flex justify-between">
                                                    <div><p className="font-bold text-[#021D34]">{s.name}</p><p className="text-xs text-slate-500">{maskCPF(s.cpf)}</p></div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {search.length > 1 && studentResults.length === 0 && !loadingStudents && (
                                    <div className="absolute top-full left-0 right-0 bg-white border mt-2 rounded-xl shadow-lg z-20 p-4 text-center text-slate-500 text-sm">Nenhum aluno encontrado.</div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="w-12 h-12 rounded-full bg-[#009DE0] text-white flex items-center justify-center font-bold text-lg">{selectedStudent.name.substring(0,2)}</div>
                                <div><p className="font-bold text-[#021D34] text-lg">{selectedStudent.name}</p><p className="text-sm text-slate-600">{maskCPF(selectedStudent.cpf)}</p></div>
                            </div>
                        )}
                    </div>

                    <div className={`bg-white p-6 rounded-2xl border border-slate-200 transition-opacity ${!selectedStudent ? 'opacity-50' : 'opacity-100'}`}>
                        <div className="flex justify-between items-center mb-4 gap-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">2</span> Materiais</h3>
                            
                            {/* --- MUDANÇA: ÁREA DE PESQUISA + BOTÃO REFRESH --- */}
                            <div className="flex items-center gap-2 flex-1 justify-end">
                                {types.length > itemsPerPage && (
                                    <div className="relative w-full max-w-[200px]">
                                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                        <input className="w-full pl-9 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" placeholder="Filtrar..." value={itemSearch} onChange={e => setItemSearch(e.target.value)}/>
                                    </div>
                                )}
                                <button 
                                    onClick={handleManualRefreshTypes} 
                                    disabled={!isOnline}
                                    className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors ${isRefetchingTypes ? 'animate-spin text-[#009DE0]' : 'text-slate-400'} ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="Recarregar materiais"
                                >
                                    <RotateCw size={16}/>
                                </button>
                            </div>

                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-h-[300px]">
                            {visibleTypes.map(t => (
                                <button key={t.id} onClick={() => handleAddMaterial(t)} className="p-4 border rounded-xl hover:bg-[#009DE0] hover:text-white transition-all flex flex-col items-center gap-2 group">
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

                <div className="bg-white p-6 rounded-2xl border border-slate-200 h-fit sticky top-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-[#021D34]">Resumo</h3>{cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={12}/> Limpar</button>}</div>
                    <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {cart.length === 0 ? <p className="text-slate-400 text-center text-sm py-4">Nenhum item.</p> : cart.map(item => (
                            <div key={item.uid} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100"><span className="text-sm font-medium text-slate-700">{item.name}</span><button onClick={() => setCart(cart.filter(x => x.uid !== item.uid))} className="text-red-400"><X size={16}/></button></div>
                        ))}
                    </div>
                    <button 
                        onClick={finish} 
                        disabled={!selectedStudent || cart.length === 0} 
                        className={`w-full text-white py-3 rounded-lg font-bold disabled:opacity-50 shadow-lg ${isOnline ? 'bg-[#009DE0] hover:bg-[#008bc5] shadow-blue-500/20' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20'}`}
                    >
                        {isOnline ? 'Finalizar e Imprimir' : 'Salvar Offline e Imprimir'}
                    </button>
                    {!isOnline && <p className="text-xs text-center text-orange-600 mt-2 font-bold">Os dados serão sincronizados ao conectar.</p>}
                </div>
            </div>
        </div>
    );
}