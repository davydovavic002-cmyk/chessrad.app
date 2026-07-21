import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    sourcemap: false,
    minify: 'esbuild',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'ChessRad',
        short_name: 'ChessRad',
        description: 'Chess education platform',
        theme_color: '#ff7043',
        background_color: '#fff8f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never cache API or sockets — stale/corrupt SW cache caused ERR_CACHE_READ_FAILURE.
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3011', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:3011', ws: true, changeOrigin: true },
    },
  },
});
