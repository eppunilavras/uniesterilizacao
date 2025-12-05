import React, { useState, useEffect, useMemo, useContext, useRef, useCallback } from 'react';
import { 
  initializeApp, 
  getApp, 
  getApps 
} from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  orderBy,
  limit,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  getDoc,
  Timestamp,
  startAt,
  endAt,
  startAfter 
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  PackagePlus, 
  ScanBarcode, 
  History, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Printer, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRightLeft, 
  Trash2, 
  KeyRound, 
  Mail, 
  Lock, 
  Edit2, 
  Filter, 
  CheckSquare, 
  Bell, 
  Database, 
  FileDown, 
  FileUp, 
  Eraser, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown, 
  Info, 
  ShieldAlert, 
  Loader2, 
  Calendar, 
  UserCog, 
  GraduationCap, 
  Wrench, 
  FileText, 
  Activity,
  AlertTriangle,
  QrCode,
  Lightbulb,
  TrendingUp,
  PieChart as PieIcon,
  Ban,
  Timer,
  Eye,
  CalendarClock,
  BarChart3,
  UserCircle,
  Settings2,
  ScanLine,
  RotateCw,
  FlipHorizontal
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Legend
} from 'recharts';

import QRCode from 'react-qr-code';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDZRzV_S2GCRWFteklzdGjaO8ZB7j5ct2U", 
  authDomain: "uniesterilizacao.firebaseapp.com",
  projectId: "uniesterilizacao",
  storageBucket: "uniesterilizacao.firebasestorage.app",
  messagingSenderId: "357777665758",
  appId: "1:357777665758:web:fda95ec0f6188cd5ee5c4f"
};

const app = !getApps().length ? initializeApp(JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(firebaseConfig))) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'unilavras-main';

/* --- SISTEMA DE ÁUDIO (BIPS) --- */
const playSound = (type) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'success') {
            // SOM DE SUCESSO (Mantido, mas com volume alto)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(1.0, ctx.currentTime); // Volume Máximo
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.3);

        } else if (type === 'error') {
            // NOVO SOM DE ERRO "AGRADÁVEL" (Soft Thud)
            osc.type = 'sine'; // Onda suave (sem chiado)
            
            // Começa num tom médio-grave (300Hz) e cai rápido para grave (50Hz)
            // Isso cria um efeito de "Tump" ou "Bloop" negativo
            osc.frequency.setValueAtTime(300, ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
            
            // Volume começa alto e some rápido
            gain.gain.setValueAtTime(1.0, ctx.currentTime);       
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (e) {
        console.error("Erro ao reproduzir som:", e);
    }
};

// --- SISTEMA DE LOGS ---
const logEvent = async (type, message, details = {}, user = null) => {
    try {
        const currentUser = user || auth.currentUser;
        const userId = currentUser ? currentUser.uid : 'SYSTEM';
        const userName = currentUser ? (currentUser.displayName || currentUser.email || 'Usuário') : 'Sistema';

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), {
            type,
            message,
            details,
            userId,
            userName,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString()
        });
    } catch (e) {
        if (e.code !== 'permission-denied') console.error("Falha ao gravar log:", e);
    }
};

// --- UTILITÁRIOS ---
const LOGOS = {
  color: 'https://i.ibb.co/MxXMmxS0/Logo-Unilavras-Oficial-2019.png',
  white: 'https://i.ibb.co/bMqtX9Ln/Logo-Unilavras-Oficial-2019-mono-full-white.png',
};

const STATUS_CONFIG = {
  'recebido': { label: 'Recebido', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock },
  'em_esterilizacao': { label: 'Em Esterilização', color: 'bg-orange-50 text-orange-800 border-orange-200', icon: AlertCircle },
  'pronto': { label: 'Pronto p/ Retirada', color: 'bg-green-50 text-green-800 border-green-200', icon: CheckCircle2 },
  'retirado': { label: 'Retirado', color: 'bg-[#009DE0]/10 text-[#021D34] border-[#009DE0]/20', icon: CheckSquare },
};

const LOG_COLORS = {
    'LOGIN': 'bg-blue-100 text-blue-800',
    'LOGOUT': 'bg-slate-100 text-slate-800',
    'ITEM_ENTRY': 'bg-green-100 text-green-800',
    'ITEM_MOVE': 'bg-orange-100 text-orange-800',
    'ITEM_DELETE': 'bg-red-100 text-red-800',
    'USER_MGMT': 'bg-purple-100 text-purple-800',
    'ADMIN_OPT': 'bg-yellow-100 text-yellow-800',
    'DATA_OP': 'bg-indigo-100 text-indigo-800',
    'LOGIN_FAIL': 'bg-red-50 text-red-600'
};

const ROLE_LABELS = {
    'student': 'Aluno',
    'tech': 'Técnico',
    'admin': 'Administrador'
};

const LOG_TYPES = {
    'LOGIN': 'Login',
    'LOGOUT': 'Logout',
    'ITEM_ENTRY': 'Entrada',
    'ITEM_MOVE': 'Movimentação',
    'ITEM_DELETE': 'Exclusão',
    'USER_MGMT': 'Usuários',
    'ADMIN_OPT': 'Admin',
    'DATA_OP': 'Sistema',
    'LOGIN_FAIL': 'Falha Login'
};

const generateUniqueId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const formatDate = (val) => {
    if (!val) return '-';
    const date = val.toDate ? val.toDate() : new Date(val);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year: '2-digit', hour:'2-digit', minute:'2-digit' });
};

const maskCPF = (value) => {
  if(!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const translateFirebaseError = (error) => {
    const code = error.code || '';
    if(code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email ou senha incorretos.';
    if(code === 'auth/weak-password') return 'A senha deve ter pelo menos 6 caracteres.';
    if(code === 'auth/email-already-in-use') return 'Este email já está cadastrado no sistema.';
    if(code === 'auth/account-inactive') return 'Sua conta está inativa. Contate o administrador.';
    return 'Ocorreu um erro ao processar sua solicitação.';
};

// --- CONTEXTOS ---

const ToastContext = React.createContext();
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const addToast = (msg, type = 'info') => {
        const id = Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => removeToast(id), 5000);
    };
    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium animate-in slide-in-from-right-10 fade-in duration-300 ${t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-[#021D34]'}`}>
                        {t.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
                        {t.msg}
                        <button onClick={() => removeToast(t.id)} className="ml-2 hover:bg-white/20 rounded p-1"><X size={14}/></button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const DialogContext = React.createContext();
const useDialog = () => useContext(DialogContext);

const DialogProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);

    const confirm = ({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDestructive = false }) => {
        return new Promise((resolve) => {
            setDialog({
                title,
                message,
                type: 'confirm',
                confirmText,
                cancelText,
                isDestructive,
                onConfirm: () => { setDialog(null); resolve(true); },
                onCancel: () => { setDialog(null); resolve(false); }
            });
        });
    };

    const alert = ({ title, message }) => {
        return new Promise((resolve) => {
            setDialog({
                title,
                message,
                type: 'alert',
                onConfirm: () => { setDialog(null); resolve(true); }
            });
        });
    };

    return (
        <DialogContext.Provider value={{ confirm, alert }}>
            {children}
            {dialog && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#021D34]/50 backdrop-blur-sm animate-in fade-in duration-200 no-print">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4 mb-4">
                            <div className={`p-3 rounded-full ${dialog.isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-[#009DE0]'}`}>
                                {dialog.isDestructive ? <AlertTriangle size={24}/> : <Info size={24}/>}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{dialog.title}</h3>
                                <p className="text-slate-600 text-sm mt-1">{dialog.message}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            {dialog.type === 'confirm' && (
                                <button 
                                    onClick={dialog.onCancel}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors text-sm"
                                >
                                    {dialog.cancelText || 'Cancelar'}
                                </button>
                            )}
                            <button 
                                onClick={dialog.onConfirm}
                                className={`px-4 py-2 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95 text-sm ${dialog.isDestructive ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' : 'bg-[#009DE0] hover:bg-[#008bc5] shadow-blue-500/30'}`}
                            >
                                {dialog.confirmText || 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};

// --- PRINT CONTEXT & OVERLAY (VERSÃO FINAL: AUTO-SCALE + QR CODE + TRANSFORMS) ---
const PrintContext = React.createContext();
const usePrint = () => useContext(PrintContext);

const PrintProvider = ({ children, user }) => {
    const [printQueue, setPrintQueue] = useState([]);
    // Estado inicial seguro
    const [settings, setSettings] = useState({
        width: 50, height: 30, margin: 2, orientation: 'landscape',
        codeType: 'barcode', // 'barcode' | 'qrcode'
        autoSize: false,     // true = Impressora decide | false = CSS força mm
        rotation: 0,         // 0, 90, 180, 270
        mirror: false,       // Espelhamento horizontal
        showLogo: true, showTitle: true, showDate: true, showStudent: true, showType: true
    });

    // Carregar configurações do Firestore
    useEffect(() => {
		
		// Se não houver usuário logado, não tenta carregar (evita erros de permissão)
        if (!user) return;
		
        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings_labels', 'config'), (docSnap) => {
            if (docSnap.exists()) {
                setSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        });
        return () => unsub();
    }, [user]);

    const printItems = (items) => {
        setPrintQueue(Array.isArray(items) ? items : [items]);
        // Delay de 500ms para garantir que QR Code e CSS carreguem antes do dialog
        setTimeout(() => {
            window.print();
        }, 500); 
    };

    // --- LÓGICA DE ESCALA DINÂMICA (FONTE & LOGO) ---
    // Se for AUTO, usamos fontes maiores. Se for MANUAL (50x30mm), fontes compactas.
    const fontSizeBody = settings.autoSize ? '12px' : '8px';
    const fontSizeDate = settings.autoSize ? '10px' : '6px';
    const fontSizeTitleMain = settings.autoSize ? '11px' : '7px';
    const fontSizeTitleSub = settings.autoSize ? '8px' : '5px';
    const logoHeight = settings.autoSize ? '18px' : '10px';
    
    // Altura mínima para o corpo: QR Code precisa de mais espaço que Barcode
    // Se for Auto + QR, garantimos 25mm para não cortar.
    const minBodyHeight = settings.codeType === 'qrcode' ? '25mm' : '10mm';

    // --- CSS DE IMPRESSÃO ---
    // 1. @page: No auto, margem 0 e size auto. No manual, dimensões exatas.
    const cssPageSize = settings.autoSize 
        ? `size: auto; margin: 0mm;` 
        : `size: ${settings.width}mm ${settings.height}mm; margin: 0mm;`;

    // 2. Body: Trava o tamanho se for manual.
    const cssBodySize = settings.autoSize
        ? `width: auto; height: auto;`
        : `width: ${settings.width}mm; height: ${settings.height}mm; max-width: ${settings.width}mm; max-height: ${settings.height}mm; overflow: hidden;`;

    // 3. Sticker Container: Padding e Quebras
    const cssStickerSize = settings.autoSize
        ? `width: 100%; height: auto; padding: ${settings.margin}mm; page-break-after: always; break-inside: avoid;`
        : `width: ${settings.width}mm; height: ${settings.height}mm; padding: ${settings.margin}mm; page-break-after: always; overflow: hidden; position: relative; left: 0; top: 0;`;

    // 4. Transformações (Rotação e Espelho)
    const transformCSS = `rotate(${settings.rotation}deg) scaleX(${settings.mirror ? -1 : 1})`;

    return (
        <PrintContext.Provider value={{ printItems }}>
            {children}
            <style>{`
                @media print {
                    @page { ${cssPageSize} }
                    
                    html, body { 
                        margin: 0 !important; padding: 0 !important;
                        ${cssBodySize}
                        -webkit-print-color-adjust: exact;
                    }

                    .no-print { display: none !important; }
                    
                    #print-overlay {
                        display: block !important; position: absolute;
                        top: 0; left: 0; width: 100%; height: 100%;
                        background: white; z-index: 99999;
                    }

                    .sticker-item {
                        ${cssStickerSize}
                        box-sizing: border-box; display: flex;
                        align-items: center; justify-content: center;
                    }

                    .sticker-content {
                        width: 100%; height: 100%;
                        display: flex; flex-direction: column; justify-content: space-between;
                        transform: ${transformCSS}; transform-origin: center center;
                    }

                    .sticker-header {
                        display: flex; justify-content: space-between; align-items: center;
                        border-bottom: 1px solid black; padding-bottom: 2px; margin-bottom: 2px;
                        flex-shrink: 0;
                    }

                    .sticker-body {
                        flex: 1; display: flex; flex-direction: column;
                        align-items: center; justify-content: center;
                        overflow: hidden; padding: 4px 0;
                        min-height: ${minBodyHeight};
                    }

                    .sticker-code-area {
                        flex: 1; display: flex; align-items: center; justify-content: center;
                        width: 100%; height: ${settings.autoSize ? 'auto' : '100%'};
                    }

                    .sticker-footer {
                        border-top: 1px solid black; padding-top: 2px;
                        display: flex; flex-direction: column; justify-content: center;
                        flex-shrink: 0;
                    }

                    .sticker-info {
                        display: flex; justify-content: space-between; align-items: baseline;
                        line-height: 1.1; font-size: ${fontSizeBody}; /* Fonte Dinâmica */
                    }
                    .sticker-label { font-weight: bold; }
                    .sticker-value { 
                        font-weight: bold; text-transform: uppercase; 
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%; 
                    }
                }
            `}</style>
            
            <div id="print-overlay" className="hidden">
                {printQueue.map((item, index) => (
                    <div key={item.id || index} className="sticker-item">
                        <div className="sticker-content">
                            {/* HEADER */}
                            {(settings.showLogo || settings.showTitle || settings.showDate) && (
                                <div className="sticker-header">
                                    <div className="flex items-center gap-2">
                                        {settings.showLogo && <img src={LOGOS.color} style={{height: logoHeight, width: 'auto'}} alt="logo" />}
                                        {settings.showTitle && (
                                            <div className="flex flex-col leading-none">
                                                <span style={{fontSize: fontSizeTitleMain, fontWeight: 900}}>UNILAVRAS</span>
                                                <span style={{fontSize: fontSizeTitleSub, fontWeight: 'bold'}}>ESTERILIZAÇÃO</span>
                                            </div>
                                        )}
                                    </div>
                                    {settings.showDate && <span style={{fontSize: fontSizeDate, fontWeight: 'bold'}}>{new Date().toLocaleDateString('pt-BR')}</span>}
                                </div>
                            )}
                            
                            {/* BODY (QR/BARCODE) */}
                            <div className="sticker-body">
                                <div className="sticker-code-area">
                                    {settings.codeType === 'qrcode' 
                                        ? <QRCodeComponent value={item.code || 'TESTE'} />
                                        : <Barcode value={item.code || 'TESTE'} />
                                    }
                                </div>
                            </div>

                            {/* FOOTER */}
                            {(settings.showStudent || settings.showType) && (
                                <div className="sticker-footer">
                                    {settings.showStudent && (
                                        <div className="sticker-info">
                                            <span className="sticker-label">ALUNO:</span>
											<span className="sticker-value">
												{(() => {
													if (!item.studentName) return 'NOME';
													const parts = item.studentName.trim().split(' ');
													// Se tiver só um nome, mostra ele. Se tiver mais, mostra Primeiro + Último
													return parts.length > 1 
														? `${parts[0]} ${parts[parts.length - 1]}`
														: parts[0];
												})()}
											</span>
                                        </div>
                                    )}
                                    {settings.showType && (
                                        <div className="sticker-info">
                                            <span className="sticker-label">MAT:</span>
                                            <span className="sticker-value">{item.type || 'MATERIAL'}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </PrintContext.Provider>
    );
};

// 4. DataTable
const DataTable = ({ columns, data, actions, emptyMsg, mobileRender }) => {
    const [page, setPage] = useState(1);
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const itemsPerPage = 10;

    const sortedData = useMemo(() => {
        if (!sortCol) return data;
        return [...data].sort((a, b) => {
            let valA = a[sortCol];
            let valB = b[sortCol];
            if(typeof valA === 'string') valA = valA.toLowerCase();
            if(typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortCol, sortDir]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const currentData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const handleSort = (key) => {
        if (sortCol === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortCol(key); setSortDir('asc'); }
    };

    useEffect(() => { setPage(1); }, [data.length]);

    if (currentData.length === 0) {
        return <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">{emptyMsg || 'Nenhum registro.'}</div>;
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`hidden md:block overflow-x-auto`}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#021D34] text-white">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={col.key || idx} onClick={() => col.sortable && handleSort(col.key)} className={`p-4 font-semibold ${col.sortable ? 'cursor-pointer hover:bg-white/10 select-none' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        {col.label}
                                        {sortCol === col.key && (sortDir === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>)}
                                    </div>
                                </th>
                            ))}
                            {actions && <th className="p-4 text-right">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {currentData.map((row, i) => (
                            <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                                {columns.map((col, idx) => (
                                    <td key={col.key || idx} className="p-4 text-slate-700">
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                                {actions && <td className="p-4 text-right">{actions(row)}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden">
                {mobileRender ? (
                    <div className="divide-y divide-slate-100">
                        {currentData.map((row, i) => (
                            <div key={row.id || i} className="p-4 hover:bg-slate-50 transition-colors">
                                {mobileRender(row)}
                                {actions && (
                                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                                        {actions(row)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {currentData.map((row, i) => (
                            <div key={row.id || i} className="p-4 space-y-2">
                                {columns.map((col, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-slate-500">{col.label}</span>
                                        <div className="text-right">
                                            {col.render ? col.render(row) : row[col.key]}
                                        </div>
                                    </div>
                                ))}
                                {actions && <div className="flex justify-end pt-2 mt-2 border-t border-slate-100">{actions(row)}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <span className="text-xs text-slate-500">Pág {page}/{totalPages} ({sortedData.length} itens)</span>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded hover:bg-white disabled:opacity-50 text-slate-600"><ChevronLeft size={16}/></button>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded hover:bg-white disabled:opacity-50 text-slate-600"><ChevronRight size={16}/></button>
                    </div>
                </div>
            )}
        </div>
    );
};

// 5. Code 39 Barcode Generator
const Barcode = ({ value }) => {
    const code39Map = {
        '0': 'NNNwwnWnW', '1': 'WnNwNnNnW', '2': 'NnWwNnNnW', '3': 'WnWwNnNnN', '4': 'NnNwWnNnW',
        '5': 'WnNwWnNnN', '6': 'NnWwWnNnN', '7': 'NnNwNnWnW', '8': 'WnNwNnWnN', '9': 'NnWwNnWnN',
        'A': 'WnNnNwNnW', 'B': 'NnWnNwNnW', 'C': 'WnWnNwNnN', 'D': 'NnNnWwNnW', 'E': 'WnNnWwNnN',
        'F': 'NnWnWwNnN', 'G': 'NnNnNwWnW', 'H': 'WnNnNwWnN', 'I': 'NnWnNwWnN', 'J': 'NnNnWwWnN',
        'K': 'WnNnNnNwW', 'L': 'NnWnNnNwW', 'M': 'WnWnNnNwN', 'N': 'NnNnWnNwW', 'O': 'WnNnWnNwN',
        'P': 'NnWnWnNwN', 'Q': 'NnNnNnWwW', 'R': 'WnNnNnWwN', 'S': 'NnWnNnWwN', 'T': 'NnNnWnWwN',
        'U': 'WwNnNnNnW', 'V': 'NwWnNnNnW', 'W': 'WwWnNnNnN', 'X': 'NwNnWnNnW', 'Y': 'WwNnWnNnN',
        'Z': 'NwWnWnNnN', '-': 'NwNnNnWnW', '.': 'WwNnNnWnN', ' ': 'NwWnNnWnN', '*': 'NwNnWnWnN',
        '$': 'NwNwNwNnN', '/': 'NwNwNnNwN', '+': 'NwNnNwNwN', '%': 'NnNwNwNwN' 
    };

    const encoded = `*${value.toUpperCase()}*`;
    let elements = [];
    let x = 0;
    const narrowW = 1.2;
    const wideW = 3.6;
    const height = 40;

    for (let i = 0; i < encoded.length; i++) {
        const char = encoded[i];
        const pattern = code39Map[char] || code39Map[' '];
        
        for (let j = 0; j < 9; j++) {
            const isBar = j % 2 === 0; 
            const width = (pattern[j] === 'W' || pattern[j] === 'w') ? wideW : narrowW;
            if (isBar) elements.push(<rect key={`${i}-${j}`} x={x} y={0} width={width} height={height} fill="black" />);
            x += width;
        }
        x += narrowW;
    }

    return (
        <div className="flex flex-col items-center w-full overflow-hidden">
            <svg width="100%" height="35" viewBox={`0 0 ${x} ${height}`} preserveAspectRatio="none">
                {elements}
            </svg>
            <span className="text-[10px] font-mono font-bold leading-none mt-0.5">{value}</span>
        </div>
    );
};

const QRCodeComponent = ({ value }) => {
    return (
        <div className="flex items-center justify-center w-full h-full p-1">
            <div style={{ height: "100%", width: "100%", maxWidth: "100%" }}>
                <QRCode
                    size={256}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={value}
                    viewBox={`0 0 256 256`}
                />
            </div>
        </div>
    );
};

// --- APP ROOT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'));
          if (snap.exists()) {
             const data = snap.data();
             if (data.active === false) {
                 setAuthError("Esta conta foi desativada pelo administrador.");
                 await signOut(auth);
                 setUser(null); setUserProfile(null);
             } else {
                 setAuthError(null);
                 setUser(u); setUserProfile({ uid: u.uid, ...data });
             }
          } else { 
             setAuthError("Perfil não encontrado.");
             await signOut(auth);
             setUser(null); setUserProfile(null);
          }
        } catch (e) { 
            setAuthError("Erro ao carregar perfil.");
            await signOut(auth); 
        }
      } else { 
          setUser(null); setUserProfile(null); 
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <ToastProvider>
        <DialogProvider>
            <PrintProvider user={user}>
                <style>{`
                    @media print {
                        @page { 
                            size: 50mm 30mm; 
                            margin: 0; 
                        }
                        html, body { 
                            margin: 0 !important; 
                            padding: 0 !important;
                            width: 50mm;
                            height: 30mm;
                        }
                        .no-print { display: none !important; }
                        #print-overlay {
                            display: block !important;
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: white;
                            z-index: 99999;
                        }
                        .sticker-item {
                            width: 50mm;
                            height: 30mm;
                            page-break-after: always;
                            break-after: page;
                            overflow: hidden;
                            box-sizing: border-box;
                            padding: 1mm 2mm;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .sticker-content {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                        }
                        .sticker-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 1px solid black;
                            padding-bottom: 1px;
                            margin-bottom: 1px;
                        }
                        .sticker-logo-area {
                            display: flex;
                            align-items: center;
                            gap: 3px;
                        }
                        .sticker-logo-img {
                            height: 10px;
                            width: auto;
                        }
                        .sticker-brand-col {
                            display: flex;
                            flex-direction: column;
                            line-height: 0.8;
                        }
                        .sticker-brand-title { 
                            font-size: 7px; 
                            font-weight: 900; 
                            color: #000;
                        }
                        .sticker-brand-sub {
                            font-size: 5px;
                            font-weight: bold;
                            color: #333;
                            text-transform: uppercase;
                        }
                        .sticker-date { font-size: 6px; font-weight: bold; }
                        
                        .sticker-barcode-area {
                            flex: 1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 1px 0;
                        }

                        .sticker-footer {
                            border-top: 1px solid black;
                            padding-top: 1px;
                            display: flex;
                            flex-direction: column;
                        }
                        .sticker-info {
                            display: flex;
                            justify-content: space-between;
                            align-items: baseline;
                            line-height: 1;
                        }
                        .sticker-label { font-size: 6px; font-weight: bold; }
                        .sticker-value { font-size: 7px; font-weight: bold; text-transform: uppercase; max-width: 35mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    }
                `}</style>

                {loading ? (
                    <div className="h-screen flex flex-col items-center justify-center bg-white no-print">
                        <img src={LOGOS.color} className="h-24 w-auto animate-bounce mb-4"/>
                        <div className="w-8 h-8 border-4 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>
                    </div>
                ) : !user || !userProfile ? (
                    <div className="no-print">
                        <LoginScreen globalError={authError} />
                    </div>
                ) : (
                    <div className="no-print">
                        <MainLayout user={user} userProfile={userProfile} />
                    </div>
                )}
            </PrintProvider>
        </DialogProvider>
    </ToastProvider>
  );
}

// --- LAYOUT ---
function MainLayout({ user, userProfile }) {
    const [view, setView] = useState('dashboard');
    const [menuOpen, setMenuOpen] = useState(false);
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
    const { confirm } = useDialog();
    const inactivityTimer = useRef(null);
    const warningTimer = useRef(null);
    
    // --- LÓGICA DE INATIVIDADE ---
    const TIMEOUT_DURATION = 15 * 60 * 1000;
    const WARNING_DURATION = 14 * 60 * 1000;

    const handleLogout = async (auto = false) => { 
        if (!auto) {
            if (await confirm({ title: 'Sair', message: 'Deseja encerrar sua sessão?', confirmText: 'Sair' })) {
                await performLogout('Usuário clicou em sair');
            }
        } else {
             await performLogout('Logout por inatividade');
        }
    };

    const performLogout = async (reason) => {
		try {
			// 1. Registra o log
			await logEvent('LOGOUT', reason, {}, user);
			
			// 2. Faz o logout no Firebase
			await signOut(auth); 

			
		} catch (error) {
			console.error("Erro ao realizar logout:", error);
		}
	};

    const resetInactivity = useCallback(() => {
        const keep = localStorage.getItem('unilavras_keep_signed_in') === 'true';
        if (keep) return;

        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (warningTimer.current) clearTimeout(warningTimer.current);

        setShowTimeoutWarning(false);

        warningTimer.current = setTimeout(() => {
            setShowTimeoutWarning(true);
        }, WARNING_DURATION);

        inactivityTimer.current = setTimeout(() => {
            handleLogout(true);
        }, TIMEOUT_DURATION);
    }, []);

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        const handleActivity = () => resetInactivity();

        events.forEach(e => window.addEventListener(e, handleActivity));
        resetInactivity();

        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
            if (warningTimer.current) clearTimeout(warningTimer.current);
        };
    }, [resetInactivity]);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'tech', 'student'] },
        { id: 'reception', label: 'Recepção', icon: PackagePlus, roles: ['admin', 'tech'] },
        { id: 'movement', label: 'Movimentação', icon: ScanBarcode, roles: ['admin', 'tech'] },
        { id: 'history', label: 'Histórico', icon: History, roles: ['admin', 'tech', 'student'] },
        { id: 'notifications', label: 'Avisos', icon: Bell, roles: ['student'] },
        { id: 'users', label: 'Usuários', icon: Users, roles: ['admin', 'tech'] },
        { id: 'admin', label: 'Administração', icon: Settings, roles: ['admin'] },
    ];

    const allowedItems = menuItems.filter(i => i.roles.includes(userProfile.role));

    useEffect(() => { 
        if (!allowedItems.find(i => i.id === view) && view !== 'profile') setView('dashboard'); 
    }, [userProfile.role]);

    return (
        <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-800">
            {showTimeoutWarning && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95">
                        <Timer className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-pulse"/>
                        <h3 className="text-xl font-bold text-[#021D34]">Sessão Expirando</h3>
                        <p className="text-slate-600 mt-2">Você está inativo há algum tempo. Sua sessão será encerrada em breve para sua segurança.</p>
                        <button 
                            onClick={resetInactivity}
                            className="mt-6 w-full bg-[#009DE0] text-white py-3 rounded-lg font-bold hover:bg-[#008bc5] transition-colors"
                        >
                            Continuar Logado
                        </button>
                    </div>
                </div>
            )}

            <aside className="hidden md:flex flex-col w-72 bg-[#021D34] shadow-xl z-20">
                <div className="p-6 border-b border-white/10 flex flex-col items-center">
                    <img src={LOGOS.white} className="h-12 w-auto mb-3 opacity-90"/>
                    <span className="text-[10px] text-[#009DE0] uppercase tracking-[0.2em] font-bold">Controle de Esterilização</span>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {allowedItems.map(item => (
                        <button key={item.id} onClick={() => setView(item.id)} 
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                            ${view === item.id ? 'bg-[#009DE0] text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            <item.icon size={20} className={view === item.id ? 'text-white' : 'text-[#009DE0]'} />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/10 bg-[#011526]">
                    <div 
                        onClick={() => setView('profile')}
                        className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors group"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#009DE0] to-blue-700 flex items-center justify-center text-white font-bold shadow-lg border border-white/20 group-hover:scale-105 transition-transform">
                            {userProfile.name.substring(0,2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-white truncate w-36 group-hover:text-[#009DE0] transition-colors">{userProfile.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{ROLE_LABELS[userProfile.role] || userProfile.role}</p>
                        </div>
                    </div>
                    <button onClick={() => handleLogout(false)} className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 hover:bg-red-500 hover:text-white transition-all">
                        <LogOut size={14}/> Encerrar Sessão
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-screen relative">
                <header className="md:hidden flex items-center justify-between p-4 bg-white border-b z-10 shadow-sm">
                    <button onClick={() => setMenuOpen(true)} className="p-2 -ml-2 text-[#021D34]"><Menu/></button>
                    <img src={LOGOS.color} className="h-8 w-auto"/>
                    <button onClick={() => setView('profile')} className="w-8 h-8 rounded-full bg-[#009DE0] text-white flex items-center justify-center text-xs font-bold shadow-sm active:scale-95 transition-transform">
                        {userProfile.name.substring(0,2).toUpperCase()}
                    </button>
                </header>

                {menuOpen && (
                    <div className="fixed inset-0 z-50 flex">
                        <div className="fixed inset-0 bg-[#021D34]/90 backdrop-blur-sm" onClick={() => setMenuOpen(false)}/>
                        <div className="relative w-64 bg-[#021D34] h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-left">
                            <button onClick={() => setMenuOpen(false)} className="self-end text-white/50 p-2"><X/></button>
                            <nav className="space-y-2 mt-4">
                                <button onClick={() => { setView('profile'); setMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${view === 'profile' ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}>
                                    <UserCircle size={20}/> Meu Perfil
                                </button>
                                <div className="h-px bg-white/10 my-2 mx-2"/>
                                {allowedItems.map(item => (
                                    <button key={item.id} onClick={() => { setView(item.id); setMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${view === item.id ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}>
                                        <item.icon size={20}/> {item.label}
                                    </button>
                                ))}
                            </nav>
                            <button onClick={() => handleLogout(false)} className="mt-auto flex items-center gap-2 text-red-400 p-3"><LogOut size={16}/> Sair</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar bg-[#F8FAFC]">
                    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-0">
                        {view === 'dashboard' && <Dashboard userProfile={userProfile} />}
                        {view === 'reception' && <Reception userProfile={userProfile} />}
                        {view === 'movement' && <Movement userProfile={userProfile} />}
                        {view === 'history' && <HistoryView userProfile={userProfile} />}
                        {view === 'notifications' && <NotificationsView userProfile={userProfile} />}
                        {view === 'users' && <UserManagement userProfile={userProfile} />}

                        {view === 'profile' && <ProfileView userProfile={userProfile} />}
						
						{/* Mantém o painel montado (invisível) para não perder os logs carregados ao trocar de tela */}
						{userProfile.role === 'admin' && (
							<div style={{ display: view === 'admin' ? 'block' : 'none' }}>
								<AdminPanel userProfile={userProfile} />
							</div>
						)}
					
					</div>
                </div>
            </main>
        </div>
    );
}

// --- PROFILE VIEW (NOVO) ---
function ProfileView({ userProfile }) {
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-[#021D34] mb-6">Meu Perfil</h2>
            
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden max-w-3xl mx-auto">
                {/* Header Gradient */}
                <div className="h-32 bg-gradient-to-r from-[#021D34] to-[#009DE0] relative">
                    <div className="absolute inset-0 bg-white/5 pattern-dots"/>
                </div>

                <div className="px-8 pb-8 relative">
                    {/* Avatar */}
                    <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 mb-6 gap-6">
                        <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-xl">
                            <div className="w-full h-full rounded-full bg-[#021D34] text-white flex items-center justify-center text-3xl font-bold">
                                {userProfile.name.substring(0,2).toUpperCase()}
                            </div>
                        </div>
                        <div className="text-center md:text-left flex-1 md:translate-y-4">
                            <h1 className="text-2xl font-bold text-[#021D34]">{userProfile.name}</h1>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                    userProfile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                    userProfile.role === 'tech' ? 'bg-orange-100 text-orange-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    {ROLE_LABELS[userProfile.role]}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> Ativo
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detalhes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Mail size={14}/> Email Cadastrado
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                {userProfile.email}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <ScanBarcode size={14}/> CPF
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium font-mono">
                                {maskCPF(userProfile.cpf)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Calendar size={14}/> Membro Desde
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-medium">
                                {userProfile.createdAt ? formatDate(userProfile.createdAt) : 'Data não disponível'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                <KeyRound size={14}/> Senha
                            </label>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 font-medium flex justify-between items-center">
                                <span>••••••••••••</span>
                                <span className="text-xs text-slate-400 italic">Gerenciada no Login</span>
                            </div>
                        </div>
                    </div>
                    
                    {userProfile.role !== 'admin' && (
						<div className="mt-8 pt-6 border-t border-slate-100 text-center md:text-left">
							<p className="text-xs text-slate-400">
								Para alterar dados sensíveis como CPF ou Email, entre em contato com a administração do sistema.
							</p>
						</div>
					)}

                </div>
            </div>
        </div>
    );
}

// --- DASHBOARD ---
function Dashboard({ userProfile }) {
    const [stats, setStats] = useState({ 
        current: { rec:0, em:0, pront:0, ret:0 }, 
        previous: { rec:0, em:0, pront:0, ret:0 },
        types: [],
        timeline: [],
        topStudents: [] 
    });
    const [anns, setAnns] = useState([]);
    const [period, setPeriod] = useState('7d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [insights, setInsights] = useState([]);
    
    // --- Recados (Otimizado: Limitado aos últimos 10) ---
    useEffect(() => {
        const now = new Date();
        // Traz apenas anúncios ativos ou recentes para não ler o banco todo
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), 
            orderBy('createdAt', 'desc'),
            limit(10) 
        );

        const unsubAnn = onSnapshot(q, (s) => {
            const all = s.docs.map(d => ({id: d.id, ...d.data()}));
            
            const active = all.filter(a => {
                const start = a.validFrom ? new Date(a.validFrom) : null;
                const end = a.validUntil ? new Date(a.validUntil) : null;
                
                if (start && now < start) return false;
                if (end && now > end) return false;
                return true;
            });
            setAnns(active);
        });
        return () => unsubAnn();
    }, []);

    // --- Dados Principais (CORREÇÃO DE LEITURA: Filtro no Banco) ---
    useEffect(() => {
        let startDate = new Date();
        let endDate = new Date(2100, 11, 31); // Futuro distante
        const now = new Date();

        // Configuração das datas de filtro
        if (period === '7d') startDate.setDate(now.getDate() - 7);
        if (period === '30d') startDate.setDate(now.getDate() - 30);
        if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
        if (period === 'custom') {
            if (!customStart) return; // Não busca se não tiver data
            startDate = new Date(customStart);
            if (customEnd) endDate = new Date(customEnd + 'T23:59:59');
        }

        // Zera as horas para garantir comparação correta do dia
        if (period !== 'custom') startDate.setHours(0,0,0,0);

        // Montagem da Query Otimizada
        let constraints = [
            orderBy('createdAt', 'desc') // Ordena por data
        ];

        // Adiciona filtros de segurança
        // Nota: O Firestore exige que o filtro de intervalo (<, >) seja no mesmo campo do orderBy
        constraints.push(where('createdAt', '>=', startDate));
        constraints.push(where('createdAt', '<=', endDate));

        if (userProfile.role === 'student') {
            constraints.push(where('studentId', '==', userProfile.uid));
        }

        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
            ...constraints
        );

        const unsubItems = onSnapshot(q, (s) => {
            processData(s.docs);
        }, (error) => {
            console.error("Erro no Dashboard (Provavelmente falta índice):", error);
            // Se der erro de índice, o console mostrará o link para criar.
        });

        return () => unsubItems();
    }, [userProfile, period, customStart, customEnd]);

    const processData = (docs) => {
        const counts = { rec:0, em:0, pront:0, ret:0 };
        const typeCount = {};
        const dailyCount = {};
        const studentCount = {};

        docs.forEach(d => {
            const data = d.data();
            // A data já foi filtrada no banco, podemos confiar
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

            if (data.status === 'recebido') counts.rec++;
            if (data.status === 'em_esterilizacao') counts.em++;
            if (data.status === 'pronto') counts.pront++;
            if (data.status === 'retirado') counts.ret++;

            typeCount[data.type] = (typeCount[data.type] || 0) + 1;

            const dayKey = date.toLocaleDateString('pt-BR');
            dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;

            if (userProfile.role !== 'student') {
                studentCount[data.studentName] = (studentCount[data.studentName] || 0) + 1;
            }
        });

        const typesData = Object.entries(typeCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
        const timelineData = Object.entries(dailyCount).map(([name, value]) => ({ name, value })).sort((a,b) => {
            const [da, ma, ya] = a.name.split('/');
            const [db, mb, yb] = b.name.split('/');
            return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
        });
        const topStudentsData = Object.entries(studentCount).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);

        const newInsights = [];
        if (typesData.length > 0) newInsights.push(`Material mais comum: "${typesData[0].name}" (${typesData[0].value}).`);
        if (timelineData.length > 0) {
            const busiestDay = timelineData.reduce((prev, current) => (prev.value > current.value) ? prev : current);
            newInsights.push(`Pico de movimento: ${busiestDay.name} (${busiestDay.value} itens).`);
        }
        if (userProfile.role === 'student' && counts.ret > 0) {
            newInsights.push(`Você já retirou ${counts.ret} materiais.`);
        }

        setStats({
            current: counts,
            previous: { rec:0, em:0, pront:0, ret:0 }, 
            types: typesData,
            timeline: timelineData,
            topStudents: topStudentsData
        });
        setInsights(newInsights);
    };

    const COLORS = ['#009DE0', '#021D34', '#F97316', '#22C55E', '#64748B'];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-[#021D34]">Olá, {userProfile.name.split(' ')[0]}</h2>
                    <p className="text-slate-500 flex items-center gap-2">
                        <Activity size={16}/> Resumo em tempo real da central de esterilização.
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-lg border shadow-sm w-full md:w-auto">
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="p-2 bg-slate-50 border rounded text-sm outline-none focus:border-[#009DE0] font-medium text-slate-700 w-full md:w-auto">
                        <option value="7d">Últimos 7 dias</option>
                        <option value="30d">Últimos 30 dias</option>
                        <option value="year">Este Ano</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    
                    {period === 'custom' && (
                        <div className="flex gap-2">
                            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="p-2 border rounded text-sm"/>
                            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="p-2 border rounded text-sm"/>
                        </div>
                    )}
                </div>
            </div>

            {anns.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {anns.map(a => (
                        <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group relative flex flex-col h-full">
                            {a.imageUrl ? (
                                <div className="h-32 overflow-hidden relative shrink-0">
                                    <img src={a.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                    <span className="absolute bottom-2 left-3 text-white text-xs font-bold bg-[#009DE0] px-2 py-0.5 rounded shadow">Comunicado</span>
                                </div>
                            ) : (
                                <div className="h-2 bg-[#009DE0] w-full shrink-0"/>
                            )}
                            <div className="p-5 flex-1 flex flex-col">
                                <h4 className="font-bold text-[#021D34] text-lg mb-2">{a.title}</h4>
                                <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap mb-2">{a.content}</p>
                                
                                {userProfile.role === 'admin' && (a.validUntil || a.validFrom) && (
                                    <div className="mt-auto pt-3 border-t flex items-center gap-2 text-xs text-slate-400">
                                        <Clock size={12}/>
                                        <span>
                                            {a.validFrom ? new Date(a.validFrom).toLocaleDateString() : 'Agora'} até {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Sempre'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Recebidos" count={stats.current.rec} icon={Clock} color="text-slate-600" bg="bg-slate-100" />
                <StatCard title="Em Processo" count={stats.current.em} icon={AlertCircle} color="text-orange-600" bg="bg-orange-50" />
                <StatCard title="Prontos" count={stats.current.pront} icon={CheckCircle2} color="text-green-600" bg="bg-green-50" />
                <StatCard title="Retirados" count={stats.current.ret} icon={CheckSquare} color="text-[#009DE0]" bg="bg-blue-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-[#021D34] mb-6 flex items-center gap-2">
                        <TrendingUp className="text-[#009DE0]"/> Fluxo de Entrada ({period === 'custom' ? 'Período' : period})
                    </h3>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.timeline}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#009DE0" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#009DE0" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} dy={10} minTickGap={30}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}}/>
                                <Tooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    formatter={(value) => [value, "Quantidade"]}
                                />
                                <Area type="monotone" dataKey="value" stroke="#009DE0" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-[#021D34] to-[#009DE0] p-6 rounded-2xl shadow-lg text-white">
                        <h3 className="font-bold flex items-center gap-2 mb-4 text-white/90">
                            <Lightbulb className="text-yellow-400"/> Insights
                        </h3>
                        <ul className="space-y-3 text-sm text-white/80">
                            {insights.length > 0 ? insights.map((ins, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="mt-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"/>
                                    {ins}
                                </li>
                            )) : (
                                <li>Sem dados suficientes no período.</li>
                            )}
                        </ul>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[300px] flex flex-col">
                        <h3 className="font-bold text-[#021D34] mb-2 flex items-center gap-2">
                            <BarChart3 className="text-[#009DE0]"/> Por Tipo
                        </h3>
                        <div className="flex-1 w-full min-h-0">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={stats.types.slice(0, 10)}
                                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0"/>
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={100} 
                                        tick={{fill: '#64748B', fontSize: 10}}
                                        interval={0}
                                    />
                                    <Tooltip 
                                        cursor={{fill: '#F1F5F9'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                        formatter={(value) => [value, "Quantidade"]}
                                    />
                                    <Bar dataKey="value" fill="#009DE0" radius={[0, 4, 4, 0]} barSize={16}>
                                        {stats.types.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {userProfile.role !== 'student' && stats.topStudents.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-[#021D34] mb-6 flex items-center gap-2">
                        <UserCog className="text-[#009DE0]"/> Top 5 Alunos Mais Ativos
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topStudents} layout="vertical" margin={{left: 20}}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0"/>
                                <XAxis type="number" hide/>
                                <YAxis dataKey="name" type="category" width={150} tick={{fill: '#64748B', fontSize: 12}}/>
                                <Tooltip 
                                    cursor={{fill: '#F1F5F9'}} 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                    formatter={(value, name, props) => [value, "Materiais"]}
                                />
                                <Bar dataKey="value" fill="#009DE0" radius={[0, 4, 4, 0]} barSize={20}>
                                    { stats.topStudents.map((entry, index) => <Cell key={`cell-${index}`} fill={['#009DE0', '#021D34', '#F97316', '#22C55E', '#64748B'][index % 5]} />) }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({title, count, icon:Icon, color, bg}) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${bg} ${color}`}><Icon size={24}/></div>
            </div>
            <h3 className="text-3xl font-bold text-[#021D34]">{count}</h3>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">{title}</p>
        </div>
    );
}

// --- LOGIN ---
function LoginScreen({ globalError }) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [mode, setMode] = useState('login');
    const [keepSigned, setKeepSigned] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addToast } = useToast();

    // Se houver erro global (ex: conta inativa), forçamos o fim do loading
    useEffect(() => {
        if (globalError) setIsSubmitting(false);
    }, [globalError]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            
            // --- CORREÇÃO: VERIFICAR STATUS ANTES DE LOGAR SUCESSO ---
            // Buscamos o perfil manualmente aqui para garantir que não logamos sucesso se estiver inativo
            const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.active === false) {
                    await logEvent('LOGIN_FAIL', 'Login bloqueado - Usuário inativo', { email });
                    await signOut(auth); // Desloga imediatamente
                    throw { code: 'auth/account-inactive' }; // Joga erro customizado para o catch
                }
            }
            
            // Se chegou aqui, está ativo.
            await logEvent('LOGIN', 'Usuário fez login com sucesso', { email }, cred.user);
            if (keepSigned) localStorage.setItem('unilavras_keep_signed_in', 'true');
            else localStorage.removeItem('unilavras_keep_signed_in');

        } catch (error) {
            // Se não foi erro de conta inativa, loga a falha genérica
            if (error.code !== 'auth/account-inactive') {
                await logEvent('LOGIN_FAIL', 'Tentativa de login falhou', { email, error: error.code });
            }
            addToast(translateFirebaseError(error), 'error');
            setIsSubmitting(false);
        }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await sendPasswordResetEmail(auth, email);
            addToast('Link de recuperação enviado!', 'success');
            setMode('login');
        } catch (error) {
            addToast(translateFirebaseError(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#021D34] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#009DE0] rounded-full blur-[150px] opacity-20"/>
            <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl relative z-10">
                <div className="text-center mb-8">
                    <img src={LOGOS.color} className="h-16 mx-auto mb-6"/>
                    <h1 className="text-2xl font-bold text-[#021D34]">{mode === 'login' ? 'Portal de Esterilização' : 'Recuperar Senha'}</h1>
                </div>

                {globalError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3 text-red-700 text-sm items-start">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5"/>
                        <span>{globalError}</span>
                    </div>
                )}

                {mode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
                            <input type="email" className="w-full p-3 border border-slate-200 rounded-lg focus:border-[#009DE0] outline-none" value={email} onChange={e=>setEmail(e.target.value)} required disabled={isSubmitting}/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 uppercase">Senha</label>
                            <input type="password" className="w-full p-3 border border-slate-200 rounded-lg focus:border-[#009DE0] outline-none" value={pass} onChange={e=>setPass(e.target.value)} required disabled={isSubmitting}/>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={keepSigned} onChange={e=>setKeepSigned(e.target.checked)} className="rounded text-[#009DE0] focus:ring-[#009DE0]" disabled={isSubmitting}/>
                                <span className="text-slate-600">Manter conectado</span>
                            </label>
                            <button type="button" onClick={()=>setMode('forgot')} className="text-[#009DE0] hover:underline font-medium" disabled={isSubmitting}>Esqueceu a senha?</button>
                        </div>

                        <button disabled={isSubmitting} className="w-full bg-[#009DE0] text-white p-3.5 rounded-lg font-bold hover:bg-[#008bc5] transition-all flex justify-center items-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5"/> : 'Entrar'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <input type="email" placeholder="Email cadastrado" className="w-full p-3 border border-slate-200 rounded-lg focus:border-[#009DE0] outline-none" value={email} onChange={e=>setEmail(e.target.value)} required disabled={isSubmitting}/>
                        <button disabled={isSubmitting} className="w-full bg-[#021D34] text-white p-3.5 rounded-lg font-bold">Enviar Link</button>
                        <button type="button" onClick={()=>setMode('login')} className="w-full text-center text-sm text-slate-500 hover:text-[#009DE0] mt-2">Voltar para Login</button>
                    </form>
                )}
            </div>
        </div>
    );
}

// --- NOTIFICAÇÕES ALUNO ---
function NotificationsView({ userProfile }) {
    const [notifs, setNotifs] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        const q = query(
            collection(db, 'artifacts', appId, 'users', userProfile.uid, 'notifications'), 
            orderBy('createdAt', 'desc'),
			limit(50)
        );
        const unsub = onSnapshot(q, s => setNotifs(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsub();
    }, [userProfile]);

    const filtered = notifs.filter(n => 
        n.title.toLowerCase().includes(search.toLowerCase()) || 
        n.message.toLowerCase().includes(search.toLowerCase())
    );

    const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-[#021D34] flex items-center gap-2 w-full md:w-auto"><Bell className="text-[#009DE0]"/> Meus Avisos</h2>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                    <input 
                        className="w-full pl-10 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" 
                        placeholder="Pesquisar avisos..." 
                        value={search} 
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            <div className="space-y-4">
                {paginated.length > 0 ? paginated.map(n => (
                    <div key={n.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-[#021D34]">{n.title}</h4>
                            <span className="text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{n.message}</p>
                    </div>
                )) : (
                    <div className="text-center py-12 text-slate-400">Nenhum aviso encontrado.</div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 bg-white border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                    <span className="px-4 py-2 text-sm text-slate-600 font-medium">Página {page} de {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 bg-white border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16}/></button>
                </div>
            )}
        </div>
    );
}

// --- RECEPÇÃO ---
function Reception({ userProfile }) {
    const [step, setStep] = useState(1);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [studentResults, setStudentResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [types, setTypes] = useState([]);
    const [cart, setCart] = useState([]);
    const [createdItems, setCreatedItems] = useState([]);
    const { addToast } = useToast();
    const { printItems } = usePrint();

    // --- BUSCA OTIMIZADA DE ALUNOS ---
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Se tiver menos de 3 caracteres, limpa e não busca (economiza leitura)
            if (search.length < 3) { 
                setStudentResults([]); 
                return; 
            }
            
            setSearching(true);
            try {
                let q;
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
                
                // Detecção simples: Se tem números, provável CPF. Se não, Nome.
                // Remove caracteres não numéricos para testar CPF
                const cleanSearch = search.replace(/\D/g, ''); 
                const isNumericSearch = cleanSearch.length > 2; 

                if (isNumericSearch) {
                    // Busca por prefixo de CPF
                    // '\uf8ff' é um caractere especial unicode que funciona como "até o final possível"
                    q = query(
                        usersRef, 
                        where('role', '==', 'student'),
                        orderBy('cpf'), // Precisa ordenar pelo campo que vai buscar intervalo
                        startAt(cleanSearch),
                        endAt(cleanSearch + '\uf8ff'),
                        limit(5) // <--- OTIMIZAÇÃO: Traz no máximo 5
                    );
                } else {
                    // Busca por Nome (Case sensitive no Firestore, então o ideal é digitar igual ou ter salvo lowercase)
                    // Assumindo que o usuário digita Capitalizado ou como está no banco
                    q = query(
                        usersRef, 
                        where('role', '==', 'student'),
                        orderBy('name'), 
                        startAt(search),
                        endAt(search + '\uf8ff'),
                        limit(5)
                    );
                }

                const snap = await getDocs(q);
                const res = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
                setStudentResults(res);

            } catch (error) {
                console.error("Erro na busca (verifique índices):", error);
                // Fallback para busca local se falhar por falta de índice complexo num primeiro momento,
                // mas isso gasta leitura se não tiver o limit.
            } finally {
                setSearching(false);
            }
        }, 500); // Debounce de 500ms
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), s => setTypes(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => unsub();
    }, []);

    const finish = async () => {
        if (cart.length === 0) return;
        const batch = writeBatch(db);
        const newItems = [];
        
        try {
            for (const item of cart) {
                let code = generateUniqueId();
                let isUnique = false;
                let attempts = 0;

                // Loop de verificação de unicidade mantido
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
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className={`bg-white p-6 rounded-2xl border transition-all ${selectedStudent ? 'border-[#009DE0]' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-lg flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">1</span> Identificação</h3>
                         {selectedStudent && <button onClick={() => { setSelectedStudent(null); setSearch(''); }} className="text-xs text-red-500 hover:underline">Alterar Aluno</button>}
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

                <div className={`bg-white p-6 rounded-2xl border border-slate-200 transition-opacity ${!selectedStudent ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#021D34] text-white flex items-center justify-center text-xs">2</span> Materiais</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {types.map(t => (
                            <button 
                                key={t.id} 
                                onClick={() => setCart([...cart, { ...t, uid: Math.random() }])} 
                                className="p-4 border rounded-xl hover:bg-[#009DE0] hover:text-white hover:border-[#009DE0] active:scale-95 active:bg-blue-600 active:border-blue-600 transition-all duration-75 text-left flex flex-col gap-2 group select-none"
                            >
                                <PackagePlus size={24} className="text-slate-300 group-hover:text-white"/>
                                <span className="font-medium">{t.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 h-fit sticky top-4 shadow-sm">
                <h3 className="font-bold text-[#021D34] mb-4">Resumo</h3>
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
    );
}

// --- MOVIMENTAÇÃO ---
function Movement({ userProfile }) {
    const [mode, setMode] = useState('list');
    const [code, setCode] = useState('');
    const [singleItem, setSingleItem] = useState(null);
    const [listItems, setListItems] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    
    // NOVO: Controle do limite de visualização
    const [visibleLimit, setVisibleLimit] = useState(50);
    
    const { addToast } = useToast();
    const { confirm } = useDialog();
    const { printItems } = usePrint();

    const searchTimeout = useRef(null);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (code === '') {
            setSingleItem(null);
            return;
        }
        if (mode === 'single' && code.length >= 6) {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            searchTimeout.current = setTimeout(async () => {
                const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('code', '==', code.toUpperCase()));
                const snap = await getDocs(q);
                if (snap.empty) {
                    playSound('error'); 
                    addToast('Código não encontrado.', 'error');
					setSingleItem(null);
                } else {
                    playSound('success'); 
                    setSingleItem({ id: snap.docs[0].id, ...snap.docs[0].data() });
                }
            }, 500);
        }
    }, [code, mode]);

    useEffect(() => {
        if (mode === 'list') {
            // USA O visibleLimit AQUI
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'items'), 
                orderBy('lastUpdated', 'desc'), 
                limit(visibleLimit) 
            );
            const unsub = onSnapshot(q, s => setListItems(s.docs.map(d => ({id: d.id, ...d.data()}))));
            return () => unsub();
        }
    }, [mode, visibleLimit]); // Recarrega se o limite mudar

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

		// Lógica de Busca: Exata vs Inteligente
		if (search.startsWith('"') && search.endsWith('"') && search.length > 2) {
			// --- BUSCA EXATA ---
			const exactTerm = search.slice(1, -1);
			// Verifica se o termo exato está contido no Nome, Código ou Tipo (Case Sensitive conforme digitado)
			matchesSearch = i.studentName.includes(exactTerm) || 
							i.code.includes(exactTerm) || 
							(i.type && i.type.includes(exactTerm));
		} else {
			// --- BUSCA INTELIGENTE (PADRÃO) ---
			// Ignora Case Sensitive e compara
			matchesSearch = i.studentName.toLowerCase().includes(search.toLowerCase()) || 
							i.code.toUpperCase().includes(search.toUpperCase()) ||
							(i.type && i.type.toLowerCase().includes(search.toLowerCase()));
		}

		const matchesStatus = filterStatus === 'all' ? true : i.status === filterStatus;
		return matchesSearch && matchesStatus;
	});

    return (
        <div className="space-y-6">
            <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-full md:w-fit overflow-x-auto">
                <button onClick={() => { setMode('list'); setCode(''); setSingleItem(null); }} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${mode === 'list' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>Lista / Lote</button>
                <button onClick={() => setMode('single')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-all whitespace-nowrap ${mode === 'single' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}>Leitura Individual</button>
            </div>

            {mode === 'single' ? (
                <div className="max-w-xl mx-auto space-y-6">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <ScanBarcode className="w-12 h-12 text-[#009DE0] mx-auto mb-4"/>
                        <h2 className="text-xl font-bold text-[#021D34] mb-2">Ler Código de Barras</h2>
                        <p className="text-xs text-slate-400 mb-4">A leitura é automática ao digitar ou escanear</p>
                        <div className="flex gap-2">
                            <input className="w-full text-center font-mono text-2xl uppercase tracking-widest p-4 border-2 border-slate-200 rounded-xl focus:border-[#009DE0] outline-none transition-all" placeholder="XXXXXX" value={code} onChange={e => setCode(e.target.value)} autoFocus/>
                        </div>
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
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_CONFIG[singleItem.status].color}`}>{STATUS_CONFIG[singleItem.status].label}</span>
                                    <button onClick={() => printItems(singleItem)} className="flex items-center gap-1 text-xs text-[#009DE0] hover:underline font-bold"><Printer size={12}/> Reimprimir</button>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                {singleItem.status === 'recebido' && <button onClick={async () => { await updateStatus(singleItem, 'em_esterilizacao'); setSingleItem(prev => ({...prev, status: 'em_esterilizacao'})); addToast('Status atualizado!', 'success'); }} className="p-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20">Iniciar Esterilização</button>}
                                {singleItem.status === 'em_esterilizacao' && <button onClick={async () => { await updateStatus(singleItem, 'pronto'); setSingleItem(prev => ({...prev, status: 'pronto'})); addToast('Material pronto!', 'success'); }} className="p-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20">Marcar como Pronto</button>}
                                {singleItem.status === 'pronto' && <button onClick={async () => { await updateStatus(singleItem, 'retirado'); setSingleItem(prev => ({...prev, status: 'retirado'})); addToast('Retirada confirmada!', 'success'); }} className="p-4 bg-[#009DE0] text-white rounded-xl font-bold hover:bg-[#008bc5] transition-colors shadow-lg shadow-blue-500/20">Confirmar Retirada</button>}
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
                                <option value="all">Todos os Status</option>
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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

                    {/* Botão Carregar Mais - Só aparece se tiver carregado o limite total e não estiver filtrando */}
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

// --- HISTÓRICO ---
function HistoryView({ userProfile }) {
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastDoc, setLastDoc] = useState(null); 
    const [hasMore, setHasMore] = useState(true); 
    const [loadingMore, setLoadingMore] = useState(false); 

    const { printItems } = usePrint();
    const { confirm } = useDialog();
    const { addToast } = useToast();

    const formatSearchTerm = (text) => {
		if (!text) return '';
		
		// 1. REGRA "EXATA" (Entre aspas)
		// Se o usuário digitar "texto", buscamos exatamente texto (case sensitive do jeito dele)
		if (text.startsWith('"') && text.endsWith('"') && text.length > 2) {
			return text.slice(1, -1); // Remove as aspas e retorna o miolo cru
		}

		const trimmed = text.trim();
		
		// 2. REGRA INTELIGENTE (Padrão)
		if (/\d/.test(trimmed)) return trimmed.toUpperCase(); // Tem número -> Código
		
		// Nome ou Material -> Capitaliza (Joao Silva)
		return trimmed.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
	};

    // --- CARGA INICIAL E BUSCA ---
    useEffect(() => {
        const timer = setTimeout(async () => {
            setLoading(true);
            setHasMore(true);
            setLastDoc(null);
            
            try {
                const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
                
                // SE TEM BUSCA (Maior que 2 letras)
                if (search.length > 2) {
                    const term = formatSearchTerm(search);
                    const queries = [];
                    const isStudent = userProfile.role === 'student';

                    // Lógica 1: É CÓDIGO? (Tem números ou é curto)
                    if (/\d/.test(term) && term.length <= 8) {
                         const constraints = [
                             where('code', '>=', term),
                             where('code', '<=', term + '\uf8ff'),
                             orderBy('code'),
                             limit(20)
                         ];
                         // Se for aluno, trava a busca apenas nos dele
                         if (isStudent) constraints.unshift(where('studentId', '==', userProfile.uid));
                         
                         queries.push(query(itemsRef, ...constraints));
                    } 
                    // Lógica 2: É TEXTO (Nome ou Material)
                    else {
                        if (isStudent) {
                            // ALUNO: Busca apenas por Tipo de Material (Nome do aluno é ele mesmo)
                            // Exige índice: studentId ASC + type ASC
                            queries.push(query(
                                itemsRef, 
                                where('studentId', '==', userProfile.uid), 
                                orderBy('type'), 
                                startAt(term), 
                                endAt(term + '\uf8ff'), 
                                limit(20)
                            ));
                        } else {
                            // ADMIN: Busca por Nome do Aluno E Tipo de Material
                            queries.push(query(itemsRef, orderBy('studentName'), startAt(term), endAt(term + '\uf8ff'), limit(20)));
                            queries.push(query(itemsRef, orderBy('type'), startAt(term), endAt(term + '\uf8ff'), limit(20)));
                        }
                    }

                    const snapshots = await Promise.all(queries.map(q => getDocs(q)));
                    const uniqueDocs = new Map();
                    snapshots.forEach(snap => snap.docs.forEach(doc => uniqueDocs.set(doc.id, { id: doc.id, ...doc.data() })));
                    
                    setHistory(Array.from(uniqueDocs.values()));
                    setHasMore(false); // Busca focada não tem paginação "carregar mais"
                    
                } else {
                    // SEM BUSCA: Carga Padrão (Últimos 50)
                    const constraints = [orderBy('createdAt', 'desc'), limit(50)];
                    if (userProfile.role === 'student') constraints.unshift(where('studentId', '==', userProfile.uid));

                    const q = query(itemsRef, ...constraints);
                    const snap = await getDocs(q);
                    
                    setHistory(snap.docs.map(d => ({id: d.id, ...d.data()})));
                    setLastDoc(snap.docs[snap.docs.length - 1]);
                    if (snap.docs.length < 50) setHasMore(false);
                }

            } catch (error) {
                console.error("Erro no histórico:", error);
                if (error.code === 'failed-precondition') addToast('Falta índice no Firebase. Verifique o console (F12).', 'info');
            } finally {
                setLoading(false);
            }
        }, 600); 

        return () => clearTimeout(timer);
    }, [userProfile, search]);

    // --- FUNÇÃO CARREGAR MAIS (PAGINAÇÃO REAL) ---
    const loadMore = async () => {
        if (!lastDoc || loadingMore) return;
        setLoadingMore(true);
        try {
            const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
            const constraints = [orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(50)];
            if (userProfile.role === 'student') constraints.unshift(where('studentId', '==', userProfile.uid));
            
            const q = query(itemsRef, ...constraints);
            const snap = await getDocs(q);
            
            if (!snap.empty) {
                const newItems = snap.docs.map(d => ({id: d.id, ...d.data()}));
                setHistory(prev => [...prev, ...newItems]);
                setLastDoc(snap.docs[snap.docs.length - 1]);
                if (snap.docs.length < 50) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (e) { console.error(e); }
        setLoadingMore(false);
    };

    const handlePrintSelected = () => {
        const toPrint = history.filter(i => selectedIds.includes(i.id));
        printItems(toPrint);
    };

    const handleDeleteSelected = async () => {
        if(selectedIds.length === 0) return;
        if (!await confirm({ title: 'Excluir Itens', message: `Excluir ${selectedIds.length} registros permanentemente?`, isDestructive: true })) return;

        const batch = writeBatch(db);
        for(const id of selectedIds) {
            batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'items', id));
        }
        await batch.commit();
        
        setHistory(prev => prev.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
        addToast('Itens excluídos.', 'success');
        logEvent('ITEM_DELETE', `Exclusão em massa de ${selectedIds.length} itens`, { executor: userProfile.name });
    };

    const isAdminOrTech = userProfile.role === 'admin' || userProfile.role === 'tech';
    const isStudent = userProfile.role === 'student';

    return (
        <div className="space-y-4">
             <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                 <h2 className="font-bold text-[#021D34] flex items-center gap-2 w-full md:w-auto"><History className="text-[#009DE0]"/> Histórico</h2>
                 
                 <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                     {isAdminOrTech && selectedIds.length > 0 && (
                        <div className="flex gap-2 animate-in slide-in-from-right w-full md:w-auto justify-center">
                             <button onClick={handlePrintSelected} className="bg-[#021D34] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"><Printer size={14}/> Imprimir ({selectedIds.length})</button>
                             <button onClick={handleDeleteSelected} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"><Trash2 size={14}/> Excluir ({selectedIds.length})</button>
                        </div>
                     )}
                     <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input className="w-full pl-10 p-2 border rounded-lg text-sm outline-none focus:border-[#009DE0]" 
                               placeholder={isStudent ? "Buscar Material ou Código..." : "Nome, Material ou Código..."} 
                               value={search} 
                               onChange={e => setSearch(e.target.value)}/>
                        {loading && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>}
                     </div>
                 </div>
             </div>
             
             {search.length > 2 && <div className="text-xs text-slate-400 px-2">Buscando por: <span className="font-bold">"{formatSearchTerm(search)}..."</span> {isStudent ? "nos seus materiais." : "no sistema."}</div>}
             
             <DataTable 
                columns={[
                    ...(isAdminOrTech ? [{ key: 'select', label: '', render: (i) => <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="rounded text-[#009DE0] focus:ring-[#009DE0]"/> }] : []),
                    { key: 'createdAt', label: 'Data Entrada', sortable: true, render: (i) => formatDate(i.createdAt) },
                    { key: 'code', label: 'Código', sortable: true, render: (i) => <span className="font-mono font-bold text-[#009DE0]">{i.code}</span> },
                    { key: 'studentName', label: 'Aluno', sortable: true },
                    { key: 'type', label: 'Material', sortable: true },
                    { key: 'status', label: 'Status Final', sortable: true, render: (i) => <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${STATUS_CONFIG[i.status].color}`}>{STATUS_CONFIG[i.status].label}</span> },
                ]}
                data={history} 
                emptyMsg={loading ? "Carregando..." : "Nenhum registro encontrado."}
                mobileRender={(i) => (
                    <div className="flex items-start gap-3">
                         {isAdminOrTech && <div className="mt-1"><input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => setSelectedIds(p => p.includes(i.id) ? p.filter(x => x !== i.id) : [...p, i.id])} className="w-5 h-5 rounded text-[#009DE0] focus:ring-[#009DE0]"/></div>}
                         <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-mono font-bold text-[#009DE0]">{i.code}</span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${STATUS_CONFIG[i.status].color}`}>{STATUS_CONFIG[i.status].label}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-sm">{i.studentName}</h4>
                            <p className="text-sm text-slate-600">{i.type}</p>
                            <p className="text-xs text-slate-400 mt-1">{formatDate(i.createdAt)}</p>
                         </div>
                    </div>
                )}
				// Se não for Admin/Tech, passamos 'null' ou 'undefined' para a prop actions inteira.
				// Assim o DataTable entende que não deve desenhar a coluna de Ações.
				actions={isAdminOrTech ? (item) => (
					<button onClick={() => printItems(item)} className="p-2 text-slate-400 hover:text-[#009DE0] hover:bg-blue-50 rounded bg-slate-50 border border-slate-200" title="Reimprimir Etiqueta">
						<Printer size={20}/>
					</button>
				) : null}
            />

            {/* BOTÃO CARREGAR MAIS (Aparece se tiver mais itens e não estiver buscando) */}
            {!loading && hasMore && search.length <= 2 && (
                <div className="flex justify-center pt-2">
                    <button onClick={loadMore} disabled={loadingMore} className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50">
                        {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                        {loadingMore ? 'Buscando...' : 'Carregar Mais Antigos'}
                    </button>
                </div>
            )}
        </div>
    );
}

// --- GESTÃO DE USUÁRIOS ---
function UserManagement({ userProfile }) {
    const [view, setView] = useState('list');
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [filterRole, setFilterRole] = useState('all');
    const [form, setForm] = useState({ name: '', email: '', cpf: '', role: 'student', password: '', active: true });
    const [editing, setEditing] = useState(null);
    
    // NOVOS ESTADOS PARA PAGINAÇÃO
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const { addToast } = useToast();
    const { confirm } = useDialog();

    // Mesma lógica inteligente do Histórico
    const formatSearchTerm = (text) => {
		if (!text) return '';
		
		// 1. Busca Exata (Aspas)
		if (text.startsWith('"') && text.endsWith('"') && text.length > 2) {
			return text.slice(1, -1);
		}

		const trimmed = text.trim();
		// 2. Busca Inteligente
		if (/\d/.test(trimmed)) return trimmed.replace(/\D/g, ''); // CPF limpo
		return trimmed.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
	};

    // --- CARREGAMENTO DE USUÁRIOS (COM PAGINAÇÃO) ---
    const fetchUsers = async (searchTerm = '') => {
        setLoading(true);
        setHasMore(true); // Reseta paginação
        setLastDoc(null);
        
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const constraints = [];

            if (filterRole !== 'all') {
                constraints.push(where('role', '==', filterRole));
            }

            if (searchTerm.length > 2) {
                const term = formatSearchTerm(searchTerm);
                const isNumeric = /^\d+$/.test(term); // Verifica se sobrou só números (CPF)

                if (isNumeric) {
                    constraints.push(orderBy('cpf'));
                    constraints.push(startAt(term));
                    constraints.push(endAt(term + '\uf8ff'));
                } else {
                    constraints.push(orderBy('name'));
                    constraints.push(startAt(term));
                    constraints.push(endAt(term + '\uf8ff'));
                }
                constraints.push(limit(20));
            } else {
                constraints.push(orderBy('createdAt', 'desc'));
                constraints.push(limit(20));
            }

            const q = query(usersRef, ...constraints);
            const snapshot = await getDocs(q);
            
            setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            
            // Se veio menos que o limite, acabou a lista
            if (snapshot.docs.length < 20) setHasMore(false);
            
            // Se for busca, desativa o "carregar mais" para simplificar (resultados focados)
            if (searchTerm.length > 2) setHasMore(false);

        } catch (error) {
            console.error("Erro usuários:", error);
            if (error.code === 'failed-precondition') addToast('Falta índice no Firebase.', 'info');
        } finally {
            setLoading(false);
        }
    };

    // --- FUNÇÃO CARREGAR MAIS ---
    const loadMore = async () => {
        if (!lastDoc || loadingMore) return;
        setLoadingMore(true);
        try {
            const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users_directory');
            const constraints = [];
            
            if (filterRole !== 'all') constraints.push(where('role', '==', filterRole));
            
            constraints.push(orderBy('createdAt', 'desc'));
            constraints.push(startAfter(lastDoc));
            constraints.push(limit(20));

            const q = query(usersRef, ...constraints);
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const newUsers = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
                setUsers(prev => [...prev, ...newUsers]);
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
                if (snapshot.docs.length < 20) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (e) { console.error(e); }
        setLoadingMore(false);
    };

    // Debounce da busca
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, filterRole]);

    const saveUser = async (e) => {
        e.preventDefault();
        try {
            if (editing) {
                // Validação de itens pendentes
                if (!form.active) {
                    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('studentId', '==', editing.uid), where('status', '!=', 'retirado'));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        addToast(`Não é possível inativar. Usuário tem itens pendentes.`, 'error');
                        return;
                    }
                }

                const updates = { name: form.name, email: form.email, cpf: form.cpf, role: form.role, active: form.active };
                await updateDoc(doc(db, 'artifacts', appId, 'users', editing.uid, 'profile', 'data'), updates);
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', editing.uid), updates);
                addToast('Dados atualizados!', 'success');
            } else {
                const secondaryApp = initializeApp(JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : JSON.stringify(firebaseConfig)), "Secondary");
                const secondaryAuth = getAuth(secondaryApp);
                const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
                
                const data = { 
                    name: form.name, 
                    email: form.email, 
                    cpf: form.cpf, 
                    role: form.role, 
                    active: true, 
                    createdAt: serverTimestamp() 
                };
                
                await setDoc(doc(db, 'artifacts', appId, 'users', cred.user.uid, 'profile', 'data'), data);
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', cred.user.uid), data);
                await signOut(secondaryAuth);
                addToast('Usuário criado!', 'success');
            }
            setView('list'); setEditing(null); setForm({ name: '', email: '', cpf: '', role: 'student', password: '', active: true });
            fetchUsers(search); 
        } catch(e) { addToast(translateFirebaseError(e), 'error'); }
    };

    const handleDelete = async (u) => {
        if (u.uid === userProfile.uid) { addToast('Não pode excluir a si mesmo.', 'error'); return; }
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'items'), where('studentId', '==', u.uid), limit(1));
        const snap = await getDocs(q);
        const hasPending = snap.docs.some(d => d.data().status !== 'retirado');

        if (hasPending) {
            addToast(`Não é possível excluir. Usuário possui itens no histórico.`, 'error');
            return;
        }

        if(!await confirm({ title: 'Desativar Usuário', message: `Deseja realmente excluir/desativar ${u.name}?`, isDestructive: true })) return;
        
        await updateDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), { active: false });
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users_directory', u.uid), { active: false });
        
        addToast('Usuário desativado.', 'success');
        fetchUsers(search);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-bold text-xl text-[#021D34] w-full md:w-auto">Gestão de Usuários</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => { setView('list'); setEditing(null); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold ${view === 'list' ? 'bg-[#021D34] text-white' : 'bg-white border'}`}>Listar</button>
                    <button onClick={() => { setView('form'); setEditing(null); setForm({ name: '', email: '', cpf: '', role: 'student', password: '', active: true }); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold ${view === 'form' ? 'bg-[#021D34] text-white' : 'bg-white border'}`}>Novo Cadastro</button>
                </div>
            </div>

            {view === 'list' ? (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                         <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                            <input className="w-full pl-10 p-2 border rounded-lg outline-none focus:border-[#009DE0]" 
                                placeholder="Buscar por nome ou CPF..." 
                                value={search} 
                                onChange={e => setSearch(e.target.value)}
                            />
                            {loading && <div className="absolute right-3 top-2.5 w-4 h-4 border-2 border-[#009DE0] border-t-transparent rounded-full animate-spin"/>}
                         </div>
                         <select className="p-2 border rounded-lg bg-white w-full md:w-auto" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                            <option value="all">Todos os Perfis</option>
                            <option value="student">Alunos</option>
                            <option value="tech">Técnicos</option>
                            <option value="admin">Administradores</option>
                         </select>
                    </div>
                    
                    {search.length > 2 && <div className="text-xs text-slate-400 px-2 mb-2">Buscando por: <span className="font-bold">"{formatSearchTerm(search)}"</span></div>}
                    
                    <DataTable 
                        columns={[
                            { key: 'name', label: 'Nome', sortable: true, render: (u) => <div><p className="font-medium text-[#021D34]">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div> },
                            { key: 'cpf', label: 'CPF', render: (u) => maskCPF(u.cpf) },
                            { key: 'role', label: 'Perfil', sortable: true, render: (u) => <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='tech'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{ROLE_LABELS[u.role] || u.role}</span> },
                            { key: 'active', label: 'Status', render: (u) => <span className={`text-xs font-bold px-2 py-1 rounded ${u.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active !== false ? 'Ativo' : 'Inativo'}</span> }
                        ]}
                        data={users} 
                        emptyMsg={loading ? 'Buscando...' : 'Nenhum usuário encontrado.'}
                        mobileRender={(u) => (
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-[#021D34]">{u.name}</h4>
                                    <p className="text-xs text-slate-500 mb-1">{u.email}</p>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='tech'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{ROLE_LABELS[u.role] || u.role}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${u.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.active !== false ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        actions={(u) => {
                            const canEdit = userProfile.role === 'admin' || (userProfile.role === 'tech' && u.role === 'student');
                            const canDelete = userProfile.role === 'admin';
                            if (!canEdit && !canDelete) return null;
                            return (
                                <div className="flex gap-2">
                                    {canEdit && <button onClick={() => { setEditing(u); setForm({...u, password:''}); setView('form'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded bg-slate-50 border border-blue-100"><Edit2 size={16}/></button>}
                                    {canDelete && <button onClick={() => handleDelete(u)} className="p-2 text-red-600 hover:bg-red-50 rounded bg-slate-50 border border-red-100"><Trash2 size={16}/></button>}
                                </div>
                            );
                        }}
                    />

                    {/* BOTÃO CARREGAR MAIS */}
                    {!loading && hasMore && search.length <= 2 && (
                        <div className="flex justify-center pt-4">
                            <button onClick={loadMore} disabled={loadingMore} className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50">
                                {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                                {loadingMore ? 'Buscando...' : 'Ver Mais Usuários'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-8 rounded-xl border border-slate-200 max-w-2xl mx-auto shadow-sm">
                    <h3 className="font-bold text-lg mb-6 border-b pb-2">{editing ? 'Editar Usuário' : 'Cadastrar Novo'}</h3>
                    <form onSubmit={saveUser} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 mb-1 block">Nome</label><input className="w-full p-3 border rounded-lg" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/></div>
                            <div><label className="text-xs font-bold text-slate-500 mb-1 block">CPF</label><input className="w-full p-3 border rounded-lg" value={maskCPF(form.cpf)} onChange={e => setForm({...form, cpf: e.target.value.replace(/\D/g,'')})} maxLength={14} required/></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 mb-1 block">Email</label><input type="email" className={`w-full p-3 border rounded-lg ${editing ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editing}/></div>
                            {!editing && <div><label className="text-xs font-bold text-slate-500 mb-1 block">Senha Inicial</label><input type="password" className="w-full p-3 border rounded-lg" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required/></div>}
                        </div>
                        <div className="bg-slate-50 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Função</label>
                                <select className="w-full p-2 border rounded bg-white" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                                    <option value="student">Aluno</option>
                                    {userProfile.role === 'admin' && <><option value="tech">Técnico</option><option value="admin">Administrador</option></>}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer mt-0 md:mt-5">
                                <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} className="rounded text-[#009DE0] focus:ring-[#009DE0]"/>
                                <span className="font-bold text-sm">Conta Ativa</span>
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={()=>setView('list')} className="flex-1 border p-4 rounded-lg font-bold hover:bg-slate-50">Cancelar</button>
                            <button className="flex-1 bg-[#021D34] text-white p-4 rounded-lg font-bold hover:bg-[#009DE0] transition-colors">{editing ? 'Salvar Alterações' : 'Criar Conta'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

// --- ADMIN PANEL ---
function AdminPanel({ userProfile }) {
    const [activeTab, setActiveTab] = useState('logs');
    const [logsVisited, setLogsVisited] = useState(false);

    // Só marca como visitado para carregar se estivermos na aba logs 
    // (O MainLayout já cuida de exibir ou não o componente inteiro)
    useEffect(() => {
        if (activeTab === 'logs' && !logsVisited) {
            setLogsVisited(true);
        }
    }, [activeTab]);

    const tabs = [
		{ id: 'logs', label: 'Auditoria', icon: FileText },
		{ id: 'data', label: 'Backup', icon: Database },
		{ id: 'labels', label: 'Etiquetas', icon: Settings2 },
		{ id: 'materials', label: 'Materiais', icon: PackagePlus },
        { id: 'announcements', label: 'Recados', icon: Bell }
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[#021D34]">Painel Administrativo</h2>
            
            {/* Navegação Mobile */}
            <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
                 {tabs.map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id)} 
                        className={`p-3 text-sm font-bold rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${activeTab === t.id ? 'bg-[#009DE0] text-white border-[#009DE0] shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                        <t.icon size={20}/> 
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Navegação Desktop */}
            <div className="hidden md:flex gap-2 border-b border-slate-200 overflow-x-auto pb-1 no-scrollbar">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 md:px-6 py-3 text-sm font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'border-[#009DE0] text-[#009DE0] bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <t.icon size={16}/> {t.label}
                    </button>
                ))}
            </div>
            
            <div className="bg-white p-4 md:p-6 rounded-b-xl md:rounded-tr-xl border border-slate-200 md:border-t-0 shadow-sm min-h-[400px] rounded-xl md:rounded-tl-none">
                {activeTab === 'announcements' && <AdminAnnouncements />}
                {activeTab === 'materials' && <AdminMaterials />}
				{activeTab === 'labels' && <AdminLabels />}
                {activeTab === 'data' && <AdminData />}
                
                {/* Mantém o componente montado mesmo quando oculto */}
                <div style={{ display: activeTab === 'logs' ? 'block' : 'none' }}>
                    {logsVisited && <AdminLogs />}
                </div>
            </div>
        </div>
    );
}

// --- ADMIN LABELS (VERSÃO RESPONSIVA MOBILE) ---
function AdminLabels() {
    const [settings, setSettings] = useState({
        width: 50, height: 30, margin: 2, orientation: 'landscape',
        codeType: 'barcode', autoSize: false,
        rotation: 0, mirror: false,
        showLogo: true, showTitle: true, showDate: true, showStudent: true, showType: true
    });
    const { addToast } = useToast();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings_labels', 'config');

    // Estado para detectar tamanho da tela
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        getDoc(docRef).then(s => {
            if (s.exists()) setSettings(prev => ({...prev, ...s.data()}));
        });

        // Listener para redimensionamento
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const save = async () => {
        try {
            await setDoc(docRef, settings, { merge: true });
            addToast('Configurações salvas!', 'success');
        } catch(e) { addToast('Erro ao salvar.', 'error'); }
    };

    const toggle = (key) => setSettings(p => ({...p, [key]: !p[key]}));

    // --- CÁLCULO VISUAL DO PREVIEW RESPONSIVO ---
    
    // NOVO: Zoom adaptativo. 1.5x no Desktop, 0.9x no Mobile
    const ZOOM = isMobile ? 0.9 : 1.5;
    
    const isRotated90 = settings.rotation === 90 || settings.rotation === 270;
    
    // Dimensões base
    const autoHeightEstimate = settings.codeType === 'qrcode' ? 55 : 35;
    const baseWidth = settings.autoSize ? 50 : (settings.orientation === 'portrait' ? settings.height : settings.width);
    const baseHeight = settings.autoSize ? autoHeightEstimate : (settings.orientation === 'portrait' ? settings.width : settings.height);
    
    // Dimensões Visuais
    const visualHeight = isRotated90 ? baseWidth : baseHeight;
    const visualWidth = isRotated90 ? baseHeight : baseWidth;

    // Margens Dinâmicas (Ajustadas com o novo ZOOM)
    const marginBottom = (visualHeight * ZOOM * 0.5) + (isMobile ? 20 : 30);
    const overlapTop = isRotated90 ? (visualHeight - visualWidth) / 2 : 0;
    const marginTop = Math.max(0, overlapTop * ZOOM) + (isMobile ? 10 : 20);

    // Fontes do Preview
    const fontSizeBody = settings.autoSize ? '12px' : '5px'; 
    const fontSizeDate = settings.autoSize ? '10px' : '4px';
    const fontSizeTitleMain = settings.autoSize ? '11px' : '5px';
    const fontSizeTitleSub = settings.autoSize ? '8px' : '3px';
    const logoHeight = settings.autoSize ? '18px' : '8px';

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-[#021D34] mb-4 flex items-center gap-2"><Settings2 size={20}/> Dimensões & Layout</h3>
                    
                    {/* Switch Tamanho Automático */}
                    <div className="mb-6 bg-white p-3 rounded-lg border border-slate-200">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <span className="font-bold text-sm text-[#021D34] block">Tamanho Automático</span>
                                <span className="text-xs text-slate-500">Impressora define o tamanho</span>
                            </div>
                            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.autoSize ? 'bg-[#009DE0]' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.autoSize ? 'translate-x-6' : 'translate-x-0'}`} />
                                <input type="checkbox" checked={settings.autoSize} onChange={() => toggle('autoSize')} className="hidden" />
                            </div>
                        </label>
                    </div>

                    {/* Inputs de Dimensão */}
                    <div className={`grid grid-cols-2 gap-4 mb-4 transition-opacity ${settings.autoSize ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <div><label className="text-xs font-bold text-slate-500">Largura (mm)</label><input type="number" className="w-full p-2 border rounded" value={settings.width} onChange={e=>setSettings({...settings, width: Number(e.target.value)})}/></div>
                        <div><label className="text-xs font-bold text-slate-500">Altura (mm)</label><input type="number" className="w-full p-2 border rounded" value={settings.height} onChange={e=>setSettings({...settings, height: Number(e.target.value)})}/></div>
                        <div><label className="text-xs font-bold text-slate-500">Margem (mm)</label><input type="number" className="w-full p-2 border rounded" value={settings.margin} onChange={e=>setSettings({...settings, margin: Number(e.target.value)})}/></div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Orientação</label>
                            <select className="w-full p-2 border rounded bg-white" value={settings.orientation} onChange={e=>setSettings({...settings, orientation: e.target.value})}>
                                <option value="landscape">Paisagem (H)</option>
                                <option value="portrait">Retrato (V)</option>
                            </select>
                        </div>
                    </div>

                    {/* Transformações */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                        <label className="text-xs font-bold text-slate-500 block mb-2">Transformações</label>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Rotação</span>
                                <div className="flex border rounded-lg overflow-hidden bg-white">
                                    {[0, 90, 180, 270].map(deg => (
                                        <button key={deg} onClick={() => setSettings({...settings, rotation: deg})} className={`flex-1 py-2 text-xs font-bold transition-colors ${settings.rotation === deg ? 'bg-[#009DE0] text-white' : 'hover:bg-slate-50 text-slate-600'}`}>{deg}°</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Espelhar</span>
                                <button onClick={() => toggle('mirror')} className={`h-[34px] px-4 rounded-lg border flex items-center gap-2 text-xs font-bold transition-all ${settings.mirror ? 'bg-[#009DE0] text-white border-[#009DE0]' : 'bg-white text-slate-600 hover:bg-slate-50'}`}><FlipHorizontal size={16}/> {settings.mirror ? 'Sim' : 'Não'}</button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Tipo de Código */}
                    <div className="space-y-3 pt-4 border-t border-slate-200 mt-4">
                        <label className="text-xs font-bold text-slate-500 block mb-2">Formato do Código</label>
                        <div className="flex gap-2">
                            <button onClick={()=>setSettings({...settings, codeType: 'barcode'})} className={`flex-1 py-2 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 ${settings.codeType === 'barcode' ? 'bg-[#009DE0] text-white border-[#009DE0]' : 'bg-white text-slate-600'}`}><ScanBarcode size={18}/> Barcode</button>
                            <button onClick={()=>setSettings({...settings, codeType: 'qrcode'})} className={`flex-1 py-2 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 ${settings.codeType === 'qrcode' ? 'bg-[#009DE0] text-white border-[#009DE0]' : 'bg-white text-slate-600'}`}><ScanLine size={18}/> QR Code</button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-[#021D34] mb-4 flex items-center gap-2"><Eye size={20}/> Visibilidade</h3>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                        <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded border hover:border-blue-300"><span className="text-xs font-bold uppercase text-slate-600">Logo</span><input type="checkbox" checked={settings.showLogo} onChange={()=>toggle('showLogo')} className="accent-[#009DE0]"/></label>
                        <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded border hover:border-blue-300"><span className="text-xs font-bold uppercase text-slate-600">Título</span><input type="checkbox" checked={settings.showTitle} onChange={()=>toggle('showTitle')} className="accent-[#009DE0]"/></label>
                        <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded border hover:border-blue-300"><span className="text-xs font-bold uppercase text-slate-600">Data</span><input type="checkbox" checked={settings.showDate} onChange={()=>toggle('showDate')} className="accent-[#009DE0]"/></label>
                        <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded border hover:border-blue-300"><span className="text-xs font-bold uppercase text-slate-600">Nome</span><input type="checkbox" checked={settings.showStudent} onChange={()=>toggle('showStudent')} className="accent-[#009DE0]"/></label>
                        <label className="flex items-center justify-between cursor-pointer bg-white p-3 rounded border hover:border-blue-300"><span className="text-xs font-bold uppercase text-slate-600">Tipo</span><input type="checkbox" checked={settings.showType} onChange={()=>toggle('showType')} className="accent-[#009DE0]"/></label>
                    </div>
                </div>

                <button onClick={save} className="w-full bg-[#021D34] text-white py-4 rounded-xl font-bold hover:bg-[#009DE0] transition-colors shadow-lg shadow-blue-900/20">Salvar Configurações</button>
            </div>

            {/* PREVIEW CONTAINER: Padding reduzido no mobile (p-4 vs p-8) e Overflow controlado */}
            <div className="bg-slate-100 p-4 md:p-8 rounded-xl border border-slate-300 flex flex-col items-center justify-start sticky top-6 h-fit min-h-[500px] overflow-hidden">
                <h3 className="font-bold text-slate-500 mb-6 uppercase tracking-wider text-sm flex items-center gap-2 relative z-20">
                    {settings.autoSize ? 'Pré-visualização (Auto)' : 'Pré-visualização (Real)'}
                </h3>
                
                {/* SIMULADOR VISUAL DA ETIQUETA */}
                <div 
                    className="bg-white shadow-2xl flex flex-col justify-between overflow-hidden relative transition-all duration-300 z-10"
                    style={{
                        width: `${baseWidth}mm`,
                        height: settings.autoSize ? 'auto' : `${baseHeight}mm`,
                        minHeight: settings.autoSize ? '30mm' : '0',
                        padding: `${settings.margin}mm`,
                        border: settings.autoSize ? '2px dashed #94a3b8' : '1px solid #e2e8f0',
                        
                        // TRANSFORMAÇÕES
                        transform: `scale(${ZOOM}) rotate(${settings.rotation}deg) scaleX(${settings.mirror ? -1 : 1})`,
                        transformOrigin: 'center center',
                        
                        // MARGENS RESPONSIVAS
                        marginBottom: `${marginBottom}mm`,
                        marginTop: `${marginTop}mm`
                    }}
                >
                    <div className="flex justify-between items-center border-b border-black pb-1 mb-1" style={{height: 'auto'}}>
                        <div className="flex items-center gap-1">
                            {settings.showLogo && <img src={LOGOS.color} style={{height: logoHeight, width: 'auto'}} alt="logo"/>}
                            {settings.showTitle && <div className="flex flex-col leading-none"><span style={{fontSize: fontSizeTitleMain, fontWeight: 900}}>UNILAVRAS</span><span style={{fontSize: fontSizeTitleSub, fontWeight: 'bold'}}>ESTERILIZAÇÃO</span></div>}
                        </div>
                        {settings.showDate && <span style={{fontSize: fontSizeDate, fontWeight: 'bold'}}>04/12/25</span>}
                    </div>

                    <div className="flex-1 flex items-center justify-center overflow-hidden py-1">
                        {settings.codeType === 'qrcode' 
                            ? <QRCodeComponent value="TESTE123" />
                            : <Barcode value="TESTE123" />
                        }
                    </div>

                    <div className="border-t border-black pt-1 flex flex-col justify-center" style={{height: 'auto'}}>
                        {settings.showStudent && <div className="flex justify-between items-baseline leading-none" style={{fontSize: fontSizeBody}}><span className="font-bold">ALUNO:</span><span className="font-bold truncate">JOAO CESAR</span></div>}
                        {settings.showType && <div className="flex justify-between items-baseline leading-none mt-0.5" style={{fontSize: fontSizeBody}}><span className="font-bold">MAT:</span><span className="font-bold truncate">KIT CLINICO</span></div>}
                    </div>
                </div>

                <div className="text-center space-y-2 relative z-10 w-full max-w-xs">
                    <p className="text-xs text-slate-400 mx-auto mt-4">
                        {settings.autoSize 
                            ? "Modo Automático: Ajuste dinâmico." 
                            : "Modo Manual: Tamanho fixo."
                        }
                    </p>
                    <div className="flex flex-col gap-1 mt-2">
                        {settings.rotation > 0 && <p className="text-xs text-[#009DE0] font-bold flex items-center justify-center gap-1"><RotateCw size={12}/> Rotacionado {settings.rotation}°</p>}
                        {settings.mirror && <p className="text-xs text-purple-600 font-bold flex items-center justify-center gap-1"><FlipHorizontal size={12}/> Modo Espelho</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AdminLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [searchText, setSearchText] = useState('');
    
    // 1. NOVO: Estado que serve apenas como "gatilho" para recarregar
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 2. ALTERADO: O useEffect agora vigia o [refreshTrigger]
    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            try {
                // Limpa estados anteriores para garantir uma lista fresca
                setHasMore(true); 
                
                const q = query(
                    collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), 
                    orderBy('timestamp', 'desc'), 
                    limit(50)
                );
                const s = await getDocs(q);
                
                setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })));
                setLastDoc(s.docs[s.docs.length - 1]);
                if (s.docs.length < 50) setHasMore(false);
            } catch (error) {
                console.error("Erro ao carregar logs:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitial();
    }, [refreshTrigger]); // <--- AQUI ESTÁ O SEGREDO: Roda sempre que o número mudar

    // Função Carregar Mais (Paginação)
    const loadMore = async () => {
        if (!lastDoc) return;
        setLoadingMore(true);
        try {
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'system_logs'), 
                orderBy('timestamp', 'desc'), 
                startAfter(lastDoc),
                limit(50)
            );
            const s = await getDocs(q);
            
            if (!s.empty) {
                const newLogs = s.docs.map(d => ({ id: d.id, ...d.data() }));
                setLogs(prev => [...prev, ...newLogs]);
                setLastDoc(s.docs[s.docs.length - 1]);
                if (s.docs.length < 50) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Erro ao carregar mais logs:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Filtro no Front-end
    const filteredLogs = logs.filter(l => {
        const matchesType = filterType === 'all' || l.type === filterType;
        const matchesText = searchText === '' || 
            (l.message && l.message.toLowerCase().includes(searchText.toLowerCase())) ||
            (l.userName && l.userName.toLowerCase().includes(searchText.toLowerCase())) ||
            (l.type && l.type.toLowerCase().includes(searchText.toLowerCase()));
        return matchesType && matchesText;
    });

    // 3. Função do Botão de Atualizar
    const handleRefresh = () => {
        setLogs([]); // Limpa visualmente para dar feedback
        setLastDoc(null);
        setRefreshTrigger(prev => prev + 1); // Muda o número, forçando o useEffect a rodar
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"/>
                        <input 
                            className="w-full pl-10 p-2 border rounded-lg text-sm focus:border-[#009DE0] outline-none" 
                            placeholder="Filtrar nos logs carregados..." 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>
                    {/* Botão de Atualizar Manual */}
                    <button 
                        onClick={handleRefresh} 
                        className="p-2 border rounded-lg hover:bg-slate-50 text-slate-500 active:scale-95 transition-transform"
                        title="Atualizar Lista Agora"
                    >
                        <RotateCw size={18}/>
                    </button>
                </div>
                <select 
                    className="p-2 border rounded-lg text-sm bg-white outline-none w-full md:w-auto" 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="all">Todos os Tipos</option>
                    {Object.keys(LOG_TYPES).map(t => (
                        <option key={t} value={t}>{LOG_TYPES[t]}</option>
                    ))}
                </select>
            </div>

            <DataTable 
                columns={[
                    { key: 'timestamp', label: 'Data/Hora', sortable: true, render: (l) => formatDate(l.timestamp) },
                    { key: 'type', label: 'Tipo', sortable: true, render: (l) => <span className={`text-[10px] font-bold px-2 py-1 rounded border ${LOG_COLORS[l.type] || 'bg-slate-100'}`}>{LOG_TYPES[l.type] || l.type}</span> },
                    { key: 'message', label: 'Descrição', sortable: true },
                    { key: 'userName', label: 'Usuário', sortable: true }
                ]}
                data={filteredLogs}
                mobileRender={(l) => (
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-400">{formatDate(l.timestamp)}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${LOG_COLORS[l.type] || 'bg-slate-100'}`}>{LOG_TYPES[l.type] || l.type}</span>
                        </div>
                        <p className="text-sm text-slate-800 font-medium">{l.message}</p>
                        <p className="text-xs text-slate-500">Por: {l.userName}</p>
                    </div>
                )}
                emptyMsg={loading ? 'Carregando auditoria...' : 'Nenhum log encontrado.'}
            />

            {/* Botão Carregar Mais */}
            {!loading && hasMore && filteredLogs.length > 0 && (
                <div className="flex justify-center pt-2">
                    <button 
                        onClick={loadMore} 
                        disabled={loadingMore}
                        className="bg-white border border-slate-300 text-slate-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-slate-50 hover:text-[#009DE0] hover:border-[#009DE0] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {loadingMore ? <Loader2 className="animate-spin w-4 h-4"/> : <ArrowDown size={16}/>}
                        {loadingMore ? 'Buscando...' : 'Carregar logs mais antigos'}
                    </button>
                </div>
            )}
            
            {!loading && !hasMore && logs.length > 0 && (
                <p className="text-center text-xs text-slate-400 pt-2">Todos os registros foram carregados.</p>
            )}
        </div>
    );
}

function AdminAnnouncements() {
    const [anns, setAnns] = useState([]);
    const [form, setForm] = useState({ title: '', content: '', imageUrl: '', validFrom: '', validUntil: '' });
    const [editingId, setEditingId] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const { addToast } = useToast();
    const { confirm } = useDialog();

	useEffect(() => {
		const q = query(
			collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), 
			orderBy('createdAt', 'desc'),
			limit(20) // Limite de 20
		);
		const unsub = onSnapshot(q, s => setAnns(s.docs.map(d => ({id: d.id, ...d.data()}))));
		return () => unsub();
	}, []);

    const save = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'announcements', editingId), { 
                    ...form, 
                    updatedAt: serverTimestamp() 
                });
                addToast('Recado atualizado!', 'success');
                setEditingId(null);
            } else {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'announcements'), { 
                    ...form, 
                    createdAt: serverTimestamp() 
                });
                addToast('Recado publicado!', 'success');
            }
            setForm({ title: '', content: '', imageUrl: '', validFrom: '', validUntil: '' });
        } catch (error) {
            console.error(error);
            addToast('Erro ao salvar recado.', 'error');
        }
    };

    const handleEdit = (item) => {
        setForm({
            title: item.title,
            content: item.content,
            imageUrl: item.imageUrl || '',
            validFrom: item.validFrom || '',
            validUntil: item.validUntil || ''
        });
        setEditingId(item.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const remove = async (id) => {
        if(await confirm({ title: 'Excluir Recado', message: 'Tem certeza que deseja apagar este recado?', isDestructive: true })) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'announcements', id));
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setForm({ title: '', content: '', imageUrl: '', validFrom: '', validUntil: '' });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {previewItem && (
                <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setPreviewItem(null)}>
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-[#021D34]">Pré-visualização</h3>
                            <button onClick={() => setPreviewItem(null)} className="p-1 hover:bg-slate-100 rounded"><X size={20}/></button>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            {previewItem.imageUrl ? (
                                <div className="h-32 overflow-hidden relative">
                                    <img src={previewItem.imageUrl} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                                    <span className="absolute bottom-2 left-3 text-white text-xs font-bold bg-[#009DE0] px-2 py-0.5 rounded shadow">Comunicado</span>
                                </div>
                            ) : (
                                <div className="h-2 bg-[#009DE0] w-full"/>
                            )}
                            <div className="p-5">
                                <h4 className="font-bold text-[#021D34] text-lg mb-2">{previewItem.title}</h4>
                                <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{previewItem.content}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={save} className="space-y-4 border-r-0 md:border-r md:pr-6 border-slate-100 order-last md:order-first">
                <div className="flex justify-between items-center md:hidden">
                    <h4 className="font-bold text-[#021D34]">{editingId ? 'Editar Recado' : 'Novo Recado'}</h4>
                    {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-red-500">Cancelar</button>}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Título</label>
                    <input className="w-full p-3 border rounded-lg text-sm" placeholder="Título do Aviso" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required/>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Mensagem</label>
                    <textarea className="w-full p-3 border rounded-lg text-sm h-32" placeholder="Conteúdo do recado..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} required/>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">URL da Imagem (Opcional)</label>
                    <input className="w-full p-3 border rounded-lg text-sm" placeholder="https://..." value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Início da Exibição</label>
                        <input type="datetime-local" className="w-full p-3 border rounded-lg text-xs" value={form.validFrom} onChange={e => setForm({...form, validFrom: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">Fim da Exibição</label>
                        <input type="datetime-local" className="w-full p-3 border rounded-lg text-xs" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})}/>
                    </div>
                </div>
                <div className="flex gap-2 pt-2">
                    {editingId && (
                        <button type="button" onClick={cancelEdit} className="flex-1 bg-slate-100 text-slate-600 p-3 rounded-lg font-bold">Cancelar</button>
                    )}
                    <button className="flex-1 bg-[#021D34] text-white p-3 rounded-lg font-bold">{editingId ? 'Salvar Alterações' : 'Publicar Recado'}</button>
                </div>
            </form>

            <div className="md:col-span-2 space-y-4">
                <h4 className="font-bold text-[#021D34] mb-2 md:hidden">Recados Existentes</h4>
                {anns.map(a => (
                    <div key={a.id} className={`flex flex-col md:flex-row justify-between items-start bg-slate-50 p-4 rounded-xl border transition-all ${editingId === a.id ? 'border-[#009DE0] ring-2 ring-blue-100' : 'border-slate-200'}`}>
                        <div className="mb-2 md:mb-0 flex-1">
                            <h4 className="font-bold text-[#009DE0]">{a.title}</h4>
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.content}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                                <CalendarClock size={12}/>
                                {a.validFrom ? new Date(a.validFrom).toLocaleString() : 'Imediato'} 
                                <ArrowRightLeft size={10} className="mx-1"/> 
                                {a.validUntil ? new Date(a.validUntil).toLocaleString() : 'Indefinido'}
                            </div>
                        </div>
                        <div className="flex gap-1 self-end md:self-start ml-4">
                            <button onClick={() => setPreviewItem(a)} className="text-slate-400 hover:text-[#009DE0] p-2 hover:bg-white rounded-lg transition-colors" title="Pré-visualizar">
                                <Eye size={16}/>
                            </button>
                            <button onClick={() => handleEdit(a)} className="text-blue-400 hover:text-blue-600 p-2 hover:bg-white rounded-lg transition-colors" title="Editar">
                                <Edit2 size={16}/>
                            </button>
                            <button onClick={() => remove(a.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-white rounded-lg transition-colors" title="Excluir">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
                {anns.length === 0 && <p className="text-center text-slate-400 py-4">Nenhum recado publicado.</p>}
            </div>
        </div>
    );
}

function AdminMaterials() {
    const [mats, setMats] = useState([]);
    const [name, setName] = useState('');
    const [search, setSearch] = useState(''); // ALTERAÇÃO: Estado para busca
    const { addToast } = useToast();
    const { confirm } = useDialog();

    useEffect(() => onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), s => setMats(s.docs.map(d => ({id: d.id, ...d.data()})))), []);

    const add = async () => {
        if (!name) return;
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'materialTypes'), { name });
        setName('');
        addToast('Tipo adicionado!', 'success');
    };

    const remove = async (id) => {
        if(await confirm({ title: 'Remover Tipo', message: 'Deseja remover este tipo de material?', isDestructive: true })) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'materialTypes', id));
        }
    };

    // ALTERAÇÃO: Filtragem e ordenação
    const filteredAndSortedMats = useMemo(() => {
        return mats
            .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [mats, search]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            
            {/* ALTERAÇÃO: Adição de campo de busca */}
            <div className="flex flex-col md:flex-row gap-4">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/>
                    <input 
                        className="w-full pl-10 p-3 border rounded-lg text-sm outline-none focus:border-[#009DE0]" 
                        placeholder="Pesquisar material..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)}
                    />
                 </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
                <input className="flex-1 p-3 border rounded-lg" placeholder="Nome do Novo Material (ex: Kit Ortodontia)" value={name} onChange={e => setName(e.target.value)}/>
                <button onClick={add} className="bg-[#021D34] text-white px-6 py-3 rounded-lg font-bold w-full md:w-auto">Adicionar</button>
            </div>
            
            <DataTable 
                columns={[{ key: 'name', label: 'Nome do Material', sortable: true }]}
                data={filteredAndSortedMats} // ALTERAÇÃO: Usando lista filtrada e ordenada
                emptyMsg="Nenhum material encontrado."
                mobileRender={(m) => <div className="font-medium text-[#021D34]">{m.name}</div>}
                actions={(m) => (
                    <button onClick={() => remove(m.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                )}
            />
        </div>
    );
}

function AdminData() {
    const [purgeDate, setPurgeDate] = useState('');
    const { addToast } = useToast();
    const { confirm } = useDialog();
    const [loading, setLoading] = useState(false);

    // Função auxiliar para ressuscitar Timestamps do JSON
    const reviveTimestamps = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (obj.type === 'firestore/timestamp/1.0' || (obj.seconds !== undefined && obj.nanoseconds !== undefined)) {
            return new Timestamp(obj.seconds, obj.nanoseconds);
        }
        if (Array.isArray(obj)) return obj.map(reviveTimestamps);
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, reviveTimestamps(v)]));
    };

    const backup = async () => {
        setLoading(true);
        try {
            const collections = ['items', 'materialTypes', 'announcements', 'users_directory', 'system_logs'];
            const data = {};
            
            // 1. Backup das Coleções Públicas
            for (const c of collections) {
                const s = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', c));
                data[c] = s.docs.map(d => ({id: d.id, ...d.data()}));
            }
            
            // 2. Backup dos Perfis Privados (CRUCIAL PARA LOGIN)
            const userDir = data['users_directory'] || [];
            const profiles = [];
            for (const user of userDir) {
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.id, 'profile', 'data'));
                    if (snap.exists()) {
                        profiles.push({ uid: user.id, ...snap.data() });
                    }
                } catch(e) { console.warn(`Falha ao pegar perfil de ${user.id}`, e); }
            }
            data['user_profiles_backup'] = profiles;

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `backup_completo_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            addToast('Backup COMPLETO gerado com sucesso!', 'success');
        } catch(e) { addToast('Erro ao gerar backup: ' + e.message, 'error'); }
        setLoading(false);
    };

    const restore = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        if(!await confirm({ title: 'Restaurar Backup', message: 'ISSO IRÁ SOBRESCREVER DADOS. Se usuários foram deletados do Auth (Google), eles precisarão ser recriados manualmente. Continuar?', isDestructive: true })) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const rawData = JSON.parse(ev.target.result);
                const data = reviveTimestamps(rawData);

                const batch = writeBatch(db);
                let count = 0;
                
                for (const [key, items] of Object.entries(data)) {
                    if (key === 'user_profiles_backup') {
                        for (const profile of items) {
                            const { uid, ...pData } = profile;
                            if (uid) {
                                batch.set(doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data'), pData);
                                count++;
                            }
                        }
                    } else {
                        for (const item of items) {
                            const { id, ...rest } = item;
                            if (id) {
                                batch.set(doc(db, 'artifacts', appId, 'public', 'data', key, id), rest);
                                count++;
                            }
                        }
                    }

                    if (count >= 400) {
                        await batch.commit();
                        count = 0; 
                    }
                }
                
                if (count > 0) await batch.commit();
                
                await logEvent('DATA_OP', `Restauração de backup realizada.`);
                addToast(`Sistema restaurado com sucesso!`, 'success');
            } catch(e) { 
                console.error(e);
                addToast('Erro crítico ao restaurar: ' + e.message, 'error'); 
            }
            setLoading(false);
        };
        reader.readAsText(file);
    };

    const purge = async () => {
		if (!purgeDate) return;
		// Adiciona uma confirmação extra para segurança
		if (!await confirm({ title: 'Limpeza de Dados', message: `ATENÇÃO: Isso excluirá PERMANENTEMENTE itens criados antes de ${new Date(purgeDate).toLocaleDateString()}. Continuar?`, isDestructive: true })) return;
		
		setLoading(true);
		try {
			const date = new Date(purgeDate);
			
			// --- OTIMIZAÇÃO AQUI ---
			// Em vez de baixar tudo (collection), usamos 'query' com 'where'
			// Assim o Firebase só te cobra a leitura dos itens que realmente serão deletados
			const q = query(
				collection(db, 'artifacts', appId, 'public', 'data', 'items'),
				where('createdAt', '<', date)
			);
			
			const snap = await getDocs(q);
			
			if (snap.empty) {
				addToast('Nenhum registro encontrado para essa data.', 'info');
				setLoading(false);
				return;
			}

			const batch = writeBatch(db);
			snap.docs.forEach(d => batch.delete(d.ref));
			
			await batch.commit();
			await logEvent('DATA_OP', `Limpeza: ${snap.size} itens antigos removidos.`); // Loga a ação
			
			addToast(`${snap.size} registros antigos removidos.`, 'success');
		} catch(e) { 
			console.error(e);
			addToast('Erro na exclusão: ' + e.message, 'error'); 
		}
		setLoading(false);
	};

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                     <h3 className="font-bold text-[#021D34] flex items-center gap-2 mb-2"><Database size={20}/> Backup Completo</h3>
                     <p className="text-xs text-slate-500 mb-3">Salva todos os materiais, logs e permissões de usuários.</p>
                     <button onClick={backup} disabled={loading} className="w-full bg-[#009DE0] text-white py-3 rounded-lg font-bold flex justify-center gap-2 hover:bg-[#008bc5]">
                         <FileDown size={20}/> {loading ? 'Processando...' : 'Baixar JSON'}
                     </button>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                     <h3 className="font-bold text-[#021D34] flex items-center gap-2 mb-2"><FileUp size={20}/> Restaurar</h3>
                     <p className="text-xs text-slate-500 mb-3">Recupera o sistema a partir de um arquivo JSON.</p>
                     <label className="w-full bg-white border border-dashed border-slate-300 py-3 rounded-lg font-bold flex justify-center gap-2 text-slate-500 cursor-pointer hover:bg-slate-50">
                         Selecionar Arquivo <input type="file" accept=".json" onChange={restore} className="hidden" disabled={loading}/>
                     </label>
                 </div>
             </div>
             
             <div className="bg-red-50 p-6 rounded-xl border border-red-200">
                 <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2"><Eraser size={20}/> Limpeza</h3>
                 <p className="text-xs text-red-600 mb-3">Remove materiais antigos para liberar espaço.</p>
                 <input type="date" className="w-full p-3 border border-red-200 rounded-lg bg-white mb-4" value={purgeDate} onChange={e => setPurgeDate(e.target.value)}/>
                 <button onClick={purge} disabled={loading || !purgeDate} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
                     Confirmar Exclusão
                 </button>
             </div>
        </div>
    );
}