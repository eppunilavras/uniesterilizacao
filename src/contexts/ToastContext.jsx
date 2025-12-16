import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  X 
} from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    // Função auxiliar para remover (não precisa ser exportada no value se não quiser)
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // O useCallback garante que esta função mantenha a mesma referência
    // entre renderizações, evitando que o useEffect da Recepção entre em loop.
    const addToast = useCallback((msg, type = 'info') => {
        const id = Math.random();
        setToasts(prev => [...prev, { id, msg, type }]);
        
        // Remove automaticamente após 5 segundos
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            
            {/* Container de Toasts */}
            <div className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-none no-print">
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white text-sm font-medium animate-in slide-in-from-right-10 fade-in duration-300 ${
                            t.type === 'error' ? 'bg-red-600' : 
                            t.type === 'success' ? 'bg-green-600' : 
                            'bg-[#021D34]'
                        }`}
                    >
                        {t.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
                        
                        <span>{t.msg}</span>
                        
                        <button 
                            onClick={() => removeToast(t.id)} 
                            className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
                        >
                            <X size={14}/>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};