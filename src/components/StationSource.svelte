<script lang="ts">
  import type { DistanceUnit } from '../engine/types';
  import { confidenceForKm } from '../engine/confidence';
  import { formatDistance } from '../engine/units';

  /** Name of the tide station the predictions actually come from. */
  export let stationName: string;
  /** Distance from the chosen point to that station, in km. */
  export let km: number;
  export let distanceUnit: DistanceUnit;

  $: conf = confidenceForKm(km);

  // Click-to-open "why only the closest station?" popover. Closes on Escape or outside click —
  // same interaction as MarineCard's grid-cell explainer.
  let showInfo = false;
  let infoWrap: HTMLSpanElement;
  function onWindowClick(e: MouseEvent) {
    if (showInfo && infoWrap && !infoWrap.contains(e.target as Node)) showInfo = false;
  }
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === 'Escape') showInfo = false;
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onWindowKey} />

<span class="src" data-testid="closest-station"
  ><span class="anchor" aria-hidden="true">⚓</span> Closest station:
  <span class="station">{stationName}</span> · {formatDistance(km, distanceUnit)} away ·
  <span class={`conf ${conf.level}`}>{conf.label}</span><span class="info-wrap" bind:this={infoWrap}
    ><button
      type="button"
      class="info-btn"
      data-testid="station-info-btn"
      aria-label="Why only the closest station?"
      aria-expanded={showInfo}
      on:click={() => (showInfo = !showInfo)}>&#9432;</button
    >{#if showInfo}
      <div
        class="info-pop"
        role="dialog"
        aria-label="About tide-station accuracy"
        data-testid="station-info"
      >
        <p>
          Tides are predicted from the nearest gauge with published harmonics — here
          <strong>{stationName}</strong>, {formatDistance(km, distanceUnit)} away. We can't reliably
          carry that prediction to your exact spot: coastline shape, bays, headlands, and channels
          reshape the timing and height of the tide in ways plain distance can't capture. So we show
          the closest station as-is rather than invent false precision.
        </p>
      </div>
    {/if}</span
  ></span
>

<style>
  .src {
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  .anchor {
    font-size: 0.85rem;
  }
  .station {
    color: var(--text);
    font-weight: 700;
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
  .info-wrap {
    position: relative;
    display: inline-block;
  }
  .info-btn {
    background: none;
    border: none;
    padding: 0 0 0 0.15rem;
    margin: 0;
    color: var(--muted);
    font: inherit;
    font-size: 0.8rem;
    line-height: 1;
    cursor: pointer;
    vertical-align: baseline;
  }
  .info-btn:hover,
  .info-btn[aria-expanded='true'] {
    color: var(--text);
  }
  .info-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .info-pop {
    position: absolute;
    z-index: 10;
    top: calc(100% + 0.4rem);
    left: 0;
    width: min(17rem, 78vw);
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
    border-radius: 0.6rem;
    padding: 0.7rem 0.8rem;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    text-align: left;
    cursor: default;
  }
  .info-pop p {
    margin: 0;
    color: var(--text);
    font-size: 0.78rem;
    line-height: 1.45;
    font-weight: 400;
  }
</style>
