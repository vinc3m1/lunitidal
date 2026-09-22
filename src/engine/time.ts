/**
 * Timezone helpers. Tide instants are real `Date`s (absolute UTC instants); the
 * predictor handles them correctly. We only convert for DISPLAY, into the station's
 * IANA timezone (e.g. Benoa → "Asia/Makassar", WITA/UTC+8). No DST in Bali, but
 * these helpers are DST-correct via Intl for stations that do observe it.
 */
import type { TimeFormat } from './types';

export function formatTime(date: Date, timeZone: string, fmt: TimeFormat = '24h'): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: fmt === '12h',
  }).format(date);
}

export function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Short timezone label for an instant in a zone, e.g. "GMT+8" / "EDT". */
export function tzAbbrev(date: Date, timeZone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? '';
}

/** Offset (ms) between wall-clock time in `timeZone` and UTC at a given instant. */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asIfUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUTC - (instant.getTime() - instant.getUTCMilliseconds());
}

/** First instant of a local calendar day, optionally shifted by calendar days.
 * Resolve each boundary independently: a DST day can have 23 or 25 hours, and
 * some zones skip midnight entirely. The offset at noon need not match midnight.
 */
export function startOfDayInTz(instant: Date, timeZone: string, dayOffset = 0): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const localDate = (ms: number): number => {
    const parts = Object.fromEntries(formatter.formatToParts(ms).map((p) => [p.type, p.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };
  const target = localDate(instant.getTime()) + dayOffset * 86_400_000;
  // All IANA offsets fit inside this bracket. Find the first instant belonging
  // to the requested date (or the next date if a date-line move skipped it).
  let lo = target - 36 * 3_600_000;
  let hi = target + 36 * 3_600_000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(mid) < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}
