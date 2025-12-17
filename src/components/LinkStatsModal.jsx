import React, { useState } from 'react';
import { X, BarChart2, Calendar, MousePointer2, RotateCcw, AlertTriangle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { useDialog } from '../contexts/DialogContext';
import { useToast } from '../contexts/ToastContext';

export default function LinkStatsModal({ isOpen, onClose, link }) {
  const { confirm } = useDialog();
  const { addToast } = useToast();
  const [isReseting, setIsReseting] = useState(false);

  if (!isOpen || !link) return null;

  // Função para zerar a contagem
  const handleResetStats = async () => {
    // 1. Solicita confirmação ao usuário
    const confirmed = await confirm({
      title: 'Zerar contagem de cliques?',
      message: (
        <div className="space-y-2">
          <p className="dark:text-slate-300">Você está prestes a definir o contador de cliques do link <strong>"{link.name}"</strong> para zero.</p>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex gap-2 items-start transition-colors">
             <AlertTriangle size={16} className="mt-0.5 shrink-0" />
             <span>Isso afetará a ordenação e a exibição pública. O histórico detalhado de logs (se houver) será mantido no banco de dados, mas o número visual será reiniciado.</span>
          </div>
        </div>
      ),
      confirmLabel: 'Sim, zerar contagem',
      cancelLabel: 'Cancelar',
      variant: 'destructive'
    });

    if (!confirmed) return;

    try {
      setIsReseting(true);
      
      // 2. Atualiza o documento no Firestore
      const linkRef = doc(db, 'artifacts', appId, 'public', 'data', 'external_links', link.id);
      
      await updateDoc(linkRef, {
        clicks: 0,
        lastResetAt: serverTimestamp() // Opcional: marca quando foi zerado
      });

      addToast({
        type: 'success',
        title: 'Contagem zerada',
        message: 'O número de cliques foi reiniciado com sucesso.'
      });
      
      // Fecha o modal após o sucesso
      onClose();

    } catch (error) {
      console.error("Erro ao zerar:", error);
      addToast({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível zerar a contagem.'
      });
    } finally {
      setIsReseting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 transition-colors">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 transition-colors">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <BarChart2 size={20} className="text-[#009DE0] dark:text-sky-400" />
            <h3 className="font-bold">Estatísticas do Link</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            {/* Info Principal */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-[#009DE0] dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner transition-colors">
                    <MousePointer2 size={32} />
                </div>
                <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight transition-colors">
                    {link.clicks || 0}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium uppercase text-xs tracking-wider transition-colors">Total de Cliques</p>
            </div>

            {/* Detalhes do Link */}
            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 space-y-3 border border-slate-100 dark:border-slate-700 transition-colors">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Nome:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{link.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Categoria:</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300 capitalize bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 transition-colors">
                        {link.category || 'Geral'}
                    </span>
                </div>
                {link.lastResetAt && (
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 dark:border-slate-700 mt-2 transition-colors">
                         <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                             <RotateCcw size={10} /> Último reset:
                         </span>
                         <span className="text-xs text-slate-500 dark:text-slate-400">
                             {new Date(link.lastResetAt?.seconds * 1000).toLocaleDateString()}
                         </span>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex gap-3 transition-colors">
             <button
                onClick={handleResetStats}
                disabled={isReseting || (link.clicks === 0)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <RotateCcw size={16} />
                {isReseting ? 'Zerando...' : 'Zerar Contagem'}
             </button>
             
             <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all"
             >
                Fechar
             </button>
        </div>
      </div>
    </div>
  );
}