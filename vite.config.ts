import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/handlog/"); local dev serves from "/".
const base = process.env.BASE_PATH ?? '/'
const dark = '#0b0f0e'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Ask before swapping in a new version, so an update never reloads mid-capture.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'HandLog',
        short_name: 'HandLog',
        description: "Log live No Limit Hold'em hands fast, study them later.",
        theme_color: dark,
        background_color: dark,
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        categories: ['games', 'productivity', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app so it opens and works with no signal in the card room.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: 'dexie', test: /node_modules[\\/](dexie|dexie-react-hooks)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
