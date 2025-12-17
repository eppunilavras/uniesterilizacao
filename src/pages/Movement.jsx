import React, { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { collection, query, orderBy, limit, where, onSnapshot, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { 
  ScanBarcode, 
  Printer, 
  Search, 
  ArrowDown, 
  Camera, 
  XCircle, 
  Loader2, 
  AlertTriangle, 
  X,
  CheckCircle2 
} from 'lucide-react';

import { db, appId } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { useDialog } from '../contexts/DialogContext';
import { usePrint } from '../contexts/PrintContext';
import { logEvent } from '../utils/logger';
import { formatDate } from '../utils/formatters';
import { playSound } from '../utils/audio';
import { STATUS_CONFIG } from '../constants';
import DataTable from '../components/DataTable';

import { useScanner } from '../hooks/useScanner';

// --- DEFINIÇÃO DA ORDEM RIGOROSA ---
const STATUS_ORDER = ['recebido', 'em_esterilizacao', 'pronto', 'retirado'];

export default function Movement({ userProfile }) {
    const [mode, setMode] = useState('list');
    
    // Hooks do Scanner
    const { code, setCode, showCamera, setShowCamera, handleScan } = useScanner();
    
    const [singleItem, setSingleItem] = useState(null);
    const [listItems, setListItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loadingScan, setLoadingScan] = useState(false);
    const [visibleLimit, setVisibleLimit] = useState(50);
    
    const [incidentModal, setIncidentModal] = useState({ 
        isOpen: false, 
        item: null, 
        reason: '', 
        type: 'report' 
    });
    
    const { addToast } = useToast();
    const { confirm } = useDialog();
    const { printItems } = usePrint();
    
    const searchTimeout = useRef(null);
    const lastSearchedCode = useRef('');
    const inputRef = useRef(null);

    // --- HELPER: VALIDAÇÃO DE TRANSIÇÃO (Melhorada) ---
    const canMoveTo = (currentStatus, nextStatus) => {
        // 1. Sempre permite mover PARA problema (ocorrência)
        if (nextStatus === 'problema') return { allowed: true };
        
        // 2. Sempre permite sair DE problema (resolução)
        if (currentStatus === 'problema') return { allowed: true };

        const currIndex = STATUS_ORDER.indexOf(currentStatus);
        const nextIndex = STATUS_ORDER.indexOf(nextStatus);

        // Se algum status não estiver na lista padrão (erro de dados), bloqueia por segurança
        if (currIndex === -1 || nextIndex === -1) {
            return { allowed: false, error: 'O status atual do item é inválido. Contate o suporte.' };
        }

        // 3. Bloqueia mesmo status
        if (currIndex === nextIndex) {
            return { allowed: false, error: 'O item já está neste status.' };
        }

        // 4. Bloqueia retrocesso (Voltar status)
        if (nextIndex < currIndex) {
            return { allowed: false, error: 'O fluxo de esterilização é contínuo. Não é permitido retroceder etapas.' };
        }

        // 5. Bloqueia pular etapas (Obrigatório ser sequencial: Index + 1)
        if (nextIndex > currIndex + 1) {
             return { allowed: false, error: `Etapa incorreta. O item deve passar por ${STATUS_CONFIG[STATUS_ORDER[currIndex+1]].label} antes de chegar aqui.` };
        }

        return { allowed: true };
    };

    // --- BUSCA AUTOMÁTICA ---
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (code === '') { 
            setLoadingScan(false); 
            lastSearchedCode.current = ''; 
            return; 
        }

        if (mode === 'single' && code.length >= 6 && !showCamera && code !== lastSearchedCode.current) {
            setLoadingScan(true);
            searchTimeout.current = setTimeout(async () => {
                try {
                    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('code', '==', code.toUpperCase()));
                    const snap = await getDocs(q);
                    
                    lastSearchedCode.current = code;

                    if (snap.empty) {
                        playSound('error'); 
                        addToast('Código não encontrado. Verifique se o item foi cadastrado na Recepção.', 'error');
                        setSingleItem(null); 
                    } else {
                        playSound('success'); 
                        setSingleItem({ id: snap.docs[0].id, ...snap.docs[0].data() });
                        setCode(''); 
                    }
                } catch (error) { 
                    console.error(error); 
                } finally { 
                    setLoadingScan(false); 
                }
            }, 500);
        }
    }, [code, mode, showCamera, addToast, setCode]);

    // --- LISTAGEM ---
    useEffect(() => {
        if (mode === 'list') {
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
                where('status', 'in', ['recebido', 'em_esterilizacao', 'pronto', 'problema']), 
                orderBy('lastUpdated', 'desc'), 
                limit(visibleLimit) 
            );
            const unsub = onSnapshot(q, s => setListItems(s.docs.map(d => ({id: d.id, ...d.data()}))));
            return () => unsub();
        }
    }, [mode, visibleLimit]);

    // --- FUNÇÃO DE ATUALIZAÇÃO ---
    const updateStatus = async (item, newStatus, reason = null) => {
        // Validação Rigorosa
        const validation = canMoveTo(item.status, newStatus);
        if (!validation.allowed) {
            addToast(`Erro: ${validation.error}`, 'error');
            return;
        }

        const batch = writeBatch(db);
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id);
        
        const previousStatus = item.status;

        const historyEntry = { 
            status: newStatus, 
            timestamp: new Date().toISOString(), 
            by: userProfile.name 
        };
        if (reason) historyEntry.reason = reason;

        const history = [...(item.history || []), historyEntry];
        batch.update(ref, { status: newStatus, history, lastUpdated: serverTimestamp() });
        
        if (item.studentId) {
            const nRef = doc(collection(db, 'artifacts', appId, 'users', item.studentId, 'notifications'));
            let title = 'Atualização de Material';
            let message = `Seu item ${item.code} - ${item.type} mudou para: ${STATUS_CONFIG[newStatus].label}`;
            
            if (newStatus === 'problema' && reason) {
                title = '⚠️ Atenção: Ocorrência com Material';
                message = `Houve uma ocorrência com seu item ${item.code} (${item.type}): "${reason}". Por favor, procure a central.`;
            } else if (reason && reason.startsWith('Resolução:')) {
                title = '✅ Ocorrência Resolvida';
                message = `O problema com seu item ${item.code} foi resolvido e ele retornou para: ${STATUS_CONFIG[newStatus].label}.`;
            }

            batch.set(nRef, { title, message, read: false, createdAt: serverTimestamp() });
        }
        
        await batch.commit();
        
        await logEvent(
            'ITEM_MOVE', 
            `Item ${item.code} movido para ${newStatus}`, 
            { 
                itemId: item.id, 
                code: item.code, 
                studentName: item.studentName,
                previousStatus: previousStatus,
                newStatus: newStatus, 
                reason: reason || 'Fluxo normal' 
            }
        );
        
        if (mode === 'single' && singleItem && singleItem.id === item.id) { 
            setSingleItem(prev => ({...prev, status: newStatus})); 
        }

        if (mode === 'single' && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 50);
        }
    };

    const handleIncidentClick = (item) => { 
        setIncidentModal({ isOpen: true, item: item, reason: '', type: 'report' }); 
    };

    const handleResolveClick = (item) => { 
        setIncidentModal({ isOpen: true, item: item, reason: '', type: 'resolve' }); 
    };
    
    const confirmIncident = async () => {
        if (!incidentModal.reason.trim()) { 
            addToast('Por favor, digite uma descrição.', 'error'); 
            return; 
        }

        const isResolution = incidentModal.type === 'resolve';
        let newStatus = 'problema';

        if (isResolution) {
            const historyReversed = [...(incidentModal.item.history || [])].reverse();
            // Tenta encontrar o último status válido que não seja problema ou retirado
            const lastValidStatus = historyReversed.find(h => h.status !== 'problema' && h.status !== 'retirado');
            
            // Se não achar, volta para recebido por segurança
            newStatus = lastValidStatus ? lastValidStatus.status : 'recebido';
        }
        
        const logText = isResolution ? `Resolução: ${incidentModal.reason}` : incidentModal.reason;

        await updateStatus(incidentModal.item, newStatus, logText);
        
        addToast(isResolution ? `Resolvido! Item retornou para: ${STATUS_CONFIG[newStatus].label}` : 'Ocorrência registrada.', 'success');
        setIncidentModal({ isOpen: false, item: null, reason: '', type: 'report' });
    };

    // --- LOTE INTELIGENTE ---
    const handleBatch = async (targetStatus) => {
        // Filtra APENAS itens que podem mover para o status alvo
        const eligibleItems = listItems.filter(i => {
            const validation = canMoveTo(i.status, targetStatus);
            return selectedIds.includes(i.id) && validation.allowed;
        });

        const ignoredCount = selectedIds.length - eligibleItems.length;

        if (eligibleItems.length === 0) {
            if (ignoredCount > 0) {
                addToast('Nenhum item selecionado pode ir para este status (sequência incorreta).', 'warning');
            } else {
                addToast('Selecione itens válidos primeiro.', 'error');
            }
            return;
        }

        const message = ignoredCount > 0 
            ? `Mover ${eligibleItems.length} itens para ${STATUS_CONFIG[targetStatus].label}? (${ignoredCount} ignorados por estarem na etapa errada)`
            : `Mover ${eligibleItems.length} itens para ${STATUS_CONFIG[targetStatus].label}?`;

        if (!await confirm({ title: 'Movimentação em Lote', message })) return;

        for (const item of eligibleItems) { 
            await updateStatus(item, targetStatus); 
        }
        
        addToast(`${eligibleItems.length} itens atualizados!`, 'success'); 
        setSelectedIds([]);
    };

    const filteredList = listItems.filter(i => {
        let matchesSearch = false;
        if (search.startsWith('"') && search.endsWith('"') && search.length > 2) {
            const exactTerm = search.slice(1, -1);
            matchesSearch = i.studentName.includes(exactTerm) || i.code.includes(exactTerm) || (i.type && i.type.includes(exactTerm));
        } else {
            matchesSearch = i.studentName.toLowerCase().includes(search.toLowerCase()) || i.code.toUpperCase().includes(search.toUpperCase()) || (i.type && i.type.toLowerCase().includes(search.toLowerCase()));
        }
        return matchesSearch && (filterStatus === 'all' ? true : i.status === filterStatus);
    });

    return (
        <div className="space-y-6 transition-colors">
            {/* MODAL DE INCIDENTES */}
            {incidentModal.isOpen && (
                <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-[#021D34]/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-lg font-bold flex items-center gap-2 ${incidentModal.type === 'resolve' ? 'text-green-700 dark:text-green-400' : 'text-[#021D34] dark:text-white'}`}>
                                {incidentModal.type === 'resolve' ? <CheckCircle2 className="text-green-600 dark:text-green-400"/> : <AlertTriangle className="text-red-500 dark:text-red-400"/>} 
                                {incidentModal.type === 'resolve' ? 'Resolver Ocorrência' : 'Registrar Ocorrência'}
                            </h3>
                            <button onClick={() => setIncidentModal({ ...incidentModal, isOpen: false })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full"><X size={20} /></button>
                        </div>
                        
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            {incidentModal.type === 'resolve' 
                                ? `Descreva a solução. O item retornará ao status anterior.` 
                                : `Descreva o problema com o item ${incidentModal.item?.code}.`
                            }
                        </p>
                        
                        <textarea 
                            className="w-full p-4 border border-slate-200 dark:border-slate-600 rounded-xl outline-none text-sm min-h-[120px] bg-slate-50 dark:bg-slate-900 dark:text-white focus:border-[#009DE0] dark:focus:border-[#009DE0] transition-colors" 
                            placeholder={incidentModal.type === 'resolve' ? "Ex: Material re-lavado, Item consertado..." : "Motivo do problema..."}
                            value={incidentModal.reason} 
                            onChange={(e) => setIncidentModal({ ...incidentModal, reason: e.target.value })} 
                            autoFocus 
                        />
                        
                        <div className="flex gap-3 justify-end mt-4">
                            <button onClick={() => setIncidentModal({ ...incidentModal, isOpen: false })} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors">Cancelar</button>
                            <button 
                                onClick={confirmIncident} 
                                className={`px-6 py-2 text-white font-bold rounded-lg hover:brightness-90 text-sm transition-colors ${incidentModal.type === 'resolve' ? 'bg-green-600 dark:bg-green-700' : 'bg-red-600 dark:bg-red-700'}`}
                            >
                                {incidentModal.type === 'resolve' ? 'Resolver & Retornar' : 'Confirmar Problema'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-bold text-[#021D34] dark:text-white text-2xl flex items-center gap-2 w-full md:w-auto transition-colors">
                    <ScanBarcode className="text-[#009DE0]"/> Movimentação
                </h2>
                <div className="flex gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg w-full md:w-fit overflow-x-auto transition-colors">
                    <button onClick={() => { setMode('list'); setCode(''); setSingleItem(null); setShowCamera(false); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md whitespace-nowrap transition-all ${mode === 'list' ? 'bg-white dark:bg-slate-800 text-[#009DE0] shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'}`}>Lista / Lote</button>
                    <button onClick={() => setMode('single')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md whitespace-nowrap transition-all ${mode === 'single' ? 'bg-white dark:bg-slate-800 text-[#009DE0] shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'}`}>Leitura Individual</button>
                </div>
            </div>

            {mode === 'single' ? (
                <div className="max-w-xl mx-auto space-y-6 py-8 animate-in zoom-in-95 duration-300">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg text-center relative overflow-hidden transition-colors">
                        {!showCamera ? (
                            <>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#009DE0] via-purple-500 to-[#009DE0] animate-pulse"/>
                                <ScanBarcode className="w-16 h-16 text-[#009DE0] mx-auto mb-6"/>
                                <h2 className="text-2xl font-bold text-[#021D34] dark:text-white mb-2">Movimentação de Item</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Bipe o código, digite abaixo ou use a câmera.</p>
                                <input 
                                    ref={inputRef}
                                    className="w-full text-center font-mono text-3xl uppercase tracking-[0.2em] p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-[#009DE0] dark:focus:border-[#009DE0] outline-none mb-4 bg-white dark:bg-slate-900 text-black dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors" 
                                    placeholder="CÓDIGO" 
                                    value={code} 
                                    onChange={e => setCode(e.target.value)} 
                                    autoFocus 
                                />
                                <button onClick={() => setShowCamera(true)} className="w-full flex items-center justify-center gap-2 bg-[#021D34] text-white py-3 rounded-xl font-bold hover:bg-[#009DE0] transition-colors"><Camera size={20}/> Usar Câmera</button>
                            </>
                        ) : (
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-w-sm mx-auto">
                                <Scanner onScan={handleScan} components={{ audio: false }} />
                                <button onClick={() => setShowCamera(false)} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-white/30 z-20"><XCircle size={18}/> Cancelar</button>
                            </div>
                        )}
                        {loadingScan && <div className="mt-4 flex justify-center text-[#009DE0] gap-2 items-center text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Buscando...</div>}
                    </div>
                    
                    {singleItem && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md animate-in slide-in-from-bottom-4 transition-colors">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-[#021D34] dark:text-white">{singleItem.studentName}</h3>
                                    <p className="text-lg font-mono font-bold text-[#009DE0] mt-1 tracking-wider">{singleItem.code}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{singleItem.type}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <button 
                                        onClick={() => { 
                                            setSingleItem(null); 
                                            setCode(''); 
                                            if(inputRef.current) inputRef.current.focus(); 
                                        }} 
                                        className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                                        title="Fechar e Ler Novo"
                                    >
                                        <X size={20}/>
                                    </button>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${STATUS_CONFIG[singleItem.status]?.color}`}>{STATUS_CONFIG[singleItem.status]?.label}</span>
                                </div>
                            </div>
                            
                            <div className="grid gap-3">
                                {singleItem.status !== 'problema' && (
                                    <>
                                        {/* BOTÕES CONDICIONAIS QUE RESPEITAM A ORDEM */}
                                        {singleItem.status === 'recebido' && <button onClick={() => updateStatus(singleItem, 'em_esterilizacao')} className="p-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors">Iniciar Esterilização</button>}
                                        {singleItem.status === 'em_esterilizacao' && <button onClick={() => updateStatus(singleItem, 'pronto')} className="p-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors">Marcar como Pronto</button>}
                                        {singleItem.status === 'pronto' && <button onClick={() => updateStatus(singleItem, 'retirado')} className="p-4 bg-[#009DE0] text-white rounded-xl font-bold hover:bg-[#008bc5] transition-colors">Confirmar Retirada</button>}
                                    </>
                                )}

                                {singleItem.status !== 'retirado' && (
                                    <>
                                        {singleItem.status === 'problema' ? (
                                            <button 
                                                onClick={() => handleResolveClick(singleItem)} 
                                                className="mt-2 p-3 text-white bg-green-600 border border-green-700 rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm animate-pulse transition-colors"
                                            >
                                                <CheckCircle2 size={18}/> Resolver Ocorrência & Liberar
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleIncidentClick(singleItem)} 
                                                className="mt-2 p-3 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <AlertTriangle size={18}/> Registrar Ocorrência
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                        <div className="flex flex-col md:flex-row gap-4 flex-1">
                             <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                <input className="w-full pl-10 p-2 border dark:border-slate-600 rounded-lg text-sm outline-none focus:border-[#009DE0] dark:focus:border-[#009DE0] bg-transparent dark:bg-slate-900 text-slate-900 dark:text-white transition-colors" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}/>
                             </div>
                             <select className="p-2 border dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-[#009DE0] transition-colors" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="all">Todos Ativos</option>{Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'retirado').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                        </div>
                        {selectedIds.length > 0 && (
                            <div className="flex gap-2 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg transition-colors"><span className="text-xs font-bold dark:text-slate-300">{selectedIds.length} sel.</span><button onClick={() => handleBatch('em_esterilizacao')} className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600 transition-colors">Esterilizar</button><button onClick={() => handleBatch('pronto')} className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition-colors">Pronto</button><button onClick={() => handleBatch('retirado')} className="bg-[#009DE0] text-white px-2 py-1 rounded text-xs hover:bg-[#008bc5] transition-colors">Retirado</button></div>
                        )}
                    </div>
                    <DataTable 
                        columns={[
                            { key: 'select', label: '', render: (i) => <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="rounded text-[#009DE0] focus:ring-[#009DE0] bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"/> },
                            { key: 'code', label: 'Código', sortable: true, render: (i) => <span className="font-mono font-bold text-[#009DE0]">{i.code}</span> },
                            { key: 'studentName', label: 'Aluno', sortable: true },
                            { key: 'type', label: 'Material', sortable: true },
                            { key: 'createdAt', label: 'Entrada', sortable: true, render: (i) => formatDate(i.createdAt) },
                            { key: 'status', label: 'Status', sortable: true, render: (i) => { const c = STATUS_CONFIG[i.status] || STATUS_CONFIG['recebido']; return <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${c.color}`}>{c.label}</span> }}
                        ]}
                        data={filteredList}
                        mobileRender={(i) => (
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="w-5 h-5 rounded text-[#009DE0] bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"/>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <span className="font-mono font-bold text-[#009DE0]">{i.code}</span>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${STATUS_CONFIG[i.status]?.color}`}>{STATUS_CONFIG[i.status]?.label}</span>
                                    </div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{i.studentName}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{i.type}</p>
                                </div>
                            </div>
                        )}
                        actions={(item) => (
                            <div className="flex gap-1 justify-center">
                                <button onClick={() => printItems(item)} className="p-2 text-slate-400 hover:text-[#009DE0] bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded transition-colors"><Printer size={20}/></button>
                                {item.status !== 'retirado' && (
                                    <>
                                        {item.status === 'problema' ? (
                                            <button onClick={() => handleResolveClick(item)} className="p-2 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded transition-colors" title="Resolver"><CheckCircle2 size={20}/></button>
                                        ) : (
                                            <button onClick={() => handleIncidentClick(item)} className="p-2 text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded transition-colors" title="Registrar Ocorrência"><AlertTriangle size={20}/></button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    />
                    {listItems.length >= visibleLimit && <div className="flex justify-center pt-2"><button onClick={() => setVisibleLimit(p => p + 50)} className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-slate-600 dark:text-slate-300 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><ArrowDown size={16}/> Carregar Mais</button></div>}
                </div>
            )}
        </div>
    );
}