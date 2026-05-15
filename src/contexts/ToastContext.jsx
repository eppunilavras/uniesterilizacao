import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', title) => {
    // Suporte a objeto como primeiro argumento (para retrocompatibilidade e flexibilidade)
    const content = typeof message === 'object' ? message.message : message;
    const msgType = typeof message === 'object' ? (message.type || type) : type;
    const msgTitle = typeof message === 'object' ? (message.title || title) : title;
    
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message: content, type: msgType, title: msgTitle }]);
    setTimeout(() => removeToast(id), 4000); // Auto remove após 4s
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={20} className="text-green-500 dark:text-green-400" />;
      case 'error': return <AlertCircle size={20} className="text-red-500 dark:text-red-400" />;
      case 'warning': return <AlertTriangle size={20} className="text-amber-500 dark:text-amber-400" />;
      default: return <Info size={20} className="text-blue-500 dark:text-blue-400" />;
    }
  };

  const getStyles = (type) => {
    switch (type) {
      case 'success': return 'border-l-4 border-l-green-500 bg-white dark:bg-slate-800';
      case 'error': return 'border-l-4 border-l-red-500 bg-white dark:bg-slate-800';
      case 'warning': return 'border-l-4 border-l-amber-500 bg-white dark:bg-slate-800';
      default: return 'border-l-4 border-l-blue-500 bg-white dark:bg-slate-800';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="no-print fixed top-4 right-4 z-[10060] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
                pointer-events-auto w-80 p-4 rounded-lg shadow-xl shadow-slate-200/50 dark:shadow-black/30 
                flex items-start gap-3 transform transition-all duration-300 animate-in slide-in-from-right-full 
                border border-slate-100 dark:border-slate-700 ${getStyles(toast.type)}
            `}
          >
            <div className="shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
                {toast.title && <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-0.5">{toast.title}</h4>}
                <p className={`text-sm font-medium leading-tight ${toast.title ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-white font-semibold'}`}>
                    {toast.message}
                </p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}