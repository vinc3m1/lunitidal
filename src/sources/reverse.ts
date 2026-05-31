/**
 * Reverse geocoding (lat/lon → place name). Key-free + CORS via BigDataCloud's
 * reverse-geocode-client endpoint. Online-only and strictly best-effort: it exists
 * so a dropped pin or "use my location" gets a meaningful place name instead of
 * falling back to the snapped station's name. Every caller must tolerate a null
 * result (offline, rate-limited, or no locality) and fall back gracefully.
 */
interface ReverseResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

/**
 * Pure: build "City, Subdivision, Country" from a BigDataCloud response. Returns
 * null when nothing usable is present (e.g. mid-ocean). Unit-tested.
 */
export function parseReverse(data: unknown): string | null {
  const o = (data ?? {}) as ReverseResponse;
  const place = (o.city || o.locality || '').trim();
  const region = (o.principalSubdivision || '').trim();
  const country = (o.countryName || '').trim();
  // Drop a region that just repeats the place (e.g. city-states), keep the order.
  const parts = [place, region === place ? '' : region, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  timeoutMs = 2500,
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return parseReverse(await res.json());
  } catch {
    // Offline, aborted, or malformed — caller falls back to the station name.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
