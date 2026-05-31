/**
 * Sanity-check Benoa predictions against published tide tables.
 * Run: `bun run scripts/validate-benoa.ts`
 */
import { readFileSync } from 'node:fs';
import { createModel } from '../src/engine/predictor.ts';
import { toDatum } from '../src/engine/datum.ts';
import type { Station } from '../src/engine/types.ts';

const benoa: Station = JSON.parse(
  readFileSync(new URL('../public/data/benoa.json', import.meta.url), 'utf8'),
);

const constituents = benoa.harmonic_constituents;
if (!constituents) {
  throw new Error('benoa.json is missing harmonic_constituents — run `bun run build:data` first');
}

console.log(`Station: ${benoa.name} (${benoa.id})`);
console.log(`Timezone: ${benoa.timezone}, chart_datum: ${benoa.chart_datum}`);
console.log(`Constituents: ${constituents.length}`);
console.log(`Datums: ${JSON.stringify(benoa.datums)}`);

const model = createModel(constituents);

// 30 May 2026, local WITA day (00:00 WITA == 29 May 16:00 UTC).
const start = new Date('2026-05-29T16:00:00Z');
const end = new Date('2026-05-30T16:00:00Z');

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: benoa.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

console.log('\nExtremes for 30 May 2026 (WITA):');
for (const e of model.extremes(start, end)) {
  console.log(
    `  ${e.high ? 'HIGH' : 'LOW '} ${fmt(e.time)}  MSL=${e.level.toFixed(2)}m  ` +
      `LAT=${toDatum(e.level, benoa).toFixed(2)}m`,
  );
}
console.log('\nPublished (tides4fishing, approx): LOW ~02:52 0.6m · HIGH ~09:16 2.3m · LOW ~15:59 0.3m · HIGH ~22:10 1.9m');
