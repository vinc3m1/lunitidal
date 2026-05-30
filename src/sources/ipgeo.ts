/**
 * Approximate, silent IP-based geolocation for choosing a sensible default location
 * on a first visit (no permission prompt). Key-free + CORS via geojs.io. Online-only;
 * callers fall back to the bundled seed when it fails or times out.
 */
export interface IpLocation {
  lat: number;
  lon: number;
  label: string;
}

/** Pure parse of the geojs (and ipapi-shaped) response. Unit-tested. */
export function parseIpLocation(data: unknown): IpLocation {
  const o = (data ?? {}) as Record<string, unknown>;
  const lat = Number(o.latitude);
  const lon = Number(o.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('No IP location in response');
  }
  const city = (o.city as string) || '';
  const country = (o.country as string) || (o.country_name as string) || '';
  const label = [city, country].filter(Boolean).join(', ') || 'Near you';
  return { lat, lon, label };
}

export async function getIpLocation(timeoutMs = 2500): Promise<IpLocation> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller.signal });
    if (!res.ok) throw new Error(`IP geolocation failed (${res.status})`);
    return parseIpLocation(await res.json());
  } finally {
    clearTimeout(timer);
  }
}
