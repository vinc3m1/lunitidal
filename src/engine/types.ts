/** Core domain types. Framework-agnostic — no DOM, no Svelte. */

export interface HarmonicConstituent {
  name: string;
  amplitude: number;
  phase: number;
  speed?: number;
  description?: string;
}

export interface StationSource {
  name: string;
  id: string;
  published_harmonics: boolean;
  url: string;
}

export interface StationLicense {
  type: string;
  commercial_use: boolean;
  url: string;
  notes?: string;
}

export interface SubordinateOffsets {
  reference: string;
  height: {
    type: 'ratio' | 'fixed';
    high: number;
    low: number;
  };
  time: {
    high: number;
    low: number;
  };
}

/** Full station record (one per `public/data/stations/<slug>.json`). */
export interface Station {
  id: string;
  name: string;
  continent: string;
  country: string;
  region?: string;
  timezone: string;
  disclaimers: string;
  type: 'reference' | 'subordinate';
  latitude: number;
  longitude: number;
  source: StationSource;
  license: StationLicense;
  harmonic_constituents?: HarmonicConstituent[];
  offsets?: SubordinateOffsets;
  datums: Record<string, number>;
  chart_datum: string;
  epoch?: { start: string; end: string };
  referenceStation?: Station;
}

/** Slim index entry (discovery only) — see scripts/build-station-index.ts. */
export interface IndexEntry {
  id: string;
  name: string;
  region: string | null;
  country: string;
  continent: string;
  lat: number;
  lon: number;
  tz: string;
  source: string;
  type: 'reference' | 'subordinate';
  chartDatum: string;
  hasDatum: boolean;
}

export interface Extreme {
  time: Date;
  level: number;
  high: boolean;
  low: boolean;
  label: string;
}

export interface TidePoint {
  time: Date;
  level: number;
}

export type HeightUnit = 'm' | 'ft';
export type DistanceUnit = 'km' | 'mi';
export type TimeFormat = '12h' | '24h';
