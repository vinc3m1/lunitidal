<script lang="ts">
  import { link } from '../lib/router';
  import { settings } from '../stores/settings';
  import { favorites } from '../stores/favorites';
  import { REPO_URL, LICENSE_URL } from '../lib/links';

  type Opt<T> = { value: T; label: string };
  const heightOpts: Opt<'m' | 'ft'>[] = [
    { value: 'm', label: 'Metres' },
    { value: 'ft', label: 'Feet' },
  ];
  const distOpts: Opt<'km' | 'mi'>[] = [
    { value: 'km', label: 'km' },
    { value: 'mi', label: 'miles' },
  ];
  const timeOpts: Opt<'24h' | '12h'>[] = [
    { value: '24h', label: '24 hr' },
    { value: '12h', label: 'AM/PM' },
  ];
  const themeOpts: Opt<'dark' | 'light' | 'auto'>[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'auto', label: 'Auto' },
  ];

  const setHeight = (v: 'm' | 'ft') => settings.update((s) => ({ ...s, heightUnit: v }));
  const setDist = (v: 'km' | 'mi') => settings.update((s) => ({ ...s, distanceUnit: v }));
  const setTime = (v: '24h' | '12h') => settings.update((s) => ({ ...s, timeFormat: v }));
  const setTheme = (v: 'dark' | 'light' | 'auto') => settings.update((s) => ({ ...s, theme: v }));
  const toggleMarine = () => settings.update((s) => ({ ...s, showMarine: !s.showMarine }));
  const removeFav = (id: string) => favorites.update((l) => l.filter((f) => f.id !== id));
</script>

<header class="topbar">
  <a class="back" use:link href="/" data-testid="nav-back" aria-label="Back">‹ Back</a>
  <h1>Settings</h1>
</header>

<section class="card">
  <div class="row">
    <span>Tide height</span>
    <div class="seg" data-testid="seg-height">
      {#each heightOpts as o}
        <button
          type="button"
          class:active={$settings.heightUnit === o.value}
          data-testid={`unit-${o.value}`}
          on:click={() => setHeight(o.value)}>{o.label}</button
        >
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Distance</span>
    <div class="seg">
      {#each distOpts as o}
        <button type="button" class:active={$settings.distanceUnit === o.value} on:click={() => setDist(o.value)}
          >{o.label}</button
        >
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Time format</span>
    <div class="seg" data-testid="seg-time">
      {#each timeOpts as o}
        <button type="button" class:active={$settings.timeFormat === o.value} on:click={() => setTime(o.value)}
          >{o.label}</button
        >
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Theme</span>
    <div class="seg">
      {#each themeOpts as o}
        <button type="button" class:active={$settings.theme === o.value} on:click={() => setTheme(o.value)}
          >{o.label}</button
        >
      {/each}
    </div>
  </div>
  <div class="row">
    <span>Marine conditions<br /><small>Waves &amp; swell (needs connection)</small></span>
    <div class="seg" data-testid="seg-marine">
      <button type="button" class:active={$settings.showMarine} on:click={toggleMarine}>On</button>
      <button type="button" class:active={!$settings.showMarine} on:click={toggleMarine}>Off</button>
    </div>
  </div>
</section>

<section class="card">
  <h2>Favorites</h2>
  {#if $favorites.length === 0}
    <p class="muted">No saved locations yet. Tap ☆ on the main screen to save one.</p>
  {:else}
    <ul>
      {#each $favorites as f}
        <li>
          <span>{f.label}</span>
          <button type="button" class="remove" on:click={() => removeFav(f.id)} aria-label={`Remove ${f.label}`}
            >Remove</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="card">
  <h2>About</h2>
  <p class="muted">
    Lunitidal computes astronomical tide predictions in your browser — no account, no tracking,
    works offline. Astronomical tide only — <strong>not for navigation</strong>.
  </p>

  <h3>Credits</h3>
  <ul class="credits">
    <li>
      Tide data: TICON-4 / UHSLC via
      <a href="https://github.com/neaps/tide-database" target="_blank" rel="noopener noreferrer"
        >@neaps/tide-database</a
      > (CC-BY-4.0)
    </li>
    <li>
      Prediction engine: on-device
      <a href="https://github.com/neaps/tide-predictor" target="_blank" rel="noopener noreferrer"
        >@neaps/tide-predictor</a
      > (MIT)
    </li>
    <li>
      Place search &amp; marine forecast:
      <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
      (CC-BY-4.0)
    </li>
    <li>
      Approximate IP location:
      <a href="https://www.geojs.io" target="_blank" rel="noopener noreferrer">geojs.io</a>
    </li>
    <li>
      Map tiles:
      <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
      / OpenStreetMap (ODbL)
    </li>
  </ul>

  <p class="muted">
    Made by Vince Mi ·
    <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source on GitHub</a> ·
    <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">MIT License</a>
  </p>
</section>

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
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--muted);
  }
  h3 {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--muted);
    font-weight: 600;
  }
  .credits {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.45;
  }
  .credits li {
    display: block;
    background: none;
    border-radius: 0;
    padding: 0;
  }
  a {
    color: var(--accent);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .seg {
    display: inline-flex;
    background: var(--surface);
    border-radius: 0.6rem;
    overflow: hidden;
  }
  .seg button {
    border: none;
    background: transparent;
    color: var(--muted);
    padding: 0.5rem 0.9rem;
    min-height: 44px;
    font-size: 0.9rem;
  }
  .seg button.active {
    background: var(--accent);
    color: var(--bg);
    font-weight: 700;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    background: var(--surface);
    border-radius: 0.6rem;
    padding: 0.5rem 0.75rem;
  }
  .remove {
    background: none;
    border: 1px solid color-mix(in srgb, var(--falling) 50%, transparent);
    color: var(--falling);
    border-radius: 0.5rem;
    padding: 0.4rem 0.7rem;
    min-height: 40px;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.45;
  }
  .row small {
    color: var(--muted);
    font-weight: 400;
    font-size: 0.75rem;
  }
</style>
