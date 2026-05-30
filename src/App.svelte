<script lang="ts">
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { initSelection } from './stores/selection';
  import { settings } from './stores/settings';
  import Home from './routes/Home.svelte';
  import Detail from './routes/Detail.svelte';
  import Settings from './routes/Settings.svelte';

  const routes = {
    '/': Home,
    '/detail': Detail,
    '/settings': Settings,
    '*': Home,
  };

  onMount(() => initSelection());

  function applyTheme(theme: 'dark' | 'light' | 'auto') {
    if (typeof document === 'undefined') return;
    const resolved =
      theme === 'auto'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : theme;
    document.documentElement.dataset.theme = resolved;
  }
  $: applyTheme($settings.theme);
</script>

<main>
  <Router {routes} />
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
</style>
