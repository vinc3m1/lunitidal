<script lang="ts">
  import type { Extreme, HeightUnit, TidePoint, TimeFormat } from '../engine/types';
  import { buildAreaPath, buildLinePath, levelTicks, makeScale } from '../chart/geometry';
  import { formatHeight } from '../engine/units';
  import { formatTime } from '../engine/time';
  import { sunBandStops, sunTimes } from '../engine/sun';

  export let points: TidePoint[];
  export let extremes: Extreme[];
  export let levelAt: (t: Date) => number;
  export let tz: string;
  export let heightUnit: HeightUnit;
  export let timeFormat: TimeFormat;
  export let now: Date;
  /** Current scrub instant (ms). Bound by the parent so the readout stays in sync. */
  export let scrubMs: number;
  /** Location coords for the day/night shading. Null hides it (e.g. before a location loads). */
  export let sunLat: number | null = null;
  export let sunLon: number | null = null;

  const padding = { top: 24, right: 16, bottom: 28, left: 44 };
  // Peak strength of the night tint; the per-stop intensity (0..1) scales it down through twilight.
  const NIGHT_OPACITY = 0.45;
  let width = 360;
  let container: HTMLDivElement;
  let dragging = false;

  $: height = Math.round(Math.min(300, Math.max(200, width * 0.62)));
  $: startMs = points.length ? points[0].time.getTime() : now.getTime();
  $: endMs = points.length ? points[points.length - 1].time.getTime() : startMs + 86_400_000;
  $: levels = points.map((p) => p.level);
  $: rawMin = levels.length ? Math.min(...levels) : 0;
  $: rawMax = levels.length ? Math.max(...levels) : 1;
  $: vpad = (rawMax - rawMin) * 0.15 || 0.5;
  $: scale = makeScale({
    width,
    height,
    padding,
    startMs,
    endMs,
    minLevel: rawMin - vpad,
    maxLevel: rawMax + vpad,
  });
  $: linePath = buildLinePath(points, scale);
  $: areaPath = buildAreaPath(points, scale);
  $: ticks = levelTicks(scale, 3);

  $: clampedScrub = Math.min(endMs, Math.max(startMs, scrubMs));
  $: scrubDate = new Date(clampedScrub);
  $: scrubLevel = levelAt(scrubDate);
  $: scrubX = scale.xOf(clampedScrub);
  $: scrubY = scale.yOf(scrubLevel);
  $: nowX = now.getTime() >= startMs && now.getTime() <= endMs ? scale.xOf(now.getTime()) : null;

  // Sun shading: a day → twilight → night gradient behind the curve, plus a faint hairline at the
  // exact sunrise/sunset instant. Computed on-device (no fetch) from the location's coordinates.
  $: hasSun = sunLat !== null && sunLon !== null;
  $: nightStops = hasSun ? sunBandStops(startMs, endMs, sunLat as number, sunLon as number) : [];
  $: sun = hasSun ? sunTimes(new Date((startMs + endMs) / 2), sunLat as number, sunLon as number) : null;
  $: sunriseMs = sun?.sunrise?.getTime() ?? null;
  $: sunsetMs = sun?.sunset?.getTime() ?? null;
  $: sunriseX = sunriseMs !== null && sunriseMs >= startMs && sunriseMs <= endMs ? scale.xOf(sunriseMs) : null;
  $: sunsetX = sunsetMs !== null && sunsetMs >= startMs && sunsetMs <= endMs ? scale.xOf(sunsetMs) : null;

  function setScrubFromClientX(clientX: number) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    scrubMs = scale.msOf(clientX - rect.left);
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
    const STEP = 10 * 60_000; // 10 min
    const PAGE = 60 * 60_000; // 1 hour
    let next = clampedScrub;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next -= STEP;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next += STEP;
        break;
      case 'PageDown':
        next -= PAGE;
        break;
      case 'PageUp':
        next += PAGE;
        break;
      case 'Home':
        next = startMs;
        break;
      case 'End':
        next = endMs;
        break;
      default:
        return;
    }
    e.preventDefault();
    scrubMs = Math.min(endMs, Math.max(startMs, next));
  }
</script>

<div class="chart" bind:this={container} bind:clientWidth={width}>
  <svg
    {width}
    {height}
    viewBox={`0 0 ${width} ${height}`}
    role="slider"
    aria-label="Tide height over time. Drag, or use arrow keys, to scrub."
    aria-valuemin={startMs}
    aria-valuemax={endMs}
    aria-valuenow={clampedScrub}
    aria-valuetext={`${formatTime(scrubDate, tz, timeFormat)}, ${formatHeight(scrubLevel, heightUnit)}`}
    tabindex="0"
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerUp}
    on:keydown={onKeydown}
  >
    <defs>
      <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.45" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02" />
      </linearGradient>
      {#if nightStops.length}
        <linearGradient id="nightBand" x1="0" y1="0" x2="1" y2="0">
          {#each nightStops as s}
            <stop
              offset={`${(s.offset * 100).toFixed(2)}%`}
              stop-color="var(--night)"
              stop-opacity={(s.intensity * NIGHT_OPACITY).toFixed(3)}
            />
          {/each}
        </linearGradient>
      {/if}
    </defs>

    {#if nightStops.length}
      <rect
        class="nightBand"
        x={padding.left}
        y={padding.top}
        width={scale.innerWidth}
        height={scale.innerHeight}
        fill="url(#nightBand)"
      />
    {/if}

    {#each ticks as t}
      <line class="grid" x1={padding.left} x2={width - padding.right} y1={t.y} y2={t.y} />
      <text class="axis" x={padding.left - 6} y={t.y + 3} text-anchor="end">
        {formatHeight(t.level, heightUnit).replace(/ (m|ft)$/, '')}
      </text>
    {/each}

    <path class="tideArea" d={areaPath} fill="url(#tideFill)" />
    <path class="tideLine" d={linePath} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" />

    {#each extremes as e}
      <circle class={e.high ? 'ext high' : 'ext low'} cx={scale.xOf(e.time.getTime())} cy={scale.yOf(e.level)} r="3.5" />
      <text
        class="extLabel"
        x={scale.xOf(e.time.getTime())}
        y={scale.yOf(e.level) + (e.high ? -10 : 16)}
        text-anchor="middle"
      >
        {formatTime(e.time, tz, timeFormat)}
      </text>
    {/each}

    {#snippet sunMarker(x: number, rise: boolean, label: string)}
      <g class="sunMark">
        <title>{label}</title>
        <line class="sunLine" x1={x} x2={x} y1={padding.top} y2={scale.baselineY} />
        <!-- A small half-sun-over-horizon glyph with a rise/set arrow, parked in the top margin
             just above the plot edge as a label for the hairline (not a terminator on the line). -->
        <g class="sunIcon" transform={`translate(${x}, ${padding.top - 13})`}>
          <path d="M -3 11 A 3 3 0 0 1 3 11" />
          <line x1="-7" y1="11" x2="9" y2="11" />
          <line x1="0" y1="6.5" x2="0" y2="4.5" />
          <line x1="-3.2" y1="7.8" x2="-4.6" y2="6.4" />
          <line x1="3.2" y1="7.8" x2="4.6" y2="6.4" />
          {#if rise}
            <line x1="7" y1="11" x2="7" y2="4.5" />
            <polyline points="5.5,6 7,4.5 8.5,6" />
          {:else}
            <line x1="7" y1="4.5" x2="7" y2="11" />
            <polyline points="5.5,9.5 7,11 8.5,9.5" />
          {/if}
        </g>
      </g>
    {/snippet}

    {#if sunriseX !== null && sun?.sunrise}
      {@render sunMarker(sunriseX, true, `Sunrise ${formatTime(sun.sunrise, tz, timeFormat)}`)}
    {/if}
    {#if sunsetX !== null && sun?.sunset}
      {@render sunMarker(sunsetX, false, `Sunset ${formatTime(sun.sunset, tz, timeFormat)}`)}
    {/if}

    {#if nowX !== null}
      <line class="nowLine" x1={nowX} x2={nowX} y1={padding.top} y2={scale.baselineY} />
    {/if}

    <line class="scrubLine" x1={scrubX} x2={scrubX} y1={padding.top} y2={scale.baselineY} />
    <circle class="scrubDot" cx={scrubX} cy={scrubY} r="6" />
  </svg>
</div>

<style>
  .chart {
    width: 100%;
    touch-action: none; /* let us own horizontal drag for scrubbing */
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
  .grid {
    stroke: var(--muted);
    stroke-opacity: 0.15;
    stroke-width: 1;
  }
  .axis,
  .extLabel {
    fill: var(--muted);
    font-size: 11px;
  }
  .ext.high {
    fill: var(--accent);
  }
  .ext.low {
    fill: var(--falling);
  }
  .nightBand {
    pointer-events: none;
  }
  .sunMark {
    pointer-events: none;
  }
  .sunLine {
    stroke: var(--muted);
    stroke-opacity: 0.4;
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .sunIcon {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1;
    stroke-opacity: 0.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .nowLine {
    stroke: var(--text);
    stroke-opacity: 0.35;
    stroke-width: 1;
    stroke-dasharray: 3 3;
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
