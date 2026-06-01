<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { selection } from '../stores/selection';
  import { settings } from '../stores/settings';
  import { availableDatums } from '../engine/datum';
  import { confidenceForKm } from '../engine/confidence';
  import { formatDistance, formatHeight } from '../engine/units';

  $: sel = $selection;
  $: station = sel?.station ?? null;
  $: datums = station ? availableDatums(station) : [];
  $: constituents = station?.harmonic_constituents
    ? [...station.harmonic_constituents].sort((a, b) => b.amplitude - a.amplitude)
    : [];

  function onDatum(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    settings.update((s) => ({ ...s, datum: v === '' ? null : v }));
  }
</script>

<header class="topbar">
  <a class="back" use:link href="/" data-testid="nav-back" aria-label="Back">‹ Back</a>
  <h1>Source &amp; accuracy</h1>
</header>

{#if !sel || !station}
  <p class="status">No location selected.</p>
{:else}
  <section class="card">
    <h2>{sel.label}</h2>
    {#if sel.km !== null}
      <p class="explain">
        Showing the nearest tide station,
        <strong>{station.name}</strong>, {formatDistance(sel.km, $settings.distanceUnit)} away
        (<span class={`conf ${confidenceForKm(sel.km).level}`}>{confidenceForKm(sel.km).label}</span>).
        Tides at your exact spot can differ — most near headlands, inside bays, or up estuaries.
      </p>
    {:else}
      <p class="explain">Predictions for the <strong>{station.name}</strong> tide station.</p>
    {/if}
  </section>

  <section class="card">
    <h3>Chart datum</h3>
    <p class="muted">Heights are shown relative to this reference level.</p>
    <select data-testid="datum-select" on:change={onDatum} value={$settings.datum ?? ''}>
      <option value="">Auto — {station.chart_datum} (station default)</option>
      {#each datums as d}
        <option value={d}>{d} ({formatHeight(station.datums[d], $settings.heightUnit)} vs MSL)</option>
      {/each}
    </select>
  </section>

  <section class="card">
    <h3>Data source</h3>
    <dl>
      <dt>Station</dt>
      <dd>{station.name}{station.region ? `, ${station.region}` : ''}, {station.country}</dd>
      <dt>Dataset</dt>
      <dd>
        {#if station.source?.url}
          <a href={station.source.url} target="_blank" rel="noopener">{station.source?.name}</a>
        {:else}
          {station.source?.name ?? '—'}
        {/if}
      </dd>
      {#if station.epoch}
        <dt>Analysis epoch</dt>
        <dd>{station.epoch.start} – {station.epoch.end}</dd>
      {/if}
      <dt>Type</dt>
      <dd>{station.type}</dd>
      <dt>License</dt>
      <dd>
        {#if station.license?.url}
          <a href={station.license.url} target="_blank" rel="noopener">{station.license?.type}</a>
        {:else}
          {station.license?.type ?? '—'}
        {/if}
      </dd>
    </dl>
  </section>

  {#if station.type === 'subordinate' && station.offsets}
    <section class="card">
      <h3>Subordinate Offsets</h3>
      <p class="muted">Tides calculated on-device by applying time and height offsets to the reference station <strong>{station.referenceStation?.name || station.offsets.reference}</strong>.</p>
      <dl>
        <dt>Reference Station</dt>
        <dd>{station.referenceStation?.name || station.offsets.reference}</dd>
        <dt>High tide shift</dt>
        <dd>{station.offsets.time.high > 0 ? `+${station.offsets.time.high}` : station.offsets.time.high} min</dd>
        <dt>Low tide shift</dt>
        <dd>{station.offsets.time.low > 0 ? `+${station.offsets.time.low}` : station.offsets.time.low} min</dd>
        <dt>Height offset type</dt>
        <dd>{station.offsets.height.type === 'ratio' ? 'Ratio (Multiplier)' : 'Fixed offset'}</dd>
        <dt>High tide offset</dt>
        <dd>{station.offsets.height.type === 'ratio' ? `×${station.offsets.height.high.toFixed(2)}` : `${station.offsets.height.high > 0 ? `+${station.offsets.height.high}` : station.offsets.height.high} m`}</dd>
        <dt>Low tide offset</dt>
        <dd>{station.offsets.height.type === 'ratio' ? `×${station.offsets.height.low.toFixed(2)}` : `${station.offsets.height.low > 0 ? `+${station.offsets.height.low}` : station.offsets.height.low} m`}</dd>
      </dl>
    </section>
  {/if}

  {#if constituents.length}
    <section class="card">
      <h3>Harmonic constituents ({constituents.length})</h3>
      <p class="muted">The on-device model sums these to predict the curve.</p>
      <table data-testid="constituents">
        <thead>
          <tr><th>Name</th><th>Amplitude (m)</th><th>Phase (°)</th></tr>
        </thead>
        <tbody>
          {#each constituents as c}
            <tr>
              <td>{c.name}</td>
              <td>{c.amplitude.toFixed(3)}</td>
              <td>{c.phase.toFixed(1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}

  <p class="source-note">
    Data: {station.source?.name ?? 'TICON-4'} ({station.license?.type ?? 'CC-BY-4.0'})
  </p>
{/if}

<style>
  .topbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .back {
    color: var(--accent);
    text-decoration: none;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .topbar h1 {
    margin: 0;
    font-size: 1rem;
    color: var(--muted);
    font-weight: 600;
  }
  .card {
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
  }
  .explain {
    margin: 0;
    line-height: 1.45;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
  .conf.good {
    color: var(--accent);
  }
  .conf.rough,
  .conf.far {
    color: var(--falling);
  }
  select {
    width: 100%;
    padding: 0.75rem;
    border-radius: 0.6rem;
    background: var(--surface);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 30%, transparent);
    min-height: 48px;
    font-size: 1rem;
  }
  dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 1rem;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  th {
    text-align: left;
    color: var(--muted);
    font-weight: 600;
    border-bottom: 1px solid color-mix(in srgb, var(--muted) 25%, transparent);
    padding: 0.3rem 0;
  }
  td {
    padding: 0.25rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--muted) 12%, transparent);
  }
  a {
    color: var(--accent);
  }
  .source-note {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    text-align: center;
  }
</style>
