/**
 * Open-Meteo Marine API (key-free, CORS). A separate, online-only layer on top of
 * the astronomical tide — waves & swell. Degrades gracefully: callers handle offline
 * and the "no marine data for this location" case (inland/enclosed points).
 */
export interface MarinePoint {
  time: Date;
  waveHeight: number | null;
  swellHeight: number | null;
  swellPeriod: number | null;
}

export interface MarineData {
  points: MarinePoint[];
  /** Highest-wave hour within the window (for the at-a-glance summary). */
  peak: MarinePoint | null;
}

interface MarineResponse {
  hourly?: {
    time?: string[];
    wave_height?: (number | null)[];
    swell_wave_height?: (number | null)[];
    swell_wave_period?: (number | null)[];
  };
}

/**
 * Pure: window the hourly response to [start, end) and find the peak-wave hour.
 * Unit-tested (UTC parsing, windowing, null handling, peak selection).
 */
export function parseMarine(data: unknown, start: Date, end: Date): MarineData {
  const h = (data as MarineResponse | null)?.hourly;
  if (!h?.time) return { points: [], peak: null };

  const startMs = start.getTime();
  const endMs = end.getTime();
  const points: MarinePoint[] = [];
  for (let i = 0; i < h.time.length; i++) {
    // timezone=UTC → "YYYY-MM-DDTHH:mm"; append Z to parse as a UTC instant.
    const t = new Date(`${h.time[i]}Z`);
    const ms = t.getTime();
    if (ms < startMs || ms >= endMs) continue;
    points.push({
      time: t,
      waveHeight: h.wave_height?.[i] ?? null,
      swellHeight: h.swell_wave_height?.[i] ?? null,
      swellPeriod: h.swell_wave_period?.[i] ?? null,
    });
  }

  let peak: MarinePoint | null = null;
  for (const p of points) {
    if (p.waveHeight == null) continue;
    if (!peak || (peak.waveHeight ?? -1) < p.waveHeight) peak = p;
  }
  return { points, peak };
}

export async function getMarine(
  lat: number,
  lon: number,
  start: Date,
  end: Date,
): Promise<MarineData> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: 'wave_height,swell_wave_height,swell_wave_period',
    timezone: 'UTC',
  });
  const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`);
  if (!res.ok) throw new Error(`Marine API failed (${res.status})`);
  return parseMarine(await res.json(), start, end);
}
