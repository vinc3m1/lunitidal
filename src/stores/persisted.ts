import { writable, type Writable } from 'svelte/store';

/** A writable Svelte store mirrored to localStorage (best-effort, SSR/private-mode safe). */
export function persisted<T>(key: string, initial: T): Writable<T> {
  let start = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) start = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    /* ignore unavailable/corrupt storage */
  }
  const store = writable<T>(start);
  store.subscribe((value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota/availability errors */
    }
  });
  return store;
}
