import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The one case where the station-zone fallback legitimately fires: a *valid* point whose
 * coordinate→zone lookup is unavailable (e.g. the lazy tz-lookup chunk failed to load). Here the
 * place and its tides are real, so degrading to the nearby station's zone — the app's original
 * behaviour, only ever wrong near a timezone line — beats erroring out a good selection. Bad
 * coordinates are a different story and fail fast (see selection.test.ts).
 *
 * timezoneAt is mocked to null here precisely to simulate that boundary failing.
 */
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
vi.mock('../engine/timezone', () => ({ timezoneAt: vi.fn(async () => null) }));
vi.mock('../sources/reverse', () => ({ reverseGeocode: vi.fn(async () => null) }));
vi.mock('../sources/ipgeo', () => ({ getIpLocation: vi.fn() }));

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as unknown as Storage);
  vi.resetModules();
});

describe('selection timezone fallback', () => {
  it('degrades to the station zone (no error) when a valid point’s zone lookup is unavailable', async () => {
    const { selectPoint, selection } = await import('./selection');
    const { timezoneAt } = await import('../engine/timezone');
    const { get } = await import('svelte/store');

    await selectPoint(-6.2, 106.8, 'Jakarta'); // valid coords, but the lookup returns null

    expect(timezoneAt).toHaveBeenCalledWith(-6.2, 106.8);
    expect(get(selection)!.timezone).toBe('Asia/Makassar'); // graceful fallback, selection intact
  });
});
