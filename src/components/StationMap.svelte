<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { loadIndex, searchByName } from '../engine/stations';
  import type { IndexEntry } from '../engine/types';
  import { selectPoint, selectStationId, selectFavorite } from '../stores/selection';
  import { geocode, geoLabel, type GeoResult } from '../sources/geocode';
  import { favorites, type Favorite } from '../stores/favorites';
  import { proposed } from '../stores/proposed';
  import { settings } from '../stores/settings';
  import { formatDistance } from '../engine/units';

  export let lat = -8.7;
  export let lon = 115.2;
  export let stationLat: number | null = null;
  export let stationLon: number | null = null;
  export let stationName = 'Tide station';
  export let stationType: 'reference' | 'subordinate' | null = null;
  /** Grid cell the marine forecast was sampled from (nearest wave-model cell); null hides the marker. */
  export let marineLat: number | null = null;
  export let marineLon: number | null = null;
  export let mode: 'overlay' | 'inline' = 'overlay';
  export let hideSearch = false;

  const dispatch = createEventDispatcher<{ close: void }>();
  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;
  let currentMarker: maplibregl.Marker | undefined;
  let stationMarker: maplibregl.Marker | undefined;
  let marineMarker: maplibregl.Marker | undefined;
  let pinMarker: maplibregl.Marker | undefined;
  let busy = false;

  // Search functionality variables
  let query = '';
  let index: IndexEntry[] = [];
  let placeResults: GeoResult[] = [];
  let geoError = '';
  let busyGeolocation = false;
  let isFocused = false;
  let searchInputEl: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let highlightActive = false;

  $: stationResults = query.trim() ? searchByName(index, query.trim(), 12) : [];

  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 250);
  }

  async function runSearch() {
    const q = query.trim();
    placeResults = [];
    geoError = '';
    if (q.length >= 3 && navigator.onLine) {
      try {
        placeResults = await geocode(q, 6);
      } catch {
        geoError = 'Place search unavailable';
      }
    } else if (q.length >= 3 && !navigator.onLine) {
      geoError = 'Offline — showing stations only';
    }
  }

  function clearSearch() {
    query = '';
    placeResults = [];
    geoError = '';
    searchInputEl?.focus();
  }

  export function focusSearch() {
    isFocused = true;
    searchInputEl?.focus();
    
    // Smoothly scroll the map container into view
    const cardEl = searchInputEl?.closest('.card');
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      searchInputEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Trigger visual highlight effect
    highlightActive = true;
    setTimeout(() => {
      highlightActive = false;
    }, 1500);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      geoError = 'Geolocation is not available';
      return;
    }
    busyGeolocation = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latVal = pos.coords.latitude;
        const lonVal = pos.coords.longitude;
        markLocation({ lat: latVal, lon: lonVal });
        if (map) {
          map.easeTo({ center: [lonVal, latVal], zoom: 12, duration: 450 });
        }
        void run(() => selectPoint(latVal, lonVal));
        busyGeolocation = false;
        isFocused = false;
        query = '';
      },
      (err) => {
        geoError = err.message;
        busyGeolocation = false;
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  /** Recenter the map on the current selection (its default framing). Picking a
   *  brand-new "current location" lives in the search dropdown instead. */
  function recenterMap() {
    if (!map) return;
    fitSelection(map, lat, lon, stationLat, stationLon, mode);
  }

  function pickStation(s: IndexEntry) {
    void run(() => selectStationId(s.id, s.name));
    if (map) {
      map.easeTo({ center: [s.lon, s.lat], zoom: 12, offset: mode === 'inline' ? [0, 35] : [0, 60], duration: 450 });
    }
    query = '';
    isFocused = false;
  }

  function pickFavorite(f: Favorite) {
    void run(() => selectFavorite(f));
    if (map) {
      map.easeTo({ center: [f.lon, f.lat], zoom: 12, offset: mode === 'inline' ? [0, 35] : [0, 60], duration: 450 });
    }
    query = '';
    isFocused = false;
  }

  function pickPlace(p: GeoResult) {
    markLocation({ lat: p.lat, lon: p.lon });
    if (map) {
      map.easeTo({ center: [p.lon, p.lat], zoom: 12, offset: mode === 'inline' ? [0, 35] : [0, 60], duration: 450 });
    }
    void run(() => selectPoint(p.lat, p.lon, geoLabel(p), p.timezone));
    query = '';
    isFocused = false;
  }

  function makeCurrentMarker() {
    const el = document.createElement('div');
    el.className = 'current-location-marker';
    el.dataset.testid = 'current-location-marker';
    el.title = 'Current location';
    el.setAttribute('aria-label', 'Current location');
    return el;
  }

  /** Inner markup for the station marker: an anchor badge (reads as "tide station",
   *  matching the ⚓ used in search) wrapped in an icon layer. The hover-scale lives
   *  on the inner `.icon` element, NOT the marker root — MapLibre drives panning by
   *  writing `transform: translate(...)` onto the root, so any `transition` there
   *  makes the dot lag a frame behind the map. Keeping the transition off the root
   *  fixes the "spring-loaded" station dot. */
  function stationIconHtml(type: 'reference' | 'subordinate' | null) {
    const fill = type === 'subordinate' ? 'var(--falling)' : 'var(--accent)';
    return `
      <div class="selected-station-marker-icon">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="17" cy="17" r="14" fill="${fill}" stroke="#ffffff" stroke-width="3"/>
          <g transform="translate(8 8) scale(0.75)" stroke="#ffffff" stroke-width="2.4" fill="none"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22V8"/>
            <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
            <circle cx="12" cy="5" r="3"/>
          </g>
        </svg>
      </div>`;
  }

  function makeStationMarker() {
    const el = document.createElement('div');
    el.className = `selected-station-marker${stationType === 'subordinate' ? ' subordinate' : ''}`;
    el.dataset.testid = 'selected-station-marker';
    el.title = stationName;
    el.setAttribute('aria-label', stationName);
    el.innerHTML = stationIconHtml(stationType);
    return el;
  }

  /** Attach a lightweight hover tooltip to a marker so people can tell the dots apart
   *  (current location vs. tide station vs. waves vs. the pin they just dropped).
   *  `text` is a getter so labels that change over time (e.g. the station name) stay
   *  fresh. The popup is non-interactive (pointer-events: none, via CSS) so it can't
   *  steal the hover and flicker. */
  function attachHoverPopup(marker: maplibregl.Marker, text: () => string) {
    const el = marker.getElement();
    let popup: maplibregl.Popup | undefined;
    el.addEventListener('mouseenter', () => {
      if (!map) return;
      popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        className: 'map-hover-popup',
      })
        .setLngLat(marker.getLngLat())
        .setText(text())
        .addTo(map);
    });
    el.addEventListener('mouseleave', () => {
      popup?.remove();
      popup = undefined;
    });
  }

  function makeMarineMarker() {
    const el = document.createElement('div');
    el.className = 'marine-sample-marker';
    el.dataset.testid = 'marine-sample-marker';
    el.title = 'Waves & swell sampled here';
    el.setAttribute('aria-label', 'Marine forecast sample point');
    el.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 8c2 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 14c2 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"
          stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    return el;
  }

  /** Show/move/remove the marine marker and the dashed link from the chosen point to it. */
  function updateMarine(mlat: number | null, mlon: number | null, fromLat: number, fromLon: number) {
    if (!map) return;
    if (mlat == null || mlon == null) {
      marineMarker?.remove();
      marineMarker = undefined;
      setMarineLink(null, null, null, null);
      return;
    }
    if (marineMarker) marineMarker.setLngLat([mlon, mlat]);
    else {
      marineMarker = new maplibregl.Marker({ element: makeMarineMarker(), anchor: 'center' })
        .setLngLat([mlon, mlat])
        .addTo(map);
      attachHoverPopup(marineMarker, () => 'Waves & swell sampled here');
    }
    setMarineLink(fromLon, fromLat, mlon, mlat);
  }

  function setMarineLink(
    fromLon: number | null,
    fromLat: number | null,
    toLon: number | null,
    toLat: number | null,
  ) {
    const src = map?.getSource('marine-link') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features =
      fromLon == null || fromLat == null || toLon == null || toLat == null
        ? []
        : [
            {
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [fromLon, fromLat],
                  [toLon, toLat],
                ],
              },
              properties: {},
            },
          ];
    src.setData({ type: 'FeatureCollection', features } as never);
  }

  function makePendingMarker() {
    const el = document.createElement('div');
    el.className = 'pending-location-marker';
    el.dataset.testid = 'pending-location-marker';
    el.title = 'Marked location';
    el.setAttribute('aria-label', 'Marked location');
    return el;
  }

  /** Propose a point. State lives in the shared `proposed` store (not a local var) so
   *  the pin survives expanding/shrinking the map, where a *separate* StationMap
   *  instance takes over. `syncProposedMarker` reconciles this instance's pin to it. */
  function markLocation(point: { lat: number; lon: number }) {
    proposed.set(point);
  }

  function syncProposedMarker(point: { lat: number; lon: number } | null) {
    if (!map) return;
    if (!point) {
      pinMarker?.remove();
      pinMarker = undefined;
      return;
    }
    if (pinMarker) pinMarker.setLngLat([point.lon, point.lat]);
    else {
      pinMarker = new maplibregl.Marker({ element: makePendingMarker(), anchor: 'bottom' })
        .setLngLat([point.lon, point.lat])
        .addTo(map);
      attachHoverPopup(pinMarker, () => 'Proposed location — “Use this location” to confirm');
    }
  }

  function fitSelection(
    targetMap: maplibregl.Map,
    selectedLat: number,
    selectedLon: number,
    selectedStationLat: number | null,
    selectedStationLon: number | null,
    displayMode: 'overlay' | 'inline',
  ) {
    const selected: [number, number] = [selectedLon, selectedLat];
    const station: [number, number] = [
      selectedStationLon ?? selectedLon,
      selectedStationLat ?? selectedLat,
    ];
    currentMarker?.setLngLat(selected);
    stationMarker?.setLngLat(station);

    if (selected[0] === station[0] && selected[1] === station[1]) {
      targetMap.easeTo({
        center: selected,
        zoom: Math.max(targetMap.getZoom(), 10),
        offset: displayMode === 'inline' ? [0, 35] : [0, 60],
        duration: 450
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds(selected, selected).extend(station);
    targetMap.fitBounds(bounds, {
      padding: displayMode === 'inline'
        ? { top: 90, bottom: 40, left: 45, right: 45 }
        : { top: 150, bottom: 60, left: 60, right: 60 },
      maxZoom: displayMode === 'inline' ? 12 : 13,
      duration: 450,
    });
  }

  onMount(async () => {
    map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [lon, lat],
      zoom: 9,
      attributionControl: false,
      // Tilting the map adds no value for a 2D tide chart and is easy to trigger
      // accidentally, so disable the two-finger pitch gesture (and keep it flat).
      touchPitch: false,
    });
    // Expose the instance on its container so E2E tests can introspect gesture
    // config (no public MapLibre API maps a canvas back to its Map).
    (container as HTMLElement & { _maplibreMap?: maplibregl.Map })._maplibreMap = map;
    // Controls in bottom corners are prepended (each new control inserts above
    // the previous), so add attribution first to keep it below the zoom controls.
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    // Recenter control: snaps the view back to the selected location. A
    // bounding-frame (corner brackets + center dot) icon reads as "fit the
    // selection back into view", distinct from the device-location flow.
    let recenterContainer: HTMLDivElement | undefined;
    const recenterControl: maplibregl.IControl = {
      onAdd() {
        recenterContainer = document.createElement('div');
        recenterContainer.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-recenter-btn';
        btn.title = 'Recenter map';
        btn.setAttribute('aria-label', 'Recenter map');
        btn.dataset.testid = 'map-recenter';
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 9 V6 a2 2 0 0 1 2 -2 h3" />
            <path d="M15 4 h3 a2 2 0 0 1 2 2 v3" />
            <path d="M20 15 v3 a2 2 0 0 1 -2 2 h-3" />
            <path d="M9 20 H6 a2 2 0 0 1 -2 -2 v-3" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          </svg>`;
        btn.addEventListener('click', recenterMap);
        recenterContainer.appendChild(btn);
        return recenterContainer;
      },
      onRemove() {
        recenterContainer?.parentNode?.removeChild(recenterContainer);
        recenterContainer = undefined;
      },
    };
    map.addControl(recenterControl, 'bottom-right');
    currentMarker = new maplibregl.Marker({ element: makeCurrentMarker(), anchor: 'center' })
      .setLngLat([lon, lat])
      .addTo(map);
    attachHoverPopup(currentMarker, () => 'Current location');
    stationMarker = new maplibregl.Marker({ element: makeStationMarker(), anchor: 'center' })
      .setLngLat([stationLon ?? lon, stationLat ?? lat])
      .addTo(map);
    attachHoverPopup(stationMarker, () =>
      `${stationName} · Tide station${stationType === 'subordinate' ? ' (subordinate)' : ''}`,
    );

    index = await loadIndex();
    const data = {
      type: 'FeatureCollection',
      features: index.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { id: s.id, name: s.name, type: s.type },
      })),
    };

    map.on('load', () => {
      if (!map) return;

      // Force compact attribution to start collapsed (MapLibre auto-expands on desktop)
      const attribEl = container.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact');
      if (attribEl) attribEl.classList.remove('maplibregl-compact-show');

      // Dashed link between the chosen point and the grid cell the waves come from.
      map.addSource('marine-link', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as never,
      });
      map.addLayer({
        id: 'marine-link',
        type: 'line',
        source: 'marine-link',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#0a7ea4',
          'line-width': 2,
          'line-opacity': 0.55,
          'line-dasharray': [1.5, 1.5],
        },
      });

      map.addSource('stations', { type: 'geojson', data: data as never });
      map.addLayer({
        id: 'stations-c',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': [
            'match',
            ['get', 'type'],
            'subordinate', 4,
            5
          ],
          'circle-color': [
            'match',
            ['get', 'type'],
            'subordinate', '#c9711f',
            '#0a7ea4'
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'stations-l',
        type: 'symbol',
        source: 'stations',
        minzoom: 8,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: { 'text-color': '#0b3a5a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
      });

      // Apply any marine sample that arrived while the style was still loading.
      updateMarine(marineLat, marineLon, lat, lon);
    });

    map.on('mouseenter', 'stations-c', () => map && (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'stations-c', () => map && (map.getCanvas().style.cursor = ''));
    map.on('click', 'stations-c', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties as { id: string; name: string };
      run(() => selectStationId(props.id, props.name));
    });
    map.on('click', (e) => {
      if (!map) return;
      if (map.getLayer('stations-c')) {
        if (map.queryRenderedFeatures(e.point, { layers: ['stations-c'] }).length) return;
      }
      markLocation({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });
  });

  $: if (map) fitSelection(map, lat, lon, stationLat, stationLon, mode);
  $: if (map) updateMarine(marineLat, marineLon, lat, lon);
  // Keep this instance's pin in sync with the shared proposed-location store, so the
  // dropped pin persists across expand/shrink and clears everywhere when dismissed.
  $: if (map) syncProposedMarker($proposed);
  $: if (stationMarker && stationType) {
    const el = stationMarker.getElement();
    if (el) {
      el.className = `selected-station-marker${stationType === 'subordinate' ? ' subordinate' : ''}`;
      el.title = stationName;
      el.setAttribute('aria-label', stationName);
      el.innerHTML = stationIconHtml(stationType);
    }
  }

  onDestroy(() => map?.remove());

  async function run(fn: () => Promise<void>) {
    busy = true;
    try {
      await fn();
      // The selection is committed — drop any uncommitted proposed pin so it doesn't
      // linger on the map (or reappear on the inline map after the overlay closes).
      proposed.set(null);
      dispatch('close');
    } catch (e) {
      // Surface failures (e.g. invalid coordinates, no nearby station) instead of letting them
      // become an unhandled rejection; keep the map open so the user can pick again.
      geoError = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
  // No label → the nearest station's name is used (not a stale "Dropped pin").
  const useDroppedPin = () => $proposed && run(() => selectPoint($proposed!.lat, $proposed!.lon));
</script>

<div
  class:map-overlay={mode === 'overlay'}
  class:map-inline={mode === 'inline'}
  data-testid={mode === 'overlay' ? 'map-sheet' : 'home-map'}
>
  {#if !hideSearch}
    {#if isFocused}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="search-backdrop" on:click={() => (isFocused = false)}></div>
    {/if}

    <div
      class="map-search-container"
      class:highlighted={highlightActive}
    >
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          bind:this={searchInputEl}
          type="search"
          placeholder="Search station, town, beach..."
          bind:value={query}
          on:input={onInput}
          on:focus={() => (isFocused = true)}
          autocomplete="off"
          data-testid="map-search-input"
        />
        {#if query}
          <button class="clear-btn" type="button" on:click={clearSearch} aria-label="Clear search">✕</button>
        {/if}
      </div>

      {#if isFocused}
        <div
          class="search-dropdown-wrapper"
          class:has-dual-results={query.trim() && stationResults.length && placeResults.length}
          data-testid="search-results-dropdown"
        >
          <button
            class="search-dropdown-btn"
            type="button"
            data-testid="use-my-location"
            disabled={busyGeolocation}
            on:click={useMyLocation}
          >
            <span>📍</span>
            <span>{busyGeolocation ? 'Locating…' : 'Use my location'}</span>
          </button>

          {#if geoError}
            <p class="search-hint" style="color: var(--falling);">{geoError}</p>
          {/if}

          {#if !query && $favorites && $favorites.length}
            <div class="search-favorites-container">
              <div class="search-section-title sticky-title">Favorites</div>
              <ul class="search-dropdown-list" data-testid="favorites">
                {#each $favorites as f}
                  <li>
                    <button class="search-dropdown-item" type="button" on:click={() => pickFavorite(f)}>
                      <span class="search-item-name"><span class="star">★</span>{f.label}</span>
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if query.trim()}
            <div class="search-results-grid" class:dual-columns={stationResults.length && placeResults.length}>
              {#if stationResults.length}
                <div class="search-results-column">
                  <div class="search-section-title sticky-title">Tide Stations</div>
                  <ul class="search-dropdown-list">
                    {#each stationResults as s}
                      <li>
                        <button class="search-dropdown-item" type="button" data-testid="station-result" on:click={() => pickStation(s)}>
                          <span class="search-item-name">⚓ {s.name}</span>
                          <span class="search-item-sub">{[s.region, s.country].filter(Boolean).join(', ')}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}

              {#if placeResults.length}
                <div class="search-results-column">
                  <div class="search-section-title sticky-title">Places</div>
                  <ul class="search-dropdown-list">
                    {#each placeResults as p}
                      <li>
                        <button class="search-dropdown-item" type="button" data-testid="place-result" on:click={() => pickPlace(p)}>
                          <span class="search-item-name">🗺️ {p.name}</span>
                          <span class="search-item-sub">{[p.admin1, p.country].filter(Boolean).join(', ')}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}

          {#if query.trim().length >= 3 && !stationResults.length && !placeResults.length}
            <p class="search-hint">No matches found</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if mode === 'overlay'}
    <button class="shrink-btn-floating" type="button" data-testid="map-close" on:click={() => dispatch('close')} aria-label="Close map">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" />
        <line x1="10" y1="14" x2="3" y2="21" />
      </svg>
    </button>
  {/if}

  <div class="map" bind:this={container}></div>
  {#if $proposed}
    <div class="pin-actions">
      <button class="use-pin" type="button" data-testid="use-pin" disabled={busy} on:click={useDroppedPin}>
        {busy ? 'Loading…' : 'Use this location'}
      </button>
      <button
        class="clear-pin"
        type="button"
        data-testid="clear-pin"
        disabled={busy}
        on:click={() => proposed.set(null)}
        aria-label="Clear proposed location"
        title="Clear proposed location"
      >✕</button>
    </div>
  {/if}
</div>

<style>
  /* Recenter control button (built imperatively, so styled globally). Matches the
     sizing of MapLibre's own control buttons and centers the bounding-frame icon. */
  :global(.map-recenter-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
  }
  :global(.map-recenter-btn:hover) {
    color: #000;
  }

  .map-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .map-inline {
    position: relative;
    display: flex;
    min-height: 18rem;
    overflow: hidden;
    border-radius: 0.75rem;
    background: var(--surface);
  }
  .map {
    flex: 1;
    min-height: 0;
  }
  .map-inline .map {
    min-height: 18rem;
  }
  :global(.current-location-marker) {
    width: 1.45rem;
    height: 1.45rem;
    border: 3px solid #ffffff;
    border-radius: 999px;
    background: var(--falling);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--falling) 35%, transparent),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
  :global(.selected-station-marker) {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45));
    /* No transition here: MapLibre pans the marker via `transform: translate(...)` on
       this root element, so a transform transition would make the dot visibly lag the
       map. The hover animation lives on the inner .icon instead. */
  }
  :global(.selected-station-marker-icon) {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  :global(.selected-station-marker:hover .selected-station-marker-icon) {
    transform: scale(1.1);
  }
  :global(.marine-sample-marker) {
    width: 1.7rem;
    height: 1.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #ffffff;
    border-radius: 999px;
    background: #0a7ea4;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  :global(.pending-location-marker) {
    width: 1.4rem;
    height: 1.4rem;
    border: 3px solid #ffffff;
    border-radius: 999px;
    background: var(--proposed);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--proposed) 30%, transparent),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
  /* Hover tooltips distinguishing the map dots. pointer-events: none keeps the popup
     from stealing hover off the marker (which would make it flicker). */
  :global(.map-hover-popup) {
    pointer-events: none;
  }
  :global(.map-hover-popup .maplibregl-popup-content) {
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 25%, transparent);
    border-radius: 0.5rem;
    padding: 0.35rem 0.6rem;
    font-size: 0.78rem;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  }
  :global(.map-hover-popup .maplibregl-popup-tip) {
    border-top-color: color-mix(in srgb, var(--surface) 92%, transparent);
    border-bottom-color: color-mix(in srgb, var(--surface) 92%, transparent);
  }
  .pin-actions {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(1.25rem + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 10;
  }
  .use-pin {
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: 999px;
    padding: 0.85rem 1.5rem;
    font-weight: 700;
    font-size: 1rem;
    min-height: 48px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.1s ease;
  }
  .use-pin:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .use-pin:active:not(:disabled) {
    transform: scale(0.98);
  }
  .clear-pin {
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 25%, transparent);
    border-radius: 999px;
    width: 48px;
    height: 48px;
    min-width: 48px;
    font-size: 1.1rem;
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .clear-pin:hover:not(:disabled) {
    background: color-mix(in srgb, var(--surface) 70%, var(--text) 30%);
  }
  .clear-pin:active:not(:disabled) {
    transform: scale(0.95);
  }
  .clear-pin:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .map-search-container {
    position: absolute;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    max-width: 24rem;
    z-index: 101;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: auto;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease;
  }
  
  .map-overlay .map-search-container {
    top: calc(4.5rem + env(safe-area-inset-top));
  }
  
  /* Highlight effect for focusSearch method */
  .map-search-container.highlighted {
    transform: scale(1.04);
  }
  .map-search-container.highlighted .search-bar {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent), 0 10px 25px rgba(0, 0, 0, 0.35);
  }
  
  .search-bar {
    display: flex;
    align-items: center;
    background: color-mix(in srgb, var(--surface) 85%, transparent 15%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
    border-radius: 0.75rem;
    padding: 0.5rem 0.75rem;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  
  .search-bar:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent), 0 4px 15px rgba(0, 0, 0, 0.25);
  }
  
  .search-icon {
    font-size: 0.95rem;
    color: var(--muted);
    margin-right: 0.5rem;
    user-select: none;
  }
  
  .search-bar input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 0.92rem;
    padding: 0.25rem 0;
    min-height: 24px;
  }
  
  .search-bar input::placeholder {
    color: var(--muted);
    opacity: 0.8;
  }
  
  .clear-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem;
    margin-left: 0.35rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    transition: background 0.15s, color 0.15s;
  }
  
  .clear-btn:hover {
    background: color-mix(in srgb, var(--surface) 70%, var(--text) 30%);
    color: var(--text);
  }
  
  .search-backdrop {
    position: absolute;
    inset: 0;
    background: transparent;
    z-index: 100;
  }
  
  .search-dropdown-wrapper {
    background: color-mix(in srgb, var(--surface) 90%, transparent 10%);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    max-height: 20rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--muted) 40%, transparent) transparent;
  }

  .search-dropdown-wrapper::-webkit-scrollbar {
    width: 6px;
  }
  .search-dropdown-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }
  .search-dropdown-wrapper::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    border-radius: 3px;
  }
  .search-dropdown-wrapper::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
  }

  .map-overlay .search-dropdown-wrapper {
    max-height: 32rem;
  }

  /* Dual column layout for desktop/tablet */
  .search-results-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  @media (min-width: 500px) {
    .search-results-grid.dual-columns {
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    
    .search-dropdown-wrapper.has-dual-results {
      overflow-y: hidden;
      max-height: none;
      min-width: min(34rem, calc(100vw - 3rem));
      width: max-content;
      /* Break out of the flex container so the search bar keeps its width */
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 0.5rem;
    }
    
    .search-dropdown-wrapper.has-dual-results .search-results-grid.dual-columns {
      max-height: 20rem;
    }

    .map-overlay .search-dropdown-wrapper.has-dual-results .search-results-grid.dual-columns {
      max-height: calc(85vh - 160px);
    }
    
    .search-results-column {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding-right: 0.25rem;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--muted) 35%, transparent) transparent;
    }

    .search-results-column::-webkit-scrollbar {
      width: 4px;
    }
    .search-results-column::-webkit-scrollbar-track {
      background: transparent;
    }
    .search-results-column::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--muted) 35%, transparent);
      border-radius: 2px;
    }
  }

  .search-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    padding: 0.35rem 0.5rem 0.15rem;
    margin: 0;
  }

  .sticky-title {
    position: sticky;
    top: 0;
    z-index: 5;
    background: color-mix(in srgb, var(--surface) 95%, transparent 5%);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 0.35rem 0.5rem;
    margin-bottom: 0.15rem;
    border-bottom: 1px solid color-mix(in srgb, var(--muted) 10%, transparent);
  }
  
  .search-dropdown-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  
  .search-dropdown-item {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 0.5rem;
    padding: 0.45rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    cursor: pointer;
    color: var(--text);
    transition: background 0.15s;
  }
  
  .search-dropdown-item:hover {
    background: color-mix(in srgb, var(--surface) 75%, var(--text) 25%);
  }
  
  .search-item-name {
    font-size: 0.88rem;
    font-weight: 600;
  }
  
  .search-item-sub {
    font-size: 0.75rem;
    color: var(--muted);
  }
  
  .search-dropdown-btn {
    width: 100%;
    text-align: left;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    border-radius: 0.5rem;
    padding: 0.5rem 0.6rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    transition: background 0.15s, filter 0.15s;
  }
  
  .search-dropdown-btn:hover {
    background: color-mix(in srgb, var(--accent) 25%, transparent);
    filter: brightness(1.15);
  }
  
  .search-dropdown-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .search-hint {
    padding: 0.5rem;
    font-size: 0.8rem;
    color: var(--muted);
    text-align: center;
    margin: 0;
  }

  .star {
    color: var(--accent);
    margin-right: 0.25rem;
  }

  /* Hide Webkit native cancel cross button */
  input[type="search"]::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }

  .map-overlay .map-search-container {
    top: calc(1rem + env(safe-area-inset-top));
    left: 1rem;
    right: 5rem;
    max-width: calc(100% - 6rem);
  }



  .shrink-btn-floating {
    position: absolute;
    top: calc(1rem + env(safe-area-inset-top));
    right: 1rem;
    z-index: 101;
    background: color-mix(in srgb, var(--surface) 85%, transparent 15%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 20%, transparent);
    border-radius: 0.75rem;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .shrink-btn-floating:hover {
    background: color-mix(in srgb, var(--surface) 70%, var(--text) 30%);
  }
  .shrink-btn-floating:active {
    transform: scale(0.95);
  }
</style>

