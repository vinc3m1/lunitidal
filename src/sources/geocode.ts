/**
 * Open-Meteo geocoding (key-free, CORS-enabled). The ONE online dependency for
 * place-name search. Resolves at town/place level. Degrades gracefully: callers
 * should catch and fall back to offline station-name search when offline.
 */
export interface GeoResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
}

export async function geocode(query: string, count = 6): Promise<GeoResult[]> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).map((r) => ({
    id: r.id as number,
    name: r.name as string,
    admin1: r.admin1 as string | undefined,
    country: r.country as string | undefined,
    lat: r.latitude as number,
    lon: r.longitude as number,
  }));
}

/** "Uluwatu, Bali, Indonesia" from a geocoder result. */
export function geoLabel(r: GeoResult): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ');
}
