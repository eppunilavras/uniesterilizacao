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
  Loader2,
  AlertTriangle,
  X // <--- Adicionado para o botão de fechar do modal
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

    // --- NOVO: Estado para o Modal de Incidente ---
    const [incidentModal, setIncidentModal] = useState({ 
        isOpen: false, 
        item: null, 
        reason: '' 
    });
    
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

    // --- BUSCA AUTOMÁTICA ---
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        
        if (code === '') {
            setSingleItem(null);
            return;
        }

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
                    }
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoadingScan(false);
                }
            }, 500);
        }
    }, [code, mode, showCamera, addToast]);

    // --- CARREGAMENTO DA LISTA ---
    useEffect(() => {
        if (mode === 'list') {
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
                where('status', 'in', ['recebido', 'em_esterilizacao', 'pronto', 'problema']), 
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

    // --- ATUALIZAÇÃO DE STATUS (Com suporte a Motivo) ---
    const updateStatus = async (item, newStatus, reason = null) => {
        const batch = writeBatch(db);
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'items', item.id);
        
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
            }

            batch.set(nRef, {
                title,
                message,
                read: false,
                createdAt: serverTimestamp()
            });
        }
        await batch.commit();
        await logEvent('ITEM_MOVE', `Item ${item.code} movido para ${newStatus}`, { itemId: item.id, code: item.code, newStatus, reason });
        
        if (mode === 'single' && singleItem && singleItem.id === item.id) {
            setSingleItem(prev => ({...prev, status: newStatus}));
        }
    };

    // --- NOVOS HANDLERS DO MODAL DE INCIDENTE ---
    
    // Abre o modal
    const handleIncidentClick = (item) => {
        setIncidentModal({ 
            isOpen: true, 
            item: item, 
            reason: '' // Reseta o motivo ao abrir
        });
    };

    // Confirma e salva
    const confirmIncident = async () => {
        if (!incidentModal.reason.trim()) {
            addToast('Por favor, descreva o problema.', 'error');
            return;
        }
        
        await updateStatus(incidentModal.item, 'problema', incidentModal.reason);
        addToast('Ocorrência registrada e aluno notificado.', 'success');
        
        // Fecha o modal
        setIncidentModal({ isOpen: false, item: null, reason: '' });
    };

    // Ações em Lote
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
            
            {/* --- MODAL DE OCORRÊNCIA (Novo) --- */}
            {incidentModal.isOpen && (
                <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-[#021D34]/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-[#021D34] flex items-center gap-2">
                                <AlertTriangle className="text-red-500" size={24} /> 
                                Registrar Ocorrência
                            </h3>
                            <button 
                                onClick={() => setIncidentModal({ ...incidentModal, isOpen: false })} 
                                className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-500 mb-4">
                            Descreva o problema identificado com o item <strong className="text-[#021D34]">{incidentModal.item?.code}</strong>. 
                            <br/>Esta mensagem será enviada ao aluno.
                        </p>

                        <textarea 
                            className="w-full p-4 border border-slate-200 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm min-h-[120px] resize-none mb-6 bg-slate-50"
                            placeholder="Ex: Material chegou com peça quebrada; Item incompleto; Embalagem violada..."
                            value={incidentModal.reason}
                            onChange={(e) => setIncidentModal({ ...incidentModal, reason: e.target.value })}
                            autoFocus
                        />

                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setIncidentModal({ ...incidentModal, isOpen: false })}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmIncident}
                                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 text-sm flex items-center gap-2"
                            >
                                Confirmar Ocorrência
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                <button onClick={() => setShowCamera(true)} className="w-full flex items-center justify-center gap-2 bg-[#021D34] text-white py-3 rounded-xl font-bold hover:bg-[#009DE0] transition-colors"><Camera size={20}/> Usar Câmera</button>
                            </>
                        ) : (
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-w-sm mx-auto">
                                <Scanner onScan={handleScan} components={{ audio: false }} />
                                <div className="absolute inset-0 border-2 border-[#009DE0] opacity-50 pointer-events-none"/>
                                <button onClick={() => setShowCamera(false)} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-white/30 z-20"><XCircle size={18}/> Cancelar</button>
                            </div>
                        )}
                        {loadingScan && <div className="mt-4 flex justify-center text-[#009DE0] gap-2 items-center text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Buscando...</div>}
                    </div>

                    {singleItem && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md animate-in slide-in-from-bottom-4">
                            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase">Aluno</span>
                                    <h3 className="text-xl font-bold text-[#021D34]">{singleItem.studentName}</h3>
                                    <p className="text-sm text-slate-500">{singleItem.type}</p>
                                </div>
                                <div className="flex flex-row md:flex-col items-center md:items-end gap-2 w-full md:w-auto justify-between md:justify-start">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase ${STATUS_CONFIG[singleItem.status]?.color || STATUS_CONFIG['recebido'].color}`}>
                                        {STATUS_CONFIG[singleItem.status]?.label || singleItem.status}
                                    </span>
                                    <button onClick={() => printItems(singleItem)} className="flex items-center gap-1 text-xs text-[#009DE0] hover:underline font-bold"><Printer size={12}/> Reimprimir</button>
                                </div>
                            </div>
                            
                            <div className="grid gap-3">
                                {singleItem.status === 'recebido' && <button onClick={async () => { await updateStatus(singleItem, 'em_esterilizacao'); addToast('Status atualizado!', 'success'); }} className="p-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20">Iniciar Esterilização</button>}
                                {singleItem.status === 'em_esterilizacao' && <button onClick={async () => { await updateStatus(singleItem, 'pronto'); addToast('Material pronto!', 'success'); }} className="p-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20">Marcar como Pronto</button>}
                                {singleItem.status === 'pronto' && <button onClick={async () => { await updateStatus(singleItem, 'retirado'); addToast('Retirada confirmada!', 'success'); }} className="p-4 bg-[#009DE0] text-white rounded-xl font-bold hover:bg-[#008bc5] transition-colors shadow-lg shadow-blue-500/20">Confirmar Retirada</button>}
                                {singleItem.status === 'retirado' && <p className="text-center text-slate-500 py-4 bg-slate-50 rounded-xl">Este material já foi retirado.</p>}
                                {singleItem.status === 'problema' && <p className="text-center text-red-600 py-4 bg-red-50 rounded-xl font-bold border border-red-100 flex items-center justify-center gap-2"><AlertTriangle/> Item com Ocorrência Registrada.</p>}
                                
                                {/* BOTÃO DE OCORRÊNCIA (Novo Handler) */}
                                {singleItem.status !== 'retirado' && (
                                    <button 
                                        onClick={() => handleIncidentClick(singleItem)}
                                        className="mt-2 p-3 text-red-600 border border-red-200 bg-red-50 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <AlertTriangle size={18}/> {singleItem.status === 'problema' ? 'Editar Ocorrência' : 'Registrar Ocorrência'}
                                    </button>
                                )}
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
                            { key: 'status', label: 'Status', sortable: true, render: (i) => {
                                const config = STATUS_CONFIG[i.status] || STATUS_CONFIG['recebido'];
                                return <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border ${config.color}`}>{config.label}</span>
                            }}
                        ]}
                        data={filteredList}
                        mobileRender={(i) => {
                            const config = STATUS_CONFIG[i.status] || STATUS_CONFIG['recebido'];
                            return (
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center h-full">
                                        <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="w-5 h-5 rounded text-[#009DE0] focus:ring-[#009DE0]"/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <span className="font-mono font-bold text-[#009DE0] text-lg">{i.code}</span>
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border h-fit ${config.color}`}>{config.label}</span>
                                        </div>
                                        <p className="font-bold text-slate-800">{i.studentName}</p>
                                        <p className="text-sm text-slate-500">{i.type}</p>
                                        <p className="text-xs text-slate-400 mt-1">{formatDate(i.createdAt)}</p>
                                    </div>
                                    
                                    {/* Ação rápida na lista também (Opcional) */}
                                    {i.status !== 'retirado' && (
                                        <button onClick={() => handleIncidentClick(i)} className="p-2 text-red-400 bg-red-50 rounded-full border border-red-100 shadow-sm" title="Ocorrência"><AlertTriangle size={16}/></button>
                                    )}
                                </div>
                            );
                        }}
                        actions={(item) => (
                            // AQUI ESTÁ A ALTERAÇÃO: adicionado 'justify-center'
                            <div className="flex gap-1 justify-center">
                                <button onClick={() => printItems(item)} className="p-2 text-slate-400 hover:text-[#009DE0] hover:bg-blue-50 rounded bg-slate-50 border border-slate-200" title="Imprimir Etiqueta"><Printer size={20}/></button>
                                {item.status !== 'retirado' && (
                                    <button onClick={() => handleIncidentClick(item)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded bg-slate-50 border border-slate-200" title="Registrar Ocorrência"><AlertTriangle size={20}/></button>
                                )}
                            </div>
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