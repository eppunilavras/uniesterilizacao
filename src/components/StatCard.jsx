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
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:translate-y-[-2px] transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                {/* O container do ícone usa as classes passadas via props (bg e color).
                   Para o modo noturno funcionar bem aqui, certifique-se de passar as classes dark 
                   no componente pai (ex: bg="bg-orange-50 dark:bg-orange-900/20").
                */}
                <div className={`p-3 rounded-xl transition-colors ${bg} ${color}`}>
                    <Icon size={24}/>
                </div>
            </div>
            <h3 className="text-3xl font-bold text-[#021D34] dark:text-white transition-colors">
                {count}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1 transition-colors">
                {title}
            </p>
        </div>
    );
};

export default StatCard;