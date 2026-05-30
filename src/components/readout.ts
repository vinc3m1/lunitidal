import type { Extreme } from '../engine/types';

export interface ReadoutState {
  nextExtreme: Extreme | undefined;
  isNow: boolean;
  rising: boolean;
  showCountdown: boolean;
}

interface ReadoutStateInput {
  scrubDate: Date;
  scrubLevel: number;
  levelAt: (t: Date) => number;
  extremes: Extreme[];
  now: Date;
}

export function getReadoutState({
  scrubDate,
  scrubLevel,
  levelAt,
  extremes,
  now,
}: ReadoutStateInput): ReadoutState {
  const nextExtreme = extremes.find((e) => e.time.getTime() > scrubDate.getTime());
  const isNow = Math.abs(scrubDate.getTime() - now.getTime()) < 60_000;
  return {
    nextExtreme,
    isNow,
    rising: nextExtreme
      ? nextExtreme.high
      : levelAt(new Date(scrubDate.getTime() + 15 * 60_000)) > scrubLevel,
    showCountdown: isNow && !!nextExtreme,
  };
}
