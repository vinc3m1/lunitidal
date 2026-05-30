import { get } from 'svelte/store';
import { loadIndex, nearest } from '../engine/stations';
import type { IndexEntry } from '../engine/types';
import { persisted } from './persisted';

export interface Favorite {
  id: string; // station.id
  label: string; // station.name
  lat: number;
  lon: number;
}

export const favorites = persisted<Favorite[]>('lunitidal:favorites', []);

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

function needsMigration(f: any): boolean {
  return f.id.includes(',') || isLegacyLabel(f.label);
}

/**
 * Pure: backfill the resolved station ID and name onto favorites and replace any
 * legacy label with the station name. Also deduplicates by the new station ID.
 */
export function healFavoriteLabels(list: any[], index: IndexEntry[]): Favorite[] {
  const healed: Favorite[] = [];
  const seenIds = new Set<string>();

  for (const f of list) {
    if (!needsMigration(f)) {
      if (!seenIds.has(f.id)) {
        seenIds.add(f.id);
        healed.push({
          id: f.id,
          label: f.label,
          lat: f.lat,
          lon: f.lon,
        });
      }
    } else {
      const [near] = nearest(index, f.lat, f.lon, 1);
      if (near) {
        const id = near.station.id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          healed.push({
            id,
            label: isLegacyLabel(f.label) ? near.station.name : f.label,
            lat: near.station.lat,
            lon: near.station.lon,
          });
        }
      } else {
        if (!seenIds.has(f.id)) {
          seenIds.add(f.id);
          healed.push({
            id: f.id,
            label: f.label,
            lat: f.lat,
            lon: f.lon,
          });
        }
      }
    }
  }

  return healed;
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
