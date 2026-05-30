import { describe, expect, it } from 'vitest';
import { confidenceForKm, describeMatch } from './confidence';

describe('confidence', () => {
  it('buckets by distance', () => {
    expect(confidenceForKm(5).level).toBe('good');
    expect(confidenceForKm(30).level).toBe('fair');
    expect(confidenceForKm(80).level).toBe('rough');
    expect(confidenceForKm(250).level).toBe('far');
  });

  it('describes a match in one line', () => {
    expect(describeMatch('Benoa', 12, 'km')).toBe('Benoa · 12 km · good match');
  });
});
