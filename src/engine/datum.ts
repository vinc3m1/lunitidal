/**
 * Chart-datum conversion. The predictor synthesises around MSL = 0; published tide
 * tables are usually relative to a chart datum (LAT/MLLW/…). To express a level
 * "above datum D", shift by datums[MSL] - datums[D] — the datums table's zero point
 * varies by source (TICON tables are MSL-relative so datums.MSL = 0; NOAA tables are
 * station-datum-relative so datums.MSL is a few metres), which is why the offset must
 * be measured against the table's own MSL entry, never assumed to be -datums[D].
 * Benoa: chart_datum=LAT, MSL=0, LAT=-1.63 → offset +1.63 m.
 * San Francisco: chart_datum=MLLW, MSL=2.773, MLLW=1.822 → offset +0.951 m.
 */
import type { Station } from './types';

type DatumSource = Pick<Station, 'datums' | 'chart_datum'>;

/** Metres to add to an MSL-relative level to express it above `target` datum. */
export function datumOffset(station: DatumSource, target?: string): number {
  const datums = station.datums;
  if (!datums) return 0;
  const key = target ?? station.chart_datum;
  const v = datums[key];
  if (typeof v !== 'number') return 0;
  const msl = typeof datums.MSL === 'number' ? datums.MSL : 0;
  // `+ 0` normalises -0 (from subtracting equal values) to +0.
  return msl - v + 0;
}

/** Convert an MSL-relative level to one above `target` (defaults to chart datum). */
export function toDatum(levelMSL: number, station: DatumSource, target?: string): number {
  return levelMSL + datumOffset(station, target);
}

/** Datum keys available for this station (for the datum selector). */
export function availableDatums(station: DatumSource): string[] {
  return station.datums ? Object.keys(station.datums) : [];
}
