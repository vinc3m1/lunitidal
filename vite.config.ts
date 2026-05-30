import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves project sites under /<repo>/ — the deploy workflow sets
// BASE_PATH=/lunitidal/. Locally this stays '/'. Routing is hash-based, so only
// asset URLs care about the base.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'data/*.json'],
      manifest: {
        name: 'Lunitidal — Tide Predictions',
        short_name: 'Lunitidal',
        description: 'Offline-first tide predictions, computed on-device.',
        theme_color: '#0b1f3a',
        background_color: '#0b1f3a',
        display: 'standalone',
        id: base,
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,png,woff2}'],
        // Precache the app shell + slim index + benoa seed, but NOT the thousands of
        // per-station constituent files (those are runtime-cached on demand below).
        globIgnores: ['**/data/stations/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Seed station data + index are precached so first launch works offline.
        runtimeCaching: [
          {
            // Lazily-loaded per-station constituents: cache-first once fetched.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/stations/'),
            handler: 'CacheFirst',
            options: { cacheName: 'station-constituents' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
