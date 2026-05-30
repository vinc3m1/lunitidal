/**
 * Headless UI smoke test (run with `bun run scripts/verify-ui.ts`).
 * Loads the running dev server in a mobile viewport, confirms the tide chart and
 * readout render, exercises a scrub drag, and screenshots the result.
 */
import { chromium } from '@playwright/test';

const URL = process.env.VERIFY_URL ?? 'http://localhost:5188/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const errors: string[] = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('svg[role="slider"]', { timeout: 20_000 });

const readoutBefore = (await page.textContent('.readout'))?.replace(/\s+/g, ' ').trim();

// Drag the scrub line across the chart.
const svg = page.locator('svg[role="slider"]');
const box = await svg.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}
const readoutAfter = (await page.textContent('.readout'))?.replace(/\s+/g, ' ').trim();

const locbar = (await page.textContent('header.locbar'))?.replace(/\s+/g, ' ').trim();
const extremes = await page.locator('.extremes li').count();
const pathLen = await page.locator('svg[role="slider"] path').count();

await page.screenshot({ path: '/tmp/home.png', fullPage: true });
await browser.close();

console.log('LOCBAR:', locbar);
console.log('READOUT_BEFORE:', readoutBefore);
console.log('READOUT_AFTER :', readoutAfter);
console.log('EXTREMES_ROWS:', extremes);
console.log('CHART_PATHS:', pathLen);
console.log('SCRUB_CHANGED:', readoutBefore !== readoutAfter);
console.log('PAGE_ERRORS:', errors.length ? errors.join(' | ') : 'none');
console.log(errors.length === 0 && extremes > 0 && pathLen >= 2 ? 'VERIFY_OK' : 'VERIFY_FAIL');
