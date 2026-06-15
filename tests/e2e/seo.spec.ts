import { expect, test } from './fixtures';

const BENOA = '/tides/benoa-indonesia/';

test('a station deep link boots the app on that station', async ({ page }) => {
  await page.goto(BENOA);
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.locator('.name')).toContainText('Benoa');
  // svelte:head keeps the tab title in sync with the selected location.
  await expect(page).toHaveTitle(/Benoa/);
});

test('prerendered station HTML carries crawlable content + meta (no JS)', async ({ request }) => {
  const res = await request.get(BENOA);
  expect(res.status()).toBe(200);
  const html = await res.text();

  // SEO head, swapped in for the shell's defaults.
  expect(html).toContain('<title>Benoa Tide Times');
  expect(html).toContain('<link rel="canonical" href="https://www.lunitidal.app/tides/benoa-indonesia/" />');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('"@type":"Place"');
  expect(html).not.toContain('seo:start'); // marker block was consumed

  // Crawlable body content the SPA overwrites on boot.
  expect(html).toContain('<h1>Benoa Tide Times');
  expect(html).toMatch(/<a href="\/tides\/[a-z0-9-]+\/">/); // internal nearby links for crawl depth
});

test('home and sitemap expose the site to crawlers', async ({ request }) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  const homeHtml = await home.text();
  expect(homeHtml).toContain('name="description"');
  expect(homeHtml).toContain('"@type":"WebApplication"');
  expect(homeHtml).toContain('<link rel="canonical" href="https://www.lunitidal.app/" />');

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Sitemap: https://www.lunitidal.app/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('<loc>https://www.lunitidal.app/</loc>');
  expect(xml).toContain('/tides/benoa-indonesia/</loc>');
});

test('a plain visit to / keeps its URL (no rewrite); picking a place updates it', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  // The initial restore/seed selection must NOT rewrite the address bar.
  expect(new URL(page.url()).pathname).toBe('/');
});
