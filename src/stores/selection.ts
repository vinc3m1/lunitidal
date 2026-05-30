import { get, writable } from 'svelte/store';
import { loadIndex, loadSeedStation, loadStation, nearest } from '../engine/stations';
import type { Station } from '../engine/types';
import { getIpLocation } from '../sources/ipgeo';
import { isLegacyLabel, type Favorite } from './favorites';
import { persisted } from './persisted';

export interface Selection {
  station: Station;
  /** Display label — a place name when geocoded, else the station name. */
  label: string;
  /** Distance (km) from the chosen point to this station; null when picked directly. */
  km: number | null;
  /** The chosen point (station coords when picked directly). */
  point: { lat: number; lon: number };
}

export const selection = writable<Selection | null>(null);
export const selectionStatus = writable<'loading' | 'ready' | 'error'>('loading');

interface LastLocation {
  stationId: string;
  label: string;
  km: number | null;
  lat: number;
  lon: number;
}
const lastLocation = persisted<LastLocation | null>('lunitidal:lastLocation', null);

function commit(sel: Selection): void {
  selection.set(sel);
  lastLocation.set({
    stationId: sel.station.id,
    label: sel.label,
    km: sel.km,
    lat: sel.point.lat,
    lon: sel.point.lon,
  });
}

/** Restore the last location, or fall back to the bundled Benoa seed. */
export async function initSelection(): Promise<void> {
  selectionStatus.set('loading');
  const last = get(lastLocation);
  try {
    if (last) {
      try {
        const station = await loadStation(last.stationId);
        // Heal legacy "My location"-style labels saved before the labelling fix.
        const label = isLegacyLabel(last.label) ? station.name : last.label;
        const sel = { station, label, km: last.km, point: { lat: last.lat, lon: last.lon } };
        selection.set(sel);
        if (label !== last.label) commit(sel);
        selectionStatus.set('ready');
        return;
      } catch {
        /* station not cached offline — fall back to seed */
      }
    }
    // No saved location: try a silent IP-based guess (online only), then snap to the
    // nearest station. Falls through to the bundled seed if it fails/times out/offline.
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        const loc = await getIpLocation();
        await selectPoint(loc.lat, loc.lon, loc.label);
        selectionStatus.set('ready');
        return;
      } catch {
        /* IP geolocation unavailable — fall back to seed */
      }
    }

    const station = await loadSeedStation();
    selection.set({
      station,
      label: station.name,
      km: null,
      point: { lat: station.latitude, lon: station.longitude },
    });
    selectionStatus.set('ready');
  } catch {
    selectionStatus.set('error');
  }
}

/**
 * Pick an arbitrary point (geolocation / geocoder / IP) and snap to the nearest station.
 * `label` is the meaningful place name when there is one (a searched place, an IP city);
 * omit it for raw geolocation so the station's own name is shown instead of a stale
 * "my location".
 */
export async function selectPoint(lat: number, lon: number, label?: string): Promise<void> {
  const index = await loadIndex();
  const [near] = nearest(index, lat, lon, 1);
  if (!near) throw new Error('No tide station found nearby');
  const station = await loadStation(near.station.id);
  commit({ station, label: label || station.name, km: near.km, point: { lat, lon } });
}

/** Pick a station directly (offline station search). */
export async function selectStationId(id: string, label: string): Promise<void> {
  const station = await loadStation(id);
  commit({
    station,
    label,
    km: null,
    point: { lat: station.latitude, lon: station.longitude },
  });
}

/** Re-select a saved favorite by its stored station (stable — no re-snapping). */
export async function selectFavorite(fav: Favorite): Promise<void> {
  if (fav.id) {
    try {
      const station = await loadStation(fav.id);
      commit({ station, label: fav.label, km: null, point: { lat: fav.lat, lon: fav.lon } });
      return;
    } catch {
      /* saved station unavailable — re-snap from the point */
    }
  }
  await selectPoint(fav.lat, fav.lon, isLegacyLabel(fav.label) ? undefined : fav.label);
}
