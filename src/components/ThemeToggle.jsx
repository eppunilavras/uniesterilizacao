import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-full transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700 hover:text-yellow-300' 
          : 'bg-white text-slate-400 hover:text-[#009DE0] shadow-sm border border-slate-200'
      } ${className}`}
      title={theme === 'dark' ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}