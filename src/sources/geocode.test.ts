import { describe, expect, it } from 'vitest';
import { geoLabel, parseGeoResults, matchesSuffix } from './geocode';

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
});
