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
  $: showStation = km !== null && !!stationName && stationName !== name;
</script>

<header class="locbar">
  <div class="info">
    <div class="name">{name}</div>
    {#if km !== null && conf}
      <div class="meta">
        {#if showStation}{stationName} · {/if}{formatDistance(km, distanceUnit)} away ·
        <span class={`conf ${conf.level}`}>{conf.label}</span>
      </div>
    {/if}
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
      on:click={() => dispatch('change')}>Search</button
    >
  </div>
</header>

<style>
  .locbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .name {
    font-size: 1.15rem;
    font-weight: 700;
  }
  .meta {
    color: var(--muted);
    font-size: 0.85rem;
    margin-top: 0.1rem;
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
    border-radius: 999px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    min-height: 44px;
  }
</style>
