import { expect, test } from './fixtures';

test('detail view lists the harmonic constituents and datum options', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  await page.getByTestId('nav-detail').click();
  await expect(page.locator('[data-testid="constituents"] tbody tr')).toHaveCount(50);
  // Auto + the station's 8 datums
  await expect(page.locator('[data-testid="datum-select"] option')).toHaveCount(9);
});

test('changing the chart datum changes displayed heights', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  const extremes = page.locator('.extremes');
  const before = (await extremes.innerText()).trim();
  await page.getByTestId('nav-detail').click();
  await page.getByTestId('datum-select').selectOption('MSL');
  await page.getByTestId('nav-back').click();
  await page.waitForSelector('svg[role="slider"]');
  await expect(extremes).not.toHaveText(before);
});
