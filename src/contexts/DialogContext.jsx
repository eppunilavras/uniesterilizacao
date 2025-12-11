import React, { createContext, useContext, useState } from 'react';
import { 
  AlertTriangle, 
  Info 
} from 'lucide-react';

const DialogContext = createContext();

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);

    const confirm = ({ 
        title, 
        message, 
        confirmText = 'Confirmar', 
        cancelText = 'Cancelar', 
        isDestructive = false 
    }) => {
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
                            <div className="w-full">
                                <h3 className="text-lg font-bold text-slate-900">{dialog.title}</h3>
                                {/* AQUI MUDAMOS DE <p> PARA <div> PARA ACEITAR CONTEÚDO HTML/JSX */}
                                <div className="text-slate-600 text-sm mt-2 w-full">
                                    {dialog.message}
                                </div>
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
                                className={`px-4 py-2 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95 text-sm ${
                                    dialog.isDestructive 
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' 
                                        : 'bg-[#009DE0] hover:bg-[#008bc5] shadow-blue-500/30'
                                }`}
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