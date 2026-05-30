/**
 * Quick visual capture for manual/agent verification.
 * Run: SHOT_URL=http://localhost:5188/ SHOT_OUT=/tmp/home.png bun run scripts/screenshot.ts
 * Optional SHOT_STORAGE = JSON localStorage seed; SHOT_FULL=0 to disable full-page.
 */
import { chromium } from '@playwright/test';

const URL = process.env.SHOT_URL ?? 'http://localhost:5188/';
const OUT = process.env.SHOT_OUT ?? '/tmp/shot.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: -8.7, longitude: 115.22 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
// Deterministic default: block IP geo so we land on the bundled seed.
await page.route(/get\.geojs\.io/, (r) => r.abort());
if (process.env.SHOT_STORAGE) {
  const seed = process.env.SHOT_STORAGE;
  await page.addInitScript((s) => {
    const data = JSON.parse(s) as Record<string, unknown>;
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, seed);
}
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('svg[role="slider"]', { timeout: 20_000 });
if (process.env.SHOT_FOCUS) {
  await page.locator('svg[role="slider"]').focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
}
if (process.env.SHOT_CLICK) {
  await page.getByTestId(process.env.SHOT_CLICK).click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: OUT, fullPage: process.env.SHOT_FULL !== '0' });
await browser.close();
console.log('wrote', OUT);
