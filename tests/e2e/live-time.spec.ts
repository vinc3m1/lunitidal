import { expect, test } from './fixtures';

test('the live readout follows time but preserves a manually scrubbed instant', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-22T07:00:00Z') });
  await page.goto('/');
  const chart = page.locator('svg[role="slider"]').first();
  await expect(chart).toBeVisible();
  const before = Number(await chart.getAttribute('aria-valuenow'));
  await page.clock.fastForward(120_000);
  await expect.poll(async () => Number(await chart.getAttribute('aria-valuenow')))
    .toBeGreaterThanOrEqual(before + 120_000);
  await expect(page.locator('.readout')).toContainText('now');
  await chart.focus();
  await page.keyboard.press('Home');
  const scrubbed = await chart.getAttribute('aria-valuenow');
  await page.clock.fastForward(120_000);
  await expect(chart).toHaveAttribute('aria-valuenow', scrubbed!);
});
