/**
 * Sitemap generation (run with `bun run scripts/build-sitemap.ts`, after build).
 * Emits `dist/sitemap.xml` with the home page plus every `/tides/<slug>/` URL,
 * built from the same station index + slug map the prerender and router use.
 * ~6k URLs is well under the 50k/50MB single-file sitemap cap.
 */
import { readFile, writeFile } from 'node:fs/promises';
import type { IndexEntry } from '../src/engine/types.ts';
import { SITE_URL, stationUrl } from '../src/seo/meta.ts';
import { buildSlugMap } from '../src/seo/slug.ts';

const DIST = new URL('../dist/', import.meta.url);
const DATA = new URL('../public/data/', import.meta.url);

async function main() {
  const index = JSON.parse(await readFile(new URL('stations-index.json', DATA), 'utf8')) as IndexEntry[];
  const { idToSlug } = buildSlugMap(index);
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = [`${SITE_URL}/`, ...index.map((e) => stationUrl(idToSlug[e.id]))];
  const body = urls
    .map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  await writeFile(new URL('sitemap.xml', DIST), xml);
  console.log(`sitemap: wrote ${urls.length} urls to dist/sitemap.xml`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
