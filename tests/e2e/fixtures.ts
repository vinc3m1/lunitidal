import { test as base, expect } from '@playwright/test';

// External/runtime resource failures we don't control (offline tests intentionally
// break these). Genuine app JS errors and uncaught exceptions are NEVER ignored —
// that's what catches regressions like the favorites ".some is not a function" crash.
const IGNORE =
  /Failed to load resource|net::ERR|ERR_INTERNET|marine-api\.open-meteo|geocoding-api\.open-meteo|openfreemap|the server responded with a status|WebGL|SwiftShader|software rendering|GroupMarkerNotSet/i;

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
      await use(errors);
      expect(errors, 'no unexpected console/page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
