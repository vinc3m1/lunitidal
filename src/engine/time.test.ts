import { describe, expect, it } from 'vitest';
import { addDays, formatTime, startOfDayInTz, tzOffsetMs } from './time';

describe('time', () => {
  it('computes the UTC offset of a timezone at an instant', () => {
    const t = new Date('2026-05-30T00:00:00Z');
    expect(tzOffsetMs(t, 'Asia/Makassar')).toBe(8 * 3_600_000); // WITA, no DST
    expect(tzOffsetMs(t, 'UTC')).toBe(0);
  });

  it('handles DST timezones at the right time of year', () => {
    // New York is UTC-4 in July (EDT), UTC-5 in January (EST).
    expect(tzOffsetMs(new Date('2026-07-01T12:00:00Z'), 'America/New_York')).toBe(-4 * 3_600_000);
    expect(tzOffsetMs(new Date('2026-01-01T12:00:00Z'), 'America/New_York')).toBe(-5 * 3_600_000);
  });

  it('finds local midnight (in tz) as a UTC instant', () => {
    // 03:00 UTC on 30 May is 11:00 WITA the same day; local midnight WITA is 29 May 16:00 UTC.
    const start = startOfDayInTz(new Date('2026-05-30T03:00:00Z'), 'Asia/Makassar');
    expect(start.toISOString()).toBe('2026-05-29T16:00:00.000Z');
  });

  it('formats time in the station timezone', () => {
    const midnightWita = new Date('2026-05-29T16:00:00Z');
    expect(formatTime(midnightWita, 'Asia/Makassar', '24h')).toBe('00:00');
    expect(formatTime(midnightWita, 'Asia/Makassar', '12h')).toBe('12:00 AM');
  });

  it('adds days as exact 24h steps', () => {
    const t = new Date('2026-05-30T00:00:00Z');
    expect(addDays(t, 1).toISOString()).toBe('2026-05-31T00:00:00.000Z');
    expect(addDays(t, -2).toISOString()).toBe('2026-05-28T00:00:00.000Z');
  });
});
