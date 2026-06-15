<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Router from './lib/Router.svelte';
  import { navigate, path, stationSlugFromPath } from './lib/router';
  import {
    initSelection,
    loadSlugMaps,
    selectStationBySlug,
    selection,
    selectionStatus,
    slugForStationId,
  } from './stores/selection';
  import { healFavorites } from './stores/favorites';
  import { settings } from './stores/settings';
  import Footer from './components/Footer.svelte';

  // Gate the URL<->selection sync until the slug maps are loaded, and skip the very
  // first selection (the initial restore/seed/deep-link) so a plain `/` visit keeps
  // its URL — only an explicit in-app location change rewrites the address bar.
  let mapsReady = false;
  let urlSyncArmed = false;

  onMount(async () => {
    // A `/tides/<slug>/` deep link wins over the saved location. If the slug is
    // unknown or the station isn't cached (offline), fall back to the normal restore.
    const slug = stationSlugFromPath(get(path));
    let handled = false;
    if (slug) {
      try {
        await selectStationBySlug(slug);
        selectionStatus.set('ready');
        handled = true;
      } catch {
        /* unknown slug / offline — fall through to the saved-or-seed default */
      }
    }
    if (!handled) await initSelection();

    healFavorites(); // migrate any old "My location"-style favorite labels
    // Best-effort: ask the browser to keep our cached data through storage pressure.
    navigator.storage?.persist?.().catch(() => {});

    await loadSlugMaps().catch(() => null);
    mapsReady = true;
  });

  // URL -> selection: client navigations (back/forward, internal links) to a
  // station URL drive the selection. Guarded by id-equality so it can't loop with
  // the selection -> URL sync below.
  $: if (mapsReady) syncPathToSelection($path);
  function syncPathToSelection(p: string): void {
    const slug = stationSlugFromPath(p);
    if (!slug) return;
    if (slugForStationId(get(selection)?.station.id ?? '') === slug) return;
    selectStationBySlug(slug).catch(() => {});
  }

  // selection -> URL: an explicit in-app location change updates the shareable URL.
  $: if (mapsReady) syncSelectionToPath($selection);
  function syncSelectionToPath(sel: typeof $selection): void {
    if (!sel) return;
    if (!urlSyncArmed) {
      urlSyncArmed = true; // skip the initial selection
      return;
    }
    const slug = slugForStationId(sel.station.id);
    if (!slug || stationSlugFromPath(get(path)) === slug) return;
    navigate(`/tides/${slug}/`, { replace: true });
  }

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
  <Router />
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
