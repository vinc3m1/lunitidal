import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
});

test('renders the tide chart with the day’s extremes', async ({ page }) => {
  const extremes = await page.locator('.extremes li').count();
  expect(extremes).toBeGreaterThanOrEqual(3);
  expect(extremes).toBeLessThanOrEqual(5);
  // area fill + curve line of the tide chart specifically
  await expect(page.locator('svg[role="slider"]').first().locator('path')).toHaveCount(2);
});

test('shows an answer-first readout', async ({ page }) => {
  await expect(page.locator('.readout')).toContainText(/Rising|Falling/);
  await expect(page.locator('.readout')).toContainText(/\d/);
});

test('shows an embedded map on the home page', async ({ page }) => {
  await expect(page.getByTestId('home-map-card')).toBeVisible();
  await expect(page.getByTestId('home-map').locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('home-map').getByTestId('current-location-marker')).toBeVisible();
  await expect(page.getByTestId('home-map').getByTestId('selected-station-marker')).toBeVisible();
});

test('map geolocate marks current location for one-click selection', async ({ page }) => {
  const map = page.getByTestId('home-map');
  await expect(map.locator('.maplibregl-canvas')).toBeVisible();
  await map.locator('.maplibregl-ctrl-geolocate').click();
  await expect(map.getByTestId('pending-location-marker')).toBeVisible();
  await expect(map.getByTestId('use-pin')).toHaveText('Use this location');
});

test('scrubbing the chart updates the readout', async ({ page }) => {
  const readout = page.locator('.readout');
  const before = (await readout.innerText()).trim();
  const box = await page.locator('svg[role="slider"]').first().boundingBox();
  if (!box) throw new Error('no chart box');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(readout).not.toHaveText(before);
});

test('chart is keyboard-operable with arrow/Home/End keys', async ({ page }) => {
  const slider = page.locator('svg[role="slider"]').first();
  const readout = page.locator('.readout');
  const min = (await slider.getAttribute('aria-valuemin'))!;
  const max = (await slider.getAttribute('aria-valuemax'))!;
  await slider.focus();

  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', min);

  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => Number(await slider.getAttribute('aria-valuenow')))
    .toBeGreaterThan(Number(min));

  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', max);
  await expect(readout).toContainText(/Next (high|low)/);
  await expect(readout).not.toContainText('(in ');

  // Announced value is human-readable (time + height), not raw milliseconds.
  await expect(slider).toHaveAttribute('aria-valuetext', /\d{1,2}:\d{2}/);
});

test('day navigation changes the displayed day', async ({ page }) => {
  const label = page.locator('.daynav .day');
  const today = (await label.innerText()).trim();
  await page.locator('.daynav button[aria-label="Next day"]').click();
  await expect(label).not.toHaveText(today);
});

test('uses a two-column home layout on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.reload();
  await page.waitForSelector('svg[role="slider"]');

  const main = await page.locator('.main-column').boundingBox();
  const map = await page.getByTestId('home-map-card').boundingBox();
  if (!main || !map) throw new Error('home layout boxes were not available');

  expect(map.x).toBeGreaterThan(main.x + main.width - 1);
});
