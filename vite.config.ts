import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// The custom domain serves the app at the root. If this is deployed as a
// GitHub Pages project site again, set BASE_PATH to the repository path.
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
        // per-station constituent files OR the thousands of prerendered station pages
        // (both are runtime-cached / served from the shell on demand instead).
        globIgnores: ['**/data/stations/**', '**/tides/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Navigations (incl. `/tides/<slug>/` deep links) fall back to the precached
        // shell when offline; the SPA then routes from the URL. Keep non-document
        // assets (sitemap, robots, station JSON) off the fallback so they hit network.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/data\//],
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
