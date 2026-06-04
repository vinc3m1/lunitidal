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
  /** IANA timezone of the place (e.g. "Asia/Makassar"). Used so times follow the
   *  chosen location, not the snapped tide station, when the two differ. */
  timezone?: string;
}

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
    timezone: r.timezone as string | undefined,
  }));
}

/** Generically match a 2-letter suffix against a text segment using prefix or initials matching. */
export function matchesSuffix(text: string | undefined, suffix: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  const s = suffix.toLowerCase().trim();
  
  // 1. Prefix match (e.g. "California" starts with "ca")
  if (t.startsWith(s)) return true;
  
  // 2. Initials match (e.g. "New York" -> initials "ny" matches "ny")
  const initials = t.split(/\s+/).map(word => word[0]).join('');
  if (initials === s) return true;
  
  return false;
}

export async function geocode(query: string, count = 6): Promise<GeoResult[]> {
  let cleaned = query.trim();
  let suffix: string | undefined;

  // Extract trailing 2-letter code (e.g. "oakland ca" -> city "oakland", suffix "ca")
  const suffixMatch = cleaned.match(/\s+([a-zA-Z]{2})$/);
  if (suffixMatch) {
    suffix = suffixMatch[1].toLowerCase();
    cleaned = cleaned.replace(/\s+([a-zA-Z]{2})$/, '').trim();
  }

  const fetchResults = async (q: string): Promise<GeoResult[]> => {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    return parseGeoResults(await res.json());
  };

  let results = await fetchResults(cleaned);

  // Fallback: If no results were found, we didn't already extract a 2-letter suffix,
  // and the query contains spaces, try treating the last word as a longer suffix (e.g. "cali" or "california").
  if (results.length === 0 && !suffix && cleaned.includes(' ')) {
    const lastSpaceIndex = cleaned.lastIndexOf(' ');
    const possiblePrefix = cleaned.substring(0, lastSpaceIndex).trim();
    const possibleSuffix = cleaned.substring(lastSpaceIndex + 1).trim();

    // Suffix must be at least 2 letters and only alphabetic characters
    if (possiblePrefix && /^[a-zA-Z]{2,}$/.test(possibleSuffix)) {
      try {
        const fallbackResults = await fetchResults(possiblePrefix);
        if (fallbackResults.length > 0) {
          suffix = possibleSuffix.toLowerCase();
          results = fallbackResults;
        }
      } catch {
        // Ignore fallback errors and return the original empty results
      }
    }
  }

  // Prioritize matches that align with the suffix in the state or country fields
  if (suffix) {
    results.sort((a, b) => {
      const aMatch = matchesSuffix(a.admin1, suffix!) || matchesSuffix(a.country, suffix!);
      const bMatch = matchesSuffix(b.admin1, suffix!) || matchesSuffix(b.country, suffix!);
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
