/**
 * Headless UI smoke test (run with `bun run scripts/verify-ui.ts`).
 * Covers Home + location flow (Phase 4) + routing to Detail/Settings (Phases 5/6).
 * No external network (geocoder is online-only and exercised manually).
 */
import { chromium } from '@playwright/test';

const URL = process.env.VERIFY_URL ?? 'http://localhost:5188/';
const clean = (s: string | null) => s?.replace(/\s+/g, ' ').trim() ?? '';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: -8.7, longitude: 115.22 },
  permissions: ['geolocation'],
});
const page = await context.newPage();

const errors: string[] = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('svg[role="slider"]', { timeout: 20_000 });

// Scrub drag updates readout
const before = clean(await page.textContent('.readout'));
const box = await page.locator('svg[role="slider"]').boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}
const after = clean(await page.textContent('.readout'));

// Geolocation snap
await page.getByTestId('change-location').click();
await page.getByTestId('use-my-location').click();
await page.getByTestId('location-sheet').waitFor({ state: 'detached', timeout: 15_000 });
const afterGeo = clean(await page.textContent('header.locbar'));

// Offline station search
await page.getByTestId('change-location').click();
await page.getByTestId('search-input').fill('Benoa');
await page.getByTestId('station-result').first().click();
await page.getByTestId('location-sheet').waitFor({ state: 'detached', timeout: 15_000 });
const afterSearch = clean(await page.textContent('header.locbar'));

// Favorite toggle
await page.getByTestId('toggle-favorite').click();
const favPressed = await page.getByTestId('toggle-favorite').getAttribute('aria-pressed');

// Reload — regression guard for persisted array stores (the favorites `.some` crash).
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('svg[role="slider"]', { timeout: 15_000 });
const reloadOk = (await page.getByTestId('toggle-favorite').getAttribute('aria-pressed')) === 'true';

// Settings: switch to feet, return home, expect 'ft' in readout
await page.getByTestId('nav-settings').click();
await page.getByTestId('unit-ft').click();
await page.getByTestId('nav-back').click();
await page.waitForSelector('svg[role="slider"]', { timeout: 10_000 });
const readoutFt = clean(await page.textContent('.readout'));

// Detail: constituents table populated
await page.getByTestId('nav-detail').click();
await page.getByTestId('constituents').waitFor({ timeout: 10_000 });
const constituentRows = await page.locator('[data-testid="constituents"] tbody tr').count();
const datumOptions = await page.locator('[data-testid="datum-select"] option').count();
await page.getByTestId('nav-back').click();
await page.waitForSelector('svg[role="slider"]', { timeout: 10_000 });

// Map: opens overlay + MapLibre canvas mounts (tiles need network; not asserted)
let mapOpened = false;
try {
  await page.getByTestId('change-location').click();
  await page.getByTestId('open-map').click();
  await page.getByTestId('map-sheet').waitFor({ timeout: 10_000 });
  await page.waitForSelector('.maplibregl-canvas', { timeout: 10_000 });
  mapOpened = true;
  await page.getByTestId('map-close').click();
  await page.getByTestId('map-sheet').waitFor({ state: 'detached', timeout: 10_000 });
} catch (e) {
  errors.push(`map: ${e instanceof Error ? e.message : String(e)}`);
}

await page.screenshot({ path: '/tmp/home.png', fullPage: true });
await browser.close();

console.log('SCRUB_CHANGED:', before !== after);
console.log('GEO_SNAPPED:', /away/.test(afterGeo), '|', afterGeo);
console.log('SEARCH_PICKED:', /Benoa/.test(afterSearch));
console.log('FAV_PRESSED:', favPressed);
console.log('FEET_APPLIED:', /ft/.test(readoutFt), '|', readoutFt);
console.log('CONSTITUENT_ROWS:', constituentRows);
console.log('DATUM_OPTIONS:', datumOptions);
console.log('MAP_OPENED:', mapOpened);
console.log('RELOAD_PERSISTED:', reloadOk);
console.log('PAGE_ERRORS:', errors.length ? errors.join(' | ') : 'none');
const ok =
  errors.length === 0 &&
  before !== after &&
  /away/.test(afterGeo) &&
  /Benoa/.test(afterSearch) &&
  favPressed === 'true' &&
  reloadOk &&
  /ft/.test(readoutFt) &&
  constituentRows > 10 &&
  datumOptions > 1 &&
  mapOpened;
console.log(ok ? 'VERIFY_OK' : 'VERIFY_FAIL');
