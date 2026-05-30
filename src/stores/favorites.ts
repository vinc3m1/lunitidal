import { get } from 'svelte/store';
import { loadIndex, nearest } from '../engine/stations';
import type { IndexEntry } from '../engine/types';
import { persisted } from './persisted';

export interface Favorite {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

export const favorites = persisted<Favorite[]>('lunitidal:favorites', []);

/** Stable id from coordinates so the same spot toggles cleanly. */
export function favoriteId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
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

/** Pure: relabel favorites carrying a legacy label to their nearest station's name. */
export function healFavoriteLabels(list: Favorite[], index: IndexEntry[]): Favorite[] {
  return list.map((f) => {
    if (!isLegacyLabel(f.label)) return f;
    const [near] = nearest(index, f.lat, f.lon, 1);
    return near ? { ...f, label: near.station.name } : f;
  });
}

/** One-time migration of old "My location"-style favorites to real station names. */
export async function healFavorites(): Promise<void> {
  const list = get(favorites);
  if (!list.some((f) => isLegacyLabel(f.label))) return;
  let index: IndexEntry[];
  try {
    index = await loadIndex();
  } catch {
    return; // offline — retry on a later launch
  }
  favorites.set(healFavoriteLabels(list, index));
}
