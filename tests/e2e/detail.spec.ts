import { expect, test } from './fixtures';

test('detail view lists the harmonic constituents and datum table', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  await page.getByTestId('nav-detail').click();
  await expect(page.locator('[data-testid="constituents"] tbody tr')).toHaveCount(50);
  // The station's 8 datums, read-only — there is deliberately no datum switcher.
  await expect(page.locator('[data-testid="datums"] tbody tr')).toHaveCount(8);
  await expect(page.getByTestId('datum-select')).toHaveCount(0);
  // The station's chart datum is called out in the table.
  await expect(page.locator('[data-testid="datums"]')).toContainText('(chart datum)');
});

test('heights are always shown above the station chart datum', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  // Benoa seed station's chart datum is LAT.
  await expect(page.locator('.datum').first()).toContainText('Heights above LAT');
});
