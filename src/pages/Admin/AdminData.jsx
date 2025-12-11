import React, { useState } from 'react';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  writeBatch, 
  query, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { 
  Database, 
  FileDown, 
  FileUp, 
  Eraser 
} from 'lucide-react';

// Imports internos (Voltando 2 níveis)
import { db, appId } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import { logEvent } from '../../utils/logger';

export default function AdminData() {
    const [purgeDate, setPurgeDate] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { addToast } = useToast();
    const { confirm } = useDialog();

    // Função auxiliar para ressuscitar Timestamps do JSON (necessário para o Firebase aceitar as datas de volta)
    const reviveTimestamps = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        
        // Se parece um Timestamp do Firestore
        if (obj.type === 'firestore/timestamp/1.0' || (obj.seconds !== undefined && obj.nanoseconds !== undefined)) {
            return new Timestamp(obj.seconds, obj.nanoseconds);
        }
        
        if (Array.isArray(obj)) return obj.map(reviveTimestamps);
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, reviveTimestamps(v)]));
    };

    const backup = async () => {
        setLoading(true);
        try {
            const collections = ['items', 'materialTypes', 'announcements', 'users_directory', 'system_logs'];
            const data = {};
            
            // 1. Backup das Coleções Públicas
            for (const c of collections) {
                const s = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', c));
                data[c] = s.docs.map(d => ({id: d.id, ...d.data()}));
            }
            
            // 2. Backup dos Perfis Privados (CRUCIAL PARA LOGIN)
            const userDir = data['users_directory'] || [];
            const profiles = [];
            for (const user of userDir) {
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.id, 'profile', 'data'));
                    if (snap.exists()) {
                        profiles.push({ uid: user.id, ...snap.data() });
                    }
                } catch(e) { console.warn(`Falha ao pegar perfil de ${user.id}`, e); }
            }
            data['user_profiles_backup'] = profiles;

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `backup_completo_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            addToast('Backup COMPLETO gerado com sucesso!', 'success');
        } catch(e) { 
            console.error(e);
            addToast('Erro ao gerar backup: ' + e.message, 'error'); 
        }
        setLoading(false);
    };

    const restore = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        if(!await confirm({ title: 'Restaurar Backup', message: 'ISSO IRÁ SOBRESCREVER DADOS. Se usuários foram deletados do Auth (Google), eles precisarão ser recriados manualmente. Continuar?', isDestructive: true })) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const rawData = JSON.parse(ev.target.result);
                const data = reviveTimestamps(rawData);

                const batch = writeBatch(db);
                let count = 0;
                
                for (const [key, items] of Object.entries(data)) {
                    if (key === 'user_profiles_backup') {
                        for (const profile of items) {
                            const { uid, ...pData } = profile;
                            if (uid) {
                                batch.set(doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data'), pData);
                                count++;
                            }
                        }
                    } else {
                        for (const item of items) {
                            const { id, ...rest } = item;
                            if (id) {
                                batch.set(doc(db, 'artifacts', appId, 'public', 'data', key, id), rest);
                                count++;
                            }
                        }
                    }

                    // Firestore limita batches a 500 operações. Usamos 400 para segurança.
                    if (count >= 400) {
                        await batch.commit();
                        count = 0; 
                    }
                }
                
                if (count > 0) await batch.commit();
                
                await logEvent('DATA_OP', `Restauração de backup realizada.`);
                addToast(`Sistema restaurado com sucesso!`, 'success');
            } catch(e) { 
                console.error(e);
                addToast('Erro crítico ao restaurar: ' + e.message, 'error'); 
            }
            setLoading(false);
        };
        reader.readAsText(file);
    };

    const purge = async () => {
		if (!purgeDate) return;
		
		if (!await confirm({ title: 'Limpeza de Dados', message: `ATENÇÃO: Isso excluirá PERMANENTEMENTE itens criados antes de ${new Date(purgeDate).toLocaleDateString()}. Continuar?`, isDestructive: true })) return;
		
		setLoading(true);
		try {
			const date = new Date(purgeDate);
			
			// --- OTIMIZAÇÃO ---
			// Usa query para pegar apenas os IDs que precisam ser deletados
			const q = query(
				collection(db, 'artifacts', appId, 'public', 'data', 'items'),
				where('createdAt', '<', date)
			);
			
			const snap = await getDocs(q);
			
			if (snap.empty) {
				addToast('Nenhum registro encontrado para essa data.', 'info');
				setLoading(false);
				return;
			}

			const batch = writeBatch(db);
			snap.docs.forEach(d => batch.delete(d.ref));
			
			await batch.commit();
			await logEvent('DATA_OP', `Limpeza: ${snap.size} itens antigos removidos.`); 
			
			addToast(`${snap.size} registros antigos removidos.`, 'success');
		} catch(e) { 
			console.error(e);
			addToast('Erro na exclusão: ' + e.message, 'error'); 
		}
		setLoading(false);
	};

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                     <h3 className="font-bold text-[#021D34] flex items-center gap-2 mb-2"><Database size={20}/> Backup Completo</h3>
                     <p className="text-xs text-slate-500 mb-3">Salva todos os materiais, logs e permissões de usuários.</p>
                     <button onClick={backup} disabled={loading} className="w-full bg-[#009DE0] text-white py-3 rounded-lg font-bold flex justify-center gap-2 hover:bg-[#008bc5]">
                         <FileDown size={20}/> {loading ? 'Processando...' : 'Baixar JSON'}
                     </button>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                     <h3 className="font-bold text-[#021D34] flex items-center gap-2 mb-2"><FileUp size={20}/> Restaurar</h3>
                     <p className="text-xs text-slate-500 mb-3">Recupera o sistema a partir de um arquivo JSON.</p>
                     <label className="w-full bg-white border border-dashed border-slate-300 py-3 rounded-lg font-bold flex justify-center gap-2 text-slate-500 cursor-pointer hover:bg-slate-50">
                         Selecionar Arquivo <input type="file" accept=".json" onChange={restore} className="hidden" disabled={loading}/>
                     </label>
                 </div>
             </div>
             
             <div className="bg-red-50 p-6 rounded-xl border border-red-200">
                 <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2"><Eraser size={20}/> Limpeza</h3>
                 <p className="text-xs text-red-600 mb-3">Remove materiais antigos para liberar espaço.</p>
                 <input type="date" className="w-full p-3 border border-red-200 rounded-lg bg-white mb-4" value={purgeDate} onChange={e => setPurgeDate(e.target.value)}/>
                 <button onClick={purge} disabled={loading || !purgeDate} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
                     Confirmar Exclusão
                 </button>
             </div>
        </div>
    );
}