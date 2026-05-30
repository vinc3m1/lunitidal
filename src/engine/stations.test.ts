import { describe, expect, it } from 'vitest';
import { haversineKm, nearest, searchByName } from './stations';
import type { IndexEntry } from './types';

const entry = (over: Partial<IndexEntry>): IndexEntry => ({
  id: 'x',
  name: 'X',
  region: null,
  country: 'Country',
  continent: 'Asia',
  lat: 0,
  lon: 0,
  tz: 'UTC',
  source: 'test',
  type: 'reference',
  chartDatum: 'MSL',
  hasDatum: true,
  ...over,
});

const index: IndexEntry[] = [
  entry({ id: 'benoa', name: 'Benoa', region: 'Bali', country: 'Indonesia', lat: -8.745, lon: 115.21 }),
  entry({ id: 'sanur', name: 'Sanur', region: 'Bali', country: 'Indonesia', lat: -8.68, lon: 115.26 }),
  entry({ id: 'sydney', name: 'Sydney', region: 'NSW', country: 'Australia', lat: -33.86, lon: 151.21 }),
];

describe('stations', () => {
  it('computes great-circle distance (Benoa→Sanur ~9km)', () => {
    expect(haversineKm(-8.745, 115.21, -8.68, 115.26)).toBeGreaterThan(5);
    expect(haversineKm(-8.745, 115.21, -8.68, 115.26)).toBeLessThan(15);
  });

  it('finds nearest stations sorted by distance', () => {
    const result = nearest(index, -8.74, 115.22, 2);
    expect(result).toHaveLength(2);
    expect(result[0].station.id).toBe('benoa');
    expect(result[0].km).toBeLessThan(result[1].km);
  });

  it('searches by name, region, and country', () => {
    expect(searchByName(index, 'ben').map((s) => s.id)).toEqual(['benoa']);
    expect(searchByName(index, 'bali').map((s) => s.id).sort()).toEqual(['benoa', 'sanur']);
    expect(searchByName(index, 'australia').map((s) => s.id)).toEqual(['sydney']);
    expect(searchByName(index, '')).toEqual([]);
  });
});
