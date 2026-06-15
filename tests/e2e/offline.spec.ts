import { expect, test } from './fixtures';

test('works offline after first load (service worker precache)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  // Wait for the service worker to take control so the reload is served from cache.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await page.context().setOffline(true);
  await page.reload();

  await page.waitForSelector('svg[role="slider"]', { timeout: 20_000 });
  await expect(page.locator('.extremes li').first()).toBeVisible();
  await expect(page.locator('.readout')).toContainText(/Rising|Falling/);
});

test('a station deep link still renders after going offline', async ({ page }) => {
  await page.goto('/tides/benoa-indonesia/');
  await page.waitForSelector('svg[role="slider"]');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await page.context().setOffline(true);
  await page.reload();

  // Offline, the SW serves the shell for the /tides/ navigation; the SPA re-routes
  // from the URL and renders a chart (the cached station, or the precached seed).
  await page.waitForSelector('svg[role="slider"]', { timeout: 20_000 });
  await expect(page.locator('.extremes li').first()).toBeVisible();
});

test('marine card degrades gracefully when offline', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('marine-card').waitFor();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByTestId('marine-card')).toContainText(/connection/i);
});
