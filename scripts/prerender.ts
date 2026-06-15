/**
 * Static prerender (run with `bun run scripts/prerender.ts`, AFTER `vite build`).
 *
 * For every station we emit `dist/tides/<slug>/index.html`: a copy of the built
 * SPA shell with (a) a station-specific SEO `<head>` swapped into the shell's
 * `<!-- seo:start -->…<!-- seo:end -->` block and (b) crawlable content injected
 * into `#app`. `mount()` clears `#app` on boot, so real users get the live app;
 * only crawlers / no-JS visitors see the static block. We also copy the shell to
 * `dist/404.html` so GitHub Pages serves it as the SPA fallback for deep links.
 *
 * No Svelte SSR / hydration — the static block is throwaway, which sidesteps any
 * hydration-mismatch risk entirely.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { datumOffset } from '../src/engine/datum.ts';
import { stationFileSlug } from '../src/engine/paths.ts';
import { createModel } from '../src/engine/predictor.ts';
import { nearest } from '../src/engine/stations.ts';
import { addDays, formatDay, formatTime, startOfDayInTz } from '../src/engine/time.ts';
import { formatDistance, formatHeight } from '../src/engine/units.ts';
import type { IndexEntry, Station } from '../src/engine/types.ts';
import { buildAppContent, buildHeadTags, type NearbyLink, type TideRow } from '../src/seo/content.ts';
import { buildSlugMap } from '../src/seo/slug.ts';
import type { StationMeta } from '../src/seo/meta.ts';

const DIST = new URL('../dist/', import.meta.url);
const DATA = new URL('../public/data/', import.meta.url);

// How many days of example tides to list, and how many nearby links to emit.
const DAYS = 3;
const NEARBY = 6;
// Optional cap (env LIMIT) — handy for quick local runs; defaults to all stations.
const LIMIT = process.env.PRERENDER_LIMIT ? Number(process.env.PRERENDER_LIMIT) : Infinity;

const SEO_BLOCK = /<!-- seo:start[\s\S]*?seo:end -->/;

const fileCache = new Map<string, Station>();
async function loadStationFile(id: string): Promise<Station> {
  const cached = fileCache.get(id);
  if (cached) return cached;
  const raw = await readFile(new URL(`stations/${stationFileSlug(id)}.json`, DATA), 'utf8');
  const station = JSON.parse(raw) as Station;
  fileCache.set(id, station);
  if (station.type === 'subordinate' && station.offsets?.reference) {
    station.referenceStation = await loadStationFile(station.offsets.reference);
  }
  return station;
}

/** Build the example tide rows for a station, or [] if the model can't be built. */
function tideRows(station: Station, tz: string, now: Date): TideRow[] {
  try {
    const model = createModel(station);
    const offset = datumOffset(station);
    const day0 = startOfDayInTz(now, tz);
    const rows: TideRow[] = [];
    for (let d = 0; d < DAYS; d++) {
      const start = addDays(day0, d);
      const end = addDays(start, 1);
      for (const e of model.extremes(start, end)) {
        rows.push({
          day: formatDay(e.time, tz),
          time: formatTime(e.time, tz),
          kind: e.high ? 'High' : 'Low',
          height: formatHeight(e.level + offset, 'm'),
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function nearbyLinks(index: IndexEntry[], entry: IndexEntry, idToSlug: Record<string, string>): NearbyLink[] {
  return nearest(index, entry.lat, entry.lon, NEARBY + 1)
    .filter((n) => n.station.id !== entry.id)
    .slice(0, NEARBY)
    .map((n) => ({
      name: n.station.name,
      slug: idToSlug[n.station.id],
      distance: formatDistance(n.km, 'km'),
    }));
}

async function main() {
  const template = await readFile(new URL('index.html', DIST), 'utf8').catch(() => {
    throw new Error('dist/index.html not found — run `vite build` before prerender.');
  });
  if (!SEO_BLOCK.test(template)) {
    throw new Error('SEO marker block not found in dist/index.html — did vite strip the comments?');
  }

  // 404 fallback = the unmodified shell (keeps the home SEO defaults).
  await writeFile(new URL('404.html', DIST), template);

  const index = JSON.parse(await readFile(new URL('stations-index.json', DATA), 'utf8')) as IndexEntry[];
  const { idToSlug } = buildSlugMap(index);
  const now = new Date();
  const targets = Number.isFinite(LIMIT) ? index.slice(0, LIMIT) : index;

  let written = 0;
  for (const entry of targets) {
    const slug = idToSlug[entry.id];
    const meta: StationMeta = {
      name: entry.name,
      region: entry.region,
      country: entry.country,
      lat: entry.lat,
      lon: entry.lon,
    };

    let rows: TideRow[] = [];
    try {
      rows = tideRows(await loadStationFile(entry.id), entry.tz, now);
    } catch {
      /* station file unreadable — still emit the page with meta + nearby links */
    }

    const head = buildHeadTags(meta, slug);
    const content = buildAppContent(meta, rows, nearbyLinks(index, entry, idToSlug), {
      datumLabel: entry.chartDatum,
      sourceName: entry.source,
      referenceDay: formatDay(startOfDayInTz(now, entry.tz), entry.tz),
    });

    const html = template
      .replace(SEO_BLOCK, head)
      .replace('<div id="app"></div>', `<div id="app">${content}</div>`);

    const dir = new URL(`tides/${slug}/`, DIST);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('index.html', dir), html);

    if (++written % 1000 === 0) console.log(`  …${written}/${targets.length}`);
  }

  console.log(`prerender: wrote ${written} station pages + 404.html`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
