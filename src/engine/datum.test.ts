import { describe, expect, it } from 'vitest';
import { availableDatums, datumOffset, toDatum } from './datum';

const benoaLike = {
  chart_datum: 'LAT',
  datums: { HAT: 1.598, MHHW: 0.699, MSL: 0, MLLW: -0.738, LAT: -1.63 },
};

describe('datum', () => {
  it('offsets to chart datum (LAT) so the datum reads zero', () => {
    expect(datumOffset(benoaLike)).toBeCloseTo(1.63, 5);
  });

  it('offsets to an explicit target datum', () => {
    expect(datumOffset(benoaLike, 'MSL')).toBe(0);
    expect(datumOffset(benoaLike, 'MLLW')).toBeCloseTo(0.738, 5);
  });

  it('converts an MSL level to above-datum', () => {
    expect(toDatum(0, benoaLike, 'LAT')).toBeCloseTo(1.63, 5);
    expect(toDatum(0.5, benoaLike, 'MSL')).toBeCloseTo(0.5, 5);
  });

  it('returns 0 offset for unknown/missing datum', () => {
    expect(datumOffset(benoaLike, 'NOPE')).toBe(0);
    expect(datumOffset({ chart_datum: 'LAT', datums: {} })).toBe(0);
  });

  it('lists available datums', () => {
    expect(availableDatums(benoaLike)).toContain('LAT');
    expect(availableDatums(benoaLike)).toContain('MLLW');
  });
});
