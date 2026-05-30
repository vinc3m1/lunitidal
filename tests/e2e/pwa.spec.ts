import { expect, test } from './fixtures';

test('PWA assets are reachable', async ({ page, request }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  for (const path of [
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-512-maskable.png',
    'manifest.webmanifest',
    'sw.js',
    'data/stations-index.json',
    'data/benoa.json',
  ]) {
    const res = await request.get(`/${path}`);
    expect(res.status(), path).toBe(200);
  }
});

test('manifest declares installable icons', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  const manifest = (await res.json()) as { icons: { sizes: string }[]; name: string };
  expect(manifest.name).toContain('Lunitidal');
  expect(manifest.icons.map((i) => i.sizes)).toContain('512x512');
});
