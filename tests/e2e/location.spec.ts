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

test('map geolocate pans quickly and completes transition within 600ms even for far-away locations', async ({ page }) => {
  // Grant permission and set mock geolocation to a location far from the default (Bali)
  // We use New York (40.7128, -74.0060)
  await page.context().setGeolocation({ latitude: 40.7128, longitude: -74.0060 });

  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('open-map').click();
  await expect(page.getByTestId('map-sheet')).toBeVisible();

  const mapSheet = page.getByTestId('map-sheet');
  const canvas = mapSheet.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();

  // Click the geolocate control
  const geolocateBtn = mapSheet.locator('.maplibregl-ctrl-geolocate');
  await geolocateBtn.click();

  // Wait for 600ms (which is longer than the 450ms transition duration but much shorter than standard flyTo duration)
  await page.waitForTimeout(600);

  // Verify that the pending marker has arrived and is centered in the map viewport
  const marker = mapSheet.getByTestId('pending-location-marker');
  await expect(marker).toBeVisible();

  const isCentered = await page.evaluate(() => {
    const mapEl = document.querySelector('[data-testid="map-sheet"] .map');
    const markerEl = document.querySelector('[data-testid="map-sheet"] [data-testid="pending-location-marker"]');
    if (!mapEl || !markerEl) return false;

    const mapRect = mapEl.getBoundingClientRect();
    const markerRect = markerEl.getBoundingClientRect();

    const mapCenterX = mapRect.left + mapRect.width / 2;
    const mapCenterY = mapRect.top + mapRect.height / 2;

    const markerBottomX = markerRect.left + markerRect.width / 2;
    const markerBottomY = markerRect.bottom;

    // The marker should be very close to the center of the map (within 15 pixels)
    const dx = Math.abs(mapCenterX - markerBottomX);
    const dy = Math.abs(mapCenterY - markerBottomY);
    return dx < 15 && dy < 15;
  });

  expect(isCentered).toBe(true);
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

test('searching and selecting a subordinate station works without crashes and displays offsets', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('search-input').fill('Kashega Bay');
  
  // Wait for the station result to appear and click it
  await page.getByTestId('station-result').first().click();
  await page.getByTestId('location-sheet').waitFor({ state: 'detached' });
  
  // Verify that the location is set to Kashega Bay
  const bar = page.locator('header.locbar');
  await expect(bar.locator('.name')).toHaveText('Kashega Bay');

  // Verify that the tide predictions are visible (extremes table loaded successfully)
  await expect(page.locator('.extremes li').first()).toBeVisible();

  // Verify that the map displays the subordinate selected marker hexagon
  await expect(page.locator('.selected-station-marker.subordinate')).toBeVisible();

  // Navigate to Detail view and verify that Subordinate Offsets are displayed
  await page.getByTestId('nav-detail').click();
  await expect(page.getByRole('heading', { name: 'Subordinate Offsets' })).toBeVisible();
});

test('token-based multi-word search matches "Oakland, CA" successfully', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  
  // Search for "oakland ca" in any order/case
  await page.getByTestId('search-input').fill('oakland ca');
  
  // Verify that the station "Oakland" appears in the results
  const result = page.getByTestId('station-result').first();
  await expect(result).toBeVisible();
  await expect(result).toContainText('Oakland');
  await expect(result).toContainText('CA');
});
