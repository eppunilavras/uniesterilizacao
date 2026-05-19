import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Copy, CheckCircle, XCircle, Clock, Infinity, ShieldCheck } from 'lucide-react';

import { db, appId } from '../../config/firebase';
import { useToast } from '../../contexts/ToastContext';
import { useDialog } from '../../contexts/DialogContext';
import { formatDate } from '../../utils/formatters';

const SAFE_ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const generateCode = (len = 6) =>
    Array.from({ length: len }, () => SAFE_ALPHA[Math.floor(Math.random() * SAFE_ALPHA.length)]).join('');

const DURATION_OPTIONS = [
    { label: '4 horas', hours: 4 },
    { label: '8 horas', hours: 8 },
    { label: '24 horas', hours: 24 },
    { label: '7 dias', hours: 168 },
    { label: '30 dias', hours: 720 },
    { label: 'Permanente', hours: null },
];

const getCodeStatus = (codeDoc) => {
    if (!codeDoc.active) return { label: 'Desativado', color: 'text-slate-400', icon: XCircle };
    if (codeDoc.usedAt) return { label: 'Utilizado', color: 'text-slate-400', icon: CheckCircle };
    if (codeDoc.expiresAt && codeDoc.expiresAt.toDate() < new Date()) return { label: 'Expirado', color: 'text-red-500', icon: XCircle };
    return { label: 'Ativo', color: 'text-green-600 dark:text-green-400', icon: CheckCircle };
};

export default function AdminSubstitute({ userProfile }) {
    const [codes, setCodes] = useState([]);
    const [label, setLabel] = useState('');
    const [duration, setDuration] = useState(8);
    const [isCreating, setIsCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const { addToast } = useToast();
    const { confirm } = useDialog();

    useEffect(() => {
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'substitute_codes'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, snap => {
            setCodes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const code = generateCode();
            const expiresAt = duration === null
                ? null
                : new Date(Date.now() + duration * 3600 * 1000);

            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'substitute_codes'), {
                code,
                label: label.trim() || `Acesso ${new Date().toLocaleDateString('pt-BR')}`,
                createdAt: serverTimestamp(),
                createdBy: { uid: userProfile.uid, name: userProfile.name },
                expiresAt: expiresAt,
                usedAt: null,
                active: true,
            });

            addToast(`Código ${code} criado com sucesso!`, 'success');
            setLabel('');
            setShowForm(false);
        } catch (err) {
            addToast('Erro ao criar código: ' + err.message, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeactivate = async (codeDoc) => {
        const ok = await confirm(`Desativar o código "${codeDoc.code}"?`, 'Confirmar', 'Desativar', 'Cancelar');
        if (!ok) return;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'substitute_codes', codeDoc.id), { active: false });
        addToast('Código desativado.', 'info');
    };

    const handleDelete = async (codeDoc) => {
        const ok = await confirm(`Excluir permanentemente o código "${codeDoc.code}"?`, 'Excluir Código', 'Excluir', 'Cancelar');
        if (!ok) return;
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'substitute_codes', codeDoc.id));
        addToast('Código excluído.', 'info');
    };

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code).then(() => addToast('Código copiado!', 'success'));
    };

    const selectedDuration = DURATION_OPTIONS.find(d => d.hours === duration);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-[#009DE0]" size={20}/>
                        Acesso de Substitutos
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Gere códigos temporários para técnicos substitutos. O código é utilizado na tela de login.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#009DE0] hover:bg-[#008bc5] text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-500/20 shrink-0"
                >
                    <Plus size={16}/> Novo Código
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Identificação (opcional)</label>
                            <input
                                type="text"
                                placeholder="Ex: Semana 20/05 – Maria"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                maxLength={60}
                                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white focus:border-[#009DE0] outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Validade</label>
                            <div className="flex flex-wrap gap-2">
                                {DURATION_OPTIONS.map(opt => (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => setDuration(opt.hours)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            duration === opt.hours
                                                ? 'bg-[#009DE0] text-white border-[#009DE0]'
                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-[#009DE0]'
                                        }`}
                                    >
                                        {opt.hours === null ? <Infinity size={12} className="inline mr-1"/> : null}
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isCreating} className="px-5 py-2 bg-[#009DE0] text-white rounded-lg font-bold text-sm hover:bg-[#008bc5] transition-all disabled:opacity-60">
                            {isCreating ? 'Gerando...' : 'Gerar Código'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-2">
                {codes.length === 0 && (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                        <ShieldCheck size={40} className="mx-auto mb-2 opacity-30"/>
                        <p className="text-sm">Nenhum código gerado ainda.</p>
                    </div>
                )}
                {codes.map(codeDoc => {
                    const status = getCodeStatus(codeDoc);
                    const isUsable = status.label === 'Ativo';
                    return (
                        <div key={codeDoc.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white dark:bg-slate-800 border rounded-xl transition-all ${isUsable ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}>
                            <div className="flex items-center gap-3 flex-1">
                                <div className={`text-2xl font-mono font-black tracking-widest ${isUsable ? 'text-[#021D34] dark:text-white' : 'text-slate-400'}`}>
                                    {codeDoc.code}
                                </div>
                                {isUsable && (
                                    <button onClick={() => handleCopy(codeDoc.code)} className="p-1.5 text-slate-400 hover:text-[#009DE0] transition-colors" title="Copiar código">
                                        <Copy size={14}/>
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{codeDoc.label}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                    <span className="text-xs text-slate-400">Criado: {formatDate(codeDoc.createdAt)}</span>
                                    {codeDoc.expiresAt ? (
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock size={10}/> Expira: {formatDate(codeDoc.expiresAt)}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Infinity size={10}/> Permanente
                                        </span>
                                    )}
                                    {codeDoc.usedAt && (
                                        <span className="text-xs text-slate-400">Usado: {formatDate(codeDoc.usedAt)}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className={`flex items-center gap-1 text-xs font-bold ${status.color}`}>
                                    <status.icon size={12}/> {status.label}
                                </span>
                                {isUsable && (
                                    <button onClick={() => handleDeactivate(codeDoc)} className="p-1.5 text-slate-400 hover:text-orange-500 transition-colors" title="Desativar">
                                        <XCircle size={16}/>
                                    </button>
                                )}
                                <button onClick={() => handleDelete(codeDoc)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
