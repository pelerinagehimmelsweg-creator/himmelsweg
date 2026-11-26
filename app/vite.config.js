import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// L'app est une « PWA » : elle s'installe sur l'écran d'accueil du téléphone
// et continue de fonctionner sans réseau (fichiers gardés par le service worker).
export default defineConfig({
  build: { chunkSizeWarningLimit: 800 },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Himmelsweg',
        short_name: 'Himmelsweg',
        description: 'Application du pèlerinage Himmelsweg',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f1e4',
        theme_color: '#b32d24',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-masquable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
});
