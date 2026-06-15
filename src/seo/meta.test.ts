import { describe, expect, it } from 'vitest';
import { buildDescription, buildTitle, placeLabel, stationJsonLd, stationUrl, type StationMeta } from './meta';

const benoa: StationMeta = { name: 'Benoa', region: 'Bali', country: 'Indonesia', lat: -8.75, lon: 115.21 };

describe('meta builders', () => {
  it('builds a place label, omitting an absent region', () => {
    expect(placeLabel(benoa)).toBe('Benoa, Bali, Indonesia');
    expect(placeLabel({ ...benoa, region: null })).toBe('Benoa, Indonesia');
  });

  it('builds a title and description that name the place', () => {
    expect(buildTitle(benoa)).toBe('Benoa Tide Times & Tide Chart — Lunitidal');
    expect(buildDescription(benoa)).toContain('Benoa, Bali, Indonesia');
  });

  it('builds a canonical station url', () => {
    expect(stationUrl('benoa-indonesia')).toBe('https://www.lunitidal.app/tides/benoa-indonesia/');
  });

  it('emits a Place + BreadcrumbList json-ld graph with coordinates', () => {
    const ld = stationJsonLd(benoa, 'benoa-indonesia') as {
      '@graph': { '@type': string; geo?: { latitude: number; longitude: number } }[];
    };
    const place = ld['@graph'].find((n) => n['@type'] === 'Place');
    expect(place?.geo).toEqual({ '@type': 'GeoCoordinates', latitude: -8.75, longitude: 115.21 });
    expect(ld['@graph'].some((n) => n['@type'] === 'BreadcrumbList')).toBe(true);
    // Must be valid JSON for a <script type="application/ld+json"> block.
    expect(() => JSON.parse(JSON.stringify(ld))).not.toThrow();
  });
});
