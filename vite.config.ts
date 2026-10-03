import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Reihenfolge zählt: Workbox nimmt die erste passende Regel.
          // Realtime ist ein endloser SSE-Stream — der darf NIE in einen Cache-Handler.
          {
            urlPattern: /^https:\/\/api\.responda\.systems\/api\/realtime/i,
            handler: 'NetworkOnly',
          },
          // EKS synchronisiert selbst über IndexedDB. Eine gecachte Antwort würde
          // offline als Erfolg gewertet und den Sync-Stand verfälschen.
          {
            urlPattern: /^https:\/\/api\.responda\.systems\/api\/(batch|collections\/eks_)/i,
            handler: 'NetworkOnly',
          },
          // Das Lager hält offline einen eigenen Zwischenspeicher. Eine gecachte
          // Antwort würde als Erfolg gewertet und einen 24 Stunden alten Bestand
          // als aktuell ausgeben.
          {
            urlPattern: /^https:\/\/api\.responda\.systems\/api\/collections\/inventory_/i,
            handler: 'NetworkOnly',
          },
          // Die Texterkennung der Gesundheitskarte wird beim ersten Mal aus
          // dem Netz geholt. Danach liegt sie im Zwischenspeicher, damit sie
          // im Funkloch nicht fehlt. Sie ist unveraenderlich versioniert,
          // deshalb CacheFirst.
          //
          // Es sind drei Dinge an zwei Orten: die Bibliothek und der
          // WASM-Kern unter npm/tesseract.js…, die Sprachdaten unter
          // npm/@tesseract.js-data/deu. Ein Muster nur auf "npm/tesseract"
          // trifft die Sprachdaten NICHT — dann laedt die Erkennung offline
          // zwar, findet aber kein Deutsch.
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@tesseract\.js-data|tesseract\.js)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'texterkennung',
              expiration: { maxEntries: 20, maxAgeSeconds: 180 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'texterkennung',
              expiration: { maxEntries: 20, maxAgeSeconds: 180 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/api\.responda\.systems\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'Responda',
        short_name: 'Responda',
        description: 'Responda – Einsatzdokumentation',
        theme_color: '#c0392b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
