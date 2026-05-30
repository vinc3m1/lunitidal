import { expect, test } from './fixtures';

test('“use my location” snaps to the nearest station with confidence', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('use-my-location').click();
  await page.getByTestId('location-sheet').waitFor({ state: 'detached' });
  const bar = page.locator('header.locbar');
  await expect(bar).toContainText('away');
  await expect(bar).toContainText(/good match|approximate|rough estimate|nearest available/);
  // Label is the nearest station, never a stale "my location".
  await expect(bar).not.toContainText(/my location/i);
  await expect(page.locator('header.locbar .name')).not.toHaveText('');
});

test('offline station-name search selects a station', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('search-input').fill('Benoa');
  await page.getByTestId('station-result').first().click();
  await page.getByTestId('location-sheet').waitFor({ state: 'detached' });
  await expect(page.locator('header.locbar .name')).toHaveText('Benoa');
});

test('online place search selects a place and updates the location', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('search-input').fill('Tanjung Benoa');
  await page.getByTestId('place-result').first().click();
  await page.getByTestId('location-sheet').waitFor({ state: 'detached' });
  const bar = page.locator('header.locbar');
  await expect(bar.locator('.name')).toHaveText('Tanjung Benoa, Bali, Indonesia');
  await expect(bar).toContainText('Benoa'); // Snaps to Benoa tide station
});

test('favorite persists across reload (regression: persisted arrays)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  const star = page.getByTestId('toggle-favorite');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.getByTestId('toggle-favorite')).toHaveAttribute('aria-pressed', 'true');
});

test('map opens with a MapLibre canvas', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('open-map').click();
  await expect(page.getByTestId('map-sheet')).toBeVisible();
  await expect(page.getByTestId('map-sheet').locator('.maplibregl-canvas')).toBeVisible();
  await page.getByTestId('map-close').click();
  await expect(page.getByTestId('map-sheet')).toHaveCount(0);
});

test('dropping a pin on the map displays the "Use this location" button', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('open-map').click();
  await expect(page.getByTestId('map-sheet')).toBeVisible();

  // Click on the map canvas to drop a pin
  const canvas = page.getByTestId('map-sheet').locator('.maplibregl-canvas');
  await canvas.click({ position: { x: 100, y: 100 } });

  // Verify that the "Use this location" button appears and is visible
  const usePinBtn = page.getByTestId('use-pin');
  await expect(usePinBtn).toBeVisible();
  await expect(usePinBtn).toHaveText('Use this location');

  // Verify that MapLibre's attribution is in compact form
  const attrib = page.getByTestId('map-sheet').locator('.maplibregl-ctrl-attrib');
  await expect(attrib).toHaveClass(/maplibregl-compact/);
});
