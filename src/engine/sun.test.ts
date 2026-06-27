import { describe, expect, it } from 'vitest';
import { sunAltitude, sunBandStops, sunTimes } from './sun';

// Reference instants are from public almanacs (timeanddate.com). The model is display-grade —
// accurate to ~1–3 min — so we assert against the known UTC instant within a small tolerance
// rather than an exact minute (refraction/elevation assumptions move it a minute or two).
const MIN = 60_000;
function expectNear(actual: Date | null, expectedISO: string, tolMin = 3) {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual!.getTime() - Date.parse(expectedISO))).toBeLessThanOrEqual(tolMin * MIN);
}

describe('sunTimes', () => {
  it('matches known sunrise/sunset (London, summer solstice)', () => {
    // 2026-06-21, London (51.5074, -0.1278): sunrise 04:43 BST (03:43Z), sunset 21:21 BST (20:21Z).
    const { sunrise, sunset } = sunTimes(new Date('2026-06-21T11:00:00Z'), 51.5074, -0.1278);
    expectNear(sunrise, '2026-06-21T03:43:00Z');
    expectNear(sunset, '2026-06-21T20:21:00Z');
  });

  it('matches known sunrise/sunset (New York, equinox)', () => {
    // 2026-03-20, NYC (40.7128, -74.0060): sunrise 06:59 EDT (10:59Z), sunset 19:09 EDT (23:09Z).
    const { sunrise, sunset } = sunTimes(new Date('2026-03-20T16:00:00Z'), 40.7128, -74.006);
    expectNear(sunrise, '2026-03-20T10:59:00Z');
    expectNear(sunset, '2026-03-20T23:09:00Z');
  });

  it('sunrise precedes sunset and both fall on the queried day', () => {
    const noon = new Date('2026-03-20T12:00:00Z');
    const { sunrise, sunset } = sunTimes(noon, 40.7, -74.0); // NYC, equinox
    expect(sunrise!.getTime()).toBeLessThan(sunset!.getTime());
    // within ~12h of the noon we asked about
    expect(Math.abs(sunrise!.getTime() - noon.getTime())).toBeLessThan(12 * 3_600_000);
  });

  it('reports polar day above the Arctic Circle at the summer solstice', () => {
    // Tromsø (69.65, 18.96) — midnight sun in late June.
    const s = sunTimes(new Date('2026-06-21T11:00:00Z'), 69.65, 18.96);
    expect(s.sunrise).toBeNull();
    expect(s.sunset).toBeNull();
    expect(s.alwaysUp).toBe(true);
    expect(s.alwaysDown).toBe(false);
  });

  it('reports polar night above the Arctic Circle at the winter solstice', () => {
    const s = sunTimes(new Date('2026-12-21T11:00:00Z'), 69.65, 18.96);
    expect(s.sunrise).toBeNull();
    expect(s.sunset).toBeNull();
    expect(s.alwaysDown).toBe(true);
    expect(s.alwaysUp).toBe(false);
  });
});

describe('sunAltitude', () => {
  it('is highest around local solar noon and below the horizon at night', () => {
    const lat = 51.5074;
    const lon = -0.1278;
    const noon = sunAltitude(new Date('2026-06-21T12:00:00Z'), lat, lon); // ~solar noon UTC≈local
    const midnight = sunAltitude(new Date('2026-06-22T00:00:00Z'), lat, lon);
    expect(noon).toBeGreaterThan(0); // sun is up
    expect(midnight).toBeLessThan(0); // sun is down
    expect(noon).toBeGreaterThan(midnight);
  });
});

describe('sunBandStops', () => {
  const DAY = 86_400_000;
  // A full UTC day at Benoa.
  const start = Date.parse('2026-06-26T16:00:00Z'); // local midnight WITA
  const end = start + DAY;

  it('produces stops spanning the window, 0..1 offsets, intensities in range', () => {
    const stops = sunBandStops(start, end, -8.74, 115.21);
    expect(stops.length).toBeGreaterThan(2);
    expect(stops[0].offset).toBe(0);
    expect(stops[stops.length - 1].offset).toBeCloseTo(1, 5);
    for (const s of stops) {
      expect(s.offset).toBeGreaterThanOrEqual(0);
      expect(s.offset).toBeLessThanOrEqual(1);
      expect(s.intensity).toBeGreaterThanOrEqual(0);
      expect(s.intensity).toBeLessThanOrEqual(1);
    }
  });

  it('offsets are non-decreasing (valid SVG gradient order)', () => {
    const stops = sunBandStops(start, end, -8.74, 115.21);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].offset).toBeGreaterThanOrEqual(stops[i - 1].offset);
    }
  });

  it('has full-dark night and full-daylight stretches within a normal day', () => {
    const stops = sunBandStops(start, end, -8.74, 115.21);
    expect(stops.some((s) => s.intensity === 1)).toBe(true); // deep night
    expect(stops.some((s) => s.intensity === 0)).toBe(true); // daylight
  });

  it('returns no stops during polar day (nothing to shade)', () => {
    // Tromsø, midnight sun — sun never dips toward the horizon.
    const ps = Date.parse('2026-06-20T22:00:00Z');
    expect(sunBandStops(ps, ps + DAY, 69.65, 18.96)).toEqual([]);
  });

  it('keeps the whole window dark during polar night (never daylight)', () => {
    // Tromsø near the winter solstice: the sun never rises, but it does climb into civil twilight
    // around midday (max altitude ≈ -3°), so the shading correctly eases off there rather than
    // sitting at full dark — what matters is it never reaches daylight (intensity 0).
    const ps = Date.parse('2026-12-20T22:00:00Z');
    const stops = sunBandStops(ps, ps + DAY, 69.65, 18.96);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops.every((s) => s.intensity > 0)).toBe(true);
    expect(stops.some((s) => s.intensity === 1)).toBe(true); // fully dark at solar midnight
  });

  it('collapses flat runs instead of emitting a stop per sample', () => {
    const stops = sunBandStops(start, end, -8.74, 115.21, 10);
    // 144 ten-minute samples would be absurd; the gradient only needs the transitions.
    expect(stops.length).toBeLessThan(20);
  });

  it('returns nothing for a zero-width window', () => {
    expect(sunBandStops(start, start, -8.74, 115.21)).toEqual([]);
  });
});
