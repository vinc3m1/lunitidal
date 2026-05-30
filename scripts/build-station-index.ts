/**
 * Build-time data extraction (run with `bun run scripts/build-station-index.ts`).
 *
 * `@neaps/tide-database` ships a ~23 MB JS bundle of every station + its harmonic
 * constituents. We must NEVER import that into the browser bundle. Instead, at build
 * time we read it in Bun and emit small static assets the app fetches on demand:
 *
 *   public/data/stations-index.json   slim index of all quality stations (for search/nearest)
 *   public/data/benoa.json            full seed station, bundled + precached (offline first-launch)
 *   public/data/stations/<id>.json    full per-station record (constituents + datums), lazy-loaded
 *
 * The slim index intentionally omits harmonic_constituents/offsets to stay small; the
 * per-station files carry everything the predictor and Detail view need.
 */
import { stations, type Station } from '@neaps/tide-database';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { stationFileSlug } from '../src/engine/paths.ts';

const OUT = new URL('../public/data/', import.meta.url);
const STATIONS_DIR = new URL('stations/', OUT);

/** Slim index entry — discovery only, no constituents. Keep field names short-ish but clear. */
interface IndexEntry {
  id: string;
  name: string;
  region: string | null;
  country: string;
  continent: string;
  lat: number;
  lon: number;
  tz: string;
  source: string;
  type: 'reference' | 'subordinate';
  chartDatum: string;
  hasDatum: boolean;
}

function hasDatum(s: Station): boolean {
  return !!s.datums && Object.keys(s.datums).length > 0;
}

function toIndexEntry(s: Station): IndexEntry {
  return {
    id: s.id,
    name: s.name,
    region: s.region ?? null,
    country: s.country,
    continent: s.continent,
    lat: s.latitude,
    lon: s.longitude,
    tz: s.timezone,
    source: s.source?.name ?? s.source?.id ?? 'unknown',
    type: s.type,
    chartDatum: s.chart_datum,
    hasDatum: hasDatum(s),
  };
}

/** Pick the canonical Benoa station: prefer the TICON-4 "final data" (fd) base series. */
function pickBenoa(list: Station[]): Station | undefined {
  const cands = list.filter((s) => /benoa/i.test(s.name) || /benoa/i.test(s.id));
  if (cands.length === 0) return undefined;
  console.log(`  benoa candidates: ${cands.map((s) => s.id).join(', ')}`);
  return (
    cands.find((s) => /benoa-163-/i.test(s.id) && /fd/i.test(s.id)) ??
    cands.find((s) => /fd/i.test(s.id)) ??
    cands.find((s) => /benoa-163[-_]/i.test(s.id)) ??
    cands[0]
  );
}

async function main() {
  // Only keep reference stations with harmonic constituents (predictor only supports these)
  const qualityStations = stations.filter(
    (s) => s.type === 'reference' && Array.isArray(s.harmonic_constituents) && s.harmonic_constituents.length > 0,
  );
  console.log(`Extracting from @neaps/tide-database: ${qualityStations.length} quality reference stations`);

  // Fresh per-station dir each run.
  await rm(STATIONS_DIR, { recursive: true, force: true });
  await mkdir(STATIONS_DIR, { recursive: true });

  // 1. Slim index for all quality stations.
  const index = qualityStations.map(toIndexEntry);
  await writeFile(new URL('stations-index.json', OUT), JSON.stringify(index));
  console.log(`  wrote stations-index.json (${index.length} entries)`);

  // 2. Per-station full records (lazy-loaded at runtime, cache-first).
  const BATCH = 200;
  for (let i = 0; i < qualityStations.length; i += BATCH) {
    await Promise.all(
      qualityStations.slice(i, i + BATCH).map((s) =>
        writeFile(new URL(`${stationFileSlug(s.id)}.json`, STATIONS_DIR), JSON.stringify(s)),
      ),
    );
  }
  console.log(`  wrote ${qualityStations.length} per-station files to stations/`);

  // 3. Benoa seed (bundled + precached for offline first-launch).
  const benoa = pickBenoa(stations);
  if (!benoa) throw new Error('Benoa station not found in tide-database!');
  await writeFile(new URL('benoa.json', OUT), JSON.stringify(benoa, null, 2));
  console.log(
    `  wrote benoa.json -> id=${benoa.id}, ${benoa.harmonic_constituents.length} constituents, ` +
      `chart_datum=${benoa.chart_datum}, tz=${benoa.timezone}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
