import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const ONE_DAY = 1000 * 60 * 60 * 24;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      // Cada volta à aba refazia as consultas e gastava leituras do Firestore.
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      // Precisa ser >= maxAge da persistência, senão o cache salvo é descartado.
      gcTime: ONE_DAY,
      retry: 1,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

// Cache do React Query salvo no IndexedDB: recarregar a página, abrir outra aba
// ou receber atualização do PWA não baixa de novo o diretório inteiro.
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get(key),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: "unilavras_query_cache",
});

// Só consultas caras e com dados serializáveis vão para o disco.
const PERSISTED_KEYS = ["users_directory", "materialTypes", "dashboard_stats"];

const persistOptions = {
  persister,
  maxAge: ONE_DAY,
  // Mudou o formato dos dados? Troque o buster para descartar o cache antigo.
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === "success" &&
      PERSISTED_KEYS.includes(query.queryKey[0]),
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
