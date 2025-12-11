import React from 'react';

/**
 * Card de Estatística Simples
 * @param {string} title - Título do card (ex: "Recebidos")
 * @param {number|string} count - O valor a ser exibido
 * @param {ElementType} icon - O componente do ícone (Lucide React)
 * @param {string} color - Classes Tailwind para a cor do texto/ícone (ex: 'text-orange-600')
 * @param {string} bg - Classes Tailwind para o fundo do ícone (ex: 'bg-orange-50')
 */
const StatCard = ({ title, count, icon: Icon, color, bg }) => {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:translate-y-[-2px] transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${bg} ${color}`}>
                    {/* Renderiza o ícone passado via props */}
                    <Icon size={24}/>
                </div>
            </div>
            <h3 className="text-3xl font-bold text-[#021D34]">{count}</h3>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">{title}</p>
        </div>
    );
};

export default StatCard;