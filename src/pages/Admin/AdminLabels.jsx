import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Settings2, ScanBarcode, ScanLine, Eye, Type, Layout, 
  AlignLeft, AlignCenter, AlignRight, 
  FlipHorizontal, ArrowLeftRight, ArrowUpDown, Smartphone,
  Image as ImageIcon, Heading, RotateCcw
} from 'lucide-react';
import { db, appId } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import { LOGOS } from '../../constants';
import Barcode from '../../components/Barcode';
import QRCodeComponent from '../../components/QRCodeComponent';

// --- CONFIGURAÇÃO PADRÃO (CONSTANTE) ---
const DEFAULT_SETTINGS = {
    // Físico
    width: 50, height: 30, margin: 1, orientation: 'portrait',
    rotation: 0, mirror: false, autoSize: false,
    
    // Seções
    showHeader: true, showFooter: true,
    
    // Conteúdo Principal (Código)
    codeType: 'qrcode', codeSize: 100, codeX: 0, codeY: 0,
    
    // POSICIONAMENTO CABEÇALHO (GERAL)
    headerX: 0, headerY: 0, headerAlign: 'center',
    
    // --- ELEMENTOS INDIVIDUAIS ---
    // Logo
    logoSize: 45, logoX: 0, logoY: 0,
    // Título
    headerFontSize: 10, titleX: 0, titleY: 0, customTitle: 'UNILAVRAS',
    // Subtítulo
    subheaderFontSize: 6, subtitleX: 0, subtitleY: 0, customSubtitle: 'ESTERILIZAÇÃO',
    // Data
    dateFontSize: 7, dateX: 0, dateY: 0,
    
    // Rodapé
    footerX: 0, footerY: 0, footerFontSize: 8, footerAlign: 'center',
    
    // Elementos Visíveis
    showLogo: true, showTitle: true, showDate: true, showStudent: true, showType: true
};

export default function AdminLabels() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [activeTab, setActiveTab] = useState('layout'); 
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    
    const { addToast } = useToast();
    const { confirm } = useDialog();
    
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings_labels', 'config');

    // --- EFEITOS ---
    useEffect(() => {
        getDoc(docRef).then(s => { 
            if (s.exists()) setSettings(prev => ({...prev, ...s.data()})); 
        });
        
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const save = async () => {
        try { 
            await setDoc(docRef, settings, { merge: true }); 
            addToast('Configurações salvas!', 'success'); 
        } catch(e) { 
            console.error(e); 
            addToast('Erro ao salvar.', 'error'); 
        }
    };

    // --- FUNÇÃO DE RESET ---
    const resetDefaults = async () => {
        if (await confirm({ 
            title: 'Restaurar Padrões', 
            message: 'Isso apagará todas as personalizações atuais da etiqueta e voltará ao layout original. Deseja continuar?', 
            isDestructive: true 
        })) {
            setSettings(DEFAULT_SETTINGS);
            addToast('Layout restaurado para o padrão. Clique em Salvar para persistir.', 'info');
        }
    };

    // --- CÁLCULOS VISUAIS ---
    const isMobile = screenWidth < 1024;
    const isRotated90 = settings.rotation === 90 || settings.rotation === 270;
    const realWidth = settings.autoSize ? 50 : (settings.orientation === 'portrait' ? settings.height : settings.width);
    const realHeight = settings.autoSize ? (settings.codeType === 'qrcode' ? 55 : 35) : (settings.orientation === 'portrait' ? settings.width : settings.height);
    const displayWidthMM = isRotated90 ? realHeight : realWidth;
    const displayHeightMM = isRotated90 ? realWidth : realHeight;
    const contentWidthPx = displayWidthMM * 3.8;
    const mobileScale = Math.min(1, (screenWidth - 64) / contentWidthPx); 
    const ZOOM = isMobile ? mobileScale : 1.5;

    // --- ESTILOS PREVIEW ---
    const fontSizeBody = settings.autoSize ? '12px' : `${settings.footerFontSize/2}px`; 
    const fontSizeDate = settings.autoSize ? '10px' : `${settings.dateFontSize/2}px`;
    const fontSizeTitleMain = settings.autoSize ? '11px' : `${settings.headerFontSize/2}px`;
    const fontSizeTitleSub = settings.autoSize ? '8px' : `${settings.subheaderFontSize/2}px`;
    const logoHeight = settings.autoSize ? '18px' : `${(settings.logoSize/100)*8}mm`;
    
    // Transforms Individuais
    const codeStyle = { transform: `translate(${settings.codeX}mm, ${settings.codeY}mm) scale(${(settings.codeSize || 100) / 100})`, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transformOrigin: 'center center' };
    const headerStyle = { justifyContent: settings.headerAlign, minHeight: '15%', transform: `translate(${settings.headerX}mm, ${settings.headerY}mm)` };
    const footerStyle = { textAlign: settings.footerAlign, minHeight: '15%', transform: `translate(${settings.footerX}mm, ${settings.footerY}mm)` };
    
    const logoStyle = { height: logoHeight, width: 'auto', transform: `translate(${settings.logoX}mm, ${settings.logoY}mm)`, display: 'inline-block' };
    const titleStyle = { fontSize: fontSizeTitleMain, fontWeight: 900, display: 'block', transform: `translate(${settings.titleX}mm, ${settings.titleY}mm)` };
    const subtitleStyle = { fontSize: fontSizeTitleSub, fontWeight: 'bold', display: 'block', transform: `translate(${settings.subtitleX}mm, ${settings.subtitleY}mm)` };
    const dateStyle = { fontSize: fontSizeDate, fontWeight: 'bold', display: 'inline-block', transform: `translate(${settings.dateX}mm, ${settings.dateY}mm)`, marginLeft: settings.headerAlign === 'flex-start' ? 'auto' : 0, marginRight: settings.headerAlign === 'flex-end' ? 'auto' : 0 };

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full max-w-full overflow-x-hidden">
            
            {/* 1. COLUNA DE CONTROLES */}
            <div className="w-full lg:flex-1 space-y-6 order-2 lg:order-1 min-w-0">
                
                {/* Abas de Navegação */}
                <div className="flex bg-slate-200 p-1 rounded-lg w-full overflow-x-auto no-scrollbar touch-pan-x">
                    <button onClick={() => setActiveTab('layout')} className={`flex-1 min-w-[80px] px-2 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'layout' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}><Layout size={14}/> Layout</button>
                    <button onClick={() => setActiveTab('header')} className={`flex-1 min-w-[80px] px-2 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'header' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}><Type size={14}/> Cabeçalho</button>
                    <button onClick={() => setActiveTab('content')} className={`flex-1 min-w-[80px] px-2 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'content' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}><ScanBarcode size={14}/> Código</button>
                    <button onClick={() => setActiveTab('footer')} className={`flex-1 min-w-[80px] px-2 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'footer' ? 'bg-white text-[#009DE0] shadow-sm' : 'text-slate-500'}`}><AlignLeft size={14}/> Rodapé</button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
                    
                    {/* --- ABA LAYOUT --- */}
                    {activeTab === 'layout' && (
                        <div className="space-y-5 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Largura (mm)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.width} onChange={e=>setSettings({...settings, width: Number(e.target.value)})}/></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Altura (mm)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.height} onChange={e=>setSettings({...settings, height: Number(e.target.value)})}/></div>
                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Margem (mm)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.margin} onChange={e=>setSettings({...settings, margin: Number(e.target.value)})}/></div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">Orientação</label>
                                    <select className="w-full p-2 border rounded text-sm bg-white" value={settings.orientation} onChange={e=>setSettings({...settings, orientation: e.target.value})}>
                                        <option value="landscape">Paisagem</option>
                                        <option value="portrait">Retrato</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-100">
                                <label className="text-xs font-bold text-slate-500 mb-2 block">Rotação da Impressão</label>
                                <div className="flex border rounded-lg overflow-hidden bg-slate-50">
                                    {[0, 90, 180, 270].map(deg => (<button key={deg} onClick={() => setSettings({...settings, rotation: deg})} className={`flex-1 py-2 text-xs font-bold transition-colors ${settings.rotation === deg ? 'bg-[#009DE0] text-white' : 'hover:bg-slate-100 text-slate-600'}`}>{deg}°</button>))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><FlipHorizontal size={16}/> Espelhar (Mirror)</span>
                                <button onClick={() => setSettings({...settings, mirror: !settings.mirror})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.mirror ? 'bg-[#009DE0]' : 'bg-slate-300'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.mirror ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- ABA CABEÇALHO --- */}
                    {activeTab === 'header' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="text-sm font-bold text-[#021D34]">Exibir Cabeçalho</span>
                                <button onClick={() => setSettings({...settings, showHeader: !settings.showHeader})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showHeader ? 'bg-green-500' : 'bg-slate-300'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.showHeader ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className={`space-y-6 transition-opacity duration-300 ${settings.showHeader ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                
                                {/* 1. GERAL */}
                                <div className="p-3 border rounded-lg bg-slate-50/50">
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Layout size={12}/> Posição Geral do Bloco</div>
                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                        <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. X</label><span className="text-[10px] text-slate-400">{settings.headerX}mm</span></div><input type="range" min="-15" max="15" className="w-full accent-[#009DE0]" value={settings.headerX} onChange={e => setSettings({...settings, headerX: Number(e.target.value)})}/></div>
                                        <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. Y</label><span className="text-[10px] text-slate-400">{settings.headerY}mm</span></div><input type="range" min="-15" max="15" className="w-full accent-[#009DE0]" value={settings.headerY} onChange={e => setSettings({...settings, headerY: Number(e.target.value)})}/></div>
                                    </div>
                                    <div className="flex border rounded overflow-hidden bg-white">
                                        <button onClick={()=>setSettings({...settings, headerAlign: 'flex-start'})} className={`flex-1 py-1.5 flex justify-center ${settings.headerAlign === 'flex-start' ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}><AlignLeft size={14}/></button>
                                        <button onClick={()=>setSettings({...settings, headerAlign: 'center'})} className={`flex-1 py-1.5 flex justify-center ${settings.headerAlign === 'center' ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}><AlignCenter size={14}/></button>
                                        <button onClick={()=>setSettings({...settings, headerAlign: 'flex-end'})} className={`flex-1 py-1.5 flex justify-center ${settings.headerAlign === 'flex-end' ? 'bg-[#009DE0] text-white' : 'text-slate-400'}`}><AlignRight size={14}/></button>
                                    </div>
                                </div>

                                {/* 2. LOGO */}
                                {settings.showLogo && (
                                    <div className="p-3 border rounded-lg bg-slate-50/50">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><ImageIcon size={12}/> Logo</div>
                                        <div className="space-y-3">
                                            <div><div className="flex justify-between"><label className="text-[10px] font-bold text-slate-500">Tamanho</label><span className="text-[10px] text-slate-400">{settings.logoSize}%</span></div><input type="range" min="10" max="150" className="w-full accent-[#009DE0]" value={settings.logoSize} onChange={e => setSettings({...settings, logoSize: Number(e.target.value)})}/></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. X</label><span className="text-[10px] text-slate-400">{settings.logoX}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.logoX} onChange={e => setSettings({...settings, logoX: Number(e.target.value)})}/></div>
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. Y</label><span className="text-[10px] text-slate-400">{settings.logoY}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.logoY} onChange={e => setSettings({...settings, logoY: Number(e.target.value)})}/></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 3. TÍTULO */}
                                {settings.showTitle && (
                                    <div className="p-3 border rounded-lg bg-slate-50/50">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Heading size={12}/> Título Principal</div>
                                        <input className="w-full p-2 border rounded text-xs mb-3" value={settings.customTitle} onChange={e => setSettings({...settings, customTitle: e.target.value})} placeholder="Texto do Título"/>
                                        <div className="space-y-3">
                                            <div><div className="flex justify-between"><label className="text-[10px] font-bold text-slate-500">Tamanho Fonte</label><span className="text-[10px] text-slate-400">{settings.headerFontSize}px</span></div><input type="range" min="6" max="30" className="w-full accent-[#009DE0]" value={settings.headerFontSize} onChange={e => setSettings({...settings, headerFontSize: Number(e.target.value)})}/></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. X</label><span className="text-[10px] text-slate-400">{settings.titleX}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.titleX} onChange={e => setSettings({...settings, titleX: Number(e.target.value)})}/></div>
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. Y</label><span className="text-[10px] text-slate-400">{settings.titleY}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.titleY} onChange={e => setSettings({...settings, titleY: Number(e.target.value)})}/></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 4. SUBTÍTULO */}
                                {settings.showTitle && (
                                    <div className="p-3 border rounded-lg bg-slate-50/50">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Type size={12}/> Subtítulo</div>
                                        <input className="w-full p-2 border rounded text-xs mb-3" value={settings.customSubtitle} onChange={e => setSettings({...settings, customSubtitle: e.target.value})} placeholder="Texto do Subtítulo"/>
                                        <div className="space-y-3">
                                            <div><div className="flex justify-between"><label className="text-[10px] font-bold text-slate-500">Tamanho Fonte</label><span className="text-[10px] text-slate-400">{settings.subheaderFontSize}px</span></div><input type="range" min="4" max="20" className="w-full accent-[#009DE0]" value={settings.subheaderFontSize} onChange={e => setSettings({...settings, subheaderFontSize: Number(e.target.value)})}/></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. X</label><span className="text-[10px] text-slate-400">{settings.subtitleX}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.subtitleX} onChange={e => setSettings({...settings, subtitleX: Number(e.target.value)})}/></div>
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. Y</label><span className="text-[10px] text-slate-400">{settings.subtitleY}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.subtitleY} onChange={e => setSettings({...settings, subtitleY: Number(e.target.value)})}/></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 5. DATA */}
                                {settings.showDate && (
                                    <div className="p-3 border rounded-lg bg-slate-50/50">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Data</div>
                                        <div className="space-y-3">
                                            <div><div className="flex justify-between"><label className="text-[10px] font-bold text-slate-500">Tamanho Fonte</label><span className="text-[10px] text-slate-400">{settings.dateFontSize}px</span></div><input type="range" min="4" max="14" className="w-full accent-[#009DE0]" value={settings.dateFontSize} onChange={e => setSettings({...settings, dateFontSize: Number(e.target.value)})}/></div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. X</label><span className="text-[10px] text-slate-400">{settings.dateX}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.dateX} onChange={e => setSettings({...settings, dateX: Number(e.target.value)})}/></div>
                                                <div><div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-slate-500">Pos. Y</label><span className="text-[10px] text-slate-400">{settings.dateY}mm</span></div><input type="range" min="-20" max="20" className="w-full accent-[#009DE0]" value={settings.dateY} onChange={e => setSettings({...settings, dateY: Number(e.target.value)})}/></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                                    <label className={`flex flex-col items-center justify-center gap-1 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${settings.showLogo ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}><input type="checkbox" checked={settings.showLogo} onChange={() => setSettings({...settings, showLogo: !settings.showLogo})} className="hidden"/> Logo</label>
                                    <label className={`flex flex-col items-center justify-center gap-1 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${settings.showTitle ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}><input type="checkbox" checked={settings.showTitle} onChange={() => setSettings({...settings, showTitle: !settings.showTitle})} className="hidden"/> Títulos</label>
                                    <label className={`flex flex-col items-center justify-center gap-1 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${settings.showDate ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}><input type="checkbox" checked={settings.showDate} onChange={() => setSettings({...settings, showDate: !settings.showDate})} className="hidden"/> Data</label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ABA CÓDIGO --- */}
                    {activeTab === 'content' && (
                        <div className="space-y-5 animate-in fade-in">
                            <div className="flex gap-2">
                                <button onClick={()=>setSettings({...settings, codeType: 'barcode'})} className={`flex-1 py-3 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 ${settings.codeType === 'barcode' ? 'bg-[#009DE0] text-white border-[#009DE0]' : 'bg-white text-slate-600'}`}><ScanBarcode size={18}/> Barcode</button>
                                <button onClick={()=>setSettings({...settings, codeType: 'qrcode'})} className={`flex-1 py-3 rounded-lg font-bold text-sm border flex items-center justify-center gap-2 ${settings.codeType === 'qrcode' ? 'bg-[#009DE0] text-white border-[#009DE0]' : 'bg-white text-slate-600'}`}><ScanLine size={18}/> QR Code</button>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500">Zoom</label><span className="text-xs text-slate-400">{settings.codeSize || 100}%</span></div>
                                    <input type="range" min="20" max="200" className="w-full accent-[#009DE0]" value={settings.codeSize || 100} onChange={e => setSettings({...settings, codeSize: Number(e.target.value)})}/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowLeftRight size={12}/> X</label><span className="text-[10px] text-slate-400">{settings.codeX}mm</span></div><input type="range" min="-30" max="30" className="w-full accent-[#009DE0]" value={settings.codeX || 0} onChange={e => setSettings({...settings, codeX: Number(e.target.value)})}/></div>
                                    <div><div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowUpDown size={12}/> Y</label><span className="text-[10px] text-slate-400">{settings.codeY}mm</span></div><input type="range" min="-30" max="30" className="w-full accent-[#009DE0]" value={settings.codeY || 0} onChange={e => setSettings({...settings, codeY: Number(e.target.value)})}/></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ABA RODAPÉ --- */}
                    {activeTab === 'footer' && (
                        <div className="space-y-5 animate-in fade-in">
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                                <span className="text-sm font-bold text-[#021D34]">Exibir Rodapé</span>
                                <button onClick={() => setSettings({...settings, showFooter: !settings.showFooter})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showFooter ? 'bg-green-500' : 'bg-slate-300'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.showFooter ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <div className={`space-y-4 transition-opacity ${settings.showFooter ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                <div><div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500">Tamanho Texto</label></div><input type="range" min="6" max="16" className="w-full accent-[#009DE0]" value={settings.footerFontSize} onChange={e => setSettings({...settings, footerFontSize: Number(e.target.value)})} /></div>
                                
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                                    <div><div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowLeftRight size={10}/> Pos. X</label><span className="text-[10px] text-slate-400">{settings.footerX}mm</span></div><input type="range" min="-10" max="10" className="w-full accent-[#009DE0]" value={settings.footerX || 0} onChange={e => setSettings({...settings, footerX: Number(e.target.value)})}/></div>
                                    <div><div className="flex justify-between mb-1"><label className="text-xs font-bold text-slate-500 flex items-center gap-1"><ArrowUpDown size={10}/> Pos. Y</label><span className="text-[10px] text-slate-400">{settings.footerY}mm</span></div><input type="range" min="-10" max="10" className="w-full accent-[#009DE0]" value={settings.footerY || 0} onChange={e => setSettings({...settings, footerY: Number(e.target.value)})}/></div>
                                </div>

                                <div className="pt-2"><label className="text-xs font-bold text-slate-500 mb-2 block">Alinhamento Texto</label><div className="flex border rounded-lg overflow-hidden bg-slate-50"><button onClick={()=>setSettings({...settings, footerAlign: 'left'})} className={`flex-1 py-2 flex justify-center ${settings.footerAlign === 'left' ? 'bg-[#009DE0] text-white' : 'text-slate-500'}`}><AlignLeft size={16}/></button><button onClick={()=>setSettings({...settings, footerAlign: 'center'})} className={`flex-1 py-2 flex justify-center ${settings.footerAlign === 'center' ? 'bg-[#009DE0] text-white' : 'text-slate-500'}`}><AlignCenter size={16}/></button><button onClick={()=>setSettings({...settings, footerAlign: 'right'})} className={`flex-1 py-2 flex justify-center ${settings.footerAlign === 'right' ? 'bg-[#009DE0] text-white' : 'text-slate-500'}`}><AlignRight size={16}/></button></div></div>
                                <div className="grid grid-cols-2 gap-2"><label className={`flex items-center gap-2 text-xs font-bold p-2 rounded border cursor-pointer ${settings.showStudent ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}><input type="checkbox" checked={settings.showStudent} onChange={() => setSettings({...settings, showStudent: !settings.showStudent})} className="accent-[#009DE0]"/> Nome Aluno</label><label className={`flex items-center gap-2 text-xs font-bold p-2 rounded border cursor-pointer ${settings.showType ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}><input type="checkbox" checked={settings.showType} onChange={() => setSettings({...settings, showType: !settings.showType})} className="accent-[#009DE0]"/> Tipo Material</label></div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* BOTÕES DE AÇÃO: RESETAR E SALVAR */}
                <div className="flex gap-3">
                    <button onClick={resetDefaults} className="flex-1 bg-white border border-slate-300 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        <RotateCcw size={18}/> Restaurar Padrões
                    </button>
                    <button onClick={save} className="flex-[2] bg-[#021D34] text-white py-4 rounded-xl font-bold hover:bg-[#009DE0] transition-colors shadow-lg shadow-blue-900/20">
                        Salvar Configurações
                    </button>
                </div>
            </div>

            {/* 2. COLUNA DE PREVIEW */}
            <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 order-1 lg:order-2 lg:sticky lg:top-4 mx-auto">
                <div className="bg-slate-100 p-6 rounded-xl border border-slate-300 flex flex-col items-center justify-center min-h-[300px] md:min-h-[400px] relative overflow-hidden">
                    <div className="absolute top-4 left-4 z-20 flex flex-col">
                        <h3 className="font-bold text-slate-400 uppercase tracking-wider text-xs flex items-center gap-2"><Eye size={14}/> Preview</h3>
                        <span className="text-[9px] text-slate-400">{isMobile ? 'Escala Mobile' : 'Escala Desktop'}</span>
                    </div>
                    
                    {/* CONTAINER FANTASMA */}
                    <div style={{
                        width: `${displayWidthMM}mm`,
                        height: `${displayHeightMM}mm`,
                        transform: `scale(${ZOOM})`,
                        transformOrigin: 'center center',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px dashed #cbd5e1' 
                    }}>
                        <div 
                            className="bg-white shadow-2xl flex flex-col justify-between overflow-hidden transition-all duration-300"
                            style={{
                                width: `${realWidth}mm`,
                                height: `${realHeight}mm`,
                                padding: `${settings.margin}mm`,
                                border: '1px solid #e2e8f0',
                                position: 'absolute',
                                top: '50%', left: '50%',
                                transform: `translate(-50%, -50%) rotate(${settings.rotation}deg) scaleX(${settings.mirror ? -1 : 1})`,
                            }}
                        >
                            {/* HEADER COM ALINHAMENTO E POSIÇÃO CUSTOMIZADA */}
                            {settings.showHeader && (
                                <div className="flex items-center border-b border-black pb-1 mb-1" style={headerStyle}>
                                    <div className="flex items-center gap-1" style={{ flexDirection: settings.headerAlign === 'center' ? 'column' : 'row' }}>
                                        {settings.showLogo && <img src={LOGOS.color} style={logoStyle} alt="logo"/>}
                                        {settings.showTitle && (
                                            <div className="flex flex-col leading-none" style={{textAlign: settings.headerAlign === 'center' ? 'center' : (settings.headerAlign === 'flex-end' ? 'right' : 'left')}}>
                                                <span style={titleStyle}>{settings.customTitle}</span>
                                                <span style={subtitleStyle}>{settings.customSubtitle}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* DATA COM POSIÇÃO CUSTOMIZADA */}
                                    {settings.showDate && <span style={dateStyle}>04/12/25</span>}
                                </div>
                            )}

                            {/* CÓDIGO */}
                            <div className="flex-1 flex items-center justify-center overflow-hidden py-1 relative">
                                <div style={codeStyle}>
                                    {settings.codeType === 'qrcode' ? <QRCodeComponent value="TESTE123" /> : <Barcode value="TESTE123" />}
                                </div>
                            </div>

                            {/* FOOTER */}
                            {settings.showFooter && (
                                <div className="border-t border-black pt-1 flex flex-col justify-center" style={footerStyle}>
                                    {settings.showStudent && <div className="leading-none" style={{fontSize: fontSizeBody}}><span className="font-bold">ALUNO:</span> <span className="font-bold truncate">JOAO CESAR</span></div>}
                                    {settings.showType && <div className="leading-none mt-0.5" style={{fontSize: fontSizeBody}}><span className="font-bold">MAT:</span> <span className="font-bold truncate">KIT CLINICO</span></div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><Smartphone size={10}/> Visualização Adaptada</span>
                </div>
            </div>
        </div>
    );
}