/**
 * Headless UI smoke test (run with `bun run scripts/verify-ui.ts`).
 * Covers the Home view + Phase 4 location flow: geolocation snap, offline station
 * search, and favoriting — all without external network (geocoder is online-only
 * and exercised manually).
 */
import { chromium } from '@playwright/test';

const URL = process.env.VERIFY_URL ?? 'http://localhost:5188/';
const clean = (s: string | null) => s?.replace(/\s+/g, ' ').trim() ?? '';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: -8.7, longitude: 115.22 }, // southern Bali
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

// --- Scrub drag updates the readout ---
const before = clean(await page.textContent('.readout'));
const box = await page.locator('svg[role="slider"]').boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}
const after = clean(await page.textContent('.readout'));

// --- Geolocation snap ---
await page.getByTestId('change-location').click();
await page.getByTestId('location-sheet').waitFor();
await page.getByTestId('use-my-location').click();
await page.getByTestId('location-sheet').waitFor({ state: 'detached', timeout: 15_000 });
const afterGeo = clean(await page.textContent('header.locbar'));

// --- Offline station search ---
await page.getByTestId('change-location').click();
await page.getByTestId('search-input').fill('Benoa');
await page.getByTestId('station-result').first().waitFor({ timeout: 10_000 });
await page.getByTestId('station-result').first().click();
await page.getByTestId('location-sheet').waitFor({ state: 'detached', timeout: 15_000 });
const afterSearch = clean(await page.textContent('header.locbar'));

// --- Favorite toggle ---
await page.getByTestId('toggle-favorite').click();
const favPressed = await page.getByTestId('toggle-favorite').getAttribute('aria-pressed');

await page.screenshot({ path: '/tmp/home.png', fullPage: true });
await browser.close();

console.log('SCRUB_CHANGED:', before !== after);
console.log('AFTER_GEO:', afterGeo);
console.log('GEO_SNAPPED:', /away/.test(afterGeo));
console.log('AFTER_SEARCH:', afterSearch);
console.log('SEARCH_PICKED:', /Benoa/.test(afterSearch));
console.log('FAV_PRESSED:', favPressed);
console.log('PAGE_ERRORS:', errors.length ? errors.join(' | ') : 'none');
const ok =
  errors.length === 0 &&
  before !== after &&
  /away/.test(afterGeo) &&
  /Benoa/.test(afterSearch) &&
  favPressed === 'true';
console.log(ok ? 'VERIFY_OK' : 'VERIFY_FAIL');
