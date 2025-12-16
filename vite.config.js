import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Isso segura a atualização e gera o estado "aguardando"
      
      // --- ADICIONE ESTE BLOCO ---
      devOptions: {
        enabled: true, // Habilita o PWA no npm run dev
        type: 'module', // Necessário para versões recentes do Vite
      },
      // ---------------------------

      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Controle de Esterilização Unilavras',
        short_name: 'UniEsterilização',
        description: 'Sistema de controle de fluxo de esterilização.',
        theme_color: '#021D34',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})