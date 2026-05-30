<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from './stores/settings';
  import {
    addDays,
    createModel,
    datumOffset,
    formatDay,
    loadSeedStation,
    startOfDayInTz,
  } from './engine';
  import type { Extreme, Station, TidePoint } from './engine/types';
  import type { TideModel } from './engine/predictor';
  import TideChart from './components/TideChart.svelte';
  import Readout from './components/Readout.svelte';
  import ExtremesTable from './components/ExtremesTable.svelte';
  import LocationBar from './components/LocationBar.svelte';

  let station: Station | null = null;
  let model: TideModel | null = null;
  let loading = true;
  let errorMsg = '';

  let now = new Date();
  let dayOffset = 0;
  let scrubMs = now.getTime();

  onMount(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await loadSeedStation();
        if (cancelled) return;
        station = s;
        model = createModel(s.harmonic_constituents);
        scrubMs = Date.now();
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e);
      } finally {
        loading = false;
      }
    })();
    const iv = setInterval(() => (now = new Date()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  });

  $: tz = station?.timezone ?? 'UTC';
  $: dayStart = station ? addDays(startOfDayInTz(now, tz), dayOffset) : now;
  $: dayEnd = addDays(dayStart, 1);
  $: offset = station ? datumOffset(station, $settings.datum ?? undefined) : 0;
  $: datumName = $settings.datum ?? station?.chart_datum ?? 'MSL';

  $: points = (model ? model.timeline(dayStart, dayEnd, 600) : []).map(
    (p): TidePoint => ({ time: p.time, level: p.level + offset }),
  );
  $: extremes = (model ? model.extremes(dayStart, dayEnd) : []).map(
    (e): Extreme => ({ ...e, level: e.level + offset }),
  );
  $: levelAtDisplay = (t: Date): number => (model ? model.levelAt(t) + offset : 0);

  $: scrubDate = new Date(Math.min(dayEnd.getTime(), Math.max(dayStart.getTime(), scrubMs)));
  $: scrubLevel = levelAtDisplay(scrubDate);

  function gotoDay(delta: number) {
    dayOffset += delta;
    const ns = addDays(startOfDayInTz(now, tz), dayOffset);
    scrubMs = ns.getTime() + 12 * 3_600_000;
  }
  function today() {
    dayOffset = 0;
    scrubMs = Date.now();
  }
</script>

<main>
  <div class="brand">
    <h1>Lunitidal</h1>
  </div>

  {#if loading}
    <p class="status">Loading tide data…</p>
  {:else if errorMsg}
    <p class="status error">Couldn’t load tide data: {errorMsg}</p>
  {:else if station && model}
    <LocationBar name={station.name} km={null} distanceUnit={$settings.distanceUnit} on:click={() => {}} />

    <section class="card">
      <Readout
        {scrubDate}
        {scrubLevel}
        levelAt={levelAtDisplay}
        {extremes}
        {tz}
        heightUnit={$settings.heightUnit}
        timeFormat={$settings.timeFormat}
        {now}
      />

      <div class="daynav">
        <button type="button" on:click={() => gotoDay(-1)} aria-label="Previous day">‹</button>
        <button type="button" class="day" on:click={today}>{formatDay(dayStart, tz)}</button>
        <button type="button" on:click={() => gotoDay(1)} aria-label="Next day">›</button>
      </div>

      <TideChart
        {points}
        {extremes}
        levelAt={levelAtDisplay}
        {tz}
        heightUnit={$settings.heightUnit}
        timeFormat={$settings.timeFormat}
        {now}
        bind:scrubMs
      />
    </section>

    <section class="card">
      <h2>Tides for {formatDay(dayStart, tz)}</h2>
      <ExtremesTable {extremes} {tz} heightUnit={$settings.heightUnit} timeFormat={$settings.timeFormat} />
      <p class="datum">Heights above {datumName} · {station.source?.name ?? 'tide model'}</p>
    </section>

    <footer>
      <p>Astronomical tide prediction only — not for navigation.</p>
      <p class="credit">Data: {station.source?.name ?? 'TICON-4'} ({station.license?.type ?? 'CC-BY-4.0'})</p>
    </footer>
  {/if}
</main>

<style>
  main {
    max-width: 32rem;
    margin: 0 auto;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .brand h1 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .card {
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  h2 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
    font-weight: 600;
  }
  .daynav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .daynav button {
    min-width: 44px;
    min-height: 40px;
    border: none;
    border-radius: 0.6rem;
    background: var(--surface);
    color: var(--text);
    font-size: 1.2rem;
  }
  .daynav .day {
    flex: 1;
    max-width: 14rem;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .status {
    color: var(--muted);
  }
  .status.error {
    color: var(--falling);
  }
  .datum {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
  }
  footer {
    color: var(--muted);
    font-size: 0.78rem;
    text-align: center;
  }
  footer p {
    margin: 0.15rem 0;
  }
  .credit {
    opacity: 0.8;
  }
</style>
