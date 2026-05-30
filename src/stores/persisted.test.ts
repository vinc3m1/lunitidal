import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { persisted } from './persisted';

class MemStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  seed(k: string, v: string) {
    this.store.set(k, v);
  }
}

let mem: MemStorage;
beforeEach(() => {
  mem = new MemStorage();
  (globalThis as { localStorage?: unknown }).localStorage = mem;
});

describe('persisted', () => {
  it('starts from the initial value when storage is empty', () => {
    expect(get(persisted('k', { a: 1 }))).toEqual({ a: 1 });
  });

  it('writes changes back to storage', () => {
    const s = persisted<{ a: number }>('k', { a: 1 });
    s.set({ a: 9 });
    expect(JSON.parse(mem.getItem('k')!)).toEqual({ a: 9 });
  });

  it('forward-fills newly-added keys for object stores', () => {
    mem.seed('k', JSON.stringify({ a: 2 }));
    expect(get(persisted('k', { a: 1, b: 5 }))).toEqual({ a: 2, b: 5 });
  });

  it('preserves array stores as arrays (regression: {...[]} bug)', () => {
    mem.seed('favs', JSON.stringify([{ id: 'x' }, { id: 'y' }]));
    const value = get(persisted<{ id: string }[]>('favs', []));
    expect(Array.isArray(value)).toBe(true);
    expect(value).toHaveLength(2);
  });

  it('falls back to initial for an array store if stored value is not an array', () => {
    mem.seed('favs', JSON.stringify({ 0: { id: 'x' } })); // corrupted (old bug shape)
    const value = get(persisted<{ id: string }[]>('favs', []));
    expect(value).toEqual([]);
  });

  it('ignores corrupt JSON', () => {
    mem.seed('k', 'not json{');
    expect(get(persisted('k', { a: 1 }))).toEqual({ a: 1 });
  });
});
