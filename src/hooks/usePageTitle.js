import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function usePageTitle() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;

    // Lógica de Títulos
    if (path === '/' || path.startsWith('/portal')) {
      // Vitrine Pública
      document.title = 'Portal Odontologia | Unilavras';
    } else if (path === '/login') {
      // Login do Sistema
      document.title = 'Acesso Restrito | UniEsterilização';
    } else {
      // Sistema Interno (Dashboard, etc)
      document.title = 'UniEsterilização';
    }
  }, [location]);
}