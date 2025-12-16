import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// O "export default" é obrigatório aqui para o import funcionar no MainLayout
export default function OfflineNotice() {
    const isOnline = useOnlineStatus();
    const prevOnlineRef = useRef(isOnline); // Para detectar a transição de estado
    const [syncStatus, setSyncStatus] = useState(null); // null | { count: number }

    useEffect(() => {
        // Detecta quando voltou a ficar online (era false, virou true)
        if (prevOnlineRef.current === false && isOnline === true) {
            
            // Verifica se havia itens pendentes salvos pelo Reception.jsx
            const pendingCount = parseInt(localStorage.getItem('unilavras_offline_count') || '0');
            
            if (pendingCount > 0) {
                setSyncStatus({ count: pendingCount });
                
                // Limpa o contador e remove o aviso após 6 segundos
                localStorage.removeItem('unilavras_offline_count');
                setTimeout(() => setSyncStatus(null), 6000);
            }
        }
        
        prevOnlineRef.current = isOnline;
    }, [isOnline]);

    // Caso 1: Está Offline (Aviso Vermelho Fixo)
    if (!isOnline) {
        return (
            <div className="bg-red-500 text-white px-4 py-2 text-sm font-bold text-center flex items-center justify-center gap-2 animate-in slide-in-from-top fixed top-0 left-0 right-0 z-[10000] shadow-md no-print">
                <WifiOff size={18} />
                <span>Você está offline. O sistema está operando em Modo Offline.</span>
            </div>
        );
    }

    // Caso 2: Acabou de voltar Online e tinha dados pendentes (Aviso Azul Temporário)
    if (isOnline && syncStatus) {
        return (
            <div className="bg-[#009DE0] text-white px-4 py-2 text-sm font-bold text-center flex items-center justify-center gap-2 animate-in slide-in-from-top fixed top-0 left-0 right-0 z-[10000] shadow-md no-print">
                <RefreshCw size={18} className="animate-spin" />
                <span>Conexão restaurada! Sincronizando {syncStatus.count} registro(s) pendentes com o servidor...</span>
            </div>
        );
    }

    // Caso 3: Online normal (nada a mostrar)
    return null;
}