import { expect, test } from './fixtures';

test('“use my location” snaps to the nearest station with confidence', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('use-my-location').click();
  await page.getByTestId('search-results-dropdown').waitFor({ state: 'detached' });
  const bar = page.locator('header.locbar');
  // The closest-station chip carries the snapped station, distance + confidence.
  const chip = page.getByTestId('closest-station');
  await expect(chip).toContainText('Closest station');
  await expect(chip).toContainText('away');
  await expect(chip).toContainText(/good match|approximate|rough estimate|nearest available/);
  // The title is the reverse-geocoded place, never a stale "my location".
  await expect(bar).not.toContainText(/my location/i);
  await expect(page.locator('header.locbar .name')).toContainText('Denpasar');
});

test('offline station-name search selects a station', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('map-search-input').fill('Benoa');
  await page.getByTestId('station-result').first().click();
  await page.getByTestId('search-results-dropdown').waitFor({ state: 'detached' });
  await expect(page.locator('header.locbar .name')).toHaveText('Benoa');
});

test('online place search selects a place and updates the location', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('change-location').click();
  await page.getByTestId('map-search-input').fill('Tanjung Benoa');
  await page.getByTestId('place-result').first().click();
  await page.getByTestId('search-results-dropdown').waitFor({ state: 'detached' });
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
  await page.getByTestId('expand-map').click();
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
  await page.getByTestId('expand-map').click();
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
  await page.getByTestId('expand-map').click();
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
  await page.getByTestId('map-search-input').fill('Kashega Bay');
  
  // Wait for the station result to appear and click it
  await page.getByTestId('station-result').first().click();
  await page.getByTestId('search-results-dropdown').waitFor({ state: 'detached' });
  
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
  await page.getByTestId('map-search-input').fill('oakland ca');
  
  // Verify that the station "Oakland" appears in the results
  const result = page.getByTestId('station-result').first();
  await expect(result).toBeVisible();
  await expect(result).toContainText('Oakland');
  await expect(result).toContainText('CA');
});

test('online place search with state abbreviation matches "Oakland CA" successfully', async ({ page }) => {
  // Mock the geocoding API for this test to return Oakland, California, simulating suffix matching
  await page.route(/geocoding-api\.open-meteo\.com/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: 99999,
            name: 'Oakland',
            admin1: 'California',
            country: 'United States',
            latitude: 37.8044,
            longitude: -122.2712,
          },
        ],
      }),
    });
  });

  await page.goto('/');
  await page.getByTestId('change-location').click();
  
  // Search for "Oakland CA" (Open-Meteo place geocoding API)
  await page.getByTestId('map-search-input').fill('Oakland CA');
  
  // Verify that the place result "Oakland, California" appears
  const result = page.getByTestId('place-result').first();
  await expect(result).toBeVisible();
  await expect(result).toContainText('Oakland');
  await expect(result).toContainText('California');
});

test('search bar moves to overlay when expanded and back to inline when shrunk', async ({ page }) => {
  await page.goto('/');
  
  // 1. Initially, search bar is visible in inline map card
  const inlineSearch = page.locator('[data-testid="home-map"] [data-testid="map-search-input"]');
  await expect(inlineSearch).toBeVisible();
  
  // 2. Expand map
  await page.getByTestId('expand-map').click();
  await expect(page.getByTestId('map-sheet')).toBeVisible();
  
  // 3. Search bar is now visible at the top of the overlay map, and hidden in the inline map
  const overlaySearch = page.locator('[data-testid="map-sheet"] [data-testid="map-search-input"]');
  await expect(overlaySearch).toBeVisible();
  await expect(inlineSearch).toHaveCount(0); // inline search is hidden/detached
  
  // 4. Shrink/Close map
  await page.getByTestId('map-close').click();
  
  // 5. Search bar is visible in inline map again
  await expect(inlineSearch).toBeVisible();
});

test('selected station marker is shifted vertically clear of the search bar', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  
  // Wait for the initial map load and easeTo animation (450ms duration) to complete
  await page.waitForTimeout(650);
  
  // Verify that the inline map marker sits in the lower part of the viewport (y coordinate is greater than half the map height)
  const mapEl = page.locator('[data-testid="home-map"] .map');
  const markerEl = page.locator('[data-testid="home-map"] [data-testid="selected-station-marker"]');
  
  await expect(mapEl).toBeVisible();
  await expect(markerEl).toBeVisible();
  
  const isOffset = await page.evaluate(() => {
    const map = document.querySelector('[data-testid="home-map"] .map');
    const marker = document.querySelector('[data-testid="home-map"] [data-testid="selected-station-marker"]');
    if (!map || !marker) return false;
    
    const mapRect = map.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    
    const mapCenterY = mapRect.top + mapRect.height / 2;
    const markerCenterY = markerRect.top + markerRect.height / 2;
    
    // The marker should be pushed downwards, so its Y coordinate should be greater than the map center Y
    // (since positive Y goes down in client coordinates)
    return markerCenterY > mapCenterY + 10;
  });
  
  expect(isOffset).toBe(true);
});

test('navigation zoom controls are positioned in the bottom-right stacking area', async ({ page }) => {
  await page.goto('/');
  
  // Verify navigation controls are visible inside the map
  const mapEl = page.locator('[data-testid="home-map"] .map');
  await expect(mapEl).toBeVisible();
  
  const isBottomRight = await page.evaluate(() => {
    const map = document.querySelector('[data-testid="home-map"] .map');
    const ctrls = document.querySelectorAll('[data-testid="home-map"] .maplibregl-ctrl-group');
    if (!map || ctrls.length === 0) return false;
    
    const mapRect = map.getBoundingClientRect();
    const mapCenterX = mapRect.left + mapRect.width / 2;
    const mapCenterY = mapRect.top + mapRect.height / 2;
    
    // Verify that every control group on the map is placed in the bottom-right quadrant
    for (const ctrl of Array.from(ctrls)) {
      const ctrlRect = ctrl.getBoundingClientRect();
      if (ctrlRect.left < mapCenterX || ctrlRect.top < mapCenterY) {
        return false;
      }
    }
    return true;
  });
  
  expect(isBottomRight).toBe(true);
});

test('openfreemap attribution is stacked below the zoom controls', async ({ page }) => {
  await page.goto('/');

  // Wait for the map and its zoom controls to render. (We assert on DOM source
  // order rather than rendered geometry so the check is deterministic even when
  // the map tiles/attribution text fail to load, e.g. offline.)
  const mapEl = page.locator('[data-testid="home-map"] .map');
  await expect(mapEl).toBeVisible();
  await expect(page.locator('[data-testid="home-map"] .maplibregl-ctrl-zoom-in')).toBeAttached();

  const attribAfterZoom = await page.evaluate(() => {
    // In MapLibre's bottom corners, controls are prepended, so the *last* DOM
    // child renders at the very bottom. The attribution must come after the
    // zoom control group to sit below it.
    const corner = document.querySelector('[data-testid="home-map"] .maplibregl-ctrl-bottom-right');
    const zoomGroup = corner
      ?.querySelector('.maplibregl-ctrl-zoom-in')
      ?.closest('.maplibregl-ctrl-group');
    const attrib = corner?.querySelector('.maplibregl-ctrl-attrib');
    if (!corner || !zoomGroup || !attrib) return false;

    const children = Array.from(corner.children);
    return children.indexOf(attrib) > children.indexOf(zoomGroup);
  });

  expect(attribAfterZoom).toBe(true);
});

test('search results show both stations and places simultaneously when both match', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('expand-map').click();
  await expect(page.getByTestId('map-sheet')).toBeVisible();

  // "Benoa" matches station index entries AND the geocode mock returns Tanjung Benoa
  const searchInput = page.getByTestId('map-search-input').last();
  await searchInput.fill('Benoa');

  // Both section titles should be visible at the same time (not buried below the fold)
  const dropdown = page.getByTestId('search-results-dropdown');
  await expect(dropdown).toBeVisible();
  await expect(dropdown.getByTestId('station-result').first()).toBeVisible();
  await expect(dropdown.getByTestId('place-result').first()).toBeVisible();
});

test('search results dropdown is scrollable and has adequate height', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('expand-map').click();
  await expect(page.getByTestId('map-sheet')).toBeVisible();

  const searchInput = page.getByTestId('map-search-input').last();
  await searchInput.fill('Benoa');

  const dropdown = page.getByTestId('search-results-dropdown');
  await expect(dropdown).toBeVisible();

  // The dropdown should have enough height to be usable (at least 120px)
  const height = await dropdown.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(120);
});
