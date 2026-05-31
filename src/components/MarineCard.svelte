<script lang="ts">
  import type { DistanceUnit, HeightUnit, TimeFormat } from '../engine/types';
  import { formatHeight, formatDistance } from '../engine/units';
  import { haversineKm } from '../engine/stations';
  import { formatTime } from '../engine/time';
  import { getMarine, type MarineData, type MarinePoint } from '../sources/marine';
  import { makeScale, buildLinePath } from '../chart/geometry';

  export let lat: number;
  export let lon: number;
  export let dayStart: Date;
  export let dayEnd: Date;
  export let heightUnit: HeightUnit;
  export let distanceUnit: DistanceUnit;
  export let timeFormat: TimeFormat;
  export let tz: string;
  export let scrubMs: number;
  /**
   * The grid cell the forecast was actually sampled from, surfaced for the parent so it
   * can mark it on the map. Bindable — set whenever a fetch resolves with coordinates.
   */
  export let sampled: { lat: number; lon: number } | null = null;

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

  function findClosestPoint(points: MarinePoint[], targetMs: number): MarinePoint | null {
    if (!points || points.length === 0) return null;
    let closest = points[0];
    let minDiff = Math.abs(closest.time.getTime() - targetMs);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].time.getTime() - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }
    return closest;
  }

  $: closestPoint = findClosestPoint(data?.points ?? [], scrubMs);
  $: activePoint = closestPoint || data?.peak;

  // Surface the sampled grid cell to the parent (for the map marker) and describe how
  // far offshore it sits from the chosen point — the wave model can't sample inland.
  $: sampled = data?.sampled ?? null;
  $: offshoreKm = data?.sampled ? haversineKm(lat, lon, data.sampled.lat, data.sampled.lon) : null;
  $: offshoreLabel =
    offshoreKm != null && offshoreKm >= 0.5 ? `~${formatDistance(offshoreKm, distanceUnit)} offshore` : '';

  // Sparkline/chart geometry setup.
  $: chartPoints = data ? data.points.map((p) => ({
    time: p.time,
    level: p.waveHeight ?? 0,
  })) : [];
  $: swellPoints = data ? data.points.map((p) => ({
    time: p.time,
    level: p.swellHeight ?? 0,
  })) : [];
  $: levels = [
    ...chartPoints.map((p) => p.level),
    ...swellPoints.map((p) => p.level),
  ];
  $: rawMin = 0;
  $: rawMax = levels.length ? Math.max(...levels, 0.1) : 1;
  $: vpad = (rawMax - rawMin) * 0.15 || 0.5;

  let width = 360;
  let container: HTMLDivElement;
  let dragging = false;

  $: scale = makeScale({
    width,
    height: 60,
    padding: { top: 8, right: 16, bottom: 8, left: 44 },
    startMs: dayStart.getTime(),
    endMs: dayEnd.getTime(),
    minLevel: 0,
    maxLevel: rawMax + vpad,
  });

  $: linePath = buildLinePath(chartPoints, scale);
  $: swellLinePath = buildLinePath(swellPoints, scale);

  $: scrubX = closestPoint ? scale.xOf(closestPoint.time.getTime()) : scale.xOf(scrubMs);
  $: scrubY = closestPoint && closestPoint.waveHeight != null ? scale.yOf(closestPoint.waveHeight) : scale.yOf(0);

  function setScrubFromClientX(clientX: number) {
    if (!container || !scale || !data?.points.length) return;
    const rect = container.getBoundingClientRect();
    const targetMs = scale.msOf(clientX - rect.left);
    const closest = findClosestPoint(data.points, targetMs);
    if (closest) {
      scrubMs = closest.time.getTime();
    }
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setScrubFromClientX(e.clientX);
  }
  function onPointerMove(e: PointerEvent) {
    if (dragging) setScrubFromClientX(e.clientX);
  }
  function onPointerUp() {
    dragging = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (!data?.points.length || !closestPoint) return;
    const idx = data.points.indexOf(closestPoint);
    if (idx === -1) return;
    let nextIdx = idx;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        nextIdx = Math.max(0, idx - 1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        nextIdx = Math.min(data.points.length - 1, idx + 1);
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = data.points.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    scrubMs = data.points[nextIdx].time.getTime();
  }
</script>

<section class="card" data-testid="marine-card">
  <div class="head">
    <div class="title-row">
      <h2>Waves &amp; swell</h2>
      {#if activePoint}
        <span class="active-time" data-testid="marine-active-time">{formatTime(activePoint.time, tz, timeFormat)}</span>
      {/if}
    </div>
    <span class="src" data-testid="marine-source"
      >Open-Meteo{#if offshoreLabel} · <span class="offshore">{offshoreLabel}</span>{/if}</span
    >
  </div>

  {#if state === 'loading'}
    <p class="muted">Loading marine forecast…</p>
  {:else if state === 'offline'}
    <p class="muted">Marine conditions need a connection.</p>
  {:else if state === 'nodata'}
    <p class="muted">No marine forecast for this location.</p>
  {:else if state === 'error'}
    <p class="muted">Marine forecast unavailable.</p>
  {:else if data && activePoint}
    <div class="stats">
      <div class="stat">
        <span class="val">{activePoint.waveHeight != null ? formatHeight(activePoint.waveHeight, heightUnit) : '—'}</span>
        <span class="lbl waves-lbl">waves</span>
      </div>
      {#if activePoint.swellHeight != null}
        <div class="stat">
          <span class="val">{formatHeight(activePoint.swellHeight, heightUnit)}</span>
          <span class="lbl swell-lbl">swell</span>
        </div>
      {/if}
      {#if activePoint.swellPeriod != null}
        <div class="stat">
          <span class="val">{activePoint.swellPeriod.toFixed(0)}s</span>
          <span class="lbl">period</span>
        </div>
      {/if}
    </div>

    <div class="chart" bind:this={container} bind:clientWidth={width} data-testid="marine-chart-container">
      <svg
        {width}
        height={60}
        viewBox={`0 0 ${width} 60`}
        role="slider"
        aria-label="Wave height over time. Drag, or use arrow keys, to scrub."
        aria-valuemin={dayStart.getTime()}
        aria-valuemax={dayEnd.getTime()}
        aria-valuenow={closestPoint ? closestPoint.time.getTime() : scrubMs}
        aria-valuetext={closestPoint ? `${formatTime(closestPoint.time, tz, timeFormat)}, waves ${formatHeight(closestPoint.waveHeight ?? 0, heightUnit)}` : ''}
        tabindex="0"
        on:pointerdown={onPointerDown}
        on:pointermove={onPointerMove}
        on:pointerup={onPointerUp}
        on:pointercancel={onPointerUp}
        on:keydown={onKeydown}
      >
        <line class="baseline" x1={scale.padding.left} x2={width - scale.padding.right} y1={scale.baselineY} y2={scale.baselineY} />
        <path d={swellLinePath} fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3 3" stroke-opacity="0.55" stroke-linejoin="round" />
        <path d={linePath} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
        
        <line class="scrubLine" x1={scrubX} x2={scrubX} y1={scale.padding.top} y2={scale.baselineY} />
        <circle class="scrubDot" cx={scrubX} cy={scrubY} r="5" />
      </svg>
    </div>
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
  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
    font-weight: 600;
  }
  .active-time {
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .src {
    color: var(--muted);
    font-size: 0.75rem;
  }
  .offshore {
    color: var(--text);
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
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .lbl.waves-lbl::before {
    content: '';
    display: inline-block;
    width: 12px;
    height: 2.5px;
    background: var(--accent);
    border-radius: 99px;
  }
  .lbl.swell-lbl::before {
    content: '';
    display: inline-block;
    width: 14px;
    height: 0px;
    border-top: 2px dashed color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .chart {
    width: 100%;
    touch-action: none;
    user-select: none;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    cursor: ew-resize;
  }
  svg:focus {
    outline: none;
  }
  svg:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 8px;
  }
  .baseline {
    stroke: var(--muted);
    stroke-opacity: 0.15;
    stroke-width: 1.5;
  }
  .scrubLine {
    stroke: var(--text);
    stroke-width: 1.5;
  }
  .scrubDot {
    fill: var(--text);
    stroke: var(--bg);
    stroke-width: 2;
  }
</style>

