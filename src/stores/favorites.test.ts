import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../engine/types';
import { favoriteId, healFavoriteLabels, isLegacyLabel, type Favorite } from './favorites';

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

  it('backfills the station and relabels legacy favorites, keeping good labels', () => {
    const list: Favorite[] = [
      { id: 'a', label: 'My location', lat: -8.74, lon: 115.21 },
      { id: 'b', label: 'Uluwatu, Bali, Indonesia', lat: -8.8, lon: 115.05 },
    ];
    const healed = healFavoriteLabels(list, [benoa]);
    expect(healed[0].label).toBe('Benoa');
    expect(healed[0].stationId).toBe('benoa');
    expect(healed[0].stationName).toBe('Benoa');
    expect(healed[1].label).toBe('Uluwatu, Bali, Indonesia'); // good label preserved
    expect(healed[1].stationId).toBe('benoa'); // station still backfilled
    expect(typeof healed[1].km).toBe('number');
  });

  it('leaves fully-populated favorites untouched', () => {
    const good: Favorite = {
      id: favoriteId(-8.74, 115.21),
      label: 'Home beach',
      lat: -8.74,
      lon: 115.21,
      stationId: 'benoa',
      stationName: 'Benoa',
      km: 1,
    };
    expect(healFavoriteLabels([good], [benoa])[0]).toEqual(good);
  });

  it('keys favorite ids to ~11 m precision', () => {
    expect(favoriteId(-8.74553, 115.21099)).toBe('-8.7455,115.2110');
  });
});
