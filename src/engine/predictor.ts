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
      // Pad reference extremes calculation slightly so we can always interpolate boundary points safely
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
      // Calculate surrounding extremes in subordinate timeline.
      // Search a wide window around this point (at least 12 hours before and after).
      const padStart = new Date(tMs - 12 * 3600_000);
      const padEnd = new Date(tMs + 12 * 3600_000);
      const subExtremes = memoExtremes || getSubExtremes(padStart, padEnd);

      // Find the previous extreme and the next extreme
      let prev: Extreme | undefined;
      let next: Extreme | undefined;

      for (let i = 0; i < subExtremes.length; i++) {
        const e = subExtremes[i];
        if (e.time.getTime() <= tMs) {
          if (!prev || e.time.getTime() > prev.time.getTime()) {
            prev = e;
          }
        }
        if (e.time.getTime() >= tMs) {
          if (!next || e.time.getTime() < next.time.getTime()) {
            next = e;
          }
        }
      }

      // If we don't have both surrounding extremes, fallback to direct reference scaling
      if (!prev || !next || prev.time.getTime() === next.time.getTime()) {
        const refVal = refModel.levelAt(time);
        if (offsets.height.type === 'ratio') {
          return refVal * ((offsets.height.high + offsets.height.low) / 2);
        } else {
          return refVal + ((offsets.height.high + offsets.height.low) / 2);
        }
      }

      // 1. Calculate the fraction of time elapsed in the subordinate interval
      const subInterval = next.time.getTime() - prev.time.getTime();
      const p = (tMs - prev.time.getTime()) / subInterval;

      // 2. Find the corresponding reference extremes.
      // To ensure perfect mathematical correspondence, we map back to the original reference extremes.
      const prevTimeShift = prev.high ? offsets.time.high : offsets.time.low;
      const nextTimeShift = next.high ? offsets.time.high : offsets.time.low;

      const refPrevTime = new Date(prev.time.getTime() - prevTimeShift * 60_000);
      const refNextTime = new Date(next.time.getTime() - nextTimeShift * 60_000);

      // 3. Interpolate the reference time t_ref corresponding to t
      const tRef = new Date(refPrevTime.getTime() + p * (refNextTime.getTime() - refPrevTime.getTime()));

      // 4. Look up reference levels
      const refLevel = refModel.levelAt(tRef);
      const refPrevLevel = refModel.levelAt(refPrevTime);
      const refNextLevel = refModel.levelAt(refNextTime);

      const refDelta = refNextLevel - refPrevLevel;
      if (Math.abs(refDelta) < 1e-5) {
        // High/low heights are identical; avoid division by zero
        return prev.level + p * (next.level - prev.level);
      }

      // 5. Calculate reference height ratio (where refLevel is relative to prev and next levels)
      const hRatio = (refLevel - refPrevLevel) / refDelta;

      // 6. Map to subordinate height range
      return prev.level + hRatio * (next.level - prev.level);
    };

    return {
      levelAt: (time) => getSubLevelAt(time),
      extremes: (start, end) => {
        // Filter out subordinate extremes outside the requested [start, end] window
        const allSubs = getSubExtremes(start, end);
        return allSubs.filter((e) => e.time >= start && e.time <= end);
      },
      timeline: (start, end, timeFidelity = 600) => {
        // Generate continuous timeline by sampling levelAt
        // For performance, pre-load a cache of subordinate extremes to avoid re-computing on each levelAt
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
