<script lang="ts">
  import { onMount } from 'svelte';
  import { link } from 'svelte-spa-router';
  import { settings } from '../stores/settings';
  import { selection, selectionStatus } from '../stores/selection';
  import { favorites, isFavorite, toggleFavorite } from '../stores/favorites';
  import { addDays, createModel, datumOffset, formatDay, startOfDayInTz, tzAbbrev } from '../engine';
  import type { Extreme, TidePoint } from '../engine/types';
  import type { TideModel } from '../engine/predictor';
  import TideChart from '../components/TideChart.svelte';
  import Readout from '../components/Readout.svelte';
  import ExtremesTable from '../components/ExtremesTable.svelte';
  import LocationBar from '../components/LocationBar.svelte';
  import StationSource from '../components/StationSource.svelte';
  import MarineCard from '../components/MarineCard.svelte';
  import { REPO_URL } from '../lib/links';

  let now = new Date();
  let dayOffset = 0;
  let scrubMs = now.getTime();
  let showMap = false;
  // Where the marine forecast was actually sampled (nearest wave-model grid cell), surfaced by
  // MarineCard so the map can mark it. Reset on every location change so a stale cell
  // never lingers on the new map while the next forecast loads.
  let marineSampled: { lat: number; lon: number } | null = null;
  let lastPointKey = '';
  $: if ($selection) {
    const k = `${$selection.point.lat},${$selection.point.lon}`;
    if (k !== lastPointKey) {
      lastPointKey = k;
      marineSampled = null;
    }
  }
  $: marineMarker = $settings.showMarine ? marineSampled : null;
  // Keep MapLibre split out of the initial bundle; load it after the home shell renders.
  let MapComp: typeof import('../components/StationMap.svelte').default | null = null;
  let mapInstance: any;

  async function loadMap() {
    if (!MapComp) MapComp = (await import('../components/StationMap.svelte')).default;
  }

  async function changeLocation() {
    if (!MapComp) {
      await loadMap();
    }
    // Smoothly focus the floating search bar on the map tile
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.focusSearch();
      }
    }, 50);
  }

  async function openMap() {
    await loadMap();
    showMap = true;
  }

  onMount(() => {
    void loadMap();
    const iv = setInterval(() => (now = new Date()), 60_000);
    return () => clearInterval(iv);
  });

  let model: TideModel | null = null;
  let modelStationId: string | null = null;
  $: station = $selection?.station ?? null;
  $: if (station && station.id !== modelStationId) {
    try {
      model = createModel(station);
      modelStationId = station.id;
      scrubMs = Date.now();
      dayOffset = 0;
    } catch (e) {
      console.error('Failed to create tide model:', e);
      model = null;
      modelStationId = null;
    }
  }

  $: tz = station?.timezone ?? 'UTC';
  $: dayStart = station ? addDays(startOfDayInTz(now, tz), dayOffset) : now;
  $: dayEnd = addDays(dayStart, 1);
  $: offset = station ? datumOffset(station, $settings.datum ?? undefined) : 0;
  $: datumName = $settings.datum ?? station?.chart_datum ?? 'MSL';
  $: tzLabel = station ? tzAbbrev(dayStart, tz) : '';

  $: points = (model ? model.timeline(dayStart, dayEnd, 600) : []).map(
    (p): TidePoint => ({ time: p.time, level: p.level + offset }),
  );
  $: extremes = (model ? model.extremes(dayStart, dayEnd) : []).map(
    (e): Extreme => ({ ...e, level: e.level + offset }),
  );
  $: readoutExtremes = (model ? model.extremes(dayStart, addDays(dayEnd, 1)) : []).map(
    (e): Extreme => ({ ...e, level: e.level + offset }),
  );
  $: levelAtDisplay = (t: Date): number => (model ? model.levelAt(t) + offset : 0);

  $: scrubDate = new Date(Math.min(dayEnd.getTime(), Math.max(dayStart.getTime(), scrubMs)));
  $: scrubLevel = levelAtDisplay(scrubDate);
  $: isNow = Math.abs(scrubMs - now.getTime()) < 60_000;

  $: favKey = $selection?.station?.id ?? '';
  $: isFav = $favorites && favKey ? isFavorite(favKey) : false;

  function onToggleFav() {
    if (!$selection) return;
    toggleFavorite({
      id: $selection.station.id,
      label: $selection.station.name,
      lat: $selection.station.latitude,
      lon: $selection.station.longitude,
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

<header class="topbar">
  <h1>Lunitidal</h1>
  <div class="actions">
    <a
      class="icon-link"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="nav-github"
      aria-label="View source on GitHub"
      title="View source on GitHub"
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
    <a class="icon-link gear" use:link href="/settings" data-testid="nav-settings" aria-label="Settings">⚙</a>
  </div>
</header>

{#if $selectionStatus === 'loading'}
  <p class="status">Loading tide data…</p>
{:else if $selectionStatus === 'error' || !$selection || !model}
  <p class="status error">Couldn’t load tide data.</p>
{:else}
  <LocationBar
    name={$selection.label}
    {isFav}
    on:change={changeLocation}
    on:togglefav={onToggleFav}
  />

  <div class="home-grid">
    <div class="main-column">
      <section class="card">
        {#if $selection.km !== null}
          <div class="tide-source">
            <StationSource
              stationName={$selection.station.name}
              km={$selection.km}
              distanceUnit={$settings.distanceUnit}
            />
          </div>
        {/if}
        <Readout
          {scrubDate}
          {scrubLevel}
          levelAt={levelAtDisplay}
          extremes={readoutExtremes}
          {tz}
          heightUnit={$settings.heightUnit}
          timeFormat={$settings.timeFormat}
          {now}
        />

        <div class="daynav">
          <button
            type="button"
            on:click={() => gotoDay(-1)}
            aria-label="Previous day"
            title="Previous day"
          >‹</button>
          <button
            type="button"
            class="day"
            class:highlight={!isNow}
            on:click={today}
            aria-label="Today"
            title="Today"
          >
            {formatDay(dayStart, tz)}{tzLabel ? ` · ${tzLabel}` : ''}
          </button>
          <button
            type="button"
            on:click={() => gotoDay(1)}
            aria-label="Next day"
            title="Next day"
          >›</button>
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

      {#if $settings.showMarine}
        <MarineCard
          lat={$selection.point.lat}
          lon={$selection.point.lon}
          {dayStart}
          {dayEnd}
          heightUnit={$settings.heightUnit}
          distanceUnit={$settings.distanceUnit}
          timeFormat={$settings.timeFormat}
          {tz}
          bind:scrubMs
          bind:sampled={marineSampled}
        />
      {/if}
    </div>

    <aside class="side-column">
      <section class="card map-card" data-testid="home-map-card">
        <div class="card-head">
          <div>
            <h2>Map</h2>
            <p class="map-hint">Tap a station, or drop a pin anywhere</p>
          </div>
          <button class="map-expand" type="button" data-testid="expand-map" aria-label="Expand map" on:click={openMap}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
        {#if MapComp}
          {#key `${$selection.point.lat}:${$selection.point.lon}`}
            <svelte:component
              this={MapComp}
              bind:this={mapInstance}
              mode="inline"
              hideSearch={showMap}
              lat={$selection.point.lat}
              lon={$selection.point.lon}
              stationLat={$selection.station.latitude}
              stationLon={$selection.station.longitude}
              stationName={$selection.station.name}
              stationType={$selection.station.type}
              marineLat={marineMarker?.lat ?? null}
              marineLon={marineMarker?.lon ?? null}
            />
          {/key}
        {:else}
          <div class="map-loading">Loading map…</div>
        {/if}
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Tides for {formatDay(dayStart, tz)}</h2>
          <a class="detail-link" use:link href="/detail" data-testid="nav-detail">ⓘ Source &amp; accuracy</a>
        </div>
        <ExtremesTable {extremes} {tz} heightUnit={$settings.heightUnit} timeFormat={$settings.timeFormat} />
        <p class="datum">Heights above {datumName} · {$selection.station.source?.name ?? 'tide model'}</p>
        <p class="datum">Times shown in {tzLabel} — the station’s local time</p>
      </section>
    </aside>
  </div>
{/if}


{#if showMap && MapComp && $selection}
  <svelte:component
    this={MapComp}
    mode="overlay"
    hideSearch={false}
    lat={$selection.point.lat}
    lon={$selection.point.lon}
    stationLat={$selection.station.latitude}
    stationLon={$selection.station.longitude}
    stationName={$selection.station.name}
    stationType={$selection.station.type}
    marineLat={marineMarker?.lat ?? null}
    marineLon={marineMarker?.lon ?? null}
    on:close={() => (showMap = false)}
  />
{/if}

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .topbar h1 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .actions {
    display: flex;
    align-items: center;
  }
  .icon-link {
    text-decoration: none;
    color: var(--muted);
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    transition: color 0.15s ease;
  }
  .icon-link:hover {
    color: var(--text);
  }
  .gear {
    font-size: 1.3rem;
  }
  .home-grid,
  .main-column,
  .side-column {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }
  .card {
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .card-head > div {
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
    font-weight: 600;
  }
  .detail-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 0.85rem;
  }
  .map-card {
    gap: 0.75rem;
  }
  .map-hint {
    margin: 0.2rem 0 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.3;
  }
  .map-expand {
    border: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
    border-radius: 50%;
    background: var(--surface);
    color: var(--accent);
    min-width: 40px;
    min-height: 40px;
    display: grid;
    place-items: center;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .map-expand:hover {
    background: color-mix(in srgb, var(--surface) 80%, var(--text) 20%);
  }
  .map-expand:active {
    transform: scale(0.95);
  }
  .map-loading {
    min-height: 18rem;
    border-radius: 0.75rem;
    background: var(--surface);
    color: var(--muted);
    display: grid;
    place-items: center;
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
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
  }
  .daynav button:hover {
    background: color-mix(in srgb, var(--surface) 85%, var(--text) 15%);
  }
  .daynav button:active {
    transform: scale(0.97);
  }
  .daynav .day {
    flex: 1;
    max-width: 14rem;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .daynav .day.highlight {
    background: color-mix(in srgb, var(--surface) 80%, var(--accent) 20%);
  }
  .daynav .day.highlight:hover {
    background: color-mix(in srgb, var(--surface) 70%, var(--accent) 30%);
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

  @media (min-width: 56rem) {
    .home-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.85fr);
      align-items: start;
    }
  }
</style>
