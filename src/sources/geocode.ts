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

const US_STATES: Record<string, string> = {
  al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California',
  co: 'Colorado', ct: 'Connecticut', de: 'Delaware', fl: 'Florida', ga: 'Georgia',
  hi: 'Hawaii', id: 'Idaho', il: 'Illinois', in: 'Indiana', ia: 'Iowa',
  ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana', me: 'Maine', md: 'Maryland',
  ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota', ms: 'Mississippi', mo: 'Missouri',
  mt: 'Montana', ne: 'Nebraska', nv: 'Nevada', nh: 'New Hampshire', nj: 'New Jersey',
  nm: 'New Mexico', ny: 'New York', nc: 'North Carolina', nd: 'North Dakota', oh: 'Ohio',
  ok: 'Oklahoma', or: 'Oregon', pa: 'Pennsylvania', ri: 'Rhode Island', sc: 'South Carolina',
  sd: 'South Dakota', tn: 'Tennessee', tx: 'Texas', ut: 'Utah', vt: 'Vermont',
  va: 'Virginia', wa: 'Washington', wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming'
};

/** Pure mapping of the Open-Meteo geocoding response → our shape. Unit-tested. */
export function parseGeoResults(data: unknown): GeoResult[] {
  const results = (data as { results?: Array<Record<string, unknown>> } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    admin1: r.admin1 as string | undefined,
    country: r.country as string | undefined,
    lat: r.latitude as number,
    lon: r.longitude as number,
  }));
}

export async function geocode(query: string, count = 6): Promise<GeoResult[]> {
  let cleaned = query.trim();
  let stateFilter: string | undefined;

  // Extract trailing 2-letter state code (e.g. "oakland ca" -> city "oakland", state "California")
  const stateMatch = cleaned.match(/\s+([a-zA-Z]{2})$/);
  if (stateMatch) {
    const code = stateMatch[1].toLowerCase();
    if (US_STATES[code]) {
      cleaned = cleaned.replace(/\s+([a-zA-Z]{2})$/, '').trim();
      stateFilter = US_STATES[code];
    }
  }

  const url =
    `https://geocoding-api.open-meteo.com/v1/search` +
    `?name=${encodeURIComponent(cleaned)}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  
  const results = parseGeoResults(await res.json());

  // Prioritize matches that are in the specified US state
  if (stateFilter) {
    results.sort((a, b) => {
      const aMatch = a.admin1?.toLowerCase() === stateFilter?.toLowerCase();
      const bMatch = b.admin1?.toLowerCase() === stateFilter?.toLowerCase();
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return 0;
    });
  }

  return results;
}

/** "Uluwatu, Bali, Indonesia" from a geocoder result. */
export function geoLabel(r: GeoResult): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ');
}
