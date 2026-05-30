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
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.region?.toLowerCase().includes(q) ?? false) ||
        s.country.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

export async function loadStation(id: string): Promise<Station> {
  const res = await fetch(`${base()}data/stations/${stationFileSlug(id)}.json`);
  if (!res.ok) throw new Error(`Failed to load station ${id} (${res.status})`);
  return (await res.json()) as Station;
}

/** The bundled, precached seed station (Benoa) — available offline on first launch. */
export async function loadSeedStation(): Promise<Station> {
  const res = await fetch(`${base()}data/benoa.json`);
  if (!res.ok) throw new Error(`Failed to load seed station (${res.status})`);
  return (await res.json()) as Station;
}
