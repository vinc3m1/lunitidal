import { describe, expect, it } from 'vitest';
import index from '../../public/data/stations-index.json';
import { buildSlugMap, slugify, stationSeoSlug, type SlugEntry } from './slug';

describe('slugify', () => {
  it('lowercases, strips diacritics, and hyphenates', () => {
    expect(slugify('Saint-Malo')).toBe('saint-malo');
    expect(slugify('Cádiz')).toBe('cadiz');
    expect(slugify('São Paulo')).toBe('sao-paulo');
    expect(slugify('  Benoa,  Bali ')).toBe('benoa-bali');
  });

  it('collapses runs and trims hyphens', () => {
    expect(slugify('A & B / C')).toBe('a-b-c');
  });
});

describe('stationSeoSlug', () => {
  it('joins name and country', () => {
    expect(stationSeoSlug({ id: 'x', name: 'Benoa', country: 'Indonesia' })).toBe('benoa-indonesia');
  });

  it('falls back to the id when the name+country strips to empty', () => {
    expect(stationSeoSlug({ id: 'noaa/1234', name: '???', country: '' })).toBe('noaa-1234');
  });
});

describe('buildSlugMap', () => {
  const sample: SlugEntry[] = [
    { id: 'b', name: 'Benoa', region: 'Bali', country: 'Indonesia' },
    { id: 'a', name: 'Benoa', region: 'Java', country: 'Indonesia' }, // same name+country → collision
    { id: 'c', name: 'Benoa', region: null, country: 'Indonesia' }, // no region → numeric suffix
  ];

  it('produces a unique, reversible slug per id', () => {
    const { slugToId, idToSlug } = buildSlugMap(sample);
    const slugs = Object.keys(slugToId);
    expect(new Set(slugs).size).toBe(sample.length);
    for (const e of sample) {
      expect(slugToId[idToSlug[e.id]]).toBe(e.id);
    }
  });

  it('resolves collisions with region, then a numeric suffix — deterministically', () => {
    const a = buildSlugMap(sample);
    const b = buildSlugMap([...sample].reverse()); // order must not matter
    expect(a.idToSlug).toEqual(b.idToSlug);
    // 'a' sorts first → keeps the base slug; the others get qualified.
    expect(a.idToSlug['a']).toBe('benoa-indonesia');
    expect(a.idToSlug['b']).toBe('benoa-bali-indonesia');
    expect(a.idToSlug['c']).toBe('benoa-indonesia-2');
  });

  it('is a clean bijection over the real station index', () => {
    const { slugToId, idToSlug } = buildSlugMap(index as SlugEntry[]);
    expect(Object.keys(idToSlug).length).toBe(index.length);
    expect(Object.keys(slugToId).length).toBe(index.length); // no slug collisions survive
    for (const e of index as SlugEntry[]) {
      expect(slugToId[idToSlug[e.id]]).toBe(e.id);
    }
  });
});
