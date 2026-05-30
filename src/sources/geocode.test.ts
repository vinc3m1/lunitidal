import { describe, expect, it, vi } from 'vitest';
import { geocode, geoLabel, parseGeoResults, matchesSuffix } from './geocode';

describe('geocode parsing', () => {
  it('maps Open-Meteo results to our shape', () => {
    const out = parseGeoResults({
      results: [
        { id: 1, name: 'Uluwatu', admin1: 'Bali', country: 'Indonesia', latitude: -8.8, longitude: 115.1 },
      ],
    });
    expect(out).toEqual([
      { id: 1, name: 'Uluwatu', admin1: 'Bali', country: 'Indonesia', lat: -8.8, lon: 115.1 },
    ]);
  });

  it('returns [] for missing/empty/invalid payloads', () => {
    expect(parseGeoResults({})).toEqual([]);
    expect(parseGeoResults(null)).toEqual([]);
    expect(parseGeoResults({ results: [] })).toEqual([]);
  });

  it('builds a human label, skipping missing parts', () => {
    expect(geoLabel({ id: 1, name: 'Sanur', admin1: 'Bali', country: 'Indonesia', lat: 0, lon: 0 })).toBe(
      'Sanur, Bali, Indonesia',
    );
    expect(geoLabel({ id: 2, name: 'Nowhere', lat: 0, lon: 0 })).toBe('Nowhere');
  });

  describe('suffix matching helper', () => {
    it('matches prefixes correctly', () => {
      expect(matchesSuffix('California', 'ca')).toBe(true);
      expect(matchesSuffix('Florida', 'fl')).toBe(true);
      expect(matchesSuffix('Washington', 'wa')).toBe(true);
      expect(matchesSuffix('Texas', 'te')).toBe(true);
      expect(matchesSuffix('Texas', 'tx')).toBe(false);
    });

    it('matches initials correctly', () => {
      expect(matchesSuffix('New York', 'ny')).toBe(true);
      expect(matchesSuffix('North Carolina', 'nc')).toBe(true);
      expect(matchesSuffix('South Dakota', 'sd')).toBe(true);
    });

    it('is case and space insensitive', () => {
      expect(matchesSuffix('  New York  ', ' NY ')).toBe(true);
      expect(matchesSuffix('California', 'CA')).toBe(true);
    });

    it('handles empty/undefined safely', () => {
      expect(matchesSuffix(undefined, 'ca')).toBe(false);
      expect(matchesSuffix('', 'ca')).toBe(false);
    });
  });

  describe('geocode function with fallback', () => {
    it('handles normal query successfully', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: 1, name: 'Oakland', admin1: 'California', country: 'United States', latitude: 37.8, longitude: -122.27 },
          ],
        }),
      } as Response);

      const res = await geocode('oakland');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('name=oakland')
      );
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('Oakland');
      mockFetch.mockRestore();
    });

    it('falls back when multi-word query returns 0 results', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch')
        // First fetch for "oakland cali" returns empty
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        } as Response)
        // Second fallback fetch for "oakland" returns results
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { id: 2, name: 'Oakland', admin1: 'Maryland', country: 'United States', latitude: 39.4, longitude: -79.4 },
              { id: 1, name: 'Oakland', admin1: 'California', country: 'United States', latitude: 37.8, longitude: -122.27 },
            ],
          }),
        } as Response);

      const res = await geocode('oakland cali');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain('name=oakland%20cali');
      expect(mockFetch.mock.calls[1][0]).toContain('name=oakland');

      // The California result should be sorted first due to matching suffix "cali"
      expect(res).toHaveLength(2);
      expect(res[0].admin1).toBe('California');
      expect(res[1].admin1).toBe('Maryland');
      mockFetch.mockRestore();
    });

    it('does not fall back if first fetch returns results', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: 3, name: 'San Francisco', admin1: 'California', country: 'United States', latitude: 37.7, longitude: -122.4 },
          ],
        }),
      } as Response);

      const res = await geocode('San Francisco');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('San Francisco');
      mockFetch.mockRestore();
    });
  });
});

