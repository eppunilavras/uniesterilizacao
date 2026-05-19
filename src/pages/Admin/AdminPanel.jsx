import React, { useState, useEffect } from 'react';
import {
  FileText,
  Database,
  Settings2,
  PackagePlus,
  Bell,
  Activity,
  ShieldCheck
} from 'lucide-react';

// Imports dos Sub-componentes
import AdminAnnouncements from './AdminAnnouncements';
import AdminMaterials from './AdminMaterials';
import AdminLabels from './AdminLabels';
import AdminData from './AdminData';
import AdminLogs from './AdminLogs';
import AdminHealth from './AdminHealth';
import AdminSubstitute from './AdminSubstitute';

export default function AdminPanel({ userProfile }) {
    const [activeTab, setActiveTab] = useState('logs');
    const [logsVisited, setLogsVisited] = useState(false);

    useEffect(() => {
        if (activeTab === 'logs' && !logsVisited) {
            setLogsVisited(true);
        }
    }, [activeTab, logsVisited]);

    const tabs = [
        { id: 'logs', label: 'Auditoria', icon: FileText },
        { id: 'health', label: 'Saúde', icon: Activity },
        { id: 'data', label: 'Backup', icon: Database },
        { id: 'labels', label: 'Etiquetas', icon: Settings2 },
        { id: 'materials', label: 'Materiais', icon: PackagePlus },
        { id: 'announcements', label: 'Recados', icon: Bell },
        { id: 'substitute', label: 'Substitutos', icon: ShieldCheck },
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* CABEÇALHO */}
            <div className="flex items-center gap-4">
                <h2 className="font-bold text-[#021D34] dark:text-white text-2xl flex items-center gap-2 transition-colors">
                    <Settings2 className="text-[#009DE0] dark:text-sky-400"/> Painel Administrativo
                </h2>
            </div>
            
            {/* Navegação Mobile (Grid) */}
            <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
                 {tabs.map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id)} 
                        className={`p-3 text-sm font-bold rounded-lg border flex flex-col items-center justify-center gap-2 transition-all 
                        ${activeTab === t.id 
                            ? 'bg-[#009DE0] text-white border-[#009DE0] shadow-md dark:bg-sky-600 dark:border-sky-600' 
                            : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}
                    >
                        <t.icon size={20}/> 
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Navegação Desktop (Abas) */}
            <div className="hidden md:flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-1 no-scrollbar transition-colors">
                {tabs.map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id)} 
                        className={`px-4 md:px-6 py-3 text-sm font-bold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap 
                        ${activeTab === t.id 
                            ? 'border-[#009DE0] text-[#009DE0] bg-white dark:bg-slate-800 dark:text-sky-400 dark:border-sky-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                    >
                        <t.icon size={16}/> {t.label}
                    </button>
                ))}
            </div>
            
            {/* Área de Conteúdo */}
            <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-b-xl md:rounded-tr-xl border border-slate-200 dark:border-slate-700 md:border-t-0 shadow-sm min-h-[400px] rounded-xl md:rounded-tl-none transition-colors">
                {activeTab === 'announcements' && <AdminAnnouncements />}
                {activeTab === 'materials' && <AdminMaterials />}
                {activeTab === 'labels' && <AdminLabels />}
                {activeTab === 'data' && <AdminData />}
                {activeTab === 'health' && <AdminHealth />}
                {activeTab === 'substitute' && <AdminSubstitute userProfile={userProfile} />}

                <div style={{ display: activeTab === 'logs' ? 'block' : 'none' }}>
                    {logsVisited && <AdminLogs />}
                </div>
            </div>
        </div>
    );
}