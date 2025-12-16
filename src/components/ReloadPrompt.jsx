import React from 'react';
// Este hook vem da biblioteca do PWA. Se der erro, verifique se instalou 'vite-plugin-pwa'
import { useRegisterSW } from 'virtual:pwa-register/react';

function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Se não precisar atualizar, não mostra nada
  if (!needRefresh) return null;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <span style={styles.message}>
          🚀 Nova versão de software disponível!
        </span>
        <div style={styles.actions}>
          <button 
            style={styles.btnUpdate} 
            onClick={() => updateServiceWorker(true)}
          >
            Atualizar
          </button>
          <button 
            style={styles.btnClose} 
            onClick={() => setNeedRefresh(false)}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Estilos CSS-in-JS simples para não precisar de arquivo extra
const styles = {
  container: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 9999,
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: '12px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    border: '1px solid #333',
    animation: 'fadeIn 0.3s ease-in-out',
    fontFamily: 'Arial, sans-serif'
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  message: {
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '10px'
  },
  btnUpdate: {
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  btnClose: {
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #666',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
  }
};

export default ReloadPrompt;