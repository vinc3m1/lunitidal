import { describe, expect, it } from 'vitest';
import { createModel } from './predictor';
import { datumOffset, toDatum } from './datum';
import type { Station } from './types';
// Static imports (resolveJsonModule) require `bun run build:data` to have
// produced public/data/. The `as Station` casts narrow the JSON's
// widened `type: string` back to the union.
import benoaJson from '../../public/data/benoa.json';
import richmondJson from '../../public/data/stations/noaa__9414849.json';
import sanFranciscoJson from '../../public/data/stations/noaa__9414290.json';

/**
 * Validates the real Benoa seed (requires `bun run build:data` to have produced
 * public/data/benoa.json). Asserts structural invariants rather than brittle exact
 * heights — TICON-4 amplitudes run ~0.3–0.5 m above the official port solution, so
 * pinning precise metres would be testing the wrong thing. Timing/shape is the point.
 */
const benoa = benoaJson as Station;

const constituents = benoa.harmonic_constituents;
if (!constituents) {
  throw new Error('benoa.json is missing harmonic_constituents — run `bun run build:data` first');
}

const model = createModel(constituents);
const dayStart = new Date('2026-05-29T16:00:00Z'); // 00:00 WITA, 30 May 2026
const dayEnd = new Date('2026-05-30T16:00:00Z');

describe('Benoa predictor', () => {
  it('has the expected seed shape', () => {
    expect(constituents.length).toBeGreaterThanOrEqual(30);
    expect(benoa.chart_datum).toBeTruthy();
    expect(benoa.timezone).toBeTruthy();
  });

  it('produces a mixed semidiurnal day (3–4 extremes, alternating)', () => {
    const ex = model.extremes(dayStart, dayEnd);
    expect(ex.length).toBeGreaterThanOrEqual(3);
    expect(ex.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < ex.length; i++) {
      expect(ex[i].high).toBe(!ex[i - 1].high); // alternates high/low
    }
  });

  it('has highs above lows, with a plausible spring-ish range', () => {
    const ex = model.extremes(dayStart, dayEnd);
    const highs = ex.filter((e) => e.high).map((e) => e.level);
    const lows = ex.filter((e) => e.low).map((e) => e.level);
    expect(Math.max(...highs)).toBeGreaterThan(Math.max(...lows));
    const range = Math.max(...highs) - Math.min(...lows);
    expect(range).toBeGreaterThan(0.5);
    expect(range).toBeLessThan(4);
  });

  it('levelAt agrees with extreme levels at extreme times', () => {
    for (const e of model.extremes(dayStart, dayEnd)) {
      expect(model.levelAt(e.time)).toBeCloseTo(e.level, 1);
    }
  });

  it('expresses heights above LAT chart datum as mostly non-negative', () => {
    const ex = model.extremes(dayStart, dayEnd);
    for (const e of ex) {
      expect(toDatum(e.level, benoa)).toBeGreaterThan(-0.5);
    }
  });

  it('produces a continuous timeline spanning the window with finite levels', () => {
    const pts = model.timeline(dayStart, dayEnd, 600);
    expect(pts.length).toBeGreaterThan(100);
    expect(pts[0].time.getTime()).toBe(dayStart.getTime());
    for (const p of pts) {
      expect(Number.isFinite(p.level)).toBe(true);
      expect(Math.abs(p.level)).toBeLessThan(5);
    }
  });
});

const subordinateStation: Station = {
  id: 'test/subordinate',
  name: 'Test Subordinate Beach',
  continent: 'Asia',
  country: 'Indonesia',
  region: 'Bali',
  timezone: 'Asia/Makassar',
  disclaimers: '',
  type: 'subordinate',
  latitude: -8.78,
  longitude: 115.25,
  source: benoa.source,
  license: benoa.license,
  datums: benoa.datums,
  chart_datum: benoa.chart_datum,
  offsets: {
    reference: benoa.id,
    height: {
      type: 'ratio',
      high: 0.8,
      low: 0.8,
    },
    time: {
      high: 20, // 20 minutes later
      low: 10,  // 10 minutes later
    },
  },
  referenceStation: benoa,
};

const subModel = createModel(subordinateStation);

describe('Subordinate predictor', () => {
  it('correctly maps extremes using time and height offsets', () => {
    const refExtremes = model.extremes(dayStart, dayEnd);
    const subExtremes = subModel.extremes(dayStart, dayEnd);

    // Filter to matching overlaps
    expect(subExtremes.length).toBe(refExtremes.length);

    for (let i = 0; i < refExtremes.length; i++) {
      const r = refExtremes[i];
      const s = subExtremes[i];

      expect(s.high).toBe(r.high);
      expect(s.low).toBe(r.low);

      // Verify time offset
      const expectedTimeShift = r.high ? 20 : 10;
      const actualTimeShift = (s.time.getTime() - r.time.getTime()) / 60_000;
      expect(actualTimeShift).toBeCloseTo(expectedTimeShift, 1);

      // Ratios apply to tide-table heights (above the reference's chart datum),
      // then the result converts back to this station's model space.
      const off = datumOffset(benoa); // ref and sub share Benoa's datums table
      expect(s.level).toBeCloseTo((r.level + off) * 0.8 - off, 4);
    }
  });

  it('levelAt matches the calculated subordinate extremes at extreme times', () => {
    const subExtremes = subModel.extremes(dayStart, dayEnd);
    for (const e of subExtremes) {
      expect(subModel.levelAt(e.time)).toBeCloseTo(e.level, 3);
    }
  });

  it('generates a continuous, smooth warped curve without stair-stepping', () => {
    const pts = subModel.timeline(dayStart, dayEnd, 600);
    expect(pts.length).toBe(600);
    
    let flatCount = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      expect(Number.isFinite(p.level)).toBe(true);
      expect(Math.abs(p.level)).toBeLessThan(5);

      if (i > 0) {
        const prev = pts[i - 1];
        const diff = Math.abs(p.level - prev.level);
        
        // Assert no sudden vertical jumps (all 10-minute changes are smooth and under 0.4m)
        expect(diff).toBeLessThan(0.4);
        
        // Count consecutive identical points (flat steps)
        if (diff === 0) {
          flatCount++;
        }
      }
    }
    // Verify there are no stair-stepped flat plateaus
    expect(flatCount).toBeLessThan(2);
  });
});

/**
 * Regression test for Bay Area heights being off by the MSL→MLLW conversion
 * (~3.2 ft): NOAA datums tables are station-datum-relative, and NOAA subordinate
 * ratios apply to MLLW-referenced tide-table heights, not MSL-relative levels.
 * Expected values are NOAA's published predictions for Richmond Inner Harbor
 * (station 9414849, ratios on SAN FRANCISCO Golden Gate 9414290), 2026-07-18 GMT,
 * feet above MLLW. NOAA predicts from the same harmonic solution we ship, so
 * unlike the TICON/Benoa caveat above, exact-ish heights ARE meaningful here.
 */
describe('Richmond Inner Harbor (NOAA subordinate on STND-relative datums)', () => {
  const richmond = richmondJson as unknown as Station;
  const sanFrancisco = sanFranciscoJson as unknown as Station;
  richmond.referenceStation = sanFrancisco;

  const M_TO_FT = 3.28084;
  const start = new Date('2026-07-18T00:00:00Z');
  const end = new Date('2026-07-19T00:00:00Z');

  // From https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9414849
  //   &product=predictions&datum=MLLW&units=english&time_zone=gmt&interval=hilo
  const noaa = [
    { t: '2026-07-18T04:12:00Z', ft: 2.097, high: false },
    { t: '2026-07-18T09:51:00Z', ft: 5.817, high: true },
    { t: '2026-07-18T16:30:00Z', ft: -0.154, high: false },
    { t: '2026-07-18T23:20:00Z', ft: 5.842, high: true },
  ];

  it('matches NOAA published heights above MLLW (display offset is 0 — no datums table)', () => {
    const subModel = createModel(richmond);
    expect(datumOffset(richmond)).toBe(0); // datum-less sub: model output IS the display value
    const ex = subModel.extremes(start, end);
    expect(ex.length).toBe(noaa.length);
    for (let i = 0; i < noaa.length; i++) {
      expect(ex[i].high).toBe(noaa[i].high);
      const dtMin = Math.abs(ex[i].time.getTime() - new Date(noaa[i].t).getTime()) / 60_000;
      expect(dtMin).toBeLessThan(15);
      expect(Math.abs(ex[i].level * M_TO_FT - noaa[i].ft)).toBeLessThan(0.25); // ft
    }
  });

  it('reference station itself converts to MLLW correctly (Golden Gate lows near 0, not -3 ft)', () => {
    const refModel = createModel(sanFrancisco);
    const off = datumOffset(sanFrancisco);
    expect(off).toBeCloseTo(0.951, 3); // MSL 2.773 - MLLW 1.822
    const lows = refModel
      .extremes(start, end)
      .filter((e) => e.low)
      .map((e) => e.level + off);
    // Above MLLW, lows sit near zero by construction of the datum.
    for (const l of lows) expect(l).toBeGreaterThan(-0.5);
  });
});
