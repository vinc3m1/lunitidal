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

const uluwatu: IndexEntry = {
  id: 'uluwatu',
  name: 'Uluwatu',
  region: 'Bali',
  country: 'Indonesia',
  continent: 'Asia',
  lat: -8.85,
  lon: 115.05,
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

  it('backfills the station, relabels legacy favorites, preserves good labels, and deduplicates', () => {
    const list = [
      { id: '-8.7400,115.2100', label: 'My location', lat: -8.74, lon: 115.21 }, // snaps to Benoa
      { id: '-8.7410,115.2110', label: 'Second spot', lat: -8.741, lon: 115.211 }, // snaps to Benoa (duplicate)
      { id: '-8.8500,115.0500', label: 'Uluwatu Beach', lat: -8.85, lon: 115.05 }, // snaps to Uluwatu (custom label)
    ];
    const healed = healFavoriteLabels(list, [benoa, uluwatu]);
    
    expect(healed.length).toBe(2);
    
    // First: healed, duplicate merged, relabeled to station name
    expect(healed[0].id).toBe('benoa');
    expect(healed[0].label).toBe('Benoa');
    expect(healed[0].lat).toBe(-8.745);
    expect(healed[0].lon).toBe(115.21);

    // Second: snaps to Uluwatu, keeps good custom label
    expect(healed[1].id).toBe('uluwatu');
    expect(healed[1].label).toBe('Uluwatu Beach');
    expect(healed[1].lat).toBe(-8.85);
    expect(healed[1].lon).toBe(115.05);
  });

  it('leaves fully-populated favorites untouched', () => {
    const good: Favorite = {
      id: 'benoa',
      label: 'Home beach',
      lat: -8.745,
      lon: 115.21,
    };
    expect(healFavoriteLabels([good], [benoa, uluwatu])[0]).toEqual(good);
  });
});
