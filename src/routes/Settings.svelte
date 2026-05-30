<script lang="ts">
  import { link } from 'svelte-spa-router';
  import { settings } from '../stores/settings';
  import { favorites } from '../stores/favorites';

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
    { value: '24h', label: '24-hour' },
    { value: '12h', label: '12-hour' },
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
    <div class="seg">
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
    Tide data from TICON-4 / UHSLC via @neaps/tide-database (CC-BY-4.0). Predictions computed
    on-device with @neaps/tide-predictor (MIT). Place search by Open-Meteo. Astronomical tide
    only — not for navigation.
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
</style>
