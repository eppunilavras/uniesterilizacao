import React from 'react';

/**
 * Componente de Skeleton para Loading States
 * @param {string} className - Classes Tailwind adicionais (ex: 'w-full h-4 rounded-full')
 */
export default function Skeleton({ className = "", ...props }) {
  return (
    <div 
      className={`animate-pulse bg-slate-200 rounded ${className}`} 
      {...props} 
    />
  );
}