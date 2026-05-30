import { writable, type Writable } from 'svelte/store';

/** A writable Svelte store mirrored to localStorage (best-effort, SSR/private-mode safe). */
export function persisted<T>(key: string, initial: T): Writable<T> {
  let start = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      // Arrays must stay arrays — object-spread merging only makes sense for
      // record-shaped settings (where it forward-fills newly-added keys).
      if (Array.isArray(initial)) {
        start = Array.isArray(parsed) ? (parsed as T) : initial;
      } else if (parsed && typeof parsed === 'object') {
        start = { ...initial, ...(parsed as Partial<T>) };
      }
    }
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
