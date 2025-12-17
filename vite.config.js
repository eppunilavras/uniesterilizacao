import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Mantém 'prompt' para usar seu componente de aviso de atualização
      registerType: 'prompt', 
      
      // Mantém as opções de desenvolvimento
      devOptions: {
        enabled: true, 
        type: 'module', 
      },

      // Seus assets originais
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png'],

      manifest: {
        // --- AQUI ESTÃO AS MUDANÇAS DE NOME ---
        // O nome global agora é o Portal
        name: 'Portal Odontologia Unilavras',
        short_name: 'Portal Odonto', 
        description: 'Acesso centralizado aos sistemas da clínica odontológica.',
        
        // --- MANTENDO SUAS CONFIGURAÇÕES VISUAIS ---
        theme_color: '#021D34',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        
        // --- MANTENDO SEUS ÍCONES ORIGINAIS ---
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