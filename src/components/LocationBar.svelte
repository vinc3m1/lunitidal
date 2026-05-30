<script lang="ts">
  import type { DistanceUnit } from '../engine/types';
  import { confidenceForKm } from '../engine/confidence';
  import { formatDistance } from '../engine/units';

  export let name: string;
  /** Distance from the chosen point to this station (km), or null if exact. */
  export let km: number | null = null;
  export let distanceUnit: DistanceUnit;

  $: conf = km !== null ? confidenceForKm(km) : null;
</script>

<header class="locbar">
  <div class="info">
    <div class="name">{name}</div>
    {#if km !== null && conf}
      <div class="meta">
        {formatDistance(km, distanceUnit)} away ·
        <span class={`conf ${conf.level}`}>{conf.label}</span>
      </div>
    {/if}
  </div>
  <button class="change" type="button" on:click>Change</button>
</header>

<style>
  .locbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
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
  .change {
    flex: none;
    background: var(--surface);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
    border-radius: 999px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    min-height: 44px;
  }
</style>
