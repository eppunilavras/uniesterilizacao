import React, { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  where, 
  getDocs, 
  startAfter, 
  startAt, 
  endAt, 
  writeBatch, 
  doc 
} from 'firebase/firestore';
import { 
  History, 
  Trash2, 
  Search, 
  ArrowDown, 
  Loader2,
  ScanBarcode,
  Eye,
  CalendarClock,
  User,
  ArrowLeft,
  FileText,
  Camera, 
  XCircle,
  UserCog,       
  GraduationCap  
} from 'lucide-react';

// Imports internos
import { db, appId } from '../config/firebase';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';
import { usePrint } from '../contexts/PrintContext'; 
import { logEvent } from '../utils/logger';
import { formatDate, maskCPF } from '../utils/formatters'; 
import { STATUS_CONFIG, LOGOS, LOG_TYPES } from '../constants';
import { playSound } from '../utils/audio';
import DataTable from '../components/DataTable';

export default function HistoryView({ userProfile }) {
    // Estados de Navegação
    const [mode, setMode] = useState('list'); 
    
    // --- ESTADOS DA LISTA GERAL ---
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastDoc, setLastDoc] = useState(null); 
    const [hasMore, setHasMore] = useState(true); 
    const [loadingMore, setLoadingMore] = useState(false); 

    // --- ESTADOS DO RASTREAMENTO ---
    const [scanCode, setScanCode] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const scanTimeout = useRef(null);

    // --- ESTADOS DO RELATÓRIO ALUNO ---
    const [reportSearch, setReportSearch] = useState('');
    const [reportResults, setReportResults] = useState([]);
    const [reportStudent, setReportStudent] = useState(null);
    const [reportStart, setReportStart] = useState('');
    const [reportEnd, setReportEnd] = useState('');
    
    // --- ESTADOS DO RELATÓRIO TÉCNICO ---
    const [techSearch, setTechSearch] = useState('');
    const [techResults, setTechResults] = useState([]);
    const [reportTech, setReportTech] = useState(null);
    
    const [generatingReport, setGeneratingReport] = useState(false);

    const { confirm } = useDialog();
    const { addToast } = useToast();
    const { printItems } = usePrint(); 

    const isAdmin = userProfile.role === 'admin';
    const isAdminOrTech = userProfile.role === 'admin' || userProfile.role === 'tech';
    const isStudent = userProfile.role === 'student';

    // --- HELPER: FORMATAÇÃO DE BUSCA (CPF ou NOME) ---
    const formatSearchTerm = (text) => {
        if (!text) return '';
        // Se só tem números, assume que é CPF e remove pontuação
        const clean = text.replace(/\D/g, '');
        if (clean.length > 0 && !/[a-zA-Z]/.test(text)) return clean;
        
        // Se tem letras, formata como Nome (Primeira Letra Maiúscula)
        return text.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
    };

    // =================================================================================
    // 1. LÓGICA DE RELATÓRIO POR ALUNO
    // =================================================================================
    useEffect(() => {
        if (mode !== 'student_report') return;
        const timer = setTimeout(async () => {
            if (reportSearch.length < 3) { setReportResults([]); return; }
            try {
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
                const term = formatSearchTerm(reportSearch);
                let q;
                
                // Decide se busca por CPF ou Nome
                if (/^\d+$/.test(term)) {
                    q = query(usersRef, where('role', '==', 'student'), orderBy('cpf'), startAt(term), endAt(term + '\uf8ff'), limit(5));
                } else {
                    q = query(usersRef, where('role', '==', 'student'), orderBy('name'), startAt(term), endAt(term + '\uf8ff'), limit(5));
                }
                const snap = await getDocs(q);
                setReportResults(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
            } catch (e) { console.error(e); }
        }, 500);
        return () => clearTimeout(timer);
    }, [reportSearch, mode]);

    const generateStudentPDF = async () => {
        if (!reportStudent || !reportStart || !reportEnd) {
            addToast('Preencha o aluno e o período.', 'error');
            return;
        }
        setGeneratingReport(true);
        try {
            const start = new Date(reportStart); start.setHours(0,0,0,0);
            const end = new Date(reportEnd); end.setHours(23,59,59,999);
            
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
                where('studentId', '==', reportStudent.uid), 
                where('createdAt', '>=', start), 
                where('createdAt', '<=', end), 
                orderBy('createdAt', 'desc')
            );
            
            const snap = await getDocs(q);
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const stats = { 
                total: items.length, 
                retirados: items.filter(i => i.status === 'retirado').length, 
                prontos: items.filter(i => i.status === 'pronto').length, 
                processo: items.filter(i => ['recebido', 'em_esterilizacao'].includes(i.status)).length 
            };
            
            const printWindow = window.open('', '_blank');
            if (!printWindow) { addToast('Pop-up bloqueado.', 'error'); return; }

            // NOTA: O CPF já estava incluído aqui, mantido.
            const htmlContent = `
                <!DOCTYPE html><html><head><title>Relatório - ${reportStudent.name}</title>
                <style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#333}.header{border-bottom:2px solid #009DE0;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between}.logo{height:50px}.title{font-size:24px;font-weight:bold;color:#021D34}.subtitle{font-size:14px;color:#64748b;margin-top:5px}.stats-container{display:flex;gap:15px;margin-bottom:30px}.stat-card{flex:1;padding:15px;border-radius:8px;border:1px solid #e2e8f0;text-align:center}.stat-val{font-size:24px;font-weight:bold;display:block;margin-bottom:5px}.student-card{background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:30px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.label{font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;display:block}.value{font-size:16px;font-weight:600;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#021D34;color:white;padding:10px;text-align:left;font-size:12px;text-transform:uppercase}td{padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px}tr:nth-child(even){background-color:#f1f5f9}.status{font-weight:bold;font-size:11px;text-transform:uppercase;padding:3px 8px;border-radius:4px;background:#e2e8f0;display:inline-block}.footer{margin-top:50px;font-size:10px;text-align:center;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}</style></head><body><div class="header"><div><div class="title">Relatório de Movimentações</div><div class="subtitle">Período: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}</div></div><img src="${LOGOS.color}" class="logo"/></div><div class="student-card"><div class="grid"><div><span class="label">Aluno</span><span class="value">${reportStudent.name}</span></div><div><span class="label">CPF</span><span class="value">${maskCPF(reportStudent.cpf)}</span></div><div><span class="label">Email</span><span class="value">${reportStudent.email}</span></div></div></div><div class="stats-container"><div class="stat-card" style="background:#f0f9ff;border-color:#bae6fd"><span class="stat-val" style="color:#0369a1">${stats.total}</span><span class="stat-label">Total</span></div><div class="stat-card" style="background:#f0fdf4;border-color:#bbf7d0"><span class="stat-val" style="color:#15803d">${stats.retirados}</span><span class="stat-label">Concluídos</span></div><div class="stat-card" style="background:#ecfccb;border-color:#d9f99d"><span class="stat-val" style="color:#4d7c0f">${stats.prontos}</span><span class="stat-label">Prontos</span></div><div class="stat-card" style="background:#fff7ed;border-color:#fed7aa"><span class="stat-val" style="color:#c2410c">${stats.processo}</span><span class="stat-label">Em Processo</span></div></div><h3>Histórico Detalhado</h3>${items.length>0?`<table><thead><tr><th>Data</th><th>Código</th><th>Material</th><th>Status</th></tr></thead><tbody>${items.map(i=>`<tr><td>${formatDate(i.createdAt)}</td><td style="font-family:monospace;font-weight:bold">${i.code}</td><td>${i.type}</td><td><span class="status">${STATUS_CONFIG[i.status]?.label||i.status}</span></td></tr>`).join('')}</tbody></table>`:`<div style="text-align:center;padding:40px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:8px">Nenhum registro encontrado.</div>`}<div class="footer">Gerado em ${new Date().toLocaleString()}</div><script>window.onload=function(){window.print()}</script></body></html>`;
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } catch (error) { console.error(error); addToast('Erro ao gerar relatório.', 'error'); } finally { setGeneratingReport(false); }
    };

    // =================================================================================
    // 2. LÓGICA DE RELATÓRIO TÉCNICO (EXCLUSIVO ADMIN) - ATUALIZADO
    // =================================================================================
    useEffect(() => {
        if (mode !== 'tech_report') return;
        const timer = setTimeout(async () => {
            if (techSearch.length < 3) { setTechResults([]); return; }
            try {
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
                const term = formatSearchTerm(techSearch);
                let q;

                // CORREÇÃO: Detecta se é CPF (números) ou Nome para fazer a busca correta
                if (/^\d+$/.test(term)) {
                    q = query(
                        usersRef, 
                        where('role', 'in', ['tech', 'admin']), 
                        orderBy('cpf'), // Busca por CPF
                        startAt(term), 
                        endAt(term + '\uf8ff'), 
                        limit(5)
                    );
                } else {
                    q = query(
                        usersRef, 
                        where('role', 'in', ['tech', 'admin']), 
                        orderBy('name'), // Busca por Nome
                        startAt(term), 
                        endAt(term + '\uf8ff'), 
                        limit(5)
                    );
                }

                const snap = await getDocs(q);
                setTechResults(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
            } catch (e) { console.error(e); }
        }, 500);
        return () => clearTimeout(timer);
    }, [techSearch, mode]);

    const generateTechPDF = async () => {
        if (!reportTech || !reportStart || !reportEnd) {
            addToast('Preencha o técnico e o período.', 'error');
            return;
        }
        setGeneratingReport(true);
        try {
            const start = new Date(reportStart); start.setHours(0,0,0,0);
            const end = new Date(reportEnd); end.setHours(23,59,59,999);
            
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), 
                where('userId', '==', reportTech.uid), 
                where('timestamp', '>=', start), 
                where('timestamp', '<=', end), 
                orderBy('timestamp', 'desc')
            );
            
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const countEntries = logs.filter(l => l.type === 'ITEM_ENTRY').length;
            const countMoves = logs.filter(l => l.type === 'ITEM_MOVE').length;
            const countLogins = logs.filter(l => l.type === 'LOGIN').length;
            
            // CORREÇÃO: Calcula o "Resto" para a conta fechar visualmente
            const countOthers = logs.length - (countEntries + countMoves + countLogins);

            const stats = { 
                total: logs.length, 
                entradas: countEntries, 
                movimentacoes: countMoves, 
                logins: countLogins,
                outros: countOthers > 0 ? countOthers : 0
            };
            
            const printWindow = window.open('', '_blank');
            if (!printWindow) { addToast('Pop-up bloqueado.', 'error'); return; }

            // ATUALIZAÇÃO: CPF adicionado ao card de informações do técnico
            const htmlContent = `<!DOCTYPE html><html><head><title>Relatório Técnico - ${reportTech.name}</title><style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#333}.header{border-bottom:2px solid #009DE0;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between}.logo{height:50px}.title{font-size:24px;font-weight:bold;color:#021D34}.subtitle{font-size:14px;color:#64748b;margin-top:5px}.tech-card{background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:30px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.label{font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;display:block}.value{font-size:16px;font-weight:600;color:#0f172a}.stats-container{display:flex;gap:15px;margin-bottom:30px}.stat-card{flex:1;padding:15px;border-radius:8px;border:1px solid #e2e8f0;text-align:center}.stat-val{font-size:24px;font-weight:bold;display:block;margin-bottom:5px}.stat-label{font-size:11px;text-transform:uppercase;font-weight:bold;color:#64748b}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#021D34;color:white;padding:10px;text-align:left;font-size:12px;text-transform:uppercase}td{padding:10px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even){background-color:#f1f5f9}.footer{margin-top:50px;font-size:10px;text-align:center;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}.badge{padding:3px 6px;border-radius:4px;font-weight:bold;font-size:10px;background:#e2e8f0;text-transform:uppercase}</style></head><body><div class="header"><div><div class="title">Relatório de Atividade</div><div class="subtitle">Técnico: ${reportTech.name} | ${start.toLocaleDateString()} a ${end.toLocaleDateString()}</div></div><img src="${LOGOS.color}" class="logo"/></div><div class="tech-card"><div class="grid"><div><span class="label">Nome</span><span class="value">${reportTech.name}</span></div><div><span class="label">CPF</span><span class="value">${maskCPF(reportTech.cpf)}</span></div><div><span class="label">Email</span><span class="value">${reportTech.email}</span></div><div><span class="label">Função</span><span class="value">${reportTech.role==='admin'?'Administrador':'Técnico'}</span></div></div></div><div class="stats-container"><div class="stat-card"><span class="stat-val">${stats.total}</span><span class="stat-label">Total de Registros</span></div><div class="stat-card" style="background:#f0fdf4;border-color:#bbf7d0"><span class="stat-val" style="color:#15803d">${stats.entradas}</span><span class="stat-label">Entradas</span></div><div class="stat-card" style="background:#fff7ed;border-color:#fed7aa"><span class="stat-val" style="color:#c2410c">${stats.movimentacoes}</span><span class="stat-label">Movimentações</span></div><div class="stat-card" style="background:#eff6ff;border-color:#bfdbfe"><span class="stat-val" style="color:#1d4ed8">${stats.logins}</span><span class="stat-label">Logins</span></div>${stats.outros > 0 ? `<div class="stat-card" style="background:#f1f5f9;border-color:#e2e8f0"><span class="stat-val" style="color:#64748b">${stats.outros}</span><span class="stat-label">Outros</span></div>` : ''}</div><h3>Registro de Atividades</h3>${logs.length>0?`<table><thead><tr><th>Data/Hora</th><th>Ação</th><th>Descrição</th></tr></thead><tbody>${logs.map(l=>`<tr><td style="white-space:nowrap">${formatDate(l.timestamp)}</td><td><span class="badge">${LOG_TYPES[l.type]||l.type}</span></td><td>${l.message}</td></tr>`).join('')}</tbody></table>`:`<div style="text-align:center;padding:40px;color:#94a3b8;border:2px dashed #e2e8f0;border-radius:8px">Nenhuma atividade registrada.</div>`}<div class="footer">Gerado em ${new Date().toLocaleString()}</div><script>window.onload=function(){window.print()}</script></body></html>`;
            printWindow.document.write(htmlContent);
            printWindow.document.close();
        } catch (error) { console.error(error); addToast('Erro ao gerar relatório.', 'error'); } finally { setGeneratingReport(false); }
    };

    // =================================================================================
    // 3. RASTREAMENTO E LISTA GERAL
    // =================================================================================
    const handleScan = (results) => {
        if (results && results.length > 0) {
            const val = results[0].rawValue;
            if(val){ setScanCode(val); setShowCamera(false); playSound('success'); }
        }
    };

    useEffect(() => {
        if (scanTimeout.current) clearTimeout(scanTimeout.current);
        if (mode === 'scan' && scanCode.length >= 6 && !showCamera) {
            scanTimeout.current = setTimeout(async () => {
                setLoading(true);
                try {
                    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('code', '==', scanCode.toUpperCase()));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                        playSound('error'); addToast('Código não encontrado.', 'error'); setSelectedItem(null);
                    } else {
                        playSound('success');
                        const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
                        if (userProfile.role === 'student' && data.studentId !== userProfile.uid) {
                            addToast('Acesso negado.', 'error'); setSelectedItem(null);
                        } else {
                            setSelectedItem(data); setMode('details'); setScanCode('');
                        }
                    }
                } catch (error) { console.error(error); } finally { setLoading(false); }
            }, 500);
        }
    }, [scanCode, mode, userProfile, showCamera]);

    useEffect(() => {
        if (mode !== 'list') return;
        const timer = setTimeout(async () => {
            setLoading(true); setHasMore(true); setLastDoc(null);
            try {
                const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
                if (search.length > 2) {
                    const term = formatSearchTerm(search); // Aplica formatação aqui também
                    const queries = [];
                    const isStd = userProfile.role === 'student';
                    
                    if (/\d/.test(term) && term.length <= 8) {
                         const c = [where('code', '>=', term), where('code', '<=', term + '\uf8ff'), orderBy('code'), limit(20)];
                         if (isStd) c.unshift(where('studentId', '==', userProfile.uid));
                         queries.push(query(itemsRef, ...c));
                    } else {
                        if (isStd) {
                            queries.push(query(itemsRef, where('studentId', '==', userProfile.uid), orderBy('type'), startAt(term), endAt(term + '\uf8ff'), limit(20)));
                        } else {
                            queries.push(query(itemsRef, orderBy('studentName'), startAt(term), endAt(term + '\uf8ff'), limit(20)));
                            queries.push(query(itemsRef, orderBy('type'), startAt(term), endAt(term + '\uf8ff'), limit(20)));
                        }
                    }
                    const snaps = await Promise.all(queries.map(q => getDocs(q)));
                    const unique = new Map();
                    snaps.forEach(s => s.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() })));
                    setHistory(Array.from(unique.values()));
                    setHasMore(false);
                } else {
                    const c = [orderBy('createdAt', 'desc'), limit(50)];
                    if (userProfile.role === 'student') c.unshift(where('studentId', '==', userProfile.uid));
                    const q = query(itemsRef, ...c);
                    const s = await getDocs(q);
                    setHistory(s.docs.map(d => ({id: d.id, ...d.data()})));
                    setLastDoc(s.docs[s.docs.length - 1]);
                    if (s.docs.length < 50) setHasMore(false);
                }
            } catch (error) { console.error("Erro lista:", error); } finally { setLoading(false); }
        }, 600);
        return () => clearTimeout(timer);
    }, [userProfile, search, mode]);

    const loadMore = async () => {
        if (!lastDoc || loadingMore) return;
        setLoadingMore(true);
        try {
            const ref = collection(db, 'artifacts', appId, 'public', 'data', 'items');
            const c = [orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(50)];
            if (userProfile.role === 'student') c.unshift(where('studentId', '==', userProfile.uid));
            const q = query(ref, ...c);
            const s = await getDocs(q);
            if (!s.empty) {
                setHistory(p => [...p, ...s.docs.map(d => ({id: d.id, ...d.data()}))]);
                setLastDoc(s.docs[s.docs.length - 1]);
                if (s.docs.length < 50) setHasMore(false);
            } else { setHasMore(false); }
        } catch (e) { console.error(e); } setLoadingMore(false);
    };

    const handleDeleteSelected = async () => {
        if(selectedIds.length === 0) return;
        if (!await confirm({ title: 'Excluir', message: `Excluir ${selectedIds.length} itens?`, isDestructive: true })) return;
        const b = writeBatch(db);
        selectedIds.forEach(id => b.delete(doc(db, 'artifacts', appId, 'public', 'data', 'items', id)));
        await b.commit();
        setHistory(p => p.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
        addToast('Itens excluídos.', 'success');
        logEvent('ITEM_DELETE', `Exclusão em massa`, { user: userProfile.name });
    };

    const handlePrintSelected = () => { printItems(history.filter(i => selectedIds.includes(i.id))); };
    
    const generateTraceReport = () => { 
        if (!selectedItem) return;
        const w = window.open('', '_blank');
        if (!w) { addToast('Pop-up bloqueado.', 'error'); return; }
        const timeline = selectedItem.history ? [...selectedItem.history].reverse() : [];
        const html = `<!DOCTYPE html><html><head><title>Rastreabilidade</title><style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#333}.header{display:flex;justify-content:space-between;border-bottom:2px solid #009DE0;padding-bottom:20px;margin-bottom:30px}.logo{height:50px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-radius:8px}.label{font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase}.value{font-size:16px;font-weight:600;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:20px}th{text-align:left;background:#021D34;color:white;padding:12px;font-size:14px}td{padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px}.badge{padding:4px 8px;border-radius:4px;font-weight:bold;font-size:12px;background:#e2e8f0}</style></head><body><div class="header"><div><h2>Relatório de Rastreabilidade</h2><div style="color:#64748b">${new Date().toLocaleString()}</div></div><img src="${LOGOS.color}" class="logo"/></div><div class="info-grid"><div><span class="label">Código</span><div class="value">${selectedItem.code}</div></div><div><span class="label">Material</span><div class="value">${selectedItem.type}</div></div><div><span class="label">Aluno</span><div class="value">${selectedItem.studentName}</div></div><div><span class="label">Status</span><div class="value">${STATUS_CONFIG[selectedItem.status].label}</div></div></div><h3>Linha do Tempo</h3><table><thead><tr><th>Data/Hora</th><th>Status</th><th>Responsável</th></tr></thead><tbody>${timeline.map(t=>`<tr><td>${formatDate(t.timestamp)}</td><td><span class="badge">${STATUS_CONFIG[t.status]?.label||t.status}</span></td><td>${t.by||'Sistema'}</td></tr>`).join('')}</tbody></table><script>window.onload=function(){window.print()}</script></body></html>`;
        w.document.write(html);
        w.document.close();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-bold text-[#021D34] text-2xl flex items-center gap-2 w-full md:w-auto">
                    <History className="text-[#009DE0]"/> Histórico
                </h2>
                
                {/* MENU DE ABAS RESPONSIVO (HORIZONTAL SCROLL NO MOBILE) */}
                <div className="flex bg-slate-200 p-1 rounded-lg w-full md:w-fit overflow-x-auto gap-1">
                    <button onClick={() => { setMode('list'); setScanCode(''); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${mode === 'list' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>
                        Lista Geral
                    </button>
                    <button onClick={() => { setMode('scan'); setSearch(''); setShowCamera(false); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${mode === 'scan' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>
                        Rastrear Item
                    </button>
                    {isAdminOrTech && (
                        <button onClick={() => { setMode('student_report'); setSearch(''); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'student_report' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>
                            <GraduationCap size={16}/> Relatório Aluno
                        </button>
                    )}
                    {isAdmin && (
                        <button onClick={() => { setMode('tech_report'); setTechSearch(''); setReportTech(null); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'tech_report' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>
                            <UserCog size={16}/> Relatório Técnico
                        </button>
                    )}
                </div>
            </div>

            {/* ABA: RELATÓRIO TÉCNICO */}
            {mode === 'tech_report' && (
                <div className="max-w-2xl mx-auto space-y-6 py-4 animate-in zoom-in-95 duration-300">
                    <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 shadow-lg relative">
                        <h3 className="text-xl font-bold text-[#021D34] mb-6 flex items-center gap-2"><UserCog className="text-[#009DE0]"/> Relatório do Técnico</h3>
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">1. Selecione o Técnico</label>
                                {reportTech ? (
                                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <div><p className="font-bold text-[#021D34]">{reportTech.name}</p><p className="text-xs text-slate-600">{reportTech.email}</p></div>
                                        <button onClick={() => { setReportTech(null); setTechSearch(''); }} className="text-red-500 hover:bg-white p-2 rounded-full transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                                        <input className="w-full pl-10 p-3 border rounded-lg outline-none focus:border-[#009DE0] text-sm" placeholder="Buscar por nome ou CPF..." value={techSearch} onChange={e => setTechSearch(e.target.value)}/>
                                        {techResults.length > 0 && <div className="absolute top-full left-0 right-0 bg-white border mt-1 rounded-lg shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">{techResults.map(t => <button key={t.uid} onClick={() => { setReportTech(t); setTechResults([]); }} className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-0"><p className="font-bold text-sm text-[#021D34]">{t.name}</p><p className="text-xs text-slate-500 uppercase font-bold">{t.role === 'admin' ? 'Administrador' : 'Técnico'}</p></button>)}</div>}
                                    </div>
                                )}
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${!reportTech ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block uppercase">2. Data Inicial</label><input type="date" className="w-full p-3 border rounded-lg" value={reportStart} onChange={e => setReportStart(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block uppercase">3. Data Final</label><input type="date" className="w-full p-3 border rounded-lg" value={reportEnd} onChange={e => setReportEnd(e.target.value)} /></div>
                            </div>
                            <button onClick={generateTechPDF} disabled={!reportTech || !reportStart || !reportEnd || generatingReport} className="w-full bg-[#021D34] text-white py-4 rounded-xl font-bold hover:bg-[#009DE0] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 mt-4">
                                {generatingReport ? <Loader2 className="animate-spin"/> : <FileText size={20}/>} {generatingReport ? 'Gerando PDF...' : 'Gerar Relatório'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 1: RELATÓRIO ALUNO */}
            {mode === 'student_report' && (
                <div className="max-w-2xl mx-auto space-y-6 py-4 animate-in zoom-in-95 duration-300">
                    <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 shadow-lg relative">
                        <h3 className="text-xl font-bold text-[#021D34] mb-6 flex items-center gap-2"><GraduationCap className="text-[#009DE0]"/> Relatório do Aluno</h3>
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">1. Selecione o Aluno</label>
                                {reportStudent ? (
                                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <div><p className="font-bold text-[#021D34]">{reportStudent.name}</p><p className="text-xs text-slate-600">{reportStudent.email}</p></div>
                                        <button onClick={() => { setReportStudent(null); setReportSearch(''); }} className="text-red-500 hover:bg-white p-2 rounded-full transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                                        <input className="w-full pl-10 p-3 border rounded-lg outline-none focus:border-[#009DE0] text-sm" placeholder="Buscar por nome ou CPF..." value={reportSearch} onChange={e => setReportSearch(e.target.value)}/>
                                        {reportResults.length > 0 && <div className="absolute top-full left-0 right-0 bg-white border mt-1 rounded-lg shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">{reportResults.map(s => <button key={s.uid} onClick={() => { setReportStudent(s); setReportResults([]); }} className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-0"><p className="font-bold text-sm text-[#021D34]">{s.name}</p><p className="text-xs text-slate-500">{maskCPF(s.cpf)}</p></button>)}</div>}
                                    </div>
                                )}
                            </div>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${!reportStudent ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block uppercase">2. Data Inicial</label><input type="date" className="w-full p-3 border rounded-lg" value={reportStart} onChange={e => setReportStart(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block uppercase">3. Data Final</label><input type="date" className="w-full p-3 border rounded-lg" value={reportEnd} onChange={e => setReportEnd(e.target.value)} /></div>
                            </div>
                            <button onClick={generateStudentPDF} disabled={!reportStudent || !reportStart || !reportEnd || generatingReport} className="w-full bg-[#021D34] text-white py-4 rounded-xl font-bold hover:bg-[#009DE0] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 mt-4">
                                {generatingReport ? <Loader2 className="animate-spin"/> : <FileText size={20}/>} {generatingReport ? 'Gerando PDF...' : 'Gerar Relatório Completo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 2: RASTREAMENTO */}
            {mode === 'scan' && (
                <div className="max-w-xl mx-auto space-y-6 py-8 animate-in zoom-in-95 duration-300">
                    <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 shadow-lg text-center relative overflow-hidden">
                        {!showCamera ? (
                            <>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#009DE0] via-purple-500 to-[#009DE0] animate-pulse"/>
                                <ScanBarcode className="w-16 h-16 text-[#009DE0] mx-auto mb-6"/>
                                <h3 className="text-2xl font-bold text-[#021D34] mb-2">Rastreamento</h3>
                                <p className="text-slate-500 mb-8 text-sm">Bipe o código ou digite abaixo.</p>
                                <input className="w-full text-center font-mono text-3xl uppercase tracking-[0.2em] p-4 border-2 border-slate-200 rounded-xl focus:border-[#009DE0] focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:tracking-normal mb-4" placeholder="CÓDIGO" value={scanCode} onChange={e => setScanCode(e.target.value)} autoFocus />
                                <button onClick={() => setShowCamera(true)} className="w-full flex items-center justify-center gap-2 bg-[#021D34] text-white py-3 rounded-xl font-bold hover:bg-[#009DE0] transition-colors"><Camera size={20}/> Usar Câmera</button>
                            </>
                        ) : (
                            <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-w-sm mx-auto">
                                <Scanner onScan={handleScan} components={{ audio: false }} />
                                <button onClick={() => setShowCamera(false)} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-white/30 z-20"><XCircle size={18}/> Cancelar</button>
                            </div>
                        )}
                        {loading && <div className="mt-4 flex justify-center text-[#009DE0] gap-2 items-center text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Buscando...</div>}
                    </div>
                </div>
            )}

            {/* ABA 3: LISTA GERAL */}
            {mode === 'list' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between">
                        <div className="flex flex-col md:flex-row gap-4 w-full flex-1">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                                <input className="w-full pl-10 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" placeholder={isStudent ? "Buscar Material..." : "Nome, Material ou Código..."} value={search} onChange={e => setSearch(e.target.value)}/>
                                {loading && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>}
                            </div>
                            {isAdminOrTech && selectedIds.length > 0 && (
                                <div className="flex gap-2 w-full md:w-auto justify-center md:justify-start">
                                    <button onClick={handlePrintSelected} className="bg-[#021D34] text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"><ArrowDown size={14}/> Imprimir</button>
                                    <button onClick={handleDeleteSelected} className="bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"><Trash2 size={14}/> Excluir</button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <DataTable 
                        columns={[
                            ...(isAdminOrTech ? [{ key: 'select', label: '', render: (i) => <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="rounded text-[#009DE0] focus:ring-[#009DE0]"/> }] : []),
                            { key: 'createdAt', label: 'Data Entrada', sortable: true, render: (i) => formatDate(i.createdAt) },
                            { key: 'code', label: 'Código', sortable: true, render: (i) => <span className="font-mono font-bold text-[#009DE0]">{i.code}</span> },
                            { key: 'studentName', label: 'Aluno', sortable: true },
                            { key: 'type', label: 'Material', sortable: true },
                            { key: 'status', label: 'Status Atual', sortable: true, render: (i) => <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${STATUS_CONFIG[i.status].color}`}>{STATUS_CONFIG[i.status].label}</span> },
                        ]}
                        data={history} 
                        emptyMsg={loading ? "Carregando..." : "Nenhum registro encontrado."}
                        mobileRender={(i) => (
                            <div className="flex items-center gap-3">
                                {isAdminOrTech && (
                                    <div className="flex items-center h-full">
                                        <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="w-5 h-5 rounded text-[#009DE0] focus:ring-[#009DE0]"/>
                                    </div>
                                )}
                                <div className="flex-1" onClick={() => { setSelectedItem(i); setMode('details'); }}>
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
                            <button onClick={() => { setSelectedItem(item); setMode('details'); }} className="p-2 text-slate-500 hover:text-[#009DE0] hover:bg-blue-50 rounded bg-slate-50 border border-slate-200"><Eye size={20}/></button>
                        )}
                    />

                    {!loading && hasMore && search.length <= 2 && (
                        <div className="flex justify-center pt-2">
                            <button onClick={loadMore} disabled={loadingMore} className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50">
                                {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                                {loadingMore ? 'Buscando...' : 'Carregar Mais Antigos'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ABA 4: DETALHES (TIMELINE) */}
            {mode === 'details' && selectedItem && (
                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    <button onClick={() => { setMode('list'); setSelectedItem(null); }} className="flex items-center gap-2 text-slate-500 hover:text-[#009DE0] font-bold transition-colors"><ArrowLeft size={20}/> Voltar para Lista</button>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-[#021D34] p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl font-bold font-mono tracking-wider">{selectedItem.code}</h2>
                                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-white text-slate-900 border border-slate-300 shadow-sm">{STATUS_CONFIG[selectedItem.status].label}</span>
                                </div>
                                <p className="opacity-80">{selectedItem.type}</p>
                            </div>
                            <div className="text-left md:text-right w-full md:w-auto"><p className="font-bold text-lg">{selectedItem.studentName}</p><p className="text-xs opacity-60">Criado em: {formatDate(selectedItem.createdAt)}</p></div>
                        </div>
                        <div className="p-4 md:p-8">
                            <h3 className="font-bold text-[#021D34] mb-6 flex items-center gap-2"><History className="text-[#009DE0]"/> Rastreabilidade</h3>
                            <div className="relative border-l-2 border-slate-200 ml-2 md:ml-6 space-y-8 pb-4">
                                {(selectedItem.history ? [...selectedItem.history].reverse() : []).map((event, index) => {
                                    const Config = STATUS_CONFIG[event.status] || STATUS_CONFIG['recebido'];
                                    return (
                                        <div key={index} className="relative pl-6 md:pl-10">
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${index === 0 ? 'bg-[#009DE0] ring-4 ring-blue-50' : 'bg-slate-300'}`}/>
                                            <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center justify-between hover:border-blue-100 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${Config.color} bg-opacity-20`}><Config.icon size={20}/></div>
                                                    <div><p className="font-bold text-[#021D34] text-sm md:text-base">{Config.label}</p><p className="text-xs text-slate-500 flex items-center gap-1"><User size={10}/> Por: {event.by || 'Sistema'}</p></div>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded border border-slate-200"><CalendarClock size={14}/>{formatDate(event.timestamp)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3">
                            <button onClick={generateTraceReport} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#021D34] text-white rounded-xl font-bold hover:bg-[#009DE0] transition-colors shadow-lg shadow-blue-900/20"><FileText size={18}/> Gerar Relatório PDF</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}