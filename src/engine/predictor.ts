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
import type { Extreme, HarmonicConstituent, TidePoint, Station } from './types';

export interface TideModel {
  /** Water level (metres, MSL-relative) at an instant. Cheap — safe for scrub. */
  levelAt(time: Date): number;
  /** Highs/lows between two instants. Expensive — call once per view. */
  extremes(start: Date, end: Date): Extreme[];
  /** Sampled curve between two instants (for drawing). */
  timeline(start: Date, end: Date, timeFidelity?: number): TidePoint[];
}

export function createModel(station: Station | HarmonicConstituent[]): TideModel {
  if (station == null) {
    throw new Error('createModel was called with null or undefined');
  }
  // Support legacy constituents array argument for compatibility and tests
  if (Array.isArray(station)) {
    const predictor = createTidePredictor(station, { offset: 0 });
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

  if (station.type === 'subordinate') {
    const offsets = station.offsets;
    if (!offsets || !station.referenceStation) {
      throw new Error(`Subordinate station ${station.id} is missing offsets or referenceStation data`);
    }

    const refModel = createModel(station.referenceStation);

    const getSubExtremes = (start: Date, end: Date): Extreme[] => {
      const padStart = new Date(start.getTime() - 12 * 3600_000);
      const padEnd = new Date(end.getTime() + 12 * 3600_000);
      const refExtremes = refModel.extremes(padStart, padEnd);

      return refExtremes.map((e): Extreme => {
        const isHigh = e.high;
        const timeShiftMin = isHigh ? offsets.time.high : offsets.time.low;
        const subTime = new Date(e.time.getTime() + timeShiftMin * 60_000);

        let subLevel = e.level;
        if (offsets.height.type === 'ratio') {
          const ratio = isHigh ? offsets.height.high : offsets.height.low;
          subLevel = e.level * ratio;
        } else if (offsets.height.type === 'fixed') {
          const fixed = isHigh ? offsets.height.high : offsets.height.low;
          subLevel = e.level + fixed;
        }

        return {
          time: subTime,
          level: subLevel,
          high: e.high,
          low: e.low,
          label: e.label,
        };
      });
    };

    const getSubLevelAt = (time: Date, memoExtremes?: Extreme[]): number => {
      const tMs = time.getTime();
      const subExtremes = memoExtremes || getSubExtremes(new Date(tMs - 12 * 3600_000), new Date(tMs + 12 * 3600_000));

      let prev: Extreme | undefined;
      let next: Extreme | undefined;

      for (let i = 0; i < subExtremes.length; i++) {
        const e = subExtremes[i];
        const eMs = e.time.getTime();
        if (eMs <= tMs) {
          if (!prev || eMs > prev.time.getTime()) {
            prev = e;
          }
        }
        if (eMs >= tMs) {
          if (!next || eMs < next.time.getTime()) {
            next = e;
          }
        }
      }

      if (!prev && !next) return 0;
      if (!prev) return next!.level;
      if (!next) return prev.level;
      if (prev.time.getTime() === next.time.getTime()) return prev.level;

      const duration = next.time.getTime() - prev.time.getTime();
      const fraction = (tMs - prev.time.getTime()) / duration;
      const cosFactor = (1 - Math.cos(fraction * Math.PI)) / 2;
      return prev.level + (next.level - prev.level) * cosFactor;
    };

    return {
      levelAt: (time) => getSubLevelAt(time),
      extremes: (start, end) => {
        const allSubs = getSubExtremes(start, end);
        return allSubs.filter((e) => e.time >= start && e.time <= end);
      },
      timeline: (start, end, timeFidelity = 600) => {
        const padStart = new Date(start.getTime() - 18 * 3600_000);
        const padEnd = new Date(end.getTime() + 18 * 3600_000);
        const memoExtremes = getSubExtremes(padStart, padEnd);

        const points: TidePoint[] = [];
        const totalDuration = end.getTime() - start.getTime();
        const step = totalDuration / (timeFidelity - 1);

        for (let i = 0; i < timeFidelity; i++) {
          const t = new Date(start.getTime() + i * step);
          points.push({
            time: t,
            level: getSubLevelAt(t, memoExtremes),
          });
        }
        return points;
      },
    };
  }

  const predictor = createTidePredictor(station.harmonic_constituents || [], { offset: 0 });
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
