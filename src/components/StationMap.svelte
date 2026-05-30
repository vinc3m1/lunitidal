<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { loadIndex } from '../engine/stations';
  import { selectPoint, selectStationId } from '../stores/selection';

  export let lat = -8.7;
  export let lon = 115.2;

  const dispatch = createEventDispatcher<{ close: void }>();
  let container: HTMLDivElement;
  let map: maplibregl.Map | undefined;
  let pinMarker: maplibregl.Marker | undefined;
  let picked: { lat: number; lon: number } | null = null;
  let busy = false;

  onMount(async () => {
    map = new maplibregl.Map({
      container,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [lon, lat],
      zoom: 9,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false } }),
      'top-right',
    );

    const index = await loadIndex();
    const data = {
      type: 'FeatureCollection',
      features: index.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { id: s.id, name: s.name },
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
          'circle-radius': 5,
          'circle-color': '#0a7ea4',
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
      if (map.queryRenderedFeatures(e.point, { layers: ['stations-c'] }).length) return;
      picked = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      if (pinMarker) pinMarker.setLngLat([picked.lon, picked.lat]);
      else pinMarker = new maplibregl.Marker({ color: '#ffb454' }).setLngLat([picked.lon, picked.lat]).addTo(map);
    });
  });

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
  const useDroppedPin = () => picked && run(() => selectPoint(picked!.lat, picked!.lon, 'Dropped pin'));
</script>

<div class="map-overlay" data-testid="map-sheet">
  <header>
    <button class="x" type="button" data-testid="map-close" on:click={() => dispatch('close')} aria-label="Close map"
      >✕</button
    >
    <span class="hint">Tap a station, or drop a pin anywhere</span>
  </header>
  <div class="map" bind:this={container}></div>
  {#if picked}
    <button class="use-pin" type="button" data-testid="use-pin" disabled={busy} on:click={useDroppedPin}>
      {busy ? 'Loading…' : 'Use this point'}
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
  }
</style>
