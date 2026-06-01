<script lang="ts">
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import { initSelection } from './stores/selection';
  import { healFavorites } from './stores/favorites';
  import { settings } from './stores/settings';
  import Home from './routes/Home.svelte';
  import Detail from './routes/Detail.svelte';
  import Settings from './routes/Settings.svelte';
  import Footer from './components/Footer.svelte';

  const routes = {
    '/': Home,
    '/detail': Detail,
    '/settings': Settings,
    '*': Home,
  };

  onMount(() => {
    initSelection();
    healFavorites(); // migrate any old "My location"-style favorite labels
    // Best-effort: ask the browser to keep our cached data through storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  });

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
  <Footer />
</main>

<style>
  main {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  @media (min-width: 48rem) {
    main {
      padding: 1.25rem 1.5rem calc(1.25rem + env(safe-area-inset-bottom));
    }
  }
</style>
