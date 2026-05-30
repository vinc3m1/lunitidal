/**
 * Qualitative confidence based on distance from the chosen point to its nearest
 * tide station. We deliberately avoid numeric ±error: tides don't interpolate
 * cleanly across space, so a fabricated "±0.3 m" would be false precision. These
 * buckets just set honest expectations; the detail view explains the caveats.
 */
import type { DistanceUnit } from './types';
import { formatDistance } from './units';

export type ConfidenceLevel = 'good' | 'fair' | 'rough' | 'far';

export interface Confidence {
  level: ConfidenceLevel;
  label: string;
}

export function confidenceForKm(km: number): Confidence {
  if (km <= 15) return { level: 'good', label: 'good match' };
  if (km <= 40) return { level: 'fair', label: 'approximate' };
  if (km <= 100) return { level: 'rough', label: 'rough estimate' };
  return { level: 'far', label: 'nearest available' };
}

/** One-line summary, e.g. "Benoa · 12 km · good match". */
export function describeMatch(stationName: string, km: number, unit: DistanceUnit): string {
  return `${stationName} · ${formatDistance(km, unit)} · ${confidenceForKm(km).label}`;
}
