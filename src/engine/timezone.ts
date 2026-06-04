/**
 * Coordinate → IANA timezone, fully offline. Tides are predicted from the nearest gauge, but
 * times are displayed in the *chosen location's* zone — which can differ from the gauge's when
 * the snap crosses a timezone line. The place-search geocoder already returns a zone for searched
 * places; this fills the gap for dropped pins and "use my location", which carry only coordinates.
 *
 * Backed by `tz-lookup` (~28 KB gzipped, pure-JS, zero deps). Loaded lazily so it stays out of the
 * initial bundle — startup restores the persisted zone, so the lookup is only needed when the user
 * picks a brand-new point. The chunk is precached by the service worker, so it still works offline.
 */
type TzLookup = (lat: number, lon: number) => string;
let _lookup: TzLookup | null = null;

/** Resolve the IANA timezone for a coordinate, or null when it can't be determined. */
export async function timezoneAt(lat: number, lon: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    if (!_lookup) {
      const mod = (await import('tz-lookup')) as unknown as { default?: TzLookup };
      _lookup = mod.default ?? (mod as unknown as TzLookup);
    }
    return _lookup(lat, lon) || null;
  } catch {
    // Out-of-range coords or a load failure — caller falls back to the station's zone.
    return null;
  }
}
