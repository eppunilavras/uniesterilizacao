import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const CHUNK_ERROR_KEY = 'chunk_reload_attempted';

function isChunkError(error) {
  const msg = error?.message || error?.toString() || '';
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError')
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Chunk obsoleto por novo deploy: limpa cache SW e recarrega automaticamente (uma vez)
    if (isChunkError(error)) {
      const alreadyTried = sessionStorage.getItem(CHUNK_ERROR_KEY);
      if (!alreadyTried) {
        sessionStorage.setItem(CHUNK_ERROR_KEY, '1');
        // Tenta invalidar cache do service worker antes de recarregar
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            Promise.all(regs.map((r) => r.unregister())).then(() => {
              window.location.reload();
            });
          });
        } else {
          window.location.reload();
        }
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC] p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full animate-in zoom-in-95">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            
            <h1 className="text-2xl font-bold text-[#021D34] mb-2">Ops! Algo deu errado.</h1>
            <p className="text-slate-500 mb-6 text-sm">
              Ocorreu um erro inesperado na aplicação. Não se preocupe, seus dados estão seguros.
            </p>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-left mb-6 overflow-hidden">
               <p className="text-xs font-mono text-red-500 break-all">
                 {this.state.error?.toString()}
               </p>
            </div>

            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-[#009DE0] text-white py-3 rounded-xl font-bold hover:bg-[#008bc5] transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;