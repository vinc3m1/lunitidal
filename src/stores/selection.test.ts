import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration coverage for the timezone the UI actually displays times in. Tides are predicted
 * from the *nearest gauge*, but times are shown in the *set location's* zone — the two differ when
 * the snapped station sits across a timezone line. These tests pin that wiring (override, offline
 * coordinate lookup, last-resort fallback, persistence) without touching the real database/network.
 */

// The snapped gauge is always in Bali (WITA / +8) regardless of where the chosen point is.
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
// Coordinate → zone lookup is mocked so each test controls what the point's own zone resolves to.
vi.mock('../engine/timezone', () => ({ timezoneAt: vi.fn(async () => null) }));
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
  it('uses the zone handed in by a place search, without a coordinate lookup', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { timezoneAt } = await import('../engine/timezone');
    const { get } = await import('svelte/store');

    await selectPoint(40.71, -74.0, 'New York, NY', 'America/New_York');

    const sel = get(selection)!;
    expect(sel.station.timezone).toBe('Asia/Makassar'); // tides come from the Bali gauge…
    expect(sel.timezone).toBe('America/New_York'); // …but times follow the searched place
    expect(timezoneAt).not.toHaveBeenCalled(); // search already carried the zone
  });

  it('resolves a dropped pin’s own zone from its coordinates (offline), not the gauge’s', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { timezoneAt } = await import('../engine/timezone');
    const { get } = await import('svelte/store');

    // A pin (no zone passed) whose coordinates resolve to a zone different from the Bali gauge.
    vi.mocked(timezoneAt).mockResolvedValue('Asia/Jayapura'); // WIT, +9
    await selectPoint(-2.5, 140.7, 'Jayapura');

    expect(timezoneAt).toHaveBeenCalledWith(-2.5, 140.7);
    const sel = get(selection)!;
    expect(sel.station.timezone).toBe('Asia/Makassar'); // gauge zone
    expect(sel.timezone).toBe('Asia/Jayapura'); // displayed in the pin’s own zone
  });

  it('falls back to the gauge zone only when the coordinate lookup can’t place the point', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { timezoneAt } = await import('../engine/timezone');
    const { get } = await import('svelte/store');

    vi.mocked(timezoneAt).mockResolvedValue(null); // lookup couldn’t resolve (e.g. bad coords)
    await selectPoint(-8.7, 115.2, 'Sanur');
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
