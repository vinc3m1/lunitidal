/**
 * Chart-datum conversion. The predictor synthesises around MSL = 0; published tide
 * tables are usually relative to a chart datum (LAT/MLLW/…). To express a level
 * "above datum D", shift by -datums[D]. Benoa: chart_datum=LAT, datums.LAT=-1.63,
 * so the offset is +1.63 m.
 */
import type { Station } from './types';

type DatumSource = Pick<Station, 'datums' | 'chart_datum'>;

/** Metres to add to an MSL-relative level to express it above `target` datum. */
export function datumOffset(station: DatumSource, target?: string): number {
  const datums = station.datums;
  if (!datums) return 0;
  const key = target ?? station.chart_datum;
  const v = datums[key];
  // `+ 0` normalises -0 (from negating a 0 datum) to +0.
  return typeof v === 'number' ? -v + 0 : 0;
}

/** Convert an MSL-relative level to one above `target` (defaults to chart datum). */
export function toDatum(levelMSL: number, station: DatumSource, target?: string): number {
  return levelMSL + datumOffset(station, target);
}

/** Datum keys available for this station (for the datum selector). */
export function availableDatums(station: DatumSource): string[] {
  return station.datums ? Object.keys(station.datums) : [];
}
