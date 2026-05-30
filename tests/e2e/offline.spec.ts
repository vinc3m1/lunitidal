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
