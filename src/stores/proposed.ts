import { writable } from 'svelte/store';

/** A point the user dropped on the map but hasn't committed yet (the "proposed"
 *  location behind the "Use this location" button).
 *
 *  This lives in a shared store rather than inside StationMap because the inline
 *  and overlay (expanded) maps are *separate component instances*. Keeping the
 *  pending pin here lets it survive expanding/shrinking the map — otherwise each
 *  instance has its own copy and the pin appears to vanish when you expand. */
export type ProposedPoint = { lat: number; lon: number } | null;

export const proposed = writable<ProposedPoint>(null);
