<script lang="ts">
  import type { HeightUnit } from '../engine/types';
  import { formatHeight } from '../engine/units';
  import { getMarine, type MarineData } from '../sources/marine';

  export let lat: number;
  export let lon: number;
  export let dayStart: Date;
  export let dayEnd: Date;
  export let heightUnit: HeightUnit;

  type State = 'loading' | 'ready' | 'offline' | 'nodata' | 'error';
  let state: State = 'loading';
  let data: MarineData | null = null;
  let token = 0;

  async function load() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      state = 'offline';
      return;
    }
    const mine = ++token;
    state = 'loading';
    try {
      const d = await getMarine(lat, lon, dayStart, dayEnd);
      if (mine !== token) return;
      if (!d.points.length || d.peak == null) {
        data = null;
        state = 'nodata';
        return;
      }
      data = d;
      state = 'ready';
    } catch {
      if (mine === token) state = 'error';
    }
  }

  // Refetch when the location or viewed day changes.
  $: key = `${lat.toFixed(3)},${lon.toFixed(3)},${dayStart.getTime()}`;
  $: {
    void key;
    load();
  }

  // Sparkline of wave height across the day.
  $: heights = data ? data.points.map((p) => p.waveHeight ?? 0) : [];
  $: maxH = heights.length ? Math.max(...heights, 0.1) : 1;
  $: spark =
    data && data.points.length
      ? data.points
          .map((p, i) => {
            const x = (i / Math.max(1, data!.points.length - 1)) * 100;
            const y = 28 - ((p.waveHeight ?? 0) / maxH) * 26;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ')
      : '';
</script>

<section class="card" data-testid="marine-card">
  <div class="head">
    <h2>Waves &amp; swell</h2>
    <span class="src">Open-Meteo</span>
  </div>

  {#if state === 'loading'}
    <p class="muted">Loading marine forecast…</p>
  {:else if state === 'offline'}
    <p class="muted">Marine conditions need a connection.</p>
  {:else if state === 'nodata'}
    <p class="muted">No marine forecast for this location.</p>
  {:else if state === 'error'}
    <p class="muted">Marine forecast unavailable.</p>
  {:else if data && data.peak}
    <div class="stats">
      <div class="stat">
        <span class="val">{formatHeight(data.peak.waveHeight ?? 0, heightUnit)}</span>
        <span class="lbl">peak waves</span>
      </div>
      {#if data.peak.swellHeight != null}
        <div class="stat">
          <span class="val">{formatHeight(data.peak.swellHeight, heightUnit)}</span>
          <span class="lbl">swell</span>
        </div>
      {/if}
      {#if data.peak.swellPeriod != null}
        <div class="stat">
          <span class="val">{data.peak.swellPeriod.toFixed(0)}s</span>
          <span class="lbl">period</span>
        </div>
      {/if}
    </div>
    <svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={spark} fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
  {/if}
</section>

<style>
  .card {
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
    font-weight: 600;
  }
  .src {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 0.88rem;
  }
  .stats {
    display: flex;
    gap: 1.5rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
  }
  .val {
    font-size: 1.25rem;
    font-weight: 800;
  }
  .lbl {
    color: var(--muted);
    font-size: 0.78rem;
  }
  .spark {
    width: 100%;
    height: 30px;
  }
</style>
