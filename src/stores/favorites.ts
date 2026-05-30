import { get } from 'svelte/store';
import { persisted } from './persisted';

export interface Favorite {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const favorites = persisted<Favorite[]>('lunitidal:favorites', []);

export function isFavorite(id: string): boolean {
  return get(favorites).some((f) => f.id === id);
}

export function toggleFavorite(fav: Favorite): void {
  favorites.update((list) =>
    list.some((f) => f.id === fav.id) ? list.filter((f) => f.id !== fav.id) : [...list, fav],
  );
}
