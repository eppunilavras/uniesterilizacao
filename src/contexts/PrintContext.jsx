import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

// Imports internos
import { db, appId } from '../config/firebase';
import { LOGOS } from '../constants';
import Barcode from '../components/Barcode';
import QRCodeComponent from '../components/QRCodeComponent';

import { logEvent } from '../utils/logger'; // <--- ADICIONAR

const PrintContext = createContext();

export const usePrint = () => useContext(PrintContext);

export const PrintProvider = ({ children, user }) => {
    const [printQueue, setPrintQueue] = useState([]);
    
    // --- ESTADO INICIAL ---
    const [settings, setSettings] = useState({
        // Físico
        width: 50, height: 30, margin: 1, orientation: 'portrait',
        rotation: 0, mirror: false, autoSize: false,
        // Seções
        showHeader: true, showFooter: true,
        // Conteúdo
        codeType: 'qrcode', codeSize: 100, codeX: 0, codeY: 0,
        // Header Geral
        headerX: 0, headerY: 0, headerAlign: 'center',
        // Elementos Individuais
        logoSize: 45, logoX: 0, logoY: 0,
        headerFontSize: 10, titleX: 0, titleY: 0, customTitle: 'UNILAVRAS',
        subheaderFontSize: 6, subtitleX: 0, subtitleY: 0, customSubtitle: 'ESTERILIZAÇÃO',
        dateFontSize: 7, dateX: 0, dateY: 0,
        // Rodapé
        footerX: 0, footerY: 0, footerFontSize: 8, footerAlign: 'center',
        // Visibilidade
        showLogo: true, showTitle: true, showDate: true, showStudent: true, showType: true,
    });

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings_labels', 'config'), (docSnap) => {
            if (docSnap.exists()) {
                setSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        });
        return () => unsub();
    }, [user]);

	const printItems = (items) => {
		const itemsArray = Array.isArray(items) ? items : [items]; // Garantir array para contagem
		setPrintQueue(itemsArray);
		
		// --- NOVO LOG ---
		// Verifica se temos usuário (pode ser null no login, mas printcontext geralmente exige auth)
		if (user) {
			logEvent(
				'DATA_OP', 
				`Impressão de ${itemsArray.length} etiquetas`, 
				{ 
					codes: itemsArray.map(i => i.code || 'S/N'),
					studentNames: itemsArray.map(i => i.studentName).filter((v, i, a) => a.indexOf(v) === i) // Nomes únicos
				},
				// Passamos um objeto user simplificado se não tivermos o profile completo aqui
				{ uid: user.uid, email: user.email } 
			);
		}

		setTimeout(() => { window.print(); }, 500); 
	};

    // =========================================================================
    // 1. CÁLCULOS DIMENSIONAIS (IGUAIS AO PREVIEW)
    // =========================================================================
    
    // Dimensões "Reais" do Conteúdo (Inverte se for Retrato)
    const isPortrait = settings.orientation === 'portrait';
    const realWidthVal = settings.autoSize ? 50 : (isPortrait ? settings.height : settings.width);
    const realHeightVal = settings.autoSize ? 55 : (isPortrait ? settings.width : settings.height);
    
    const realWidth = `${realWidthVal}mm`;
    const realHeight = `${realHeightVal}mm`;

    // Dimensões da Página Física (@page) - Considera rotação de 90/270
    // Se a rotação for 90º, a folha física precisa inverter para caber o container rotacionado
    const isRotated90 = settings.rotation === 90 || settings.rotation === 270;
    const pageWidth = isRotated90 ? realHeight : realWidth;
    const pageHeight = isRotated90 ? realWidth : realHeight;

    // =========================================================================
    // 2. ESTILOS INTERNOS (CALIBRADOS COM O PREVIEW)
    // =========================================================================
    
    // AQUI ESTÁ A CORREÇÃO: Aplicamos a divisão por 2 (/2) nas fontes
    // Isso sincroniza o tamanho da impressão com o tamanho visual do preview
    const fontSizeTitleMain = settings.autoSize ? '11px' : `${settings.headerFontSize / 2}px`;
    const fontSizeTitleSub = settings.autoSize ? '8px' : `${settings.subheaderFontSize / 2}px`;
    const fontSizeDate = settings.autoSize ? '10px' : `${settings.dateFontSize / 2}px`;
    const fontSizeFooter = settings.autoSize ? '12px' : `${settings.footerFontSize / 2}px`;
    
    const logoHeight = settings.autoSize ? '18px' : `${(settings.logoSize / 100) * 8}mm`;

    // Wrapper de Página (Centraliza o papel físico)
    const pageWrapperStyle = {
        width: pageWidth,
        height: pageHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    };

    // Container do Conteúdo (Aplica a rotação visual e margens)
    const contentContainerStyle = {
        width: realWidth,
        height: realHeight,
        padding: `${settings.margin}mm`,
        
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center', 
        
        overflow: 'hidden',
        boxSizing: 'border-box',
        
        // Aplica a rotação e espelhamento
        transform: `rotate(${settings.rotation}deg) scaleX(${settings.mirror ? -1 : 1})`,
        transformOrigin: 'center center'
    };

    // --- HEADER ---
    const headerBlockStyle = {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: settings.headerAlign === 'center' ? 'center' : settings.headerAlign,
        borderBottom: '1px solid black', // 1px para igualar preview
        paddingBottom: '2px',
        marginBottom: '1px',
        minHeight: '15%', // Igual ao preview
        position: 'relative',
        transform: `translate(${settings.headerX}mm, ${settings.headerY}mm)`,
        zIndex: 10
    };

    const headerGroupStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        flexDirection: settings.headerAlign === 'center' ? 'column' : 'row',
        textAlign: settings.headerAlign === 'center' ? 'center' : (settings.headerAlign === 'flex-end' ? 'right' : 'left'),
        flex: settings.headerAlign === 'center' ? 'none' : 1 
    };

    const logoStyle = { height: logoHeight, width: 'auto', transform: `translate(${settings.logoX}mm, ${settings.logoY}mm)`, display: 'inline-block' };
    
    // Line-height: 0.9 e white-space: nowrap para evitar quebras indesejadas
    const titleStyle = { fontSize: fontSizeTitleMain, fontWeight: 900, display: 'block', transform: `translate(${settings.titleX}mm, ${settings.titleY}mm)`, lineHeight: 0.9, color: 'black', whiteSpace: 'nowrap' };
    const subtitleStyle = { fontSize: fontSizeTitleSub, fontWeight: 600, display: 'block', transform: `translate(${settings.subtitleX}mm, ${settings.subtitleY}mm)`, textTransform: 'uppercase', lineHeight: 0.9, whiteSpace: 'nowrap' };
    
    const dateStyle = { 
        fontSize: fontSizeDate, fontWeight: 'bold', display: 'inline-block', 
        transform: `translate(${settings.dateX}mm, ${settings.dateY}mm)`,
        marginLeft: settings.headerAlign === 'flex-start' ? 'auto' : '0',
        marginRight: settings.headerAlign === 'flex-end' ? 'auto' : '0',
        marginTop: '1px',
        whiteSpace: 'nowrap'
    };

    // --- CÓDIGO ---
    const codeContainerStyle = {
        flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        overflow: 'hidden', position: 'relative', padding: '1px 0', minHeight: 0
    };
    
    const codeContentStyle = {
        height: '100%', width: '100%', // Volta a preencher o espaço (Zoom controla o tamanho)
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `translate(${settings.codeX}mm, ${settings.codeY}mm) scale(${(settings.codeSize || 100) / 100})`,
        transformOrigin: 'center center'
    };

    // --- RODAPÉ ---
    const footerBlockStyle = {
        width: '100%', borderTop: '1px solid black', paddingTop: '1px', minHeight: '15%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: settings.footerAlign,
        transform: `translate(${settings.footerX}mm, ${settings.footerY}mm)`,
        fontSize: fontSizeFooter, lineHeight: 1, zIndex: 10
    };

    return (
        <PrintContext.Provider value={{ printItems }}>
            {children}
            
            <style>{`
                @media print {
                    /* Tamanho exato da folha física */
                    @page { 
                        size: ${pageWidth} ${pageHeight}; 
                        margin: 0; 
                    }
                    
                    html, body {
                        margin: 0 !important; padding: 0 !important;
                        width: ${pageWidth} !important; height: ${pageHeight} !important;
                        background: white; overflow: hidden !important; 
                        /* Força fonte sans-serif para garantir largura igual à tela */
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                    }

                    .no-print, .no-print * { display: none !important; }

                    #print-overlay {
                        display: block !important;
                        /* Usamos absolute e removemos a largura/altura fixa para permitir o map de múltiplos itens */
                        position: absolute; left: 0; top: 0;
                        z-index: 9999; 
                        background: white; 
                    }

                    .sticker-page-break {
                        position: relative;
                        width: ${pageWidth}; height: ${pageHeight};
                        overflow: hidden;
                        page-break-after: always;
                        break-inside: avoid;
                        display: flex; alignItems: center; justifyContent: center;
                    }
                    
                    .sticker-page-break:last-child { page-break-after: auto; }
                }
            `}</style>
            
            <div id="print-overlay" className="hidden">
                {printQueue.map((item, index) => (
                    <div key={item.id || index} className="sticker-page-break">
                        <div style={pageWrapperStyle}>
                            <div style={contentContainerStyle}>
                                
                                {settings.showHeader && (
                                    <div style={headerBlockStyle}>
                                        <div style={headerGroupStyle}>
                                            {settings.showLogo && <img src={LOGOS.color} style={logoStyle} alt="logo"/>}
                                            {settings.showTitle && (
                                                <div style={{display: 'flex', flexDirection: 'column'}}>
                                                    <span style={titleStyle}>{settings.customTitle || 'UNILAVRAS'}</span>
                                                    <span style={subtitleStyle}>{settings.customSubtitle || 'ESTERILIZAÇÃO'}</span>
                                                </div>
                                            )}
                                        </div>
                                        {settings.showDate && <span style={dateStyle}>{new Date().toLocaleDateString('pt-BR')}</span>}
                                    </div>
                                )}

                                <div style={codeContainerStyle}>
                                    <div style={codeContentStyle}>
                                        {settings.codeType === 'qrcode' 
                                            ? <QRCodeComponent value={item.code || 'TESTE'} />
                                            : <Barcode value={item.code || 'TESTE'} />
                                        }
                                    </div>
                                </div> {/* <-- CORREÇÃO: fechamento correto da div */}

                                {settings.showFooter && (
                                    <div style={footerBlockStyle}>
                                        {settings.showStudent && (
                                            <div style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%'}}>
                                                <span style={{fontWeight: 800, marginRight: '3px'}}>ALUNO:</span>
                                                <span style={{fontWeight: 600, textTransform: 'uppercase'}}>
													{item.studentName ? (() => {
														// Divide o nome por espaços
														const parts = item.studentName.trim().split(/\s+/);
														// Se tiver mais de um nome, junta o Primeiro + Último
														if (parts.length > 1) {
															return `${parts[0]} ${parts[parts.length - 1]}`;
														}
														// Se tiver apenas um nome, retorna ele mesmo
														return parts[0];
													})() : 'NOME'}
												</span>
                                            </div>
                                        )}
                                        {settings.showType && (
                                            <div style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%'}}>
                                                <span style={{fontWeight: 800, marginRight: '3px'}}>MAT:</span>
                                                <span style={{fontWeight: 600, textTransform: 'uppercase'}}>{item.type || 'MATERIAL'}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </PrintContext.Provider>
    );
};