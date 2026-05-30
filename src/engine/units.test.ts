import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDistance, formatHeight, kmToMiles, metresToFeet } from './units';

describe('units', () => {
  it('converts metres to feet', () => {
    expect(metresToFeet(1)).toBeCloseTo(3.2808, 3);
  });

  it('converts km to miles', () => {
    expect(kmToMiles(10)).toBeCloseTo(6.2137, 3);
  });

  it('formats height per unit', () => {
    expect(formatHeight(2.345, 'm')).toBe('2.35 m');
    expect(formatHeight(1, 'ft')).toBe('3.3 ft');
  });

  it('formats distance with adaptive precision', () => {
    expect(formatDistance(4.2, 'km')).toBe('4.2 km');
    expect(formatDistance(12.6, 'km')).toBe('13 km');
    expect(formatDistance(10, 'mi')).toBe('6.2 mi');
  });

  it('formats a countdown', () => {
    const base = 1_000_000;
    expect(formatCountdown(base, base + 134 * 60_000)).toBe('2h 14m');
    expect(formatCountdown(base, base + 5 * 60_000)).toBe('5m');
    expect(formatCountdown(base, base - 10_000)).toBe('0m');
  });
});
