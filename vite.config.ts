import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Bulk AI',
          short_name: 'BulkAI',
          description: 'The Ultimate English Learning AI',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /https:\/\/fonts\.googleapis\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /https:\/\/fonts\.gstatic\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
              },
            },
          ],
        },
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: (process.env.DISABLE_HMR === 'true' || env.DISABLE_HMR === 'true')
        ? false 
        : {
            protocol: 'wss',
            clientPort: 443,
          },
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: (process.env.DISABLE_HMR === 'true' || env.DISABLE_HMR === 'true') ? null : {},
    },
  };
});
