import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../engine/types';
import { healFavoriteLabels, isLegacyLabel, type Favorite } from './favorites';

const benoa: IndexEntry = {
  id: 'benoa',
  name: 'Benoa',
  region: 'Bali',
  country: 'Indonesia',
  continent: 'Asia',
  lat: -8.745,
  lon: 115.21,
  tz: 'Asia/Makassar',
  source: 'test',
  type: 'reference',
  chartDatum: 'LAT',
  hasDatum: true,
};

describe('favorites healing', () => {
  it('detects legacy / meaningless labels', () => {
    for (const l of ['My location', 'my location', '  My Location ', 'Near you', '', undefined]) {
      expect(isLegacyLabel(l)).toBe(true);
    }
    expect(isLegacyLabel('Benoa')).toBe(false);
    expect(isLegacyLabel('Uluwatu, Bali')).toBe(false);
  });

  it('relabels legacy favorites to the nearest station, leaving good ones alone', () => {
    const list: Favorite[] = [
      { id: 'a', label: 'My location', lat: -8.74, lon: 115.21 },
      { id: 'b', label: 'Uluwatu, Bali, Indonesia', lat: -8.8, lon: 115.05 },
    ];
    const healed = healFavoriteLabels(list, [benoa]);
    expect(healed[0].label).toBe('Benoa');
    expect(healed[1].label).toBe('Uluwatu, Bali, Indonesia');
  });
});
