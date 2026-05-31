import { describe, expect, it } from 'vitest';
import { parseReverse } from './reverse';

describe('reverse geocoding parsing', () => {
  it('builds "City, Subdivision, Country" from a BigDataCloud response', () => {
    expect(
      parseReverse({
        city: 'Denpasar',
        principalSubdivision: 'Bali',
        countryName: 'Indonesia',
      }),
    ).toBe('Denpasar, Bali, Indonesia');
  });

  it('falls back to locality when city is absent', () => {
    expect(
      parseReverse({ locality: 'Sanur', principalSubdivision: 'Bali', countryName: 'Indonesia' }),
    ).toBe('Sanur, Bali, Indonesia');
  });

  it('drops a subdivision that merely repeats the place', () => {
    expect(
      parseReverse({ city: 'Singapore', principalSubdivision: 'Singapore', countryName: 'Singapore' }),
    ).toBe('Singapore, Singapore');
  });

  it('omits missing segments', () => {
    expect(parseReverse({ city: 'Reykjavík', countryName: 'Iceland' })).toBe('Reykjavík, Iceland');
  });

  it('returns null when there is nothing usable (mid-ocean / empty / null)', () => {
    expect(parseReverse({})).toBeNull();
    expect(parseReverse(null)).toBeNull();
    expect(parseReverse({ principalSubdivision: '', countryName: '' })).toBeNull();
  });
});
