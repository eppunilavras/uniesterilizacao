import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Criação do Client com configurações padrão
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // --- MUDANÇA AQUI ---
      // 'offlineFirst': Tenta rodar a busca (Firebase) mesmo sem internet.
      // Se falhar, o Firebase cuida de entregar o cache.
      networkMode: 'offlineFirst', 
      
      refetchOnWindowFocus: true, 
      staleTime: 1000 * 60 * 5, 
      retry: 1,
    },
    mutations: {
       networkMode: 'offlineFirst',
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);