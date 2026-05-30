/**
 * Pure chart geometry — no DOM, no Svelte. Maps tide data (time ms, level metres)
 * to SVG coordinates and back. Kept framework-agnostic so the render layer (or a
 * future native port) can reuse it.
 */
import type { TidePoint } from '../engine/types';

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ScaleOptions {
  width: number;
  height: number;
  padding: Padding;
  startMs: number;
  endMs: number;
  minLevel: number;
  maxLevel: number;
}

export interface ChartScale extends ScaleOptions {
  innerWidth: number;
  innerHeight: number;
  baselineY: number;
  xOf(ms: number): number;
  yOf(level: number): number;
  msOf(x: number): number;
}

export function makeScale(o: ScaleOptions): ChartScale {
  const innerWidth = Math.max(1, o.width - o.padding.left - o.padding.right);
  const innerHeight = Math.max(1, o.height - o.padding.top - o.padding.bottom);
  const spanMs = Math.max(1, o.endMs - o.startMs);
  const spanLevel = Math.max(0.001, o.maxLevel - o.minLevel);
  return {
    ...o,
    innerWidth,
    innerHeight,
    baselineY: o.padding.top + innerHeight,
    xOf: (ms) => o.padding.left + ((ms - o.startMs) / spanMs) * innerWidth,
    yOf: (level) => o.padding.top + (1 - (level - o.minLevel) / spanLevel) * innerHeight,
    msOf: (x) => o.startMs + ((x - o.padding.left) / innerWidth) * spanMs,
  };
}

/** SVG path for the tide curve as a polyline (10-min samples are smooth enough). */
export function buildLinePath(points: TidePoint[], scale: ChartScale): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd}${scale.xOf(p.time.getTime()).toFixed(1)} ${scale.yOf(p.level).toFixed(1)}`;
    })
    .join(' ');
}

/** Same curve, closed down to the baseline — for the gradient fill under the curve. */
export function buildAreaPath(points: TidePoint[], scale: ChartScale): string {
  if (points.length === 0) return '';
  const line = buildLinePath(points, scale);
  const lastX = scale.xOf(points[points.length - 1].time.getTime()).toFixed(1);
  const firstX = scale.xOf(points[0].time.getTime()).toFixed(1);
  const bottom = scale.baselineY.toFixed(1);
  return `${line} L${lastX} ${bottom} L${firstX} ${bottom} Z`;
}

/** Evenly-spaced Y gridlines + their level values, for axis labels. */
export function levelTicks(scale: ChartScale, count = 4): { level: number; y: number }[] {
  const ticks: { level: number; y: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const level = scale.minLevel + ((scale.maxLevel - scale.minLevel) * i) / count;
    ticks.push({ level, y: scale.yOf(level) });
  }
  return ticks;
}
