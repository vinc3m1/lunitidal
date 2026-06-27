import { expect, test } from './fixtures';

// The default seed location is southern Bali (Benoa), which has an ordinary day/night cycle, so
// sunrise and sunset both fall inside the displayed day.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
});

test('shows sunrise and sunset times for the day', async ({ page }) => {
  const sun = page.getByTestId('sun-times');
  await expect(sun).toBeVisible();
  // Two clock times (sunrise · sunset).
  await expect(sun).toContainText(/\d{1,2}:\d{2}/);
  const times = (await sun.innerText()).match(/\d{1,2}:\d{2}/g) ?? [];
  expect(times.length).toBe(2);
});

test('shades the tide chart with a day/night gradient band', async ({ page }) => {
  const chart = page.locator('svg[role="slider"]').first();
  // The night band rect + its gradient are only emitted when there is dark to show.
  await expect(chart.locator('rect.nightBand')).toHaveCount(1);
  await expect(chart.locator('#nightBand stop').first()).toBeAttached();
});

test('marks the exact sunrise and sunset instants with hairlines + sun icons', async ({ page }) => {
  const chart = page.locator('svg[role="slider"]').first();
  // One <g.sunMark> for sunrise, one for sunset — each carries an accessible <title>, a hairline,
  // and a half-sun-over-horizon icon (label, not a terminator dot).
  await expect(chart.locator('g.sunMark')).toHaveCount(2);
  await expect(chart.locator('g.sunMark title').first()).toContainText(/Sun(rise|set) \d{1,2}:\d{2}/);
  await expect(chart.locator('g.sunMark line.sunLine')).toHaveCount(2);
  await expect(chart.locator('g.sunMark g.sunIcon')).toHaveCount(2);
});

test('the tide curve is still exactly its two paths (area + line)', async ({ page }) => {
  // The sun icons add <path> arcs, so we count the tide curve by class, not every path.
  const chart = page.locator('svg[role="slider"]').first();
  await expect(chart.locator('path.tideArea, path.tideLine')).toHaveCount(2);
});
