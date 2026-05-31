<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DistanceUnit } from '../engine/types';
  import { confidenceForKm } from '../engine/confidence';
  import { formatDistance } from '../engine/units';

  const dispatch = createEventDispatcher<{ change: void; togglefav: void }>();

  export let name: string;
  /** Distance from the chosen point to this station (km), or null if exact. */
  export let km: number | null = null;
  export let distanceUnit: DistanceUnit;
  export let isFav = false;
  /** Underlying tide station; shown in the meta when the label isn't the station itself. */
  export let stationName = '';

  $: conf = km !== null ? confidenceForKm(km) : null;
</script>

<header class="locbar">
  <div class="top">
    <div class="info">
      <div class="name">{name}</div>
    </div>
    <div class="actions">
    <button
      class="star"
      class:on={isFav}
      type="button"
      data-testid="toggle-favorite"
      aria-pressed={isFav}
      aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
      on:click={() => dispatch('togglefav')}
    >
      {isFav ? '★' : '☆'}
    </button>
    <button
      class="change"
      type="button"
      data-testid="change-location"
      aria-label="Search location"
      on:click={() => dispatch('change')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </button>
    </div>
  </div>

  {#if km !== null && conf}
    <div class="station-chip" data-testid="closest-station">
      <span class="anchor" aria-hidden="true">⚓</span>
      <span class="chip-text">
        <span class="chip-label">Closest station:</span>
        <span class="chip-station">{stationName}</span>
        <span class="chip-sep">·</span>{formatDistance(km, distanceUnit)} away<span class="chip-sep">·</span><span class={`conf ${conf.level}`}>{conf.label}</span>
      </span>
    </div>
  {/if}
</header>

<style>
  .locbar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .info {
    min-width: 0;
  }
  .name {
    font-size: 1.15rem;
    font-weight: 700;
  }
  .station-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    align-self: flex-start;
    max-width: 100%;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
    color: var(--text);
    font-size: 0.82rem;
    line-height: 1.25;
  }
  .station-chip .anchor {
    font-size: 0.9rem;
    flex: none;
  }
  .chip-text {
    min-width: 0;
  }
  .chip-label {
    color: var(--muted);
  }
  .chip-station {
    font-weight: 700;
  }
  .chip-sep {
    margin: 0 0.35rem;
    color: var(--muted);
  }
  .conf.good {
    color: var(--accent);
  }
  .conf.fair {
    color: var(--text);
  }
  .conf.rough,
  .conf.far {
    color: var(--falling);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: none;
  }
  .star {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 1.4rem;
    min-width: 44px;
    min-height: 44px;
  }
  .star.on {
    color: var(--accent);
  }
  .change {
    background: var(--surface);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
    border-radius: 50%;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .change:hover {
    background: color-mix(in srgb, var(--surface) 80%, var(--text) 20%);
  }
  .change:active {
    transform: scale(0.95);
  }
</style>
