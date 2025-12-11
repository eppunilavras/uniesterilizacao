import React, { useState, useEffect, useRef } from 'react';
// Import da biblioteca de Scanner
import { Scanner } from '@yudiel/react-qr-scanner';

import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  onSnapshot, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ScanBarcode, 
  Printer, 
  Search, 
  Trash2, 
  ArrowDown,
  Camera,
  XCircle,
  Loader2
} from 'lucide-react';

// Imports internos
import { db, appId } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { usePrint } from '../contexts/PrintContext';
import { logEvent } from '../utils/logger';
import { formatDate } from '../utils/formatters';
import { playSound } from '../utils/audio';
import { STATUS_CONFIG } from '../constants';
import DataTable from '../components/DataTable';

export default function Movement({ userProfile }) {
    const [mode, setMode] = useState('list');
    const [code, setCode] = useState('');
    const [singleItem, setSingleItem] = useState(null);
    const [listItems, setListItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showCamera, setShowCamera] = useState(false);
    const [loadingScan, setLoadingScan] = useState(false);
    
    // Controle do limite de visualização
    const [visibleLimit, setVisibleLimit] = useState(50);
    
    const { addToast } = useToast();
    const { confirm } = useDialog();
    const { printItems } = usePrint();

    const searchTimeout = useRef(null);

    // --- FUNÇÃO DO SCANNER ---
    const handleScan = (results) => {
        if (results && results.length > 0) {
            const val = results[0].rawValue;
            if (val) {
                setCode(val);
                setShowCamera(false);
                playSound('success');
            }
        }
    };

    // --- BUSCA AUTOMÁTICA (Ao digitar ou ler código) ---
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        
        if (code === '') {
            setSingleItem(null);
            return;
        }

        // Só busca se tiver tamanho mínimo e a câmera estiver fechada
        if (mode === 'single' && code.length >= 6 && !showCamera) {
            setLoadingScan(true);
            searchTimeout.current = setTimeout(async () => {
                try {
                    const q = query(
                        collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
                        where('code', '==', code.toUpperCase())
                    );
                    const snap = await getDocs(q);
                    
                    if (snap.empty) {
                        playSound('error'); 
                        addToast('Código não encontrado.', 'error');
                        setSingleItem(null);
                    } else {
                        playSound('success'); 
                        setSingleItem({ id: snap.docs[0].id, ...snap.docs[0].data() });
                        // REMOVIDO: setCode('');  <-- Isso causava o bug de limpar a tela
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoadingScan(false);
                }
            }, 500);
        }
    }, [code, mode, showCamera, addToast]);

    // --- CARREGAMENTO DA LISTA (FILTRADO) ---
    useEffect(() => {
        if (mode === 'list') {
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
                where('status', 'in', ['recebido', 'em_esterilizacao', 'pronto']), 
                orderBy('lastUpdated', 'desc'), 
                limit(visibleLimit) 
            );
            
            const unsub = onSnapshot(q, s => setListItems(s.docs.map(d => ({id: d.id, ...d.data()}))), (error) => {
                console.error("Erro na lista de movimentação:", error);
                if (error.code === 'failed-precondition') {
                    addToast('Necessário criar índice no Firebase (veja console).', 'error');
                }
            });
            return () => unsub();
        }
    }, [mode, visibleLimit]);

    const updateStatus = async (item, newStatus) => {
        const batch = writeBatch(db);
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id);
        const history = [...(item.history || []), { status: newStatus, timestamp: new Date().toISOString(), by: userProfile.name }];
        
        batch.update(ref, { status: newStatus, history, lastUpdated: serverTimestamp() });
        
        if (item.studentId) {
            const nRef = doc(collection(db, 'artifacts', appId, 'users', item.studentId, 'notifications'));
            batch.set(nRef, {
                title: 'Atualização de Material',
                message: `Seu item ${item.code} - ${item.type} mudou para: ${STATUS_CONFIG[newStatus].label}`,
                read: false,
                createdAt: serverTimestamp()
            });
        }
        await batch.commit();
        await logEvent('ITEM_MOVE', `Item ${item.code} movido para ${newStatus}`, { itemId: item.id, code: item.code, newStatus });
        
        // Se for leitura individual, atualiza o item na tela
        if (mode === 'single' && singleItem && singleItem.id === item.id) {
            setSingleItem(prev => ({...prev, status: newStatus}));
        }
    };

    const handleBatch = async (newStatus) => {
        if (!await confirm({ title: 'Movimentação em Lote', message: `Mover ${selectedIds.length} itens para "${STATUS_CONFIG[newStatus].label}"?` })) return;
        for (const id of selectedIds) {
            const item = listItems.find(i => i.id === id);
            if (item) await updateStatus(item, newStatus);
        }
        addToast(`${selectedIds.length} itens atualizados!`, 'success');
        setSelectedIds([]);
    };

    const handleDeleteBatch = async () => {
        if(selectedIds.length === 0) return;
        if (!await confirm({ title: 'Excluir Itens', message: `ATENÇÃO: Deseja realmente excluir ${selectedIds.length} itens?`, isDestructive: true })) return;

        const batch = writeBatch(db);
        for (const id of selectedIds) {
            const item = listItems.find(i => i.id === id);
            if(item) {
                await logEvent('ITEM_DELETE', `Exclusão do item ${item.code}`, { executor: userProfile.name });
                batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'items', id));
            }
        }
        await batch.commit();
        addToast(`${selectedIds.length} itens excluídos.`, 'success');
        setSelectedIds([]);
    };

    const filteredList = listItems.filter(i => {
		let matchesSearch = false;
		if (search.startsWith('"') && search.endsWith('"') && search.length > 2) {
			const exactTerm = search.slice(1, -1);
			matchesSearch = i.studentName.includes(exactTerm) || i.code.includes(exactTerm) || (i.type && i.type.includes(exactTerm));
		} else {
			matchesSearch = i.studentName.toLowerCase().includes(search.toLowerCase()) || 
							i.code.toUpperCase().includes(search.toUpperCase()) ||
							(i.type && i.type.toLowerCase().includes(search.toLowerCase()));
		}
		const matchesStatus = filterStatus === 'all' ? true : i.status === filterStatus;
		return matchesSearch && matchesStatus;
	});

    return (
        <div className="space-y-6">
            
            {/* CABEÇALHO PADRONIZADO (IGUAL AO HISTÓRICO) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2 w-full md:w-auto">
                    <ScanBarcode className="text-[#009DE0]"/> Movimentação
                </h2>

                <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-full md:w-fit overflow-x-auto">
                    <button onClick={() => { setMode('list'); setCode(''); setSingleItem(null); setShowCamera(false); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${mode === 'list' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>Lista / Lote</button>
                    <button onClick={() => setMode('single')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${mode === 'single' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>Leitura Individual</button>
                </div>
            </div>

            {mode === 'single' ? (
                <div className="max-w-xl mx-auto space-y-6 py-8 animate-in zoom-in-95 duration-300">
                    
                    {/* CARTÃO DE LEITURA */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg text-center relative overflow-hidden">
                        
                        {!showCamera ? (
                            <>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#009DE0] via-purple-500 to-[#009DE0] animate-pulse"/>
                                <ScanBarcode className="w-16 h-16 text-[#009DE0] mx-auto mb-6"/>
                                <h2 className="text-2xl font-bold text-[#021D34] mb-2">Movimentação de Item</h2>
                                <p className="text-slate-500 mb-8 text-sm">Bipe o código, digite abaixo ou use a câmera.</p>
                                
                                <input 
                                    className="w-full text-center font-mono text-3xl uppercase tracking-[0.2em] p-4 border-2 border-slate-200 rounded-xl focus:border-[#009DE0] focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:tracking-normal mb-4" 
                                    placeholder="CÓDIGO" 
                                    value={code} 
                                    onChange={e => setCode(e.target.value)} 
                                    autoFocus
                                />

                                <button 
                                    onClick={() => setShowCamera(true)}
                                    className="w-full flex items-center justify-center gap-2 bg-[#021D34] text-white py-3 rounded-xl font-bold hover:bg-[#009DE0] transition-colors"
                                >
                                    <Camera size={20}/> Usar Câmera
                                </button>
                            </>
                        ) : (
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-w-sm mx-auto">
                                <Scanner 
                                    onScan={handleScan}
                                    components={{ audio: false }}
                                />
                                <div className="absolute inset-0 border-2 border-[#009DE0] opacity-50 pointer-events-none"/>
                                <button 
                                    onClick={() => setShowCamera(false)}
                                    className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-white/30 z-20"
                                >
                                    <XCircle size={18}/> Cancelar
                                </button>
                            </div>
                        )}

                        {loadingScan && <div className="mt-4 flex justify-center text-[#009DE0] gap-2 items-center text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Buscando...</div>}
                    </div>

                    {/* DETALHES DO ITEM ENCONTRADO */}
                    {singleItem && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md animate-in slide-in-from-bottom-4">
                            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">Aluno</span>
                                    <h3 className="text-xl font-bold text-[#021D34]">{singleItem.studentName}</h3>
                                    <p className="text-sm text-slate-500">{singleItem.type}</p>
                                </div>
                                <div className="flex flex-row md:flex-col items-center md:items-end gap-2 w-full md:w-auto justify-between md:justify-start">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${STATUS_CONFIG[singleItem.status].color}`}>{STATUS_CONFIG[singleItem.status].label}</span>
                                    <button onClick={() => printItems(singleItem)} className="flex items-center gap-1 text-xs text-[#009DE0] hover:underline font-bold"><Printer size={12}/> Reimprimir</button>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                {singleItem.status === 'recebido' && <button onClick={async () => { await updateStatus(singleItem, 'em_esterilizacao'); addToast('Status atualizado!', 'success'); }} className="p-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20">Iniciar Esterilização</button>}
                                {singleItem.status === 'em_esterilizacao' && <button onClick={async () => { await updateStatus(singleItem, 'pronto'); addToast('Material pronto!', 'success'); }} className="p-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20">Marcar como Pronto</button>}
                                {singleItem.status === 'pronto' && <button onClick={async () => { await updateStatus(singleItem, 'retirado'); addToast('Retirada confirmada!', 'success'); }} className="p-4 bg-[#009DE0] text-white rounded-xl font-bold hover:bg-[#008bc5] transition-colors shadow-lg shadow-blue-500/20">Confirmar Retirada</button>}
                                {singleItem.status === 'retirado' && <p className="text-center text-slate-500 py-4 bg-slate-50 rounded-xl">Este material já foi retirado.</p>}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4 flex-1">
                             <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                <input className="w-full pl-10 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" placeholder="Buscar código ou aluno..." value={search} onChange={e => setSearch(e.target.value)}/>
                             </div>
                             <select className="p-2 border rounded-lg text-sm outline-none bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="all">Todos Ativos</option>
                                {Object.entries(STATUS_CONFIG)
                                    .filter(([k]) => k !== 'retirado') 
                                    .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                             </select>
                        </div>
                        {selectedIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 animate-in slide-in-from-right bg-slate-50 p-2 rounded-lg">
                                <span className="text-xs font-bold whitespace-nowrap w-full md:w-auto text-center">{selectedIds.length} selecionados</span>
                                <div className="flex gap-2 w-full md:w-auto justify-center">
                                    <button onClick={() => handleBatch('em_esterilizacao')} className="bg-orange-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-orange-600">Esterilizar</button>
                                    <button onClick={() => handleBatch('pronto')} className="bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-600">Pronto</button>
                                    <button onClick={() => handleBatch('retirado')} className="bg-[#009DE0] text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-sky-600">Retirado</button>
                                    <button onClick={handleDeleteBatch} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 flex items-center gap-1"><Trash2 size={12}/></button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DataTable 
                        columns={[
                            { key: 'select', label: '', render: (i) => <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="rounded text-[#009DE0] focus:ring-[#009DE0]"/> },
                            { key: 'code', label: 'Código', sortable: true, render: (i) => <span className="font-mono font-bold text-[#009DE0]">{i.code}</span> },
                            { key: 'studentName', label: 'Aluno', sortable: true },
                            { key: 'type', label: 'Material', sortable: true },
                            { key: 'createdAt', label: 'Entrada', sortable: true, render: (i) => formatDate(i.createdAt) },
                            { key: 'status', label: 'Status', sortable: true, render: (i) => <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${STATUS_CONFIG[i.status].color}`}>{STATUS_CONFIG[i.status].label}</span> }
                        ]}
                        data={filteredList}
                        mobileRender={(i) => (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center h-full">
                                    <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="w-5 h-5 rounded text-[#009DE0] focus:ring-[#009DE0]"/>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <span className="font-mono font-bold text-[#009DE0] text-lg">{i.code}</span>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border h-fit ${STATUS_CONFIG[i.status].color}`}>{STATUS_CONFIG[i.status].label}</span>
                                    </div>
                                    <p className="font-bold text-slate-800">{i.studentName}</p>
                                    <p className="text-sm text-slate-500">{i.type}</p>
                                    <p className="text-xs text-slate-400 mt-1">{formatDate(i.createdAt)}</p>
                                </div>
                            </div>
                        )}
                        actions={(item) => (
                            <button onClick={() => printItems(item)} className="p-2 text-slate-400 hover:text-[#009DE0] hover:bg-blue-50 rounded bg-slate-50 border border-slate-200" title="Imprimir Etiqueta"><Printer size={20}/></button>
                        )}
                    />

                    {listItems.length >= visibleLimit && search === '' && filterStatus === 'all' && (
                        <div className="flex justify-center pt-2">
                             <button onClick={() => setVisibleLimit(p => p + 50)} className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2">
                                <ArrowDown size={16}/> Carregar Mais
                             </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}