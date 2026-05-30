/** Unit conversion + display formatting. */
import type { DistanceUnit, HeightUnit } from './types';

export const M_TO_FT = 3.280839895;
export const KM_TO_MI = 0.621371192;

export function metresToFeet(m: number): number {
  return m * M_TO_FT;
}

export function kmToMiles(km: number): number {
  return km * KM_TO_MI;
}

export function formatHeight(metres: number, unit: HeightUnit): string {
  return unit === 'ft' ? `${metresToFeet(metres).toFixed(1)} ft` : `${metres.toFixed(2)} m`;
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const value = unit === 'mi' ? kmToMiles(km) : km;
  return value < 10 ? `${value.toFixed(1)} ${unit}` : `${Math.round(value)} ${unit}`;
}

/** "2h 14m" style relative duration from now to a future instant. */
export function formatCountdown(fromMs: number, toMs: number): string {
  const mins = Math.max(0, Math.round((toMs - fromMs) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
