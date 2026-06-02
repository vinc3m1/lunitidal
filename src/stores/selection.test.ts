import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration coverage for the timezone the UI actually displays times in. Tides are predicted
 * from the *nearest gauge*, but times are shown in the *set location's* zone — the two differ when
 * the snapped station sits across a timezone line.
 *
 * Only the real boundaries are mocked — the station index and the network sources. The coordinate
 * → zone resolution runs for real (tz-lookup), so these tests exercise OUR precedence logic
 * (search-provided zone → coordinate lookup → station fallback) against actual resolved zones,
 * not a stubbed return value.
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
  it('lets a place search’s own zone win over the coordinate lookup', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    // The geocoder handed us a zone; that should be used verbatim — not overridden by what the
    // coordinates would resolve to (NYC → America/New_York).
    await selectPoint(40.71, -74.0, 'New York, NY', 'Europe/Paris');

    const sel = get(selection)!;
    expect(sel.station.timezone).toBe('Asia/Makassar'); // tides come from the Bali gauge…
    expect(sel.timezone).toBe('Europe/Paris'); // …but the search-provided zone is honoured
  });

  it('resolves a dropped pin’s own zone from its coordinates (offline), not the gauge’s', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    // A pin in Jakarta (no zone passed) snapped to the Bali gauge — different Indonesian zones.
    await selectPoint(-6.2, 106.8, 'Jakarta');

    const sel = get(selection)!;
    expect(sel.station.timezone).toBe('Asia/Makassar'); // gauge zone, WITA +8
    expect(sel.timezone).toBe('Asia/Jakarta'); // displayed in the pin’s own zone, WIB +7
  });

  it('falls back to the gauge zone only when the coordinates can’t be placed', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    // Non-finite coordinates can't resolve to a zone, so the station's is the last resort.
    await selectPoint(NaN, NaN, 'Nowhere');
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
      await selectPoint(-6.2, 106.8, 'Jakarta');
    }
    const saved = JSON.parse(localStorage.getItem('lunitidal:lastLocation')!);
    expect(saved.timezone).toBe('Asia/Jakarta');

    // Next session: a fresh module load restores the saved location zone, not the gauge's.
    vi.resetModules();
    const { initSelection, selection } = await import('./selection');
    const { get } = await import('svelte/store');
    await initSelection();
    expect(get(selection)!.timezone).toBe('Asia/Jakarta');
  });
});
