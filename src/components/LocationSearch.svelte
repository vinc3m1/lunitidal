<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { loadIndex, searchByName } from '../engine/stations';
  import type { IndexEntry } from '../engine/types';
  import { geocode, geoLabel, type GeoResult } from '../sources/geocode';
  import { selectFavorite, selectPoint, selectStationId } from '../stores/selection';
  import { favorites, type Favorite } from '../stores/favorites';
  import { settings } from '../stores/settings';
  import { formatDistance } from '../engine/units';

  const dispatch = createEventDispatcher<{ close: void; openmap: void }>();

  let query = '';
  let index: IndexEntry[] = [];
  let placeResults: GeoResult[] = [];
  let geoError = '';
  let busy = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  $: stationResults = query.trim() ? searchByName(index, query.trim(), 12) : [];

  onMount(async () => {
    try {
      index = await loadIndex();
    } catch {
      /* index should be precached; ignore */
    }
  });

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 250);
  }

  async function runSearch() {
    const q = query.trim();
    placeResults = [];
    geoError = '';
    if (q.length >= 3 && navigator.onLine) {
      try {
        placeResults = await geocode(q, 6);
      } catch {
        geoError = 'Place search unavailable';
      }
    } else if (q.length >= 3 && !navigator.onLine) {
      geoError = 'Offline — showing stations only';
    }
  }

  async function withBusy(tag: string, fn: () => Promise<void>) {
    busy = tag;
    try {
      await fn();
      dispatch('close');
    } catch (e) {
      geoError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = '';
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      geoError = 'Geolocation is not available';
      return;
    }
    busy = 'geo';
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        // No label → the nearest station's name is used (not a stale "my location").
        withBusy('geo', () => selectPoint(pos.coords.latitude, pos.coords.longitude)),
      (err) => {
        geoError = err.message;
        busy = '';
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  const pickPlace = (p: GeoResult) =>
    withBusy(`place-${p.id}`, () => selectPoint(p.lat, p.lon, geoLabel(p), p.timezone));
  const pickStation = (s: IndexEntry) => withBusy(`st-${s.id}`, () => selectStationId(s.id, s.name));
  const pickFavorite = (f: Favorite) => withBusy('fav', () => selectFavorite(f));
</script>

<div
  class="overlay"
  data-testid="location-sheet"
  role="dialog"
  aria-modal="true"
  aria-label="Choose a location"
>
  <div class="sheet">
    <header>
      <h2>Choose a location</h2>
      <button class="x" type="button" on:click={() => dispatch('close')} aria-label="Close">✕</button>
    </header>

    <div class="primary-actions">
      <button
        class="geo"
        type="button"
        data-testid="use-my-location"
        disabled={busy === 'geo'}
        on:click={useMyLocation}
      >
        {busy === 'geo' ? 'Locating…' : '📍 Use my location'}
      </button>
      <button class="map-btn" type="button" data-testid="open-map" on:click={() => dispatch('openmap')}>
        🗺 Map
      </button>
    </div>

    <input
      class="search"
      data-testid="search-input"
      type="search"
      placeholder="Search a beach, town, or station…"
      bind:value={query}
      on:input={onInput}
      autocomplete="off"
    />

    {#if geoError}
      <p class="hint">{geoError}</p>
    {/if}

    {#if !query && $favorites.length}
      <h3>Favorites</h3>
      <ul class="results" data-testid="favorites">
        {#each $favorites as f}
          <li>
            <button type="button" on:click={() => pickFavorite(f)}>
              <span class="name"><span class="star">★</span>{f.label}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if stationResults.length}
      <h3>Tide stations</h3>
      <ul class="results">
        {#each stationResults as s}
          <li>
            <button type="button" data-testid="station-result" on:click={() => pickStation(s)}>
              <span class="name">{s.name}</span>
              <span class="sub">{[s.region, s.country].filter(Boolean).join(', ')}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if placeResults.length}
      <h3>Places</h3>
      <ul class="results">
        {#each placeResults as p}
          <li>
            <button type="button" data-testid="place-result" on:click={() => pickPlace(p)}>
              <span class="name">{p.name}</span>
              <span class="sub">{[p.admin1, p.country].filter(Boolean).join(', ')}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if query.length >= 3 && !stationResults.length && !placeResults.length && !busy}
      <p class="hint">No matches.</p>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 8, 20, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 50;
  }
  .sheet {
    width: 100%;
    max-width: 32rem;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg);
    border-radius: 1rem 1rem 0 0;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  h3 {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  .x {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.1rem;
    min-width: 44px;
    min-height: 44px;
    cursor: pointer;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
    transition: background 0.2s ease, color 0.2s ease;
  }
  .x:hover {
    background: color-mix(in srgb, var(--surface) 80%, var(--text) 20%);
    color: var(--text);
  }
  .primary-actions {
    display: flex;
    gap: 0.5rem;
  }
  .geo,
  .search {
    width: 100%;
    border-radius: 0.7rem;
    padding: 0.85rem 1rem;
    font-size: 1rem;
    min-height: 48px;
  }
  .geo {
    flex: 1;
    background: var(--accent);
    color: var(--bg);
    border: none;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.1s ease;
  }
  .geo:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .geo:active:not(:disabled) {
    transform: scale(0.985);
  }
  .geo:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .map-btn {
    flex: none;
    border-radius: 0.7rem;
    padding: 0.85rem 1.1rem;
    font-size: 1rem;
    min-height: 48px;
    background: var(--surface);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }
  .map-btn:hover {
    background: color-mix(in srgb, var(--surface) 80%, var(--text) 20%);
  }
  .map-btn:active {
    transform: scale(0.985);
  }
  .search {
    background: var(--surface);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .search:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .results button {
    width: 100%;
    text-align: left;
    background: var(--surface);
    color: var(--text);
    border: none;
    border-radius: 0.6rem;
    padding: 0.7rem 0.85rem;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }
  .results button:hover {
    background: color-mix(in srgb, var(--surface) 85%, var(--text) 15%);
  }
  .results button:active {
    transform: scale(0.99);
  }
  .name {
    font-weight: 600;
  }
  .sub {
    color: var(--muted);
    font-size: 0.82rem;
  }
  .star {
    color: var(--accent);
    margin-right: 0.4rem;
  }
  .hint {
    margin: 0.2rem 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
