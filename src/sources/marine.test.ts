import { describe, expect, it } from 'vitest';
import { parseMarine } from './marine';

const day = (h: number) => `2026-05-30T${String(h).padStart(2, '0')}:00`;
const start = new Date('2026-05-30T00:00:00Z');
const end = new Date('2026-05-31T00:00:00Z');

describe('marine parsing', () => {
  it('windows hourly data to [start, end] and parses UTC times', () => {
    const data = {
      hourly: {
        time: ['2026-05-29T23:00', day(0), day(12), day(23), '2026-05-31T00:00'],
        wave_height: [9, 1.0, 2.0, 1.5, 9],
        swell_wave_height: [9, 0.5, 0.8, 0.6, 9],
        swell_wave_period: [9, 7, 9, 8, 9],
      },
    };
    const out = parseMarine(data, start, end);
    expect(out.points).toHaveLength(4); // 23:00 prev day excluded, 00:00 next day included
    expect(out.points[0].time.toISOString()).toBe('2026-05-30T00:00:00.000Z');
    expect(out.points[3].time.toISOString()).toBe('2026-05-31T00:00:00.000Z');
  });

  it('selects the peak-wave hour', () => {
    const data = {
      hourly: {
        time: [day(0), day(12), day(18)],
        wave_height: [1.0, 2.4, 1.7],
        swell_wave_height: [0.5, 1.1, 0.8],
        swell_wave_period: [7, 10, 9],
      },
    };
    const out = parseMarine(data, start, end);
    expect(out.peak?.waveHeight).toBe(2.4);
    expect(out.peak?.swellPeriod).toBe(10);
  });

  it('ignores null wave heights when picking the peak', () => {
    const data = {
      hourly: {
        time: [day(0), day(6), day(12)],
        wave_height: [null, 0.9, null],
        swell_wave_height: [null, 0.4, null],
        swell_wave_period: [null, 6, null],
      },
    };
    const out = parseMarine(data, start, end);
    expect(out.peak?.waveHeight).toBe(0.9);
  });

  it('returns empty for missing or fully-null data', () => {
    expect(parseMarine({}, start, end)).toEqual({ points: [], peak: null });
    expect(parseMarine(null, start, end)).toEqual({ points: [], peak: null });
    const allNull = parseMarine(
      { hourly: { time: [day(0)], wave_height: [null] } },
      start,
      end,
    );
    expect(allNull.peak).toBeNull();
  });
});
