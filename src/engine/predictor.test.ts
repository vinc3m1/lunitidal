import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createModel } from './predictor';
import { toDatum } from './datum';
import type { Station } from './types';

/**
 * Validates the real Benoa seed (requires `bun run build:data` to have produced
 * public/data/benoa.json). Asserts structural invariants rather than brittle exact
 * heights — TICON-4 amplitudes run ~0.3–0.5 m above the official port solution, so
 * pinning precise metres would be testing the wrong thing. Timing/shape is the point.
 */
const benoa: Station = JSON.parse(
  readFileSync(new URL('../../public/data/benoa.json', import.meta.url), 'utf8'),
);

const model = createModel(benoa.harmonic_constituents);
const dayStart = new Date('2026-05-29T16:00:00Z'); // 00:00 WITA, 30 May 2026
const dayEnd = new Date('2026-05-30T16:00:00Z');

describe('Benoa predictor', () => {
  it('has the expected seed shape', () => {
    expect(benoa.harmonic_constituents.length).toBeGreaterThanOrEqual(30);
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
