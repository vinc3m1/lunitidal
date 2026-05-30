import { describe, expect, it } from 'vitest';
import { parseIpLocation } from './ipgeo';

describe('IP geolocation parsing', () => {
  it('parses geojs string coordinates + builds a label', () => {
    const loc = parseIpLocation({
      latitude: '-8.65',
      longitude: '115.22',
      city: 'Denpasar',
      country: 'Indonesia',
    });
    expect(loc.lat).toBeCloseTo(-8.65, 5);
    expect(loc.lon).toBeCloseTo(115.22, 5);
    expect(loc.label).toBe('Denpasar, Indonesia');
  });

  it('accepts numeric coords and ipapi-style country_name', () => {
    const loc = parseIpLocation({ latitude: 51.5, longitude: -0.1, city: 'London', country_name: 'UK' });
    expect(loc.label).toBe('London, UK');
  });

  it('falls back to "Near you" when city/country are missing', () => {
    expect(parseIpLocation({ latitude: 1, longitude: 2 }).label).toBe('Near you');
  });

  it('throws when coordinates are absent or invalid', () => {
    expect(() => parseIpLocation({})).toThrow();
    expect(() => parseIpLocation(null)).toThrow();
    expect(() => parseIpLocation({ latitude: 'x', longitude: 'y' })).toThrow();
  });
});
