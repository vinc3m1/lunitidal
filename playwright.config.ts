import { defineConfig } from '@playwright/test';

/**
 * E2E runs against a production build served by `vite preview`, so the real
 * service worker + precache are exercised (required for the offline tests).
 * Geolocation is granted + pinned to southern Bali so "use my location" is
 * deterministic.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    viewport: { width: 390, height: 844 },
    permissions: ['geolocation'],
    geolocation: { latitude: -8.7, longitude: 115.22 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        // Headless CI has no GPU; allow software WebGL so MapLibre initialises.
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: 'bun run build && bunx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
