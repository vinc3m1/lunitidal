import { get } from 'svelte/store';
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
