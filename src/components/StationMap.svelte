<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { loadIndex } from '../engine/stations';
  import { selectPoint, selectStationId } from '../stores/selection';

  export let lat = -8.7;
  export let lon = 115.2;
  export let stationLat: number | null = null;
  export let stationLon: number | null = null;
  export let stationName = 'Tide station';
  export let stationType: 'reference' | 'subordinate' | null = null;
  export let mode: 'overlay' | 'inline' = 'overlay';

  const dispatch = createEventDispatcher<{ close: void }>();
  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;
  let currentMarker: maplibregl.Marker | undefined;
  let stationMarker: maplibregl.Marker | undefined;
  let pinMarker: maplibregl.Marker | undefined;
  let picked: { lat: number; lon: number } | null = null;
  let busy = false;

  function makeCurrentMarker() {
    const el = document.createElement('div');
    el.className = 'current-location-marker';
    el.dataset.testid = 'current-location-marker';
    el.title = 'Current location';
    el.setAttribute('aria-label', 'Current location');
    return el;
  }

  function makeStationMarker() {
    const el = document.createElement('div');
    el.className = `selected-station-marker${stationType === 'subordinate' ? ' subordinate' : ''}`;
    el.dataset.testid = 'selected-station-marker';
    el.title = stationName;
    el.setAttribute('aria-label', stationName);
    return el;
  }

  function makePendingMarker() {
    const el = document.createElement('div');
    el.className = 'pending-location-marker';
    el.dataset.testid = 'pending-location-marker';
    el.title = 'Marked location';
    el.setAttribute('aria-label', 'Marked location');
    return el;
  }

  function markLocation(point: { lat: number; lon: number }) {
    picked = point;
    if (pinMarker) pinMarker.setLngLat([point.lon, point.lat]);
    else {
      pinMarker = new maplibregl.Marker({ element: makePendingMarker(), anchor: 'bottom' })
        .setLngLat([point.lon, point.lat])
        .addTo(map!);
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
      targetMap.easeTo({ center: selected, zoom: Math.max(targetMap.getZoom(), 10), duration: 450 });
      return;
    }

    const bounds = new maplibregl.LngLatBounds(selected, selected).extend(station);
    targetMap.fitBounds(bounds, {
      padding: displayMode === 'inline' ? 60 : 100,
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
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      showUserLocation: false,
      trackUserLocation: false,
    });
    geolocate.on('geolocate', (e: GeolocationPosition) => {
      markLocation({ lat: e.coords.latitude, lon: e.coords.longitude });
    });
    map.addControl(geolocate, 'top-right');
    currentMarker = new maplibregl.Marker({ element: makeCurrentMarker(), anchor: 'center' })
      .setLngLat([lon, lat])
      .addTo(map);
    stationMarker = new maplibregl.Marker({ element: makeStationMarker(), anchor: 'bottom' })
      .setLngLat([stationLon ?? lon, stationLat ?? lat])
      .addTo(map);

    const index = await loadIndex();
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
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: { 'text-color': '#0b3a5a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
      });
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
  $: if (stationMarker && stationType) {
    const el = stationMarker.getElement();
    if (el) {
      el.className = `selected-station-marker${stationType === 'subordinate' ? ' subordinate' : ''}`;
    }
  }

  onDestroy(() => map?.remove());

  async function run(fn: () => Promise<void>) {
    busy = true;
    try {
      await fn();
      dispatch('close');
    } finally {
      busy = false;
    }
  }
  // No label → the nearest station's name is used (not a stale "Dropped pin").
  const useDroppedPin = () => picked && run(() => selectPoint(picked!.lat, picked!.lon));
</script>

<div
  class:map-overlay={mode === 'overlay'}
  class:map-inline={mode === 'inline'}
  data-testid={mode === 'overlay' ? 'map-sheet' : 'home-map'}
>
  {#if mode === 'overlay'}
    <header>
      <button class="x" type="button" data-testid="map-close" on:click={() => dispatch('close')} aria-label="Close map"
        >✕</button
      >
      <span class="hint">Tap a station, or drop a pin anywhere</span>
    </header>
  {/if}
  <div class="map" bind:this={container}></div>
  {#if picked}
    <button class="use-pin" type="button" data-testid="use-pin" disabled={busy} on:click={useDroppedPin}>
      {busy ? 'Loading…' : 'Use this location'}
    </button>
  {/if}
</div>

<style>
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
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem calc(0.5rem);
    padding-top: calc(0.5rem + env(safe-area-inset-top));
  }
  .x {
    background: var(--surface);
    color: var(--text);
    border: none;
    border-radius: 999px;
    min-width: 44px;
    min-height: 44px;
    font-size: 1rem;
  }
  .hint {
    color: var(--muted);
    font-size: 0.9rem;
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
    width: 1.65rem;
    height: 1.65rem;
    border: 3px solid #ffffff;
    border-radius: 0.35rem;
    background: var(--accent);
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
  :global(.selected-station-marker.subordinate) {
    background: var(--falling);
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--falling) 30%, transparent),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
  :global(.pending-location-marker) {
    width: 1.4rem;
    height: 1.4rem;
    border: 3px solid #ffffff;
    border-radius: 999px;
    background: var(--falling);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--falling) 30%, transparent),
      0 2px 10px rgba(0, 0, 0, 0.45);
  }
  .use-pin {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(1.25rem + env(safe-area-inset-bottom));
    background: var(--accent);
    color: var(--bg);
    border: none;
    border-radius: 999px;
    padding: 0.85rem 1.5rem;
    font-weight: 700;
    font-size: 1rem;
    min-height: 48px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    z-index: 10;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.1s ease;
  }
  .use-pin:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .use-pin:active:not(:disabled) {
    transform: translateX(-50%) scale(0.98);
  }
</style>
