import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      
      // Arquivos estáticos importantes que estão na public (ajuste se necessário)
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png'], 
      
      manifest: {
        name: 'Controle de Esterilização Unilavras', // Nome completo na instalação
        short_name: 'UniEsterilização', // Nome que aparece embaixo do ícone no celular
        description: 'Sistema de controle de fluxo de esterilização.',
        
        // --- CORES DO SEU TEMA ---
        theme_color: '#021D34', // Azul Escuro (Login/Sidebar) - Pinta a barra de status do celular
        background_color: '#F8FAFC', // Fundo Cinza Claro (MainLayout) - Cor de fundo ao abrir
        
        display: 'standalone', // Remove a barra de URL (aparência de app nativo)
        orientation: 'portrait', // Bloqueia rotação (opcional, remova se quiser permitir paisagem)
        
        // --- ÍCONES (Caminhos ajustados para sua pasta public/icons) ---
        icons: [
          {
            src: 'icons/pwa-192x192.png', // Certifique-se que o arquivo tem esse nome
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-512x512.png', // Certifique-se que o arquivo tem esse nome
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'  
          },
          {
            src: 'icons/maskable-icon-512x512.png', // Ícone que se adapta (arredondado/quadrado)
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})