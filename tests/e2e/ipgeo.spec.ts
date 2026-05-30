import { expect, test } from './fixtures';

test('first visit defaults to an IP-based location, snapped to nearest station', async ({ page }) => {
  // Override the fixture's default abort with a deterministic IP response (Bali).
  await page.route(/get\.geojs\.io/, (route) =>
    route.fulfill({
      json: { latitude: '-8.70', longitude: '115.22', city: 'Testville', country: 'Testland' },
    }),
  );
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');

  const bar = page.locator('header.locbar');
  await expect(bar).toContainText('Testville, Testland');
  await expect(bar).toContainText('away'); // distance to the nearest station is shown
});

test('falls back to the seed location when IP geolocation fails', async ({ page }) => {
  // fixtures.ts already aborts geojs → first load should land on the Benoa seed.
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.locator('header.locbar .name')).toHaveText('Benoa');
});
