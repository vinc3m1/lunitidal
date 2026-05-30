<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from './stores/settings';
  import { initSelection, selection, selectionStatus } from './stores/selection';
  import { favoriteId, favorites, isFavorite, toggleFavorite } from './stores/favorites';
  import { addDays, createModel, datumOffset, formatDay, startOfDayInTz } from './engine';
  import type { Extreme, TidePoint } from './engine/types';
  import type { TideModel } from './engine/predictor';
  import TideChart from './components/TideChart.svelte';
  import Readout from './components/Readout.svelte';
  import ExtremesTable from './components/ExtremesTable.svelte';
  import LocationBar from './components/LocationBar.svelte';
  import LocationSearch from './components/LocationSearch.svelte';

  let now = new Date();
  let dayOffset = 0;
  let scrubMs = now.getTime();
  let showSearch = false;

  onMount(() => {
    initSelection();
    const iv = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(iv);
  });

  // Rebuild the predictor only when the station identity changes.
  let model: TideModel | null = null;
  let modelStationId: string | null = null;
  $: station = $selection?.station ?? null;
  $: if (station && station.id !== modelStationId) {
    model = createModel(station.harmonic_constituents);
    modelStationId = station.id;
    scrubMs = Date.now();
    dayOffset = 0;
  }

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

  $: favKey = $selection ? favoriteId($selection.point.lat, $selection.point.lon) : '';
  // `$favorites` referenced so the star reacts to list changes.
  $: isFav = $favorites && favKey ? isFavorite(favKey) : false;

  function onToggleFav() {
    if (!$selection) return;
    toggleFavorite({
      id: favKey,
      label: $selection.label,
      lat: $selection.point.lat,
      lon: $selection.point.lon,
    });
  }

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
  <div class="brand"><h1>Lunitidal</h1></div>

  {#if $selectionStatus === 'loading'}
    <p class="status">Loading tide data…</p>
  {:else if $selectionStatus === 'error' || !$selection || !model}
    <p class="status error">Couldn’t load tide data.</p>
  {:else}
    <LocationBar
      name={$selection.label}
      km={$selection.km}
      distanceUnit={$settings.distanceUnit}
      {isFav}
      on:change={() => (showSearch = true)}
      on:togglefav={onToggleFav}
    />

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
      <p class="datum">Heights above {datumName} · {$selection.station.source?.name ?? 'tide model'}</p>
    </section>

    <footer>
      <p>Astronomical tide prediction only — not for navigation.</p>
      <p class="credit">
        Data: {$selection.station.source?.name ?? 'TICON-4'}
        ({$selection.station.license?.type ?? 'CC-BY-4.0'})
      </p>
    </footer>
  {/if}

  {#if showSearch}
    <LocationSearch on:close={() => (showSearch = false)} />
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
