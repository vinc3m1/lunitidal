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

test('marks the exact sunrise and sunset instants with hairlines', async ({ page }) => {
  const chart = page.locator('svg[role="slider"]').first();
  // One <g.sunMark> for sunrise, one for sunset — each carries an accessible <title>.
  await expect(chart.locator('g.sunMark')).toHaveCount(2);
  await expect(chart.locator('g.sunMark title').first()).toContainText(/Sun(rise|set) \d{1,2}:\d{2}/);
});

test('the tide curve is still exactly two paths (band/markers are not paths)', async ({ page }) => {
  // Guards the home.spec path-count invariant against the shading additions.
  await expect(page.locator('svg[role="slider"]').first().locator('path')).toHaveCount(2);
});
