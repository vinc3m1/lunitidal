import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration coverage for the timezone the UI actually displays times in. Tides are
 * predicted from the *nearest gauge*, but times are shown in the *set location's* zone — the
 * two can differ when the snapped station sits across a timezone line. These tests pin that
 * wiring (override, fallback, persistence) without touching the real station database/network.
 */

// The snapped gauge is always in Bali (WITA / +8) regardless of where the point is.
const BALI_GAUGE = {
  id: 'sta-bali',
  name: 'Benoa',
  timezone: 'Asia/Makassar',
  latitude: -8.74,
  longitude: 115.21,
  type: 'reference',
};

vi.mock('../engine/stations', () => ({
  loadIndex: vi.fn(async () => [{ id: 'sta-bali' }]),
  nearest: vi.fn(() => [{ station: { id: 'sta-bali' }, km: 3.2 }]),
  loadStation: vi.fn(async () => BALI_GAUGE),
  loadSeedStation: vi.fn(async () => BALI_GAUGE),
}));
vi.mock('../sources/reverse', () => ({ reverseGeocode: vi.fn(async () => null) }));
vi.mock('../sources/ipgeo', () => ({ getIpLocation: vi.fn() }));

function memoryLocalStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryLocalStorage());
  vi.resetModules();
});

describe('selection timezone', () => {
  it('displays times in the set location’s zone, overriding the gauge’s zone', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    // A New York point that still snaps to the Bali gauge (contrived to force divergence).
    await selectPoint(40.71, -74.0, 'New York, NY', 'America/New_York');

    const sel = get(selection)!;
    expect(sel.station.timezone).toBe('Asia/Makassar'); // tides come from the Bali gauge…
    expect(sel.timezone).toBe('America/New_York'); // …but times are shown in the chosen zone
  });

  it('falls back to the gauge’s zone when the point has no known zone', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    await selectPoint(-8.7, 115.2, 'Sanur'); // no timezone arg (e.g. dropped pin / geolocation)
    expect(get(selection)!.timezone).toBe('Asia/Makassar');
  });

  it('uses the station’s own zone for a directly-picked station', async () => {
    const { selectStationId, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    await selectStationId('sta-bali', 'Benoa');
    expect(get(selection)!.timezone).toBe('Asia/Makassar');
  });

  it('persists the set-location zone and restores it on the next load', async () => {
    // First session: pick a point whose zone differs from the gauge.
    {
      const { selectPoint } = await import('./selection');
      await selectPoint(40.71, -74.0, 'New York, NY', 'America/New_York');
    }
    const saved = JSON.parse(localStorage.getItem('lunitidal:lastLocation')!);
    expect(saved.timezone).toBe('America/New_York');

    // Next session: a fresh module load restores the saved location zone, not the gauge's.
    vi.resetModules();
    const { initSelection, selection } = await import('./selection');
    const { get } = await import('svelte/store');
    await initSelection();
    expect(get(selection)!.timezone).toBe('America/New_York');
  });
});
