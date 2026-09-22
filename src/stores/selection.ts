import { get, writable } from 'svelte/store';
import { loadIndex, loadSeedStation, loadStation, nearest } from '../engine/stations';
import { timezoneAt } from '../engine/timezone';
import type { Station } from '../engine/types';
import { buildSlugMap, type SlugMaps } from '../seo/slug';
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

/** Coordinates are sane enough to drive station snapping, fetches, and a zone lookup. */
function validCoords(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

let selectionRequest = 0;

function commit(sel: Selection, request: number): void {
  if (request !== selectionRequest) return;
  selection.set(sel);
  selectionStatus.set('ready');
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
  const request = ++selectionRequest;
  selectionStatus.set('loading');
  const last = get(lastLocation);
  try {
    // `lastLocation` is just a cache of where you were. If its coordinates came back corrupt
    // (a bad/partial write, an old schema), treat it as a miss and self-heal to the default
    // below rather than restoring a broken point.
    if (last && validCoords(last.lat, last.lon)) {
      try {
        const station = await loadStation(last.stationId);
        if (request !== selectionRequest) return;
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
        if (label !== last.label) commit(sel, request);
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
        if (request !== selectionRequest) return;
        commit(await resolvePoint(loc.lat, loc.lon, loc.label), request);
        return;
      } catch {
        /* IP geolocation unavailable — fall back to seed */
      }
    }

    if (request !== selectionRequest) return;
    const station = await loadSeedStation();
    if (request !== selectionRequest) return;
    selection.set({
      station,
      label: station.name,
      km: null,
      point: { lat: station.latitude, lon: station.longitude },
      timezone: station.timezone,
    });
    selectionStatus.set('ready');
  } catch {
    if (request === selectionRequest) selectionStatus.set('error');
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
  const request = ++selectionRequest;
  commit(await resolvePoint(lat, lon, label, timezone), request);
}

async function resolvePoint(
  lat: number, lon: number, label?: string, timezone?: string,
): Promise<Selection> {
  // Fail fast on bad input. These coordinates drive the station snap, the marine fetch, and the
  // stored point — so garbage here means the whole selection is wrong, not just the timezone.
  // (The station-zone fallback below is deliberately *not* a catch-all for this; it only covers a
  // valid point whose zone lookup couldn't load.)
  if (!validCoords(lat, lon)) {
    throw new Error(`Invalid coordinates: ${lat}, ${lon}`);
  }
  const index = await loadIndex();
  const [near] = nearest(index, lat, lon, 1);
  if (!near) throw new Error('No tide station found nearby');
  const [station, resolved, lookedUpTz] = await Promise.all([
    loadStation(near.station.id),
    label ? Promise.resolve(label) : reverseGeocode(lat, lon),
    // Searches already carry the place's zone; for raw pins / geolocation, resolve it from the
    // coordinates (offline) rather than guessing. Skip the lookup when we were handed a zone.
    timezone ? Promise.resolve<string | null>(null) : timezoneAt(lat, lon),
  ]);
  // Display in the chosen location's own zone so times follow the place even when the nearest
  // gauge sits across a timezone line; only fall back to the station's zone as a last resort
  // (e.g. an out-of-range coordinate the lookup can't place).
  return {
    station,
    label: resolved || station.name,
    km: near.km,
    point: { lat, lon },
    timezone: timezone || lookedUpTz || station.timezone,
  };
}

/**
 * id<->slug maps, derived once from the station index (no separate file shipped).
 * The prerender + sitemap scripts build the same map from the same index, so the
 * `/tides/<slug>/` URLs always line up with what the router resolves.
 */
let slugMaps: SlugMaps | null = null;
export async function loadSlugMaps(): Promise<SlugMaps> {
  if (slugMaps) return slugMaps;
  slugMaps = buildSlugMap(await loadIndex());
  return slugMaps;
}

/** Slug for a station id, if the maps are already loaded; null otherwise. */
export function slugForStationId(id: string): string | null {
  return slugMaps?.idToSlug[id] ?? null;
}

/** Resolve a `/tides/<slug>/` deep link to its station and select it. */
export async function selectStationBySlug(slug: string): Promise<void> {
  const request = ++selectionRequest;
  const maps = await loadSlugMaps();
  const id = maps.slugToId[slug];
  if (!id) throw new Error(`Unknown station slug: ${slug}`);
  const index = await loadIndex();
  const entry = index.find((e) => e.id === id);
  if (request !== selectionRequest) return;
  await selectStationId(id, entry?.name ?? id);
}

/** Pick a station directly (offline station search). */
export async function selectStationId(id: string, label: string): Promise<void> {
  const request = ++selectionRequest;
  const station = await loadStation(id);
  commit({
    station,
    label,
    km: null,
    point: { lat: station.latitude, lon: station.longitude },
    timezone: station.timezone,
  }, request);
}

/** Re-select a saved favorite by its stored station (stable — no re-snapping). */
export async function selectFavorite(fav: Favorite): Promise<void> {
  const request = ++selectionRequest;
  if (fav.id) {
    try {
      const station = await loadStation(fav.id);
      // A favorite is user data anchored to a real station — not a throwaway cache. If its stored
      // point is corrupt, salvage the station's own coordinates instead of discarding the saved
      // place (the bad point would otherwise break the marine fetch and map centering too).
      const [lat, lon] = validCoords(fav.lat, fav.lon)
        ? [fav.lat, fav.lon]
        : [station.latitude, station.longitude];
      commit({
        station,
        label: fav.label,
        km: null,
        point: { lat, lon },
        timezone: fav.timezone ?? (await timezoneAt(lat, lon)) ?? station.timezone,
      }, request);
      return;
    } catch {
      /* saved station unavailable — re-snap from the point */
    }
  }
  commit(await resolvePoint(
    fav.lat,
    fav.lon,
    isLegacyLabel(fav.label) ? undefined : fav.label,
    fav.timezone,
  ), request);
}
