import { test as base, expect } from '@playwright/test';

// External/runtime resource failures we don't control (offline tests intentionally
// break these). Genuine app JS errors and uncaught exceptions are NEVER ignored —
// that's what catches regressions like the favorites ".some is not a function" crash.
const IGNORE =
  /Failed to load resource|net::ERR|ERR_INTERNET|marine-api\.open-meteo|geocoding-api\.open-meteo|openfreemap|the server responded with a status|WebGL|SwiftShader|software rendering|GroupMarkerNotSet|^Ae$|^TypeError: Failed to fetch$/i;

/**
 * Every test using `page` automatically fails if the page logs an uncaught
 * exception or an unexpected console error.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (!IGNORE.test(text)) errors.push(`console: ${text}`);
      });

      // Mock the marine-api.open-meteo.com to make tests fast, independent of external network,
      // and completely reliable without timeouts.
      await page.route(/marine-api\.open-meteo\.com/, async (route) => {
        const times: string[] = [];
        const waveHeights: number[] = [];
        const swellHeights: number[] = [];
        const swellPeriods: number[] = [];

        // Generate 48 hourly points relative to the current UTC day
        const baseDate = new Date();
        baseDate.setUTCHours(0, 0, 0, 0);

        for (let i = 0; i < 48; i++) {
          const t = new Date(baseDate.getTime() + i * 3_600_000);
          const timeStr = t.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
          times.push(timeStr);

          const angle = (i / 24) * Math.PI;
          waveHeights.push(1.0 + Math.sin(angle) * 1.4); // peak is 2.4m
          swellHeights.push(0.5 + Math.sin(angle) * 0.6); // peak is 1.1m
          swellPeriods.push(8 + Math.round(Math.sin(angle) * 4)); // peak is 12s
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            hourly: {
              time: times,
              wave_height: waveHeights,
              swell_wave_height: swellHeights,
              swell_wave_period: swellPeriods,
            },
          }),
        });
      });

      // Default: block IP geolocation so the first-load default is deterministically the
      // bundled seed (Benoa). Tests that want the IP path register their own route first.
      await page.route(/get\.geojs\.io/, (route) => route.abort());
      await use(errors);
      expect(errors, 'no unexpected console/page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
