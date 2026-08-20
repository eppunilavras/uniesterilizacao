// Dark mode removido. Arquivo mantido para compatibilidade de imports remanescentes.
import { createContext, useContext } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  // Remove classe 'dark' caso ainda esteja no HTML de sessões anteriores
  if (typeof window !== 'undefined') {
    window.document.documentElement.classList.remove('dark');
    localStorage.removeItem('unilavras_theme');
  }
  return children;
}

export const useTheme = () => useContext(ThemeContext);
