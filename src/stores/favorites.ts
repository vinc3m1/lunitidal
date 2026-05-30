import { get } from 'svelte/store';
import { loadIndex, nearest } from '../engine/stations';
import type { IndexEntry } from '../engine/types';
import { persisted } from './persisted';

export interface Favorite {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** The tide station this favorite resolved to (kept so it never silently drifts). */
  stationId?: string;
  stationName?: string;
  /** Distance (km) from the saved point to that station; absent for exact station picks. */
  km?: number;
}

export const favorites = persisted<Favorite[]>('lunitidal:favorites', []);

/** Stable id from coordinates (~11 m precision) so the same spot toggles cleanly. */
export function favoriteId(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function isFavorite(id: string): boolean {
  return get(favorites).some((f) => f.id === id);
}

export function toggleFavorite(fav: Favorite): void {
  favorites.update((list) =>
    list.some((f) => f.id === fav.id) ? list.filter((f) => f.id !== fav.id) : [fav, ...list],
  );
}

/** Meaningless/legacy labels that should be replaced with the nearest station name. */
const LEGACY_LABEL = /^(my location|near you)$/i;

export function isLegacyLabel(label: string | null | undefined): boolean {
  return !label || LEGACY_LABEL.test(label.trim());
}

function needsMigration(f: Favorite): boolean {
  return isLegacyLabel(f.label) || !f.stationId;
}

/**
 * Pure: backfill the resolved station (id/name/distance) onto favorites and replace any
 * legacy label with the station name. Also re-keys the id to the current precision.
 */
export function healFavoriteLabels(list: Favorite[], index: IndexEntry[]): Favorite[] {
  return list.map((f) => {
    if (!needsMigration(f)) return f;
    const [near] = nearest(index, f.lat, f.lon, 1);
    if (!near) return f;
    return {
      ...f,
      id: favoriteId(f.lat, f.lon),
      label: isLegacyLabel(f.label) ? near.station.name : f.label,
      stationId: near.station.id,
      stationName: near.station.name,
      km: Math.round(near.km * 10) / 10,
    };
  });
}

/** One-time migration: heal legacy labels and backfill station info on old favorites. */
export async function healFavorites(): Promise<void> {
  const list = get(favorites);
  if (!list.some(needsMigration)) return;
  let index: IndexEntry[];
  try {
    index = await loadIndex();
  } catch {
    return; // offline — retry on a later launch
  }
  favorites.set(healFavoriteLabels(list, index));
}
