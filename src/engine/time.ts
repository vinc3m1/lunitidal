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
  return asIfUTC - instant.getTime();
}

/** The UTC instant of local midnight (in `timeZone`) for the day containing `instant`. */
export function startOfDayInTz(instant: Date, timeZone: string): Date {
  const offset = tzOffsetMs(instant, timeZone);
  const local = new Date(instant.getTime() + offset);
  const midnightWall = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  return new Date(midnightWall - offset);
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}
