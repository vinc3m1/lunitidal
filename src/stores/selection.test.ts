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

  it('fails fast on invalid coordinates instead of snapping to a bogus station/zone', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    // Garbage coordinates drive the station snap and marine fetch too, so the whole selection
    // would be wrong — reject rather than silently showing some arbitrary station's clock.
    await expect(selectPoint(NaN, NaN, 'Nowhere')).rejects.toThrow(/invalid coordinates/i);
    await expect(selectPoint(200, 0, 'Off the map')).rejects.toThrow(/invalid coordinates/i);
    expect(get(selection)).toBeNull(); // nothing committed
  });

  it('ignores a corrupt persisted location and self-heals to the default (cache miss)', async () => {
    // A stale lastLocation with garbage coordinates must not be restored as-is.
    localStorage.setItem(
      'lunitidal:lastLocation',
      JSON.stringify({
        stationId: 'sta-bali',
        label: 'Stale',
        km: 3,
        lat: null,
        lon: null,
        timezone: 'America/New_York',
      }),
    );
    const { initSelection, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    await initSelection();

    const sel = get(selection)!;
    // Fell through to the seed station instead of restoring the broken point/zone.
    expect(sel.point).toEqual({ lat: -8.74, lon: 115.21 });
    expect(sel.timezone).toBe('Asia/Makassar');
    expect(sel.label).toBe('Benoa');
  });

  it('salvages a favorite’s station coordinates when its stored point is corrupt', async () => {
    const { selectFavorite, selection } = await import('./selection');
    const { get } = await import('svelte/store');

    // Favorite is user data anchored to a real station — keep it, just fix the bad point.
    await selectFavorite({ id: 'sta-bali', label: 'Saved spot', lat: NaN, lon: NaN });

    const sel = get(selection)!;
    expect(sel.point).toEqual({ lat: -8.74, lon: 115.21 }); // station coords, not NaN
    expect(sel.timezone).toBe('Asia/Makassar');
    expect(sel.label).toBe('Saved spot'); // saved label preserved
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
