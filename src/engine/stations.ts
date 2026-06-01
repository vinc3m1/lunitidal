/**
 * Runtime station discovery + loading (browser). Works against the slim index we
 * extracted at build time; full constituents are fetched per-station on demand.
 * We re-implement nearest/search here rather than importing @neaps/tide-database's
 * geo helpers, because that package drags in a ~23 MB bundle.
 */
import type { IndexEntry, Station } from './types';
import { stationFileSlug } from './paths';

function base(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

let indexCache: IndexEntry[] | null = null;

export async function loadIndex(): Promise<IndexEntry[]> {
  if (indexCache) return indexCache;
  const res = await fetch(`${base()}data/stations-index.json`);
  if (!res.ok) throw new Error(`Failed to load station index (${res.status})`);
  indexCache = (await res.json()) as IndexEntry[];
  return indexCache;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

/**
 * Initial great-circle bearing from point 1 to point 2, in degrees clockwise from
 * true north (0–360). 0 = due north of point 1, 90 = due east, etc.
 */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/** Nearest 16-point compass abbreviation (N, NNE, NE, …) for a bearing in degrees. */
export function compass16(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_16[i];
}

export interface NearbyStation {
  station: IndexEntry;
  km: number;
}

export function nearest(index: IndexEntry[], lat: number, lon: number, n = 1): NearbyStation[] {
  return index
    .map((station) => ({ station, km: haversineKm(lat, lon, station.lat, station.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

export function searchByName(index: IndexEntry[], query: string, limit = 25): IndexEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/[\s,.-]+/)
    .filter(Boolean);

  if (tokens.length === 0) return [];

  return index
    .filter((s) => {
      const name = s.name.toLowerCase();
      const region = s.region?.toLowerCase() ?? '';
      const country = s.country.toLowerCase();

      return tokens.every((token) => {
        // 1. Direct substring match
        if (
          name.includes(token) ||
          region.includes(token) ||
          country.includes(token)
        ) {
          return true;
        }

        // 2. Region initials match (e.g. "ny" matches "New York")
        if (region) {
          const regionInitials = region
            .split(/\s+/)
            .map((word) => word[0])
            .join('');
          if (regionInitials === token) return true;
        }

        // 3. Country initials match (e.g. "us" matches "United States")
        if (country) {
          const countryInitials = country
            .split(/\s+/)
            .map((word) => word[0])
            .join('');
          if (countryInitials === token) return true;
        }

        return false;
      });
    })
    .slice(0, limit);
}

export async function loadStation(id: string): Promise<Station> {
  const res = await fetch(`${base()}data/stations/${stationFileSlug(id)}.json`);
  if (!res.ok) throw new Error(`Failed to load station ${id} (${res.status})`);
  const station = (await res.json()) as Station;

  if (station.type === 'subordinate' && station.offsets?.reference) {
    station.referenceStation = await loadStation(station.offsets.reference);
  }
  return station;
}

/** The bundled, precached seed station (Benoa) — available offline on first launch. */
export async function loadSeedStation(): Promise<Station> {
  const res = await fetch(`${base()}data/benoa.json`);
  if (!res.ok) throw new Error(`Failed to load seed station (${res.status})`);
  return (await res.json()) as Station;
}
