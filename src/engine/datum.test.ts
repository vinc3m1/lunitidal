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

  // NOAA datums tables are relative to the station datum (STND = 0), not MSL —
  // offsets must be measured against the table's own MSL entry.
  const sanFranciscoLike = {
    chart_datum: 'MLLW',
    datums: { STND: 0, MHHW: 3.602, MSL: 2.773, MLW: 2.168, MLLW: 1.822, NAVD88: 1.804 },
  };

  it('handles station-datum-relative tables (NOAA): MSL→MLLW is MSL - MLLW', () => {
    expect(datumOffset(sanFranciscoLike)).toBeCloseTo(0.951, 5); // 2.773 - 1.822
    expect(datumOffset(sanFranciscoLike, 'MLLW')).toBeCloseTo(0.951, 5);
    expect(datumOffset(sanFranciscoLike, 'MSL')).toBe(0);
    expect(datumOffset(sanFranciscoLike, 'STND')).toBeCloseTo(2.773, 5);
    expect(toDatum(-0.5, sanFranciscoLike)).toBeCloseTo(0.451, 5);
  });

  it('lists available datums', () => {
    expect(availableDatums(benoaLike)).toContain('LAT');
    expect(availableDatums(benoaLike)).toContain('MLLW');
  });
});
