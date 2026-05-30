/**
 * Generate PWA icons (run with `bun run scripts/gen-icons.ts`).
 * Rasterizes an inline SVG via the already-installed Playwright Chromium — no extra
 * image tooling. Writes to public/icons/ (committed; the manifest references them).
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const glyph = `
  <g fill="none" stroke="#4cc2ff" stroke-width="26" stroke-linecap="round">
    <path d="M64 312 C 128 246, 192 246, 256 312 S 384 378, 448 312" opacity="0.5" />
    <path d="M64 250 C 128 184, 192 184, 256 250 S 384 316, 448 250" />
  </g>
  <circle cx="372" cy="150" r="40" fill="#ffb454" />`;

const svg = (maskable: boolean) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b1f3a" />
  ${maskable ? `<g transform="translate(76.8 76.8) scale(0.7)">${glyph}</g>` : glyph}
</svg>`;

await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
const browser = await chromium.launch();

const targets: Array<{ name: string; size: number; maskable: boolean }> = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(
    `<body style="margin:0"><div style="width:${t.size}px;height:${t.size}px">${svg(t.maskable).replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`)}</div></body>`,
  );
  await page.screenshot({
    path: new URL(`../public/icons/${t.name}`, import.meta.url).pathname,
    clip: { x: 0, y: 0, width: t.size, height: t.size },
  });
  await page.close();
  console.log(`wrote icons/${t.name} (${t.size}px${t.maskable ? ', maskable' : ''})`);
}
await browser.close();
