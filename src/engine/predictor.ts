/**
 * Thin wrapper over @neaps/tide-predictor (v0.9.0).
 *
 * Levels are computed around MSL = 0 (offset: 0); chart-datum conversion is the
 * caller's job via datum.ts — we deliberately keep the model datum-agnostic so the
 * UI can switch reference (MSL / MLLW / LAT …) without rebuilding the predictor.
 *
 * Build the model ONCE per station and reuse it: levelAt() is cheap enough for a
 * 60fps scrub, while extremes() is the expensive call (compute once per view).
 */
import createTidePredictor from '@neaps/tide-predictor';
import type { Extreme, HarmonicConstituent, TidePoint } from './types';

export interface TideModel {
  /** Water level (metres, MSL-relative) at an instant. Cheap — safe for scrub. */
  levelAt(time: Date): number;
  /** Highs/lows between two instants. Expensive — call once per view. */
  extremes(start: Date, end: Date): Extreme[];
  /** Sampled curve between two instants (for drawing). */
  timeline(start: Date, end: Date, timeFidelity?: number): TidePoint[];
}

export function createModel(constituents: HarmonicConstituent[]): TideModel {
  const predictor = createTidePredictor(constituents, { offset: 0 });
  return {
    levelAt: (time) => predictor.getWaterLevelAtTime({ time }).level,
    extremes: (start, end) =>
      predictor.getExtremesPrediction({ start, end }).map((e) => ({
        time: e.time,
        level: e.level,
        high: e.high,
        low: e.low,
        label: e.label,
      })),
    timeline: (start, end, timeFidelity) =>
      predictor
        .getTimelinePrediction({ start, end, timeFidelity })
        .map((p) => ({ time: p.time, level: p.level })),
  };
}
