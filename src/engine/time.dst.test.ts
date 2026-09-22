import { describe, expect, it } from 'vitest';
import { startOfDayInTz, tzOffsetMs } from './time';

describe('local calendar days', () => {
  it.each([
    ['2026-03-08T16:00:00Z', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 23],
    ['2026-11-01T17:00:00Z', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 25],
  ])('uses the midnight offset on DST transition day %s', (instant, start, end, hours) => {
    const day = startOfDayInTz(new Date(instant), 'America/New_York');
    const next = startOfDayInTz(new Date(instant), 'America/New_York', 1);
    expect(day.toISOString()).toBe(start);
    expect(next.toISOString()).toBe(end);
    expect((next.getTime() - day.getTime()) / 3_600_000).toBe(hours);
    expect(startOfDayInTz(next, 'America/New_York', -1)).toEqual(day);
  });

  it('handles a half-hour daylight-saving transition', () => {
    const instant = new Date('2026-10-04T02:00:00Z');
    const start = startOfDayInTz(instant, 'Australia/Lord_Howe');
    const end = startOfDayInTz(instant, 'Australia/Lord_Howe', 1);
    expect(start.toISOString()).toBe('2026-10-03T13:30:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23.5);
  });

  it('starts at the first valid time when DST skips midnight', () => {
    expect(startOfDayInTz(new Date('2018-11-04T15:00:00Z'), 'America/Sao_Paulo').toISOString())
      .toBe('2018-11-04T03:00:00.000Z');
  });

  it('does not include milliseconds in the UTC offset', () => {
    expect(tzOffsetMs(new Date('2026-05-30T00:00:00.123Z'), 'Asia/Makassar'))
      .toBe(8 * 3_600_000);
  });
});
