import { useState, useEffect } from 'react';

export function useOnlineStatus() {
    // Inicia com o estado nativo do navegador
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        // 1. Listeners Nativos (ajudam na detecção instantânea em alguns casos)
        const handleOnline = () => checkConnection();
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // 2. Verificação Ativa ("Ping Real" com Timeout)
        const checkConnection = async () => {
            // Se o navegador já diz explicitamente que está offline, confiamos nele
            if (!navigator.onLine) {
                setIsOnline(false);
                return;
            }

            // CRIAÇÃO DO TIMEOUT:
            // Se o Google não responder em 3 segundos, cancelamos a tentativa.
            // Isso impede que a requisição fique "pendurada" eternamente.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            try {
                await fetch('https://www.google.com/favicon.ico?' + new Date().getTime(), { 
                    mode: 'no-cors', 
                    cache: 'no-store',
                    signal: controller.signal // Liga o timeout a esta requisição
                });
                
                // Se chegou aqui antes do timeout, tem internet
                setIsOnline(true);
            } catch (error) {
                // Se deu erro de rede, DNS ou Timeout (AbortError), estamos offline
                // console.log("Sem conexão detectada pelo ping:", error);
                setIsOnline(false);
            } finally {
                clearTimeout(timeoutId);
            }
        };

        // Verifica imediatamente ao carregar
        checkConnection();

        // Verifica periodicamente (a cada 5 segundos)
        const intervalId = setInterval(checkConnection, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(intervalId);
        };
    }, []);

    return isOnline;
}