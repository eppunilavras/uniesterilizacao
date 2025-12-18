import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertTriangle, HelpCircle, CheckCircle2, AlertOctagon } from 'lucide-react';

const DialogContext = createContext();

export function useDialog() {
  return useContext(DialogContext);
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  // Função para Diálogos de Confirmação (Sim/Não)
  const confirm = useCallback(({ 
    title, 
    message, 
    confirmLabel = 'Confirmar', 
    cancelLabel = 'Cancelar', 
    variant = 'default', 
    confirmText, 
    cancelText, 
    isDestructive 
  }) => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        confirmLabel: confirmText || confirmLabel,
        cancelLabel: cancelText || cancelLabel,
        variant: isDestructive ? 'destructive' : variant,
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  // NOVO: Função para Diálogos de Alerta (Apenas OK)
  const alert = useCallback(({ 
    title, 
    message, 
    confirmLabel = 'OK', 
    variant = 'default' 
  }) => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        confirmLabel,
        cancelLabel: null, // Alertas não têm botão de cancelar
        variant,
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(true);
        }
      });
    });
  }, []);

  const getIcon = (variant) => {
      switch(variant) {
          case 'destructive': return <AlertOctagon size={24} className="text-red-500" />;
          case 'info': return <HelpCircle size={24} className="text-blue-500" />;
          case 'success': return <CheckCircle2 size={24} className="text-green-500" />;
          default: return <AlertTriangle size={24} className="text-amber-500" />;
      }
  };

  const getButtonStyles = (variant) => {
      switch(variant) {
          case 'destructive': return 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20';
          case 'info': return 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20';
          case 'success': return 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20';
          default: return 'bg-[#021D34] hover:bg-[#009DE0] text-white shadow-blue-900/20 dark:bg-sky-600 dark:hover:bg-sky-500';
      }
  };

  return (
    // Adicionado 'alert' ao Provider
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-[#021D34]/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex gap-4 items-start bg-slate-50 dark:bg-slate-900/50 transition-colors">
                <div className={`p-2 rounded-full shrink-0 ${dialog.variant === 'destructive' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
                    {getIcon(dialog.variant)}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#021D34] dark:text-white leading-tight mb-1">
                        {dialog.title}
                    </h3>
                    {typeof dialog.message === 'string' ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            {dialog.message}
                        </p>
                    ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            {dialog.message}
                        </div>
                    )}
                </div>
                <button 
                    onClick={dialog.onCancel}
                    className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                    <X size={20}/>
                </button>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex gap-3 transition-colors">
                {dialog.cancelLabel && (
                    <button 
                        onClick={dialog.onCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    >
                        {dialog.cancelLabel}
                    </button>
                )}
                <button 
                    onClick={dialog.onConfirm}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${getButtonStyles(dialog.variant)}`}
                >
                    {dialog.confirmLabel}
                </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}