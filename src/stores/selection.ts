import { get, writable } from 'svelte/store';
import { loadIndex, loadSeedStation, loadStation, nearest } from '../engine/stations';
import type { Station } from '../engine/types';
import { getIpLocation } from '../sources/ipgeo';
import { reverseGeocode } from '../sources/reverse';
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
  /**
   * IANA timezone to display times in. This follows the *chosen location* (e.g. from the
   * geocoder), not the snapped station — they can differ when the nearest gauge sits across
   * a timezone line. Falls back to the station's timezone when the point's zone is unknown.
   */
  timezone: string;
}

export const selection = writable<Selection | null>(null);
export const selectionStatus = writable<'loading' | 'ready' | 'error'>('loading');

interface LastLocation {
  stationId: string;
  label: string;
  km: number | null;
  lat: number;
  lon: number;
  /** Optional for back-compat: older saves predate per-location timezones. */
  timezone?: string;
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
    timezone: sel.timezone,
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
        const sel = {
          station,
          label,
          km: last.km,
          point: { lat: last.lat, lon: last.lon },
          timezone: last.timezone ?? station.timezone,
        };
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
      timezone: station.timezone,
    });
    selectionStatus.set('ready');
  } catch {
    selectionStatus.set('error');
  }
}

/**
 * Pick an arbitrary point (geolocation / geocoder / IP) and snap to the nearest station.
 * `label` is the meaningful place name when the caller already has one (a searched place,
 * an IP city). When it doesn't (raw geolocation, a dropped pin) we reverse-geocode the
 * point so the title reads "Sanur, Bali" rather than the snapped station's name — making
 * it obvious that the location and the tide station are two different places. The reverse
 * lookup runs concurrently with the station load and is best-effort: offline or on failure
 * it returns null and we fall back to the station name (the previous behaviour).
 */
export async function selectPoint(
  lat: number,
  lon: number,
  label?: string,
  timezone?: string,
): Promise<void> {
  const index = await loadIndex();
  const [near] = nearest(index, lat, lon, 1);
  if (!near) throw new Error('No tide station found nearby');
  const [station, resolved] = await Promise.all([
    loadStation(near.station.id),
    label ? Promise.resolve(label) : reverseGeocode(lat, lon),
  ]);
  // Prefer the chosen location's own timezone (e.g. from the geocoder) so times follow the
  // place even when the nearest gauge sits in another zone; fall back to the station's.
  commit({
    station,
    label: resolved || station.name,
    km: near.km,
    point: { lat, lon },
    timezone: timezone || station.timezone,
  });
}

/** Pick a station directly (offline station search). */
export async function selectStationId(id: string, label: string): Promise<void> {
  const station = await loadStation(id);
  commit({
    station,
    label,
    km: null,
    point: { lat: station.latitude, lon: station.longitude },
    timezone: station.timezone,
  });
}

/** Re-select a saved favorite by its stored station (stable — no re-snapping). */
export async function selectFavorite(fav: Favorite): Promise<void> {
  if (fav.id) {
    try {
      const station = await loadStation(fav.id);
      commit({
        station,
        label: fav.label,
        km: null,
        point: { lat: fav.lat, lon: fav.lon },
        timezone: fav.timezone ?? station.timezone,
      });
      return;
    } catch {
      /* saved station unavailable — re-snap from the point */
    }
  }
  await selectPoint(
    fav.lat,
    fav.lon,
    isLegacyLabel(fav.label) ? undefined : fav.label,
    fav.timezone,
  );
}
