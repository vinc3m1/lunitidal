/**
 * Sun position & sunrise/sunset — pure, DOM-free, no network. Heights come from the tide
 * predictor; the sun curve is plain astronomy from lat/lon + date, so we compute it on-device
 * (microseconds) rather than fetching it. The algorithm is the standard NOAA / SunCalc solar
 * model (mean anomaly → ecliptic longitude → declination → hour angle), accurate to well under
 * a minute for our display purposes.
 *
 * Everything here works in absolute UTC `Date` instants, exactly like the predictor. Convert to
 * a display timezone only in the view layer (`formatTime`).
 */

const rad = Math.PI / 180;
const dayMs = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const obliquity = rad * 23.4397; // obliquity of the ecliptic

// Civil-daylight thresholds (sun altitude, radians):
//  - upper limb at the horizon, refraction-corrected → "sunrise"/"sunset"
//  - 6° below → end of civil twilight, the point we treat as "fully dark".
const ALT_SUNRISE = -0.833 * rad;
const ALT_CIVIL = -6 * rad;

function toJulian(date: Date): number {
  return date.getTime() / dayMs - 0.5 + J1970;
}
function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * dayMs);
}
function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(d: number): number {
  return rad * (357.5291 + 0.98560028 * d);
}
function eclipticLongitude(M: number): number {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372; // perihelion of the Earth
  return M + C + P + Math.PI;
}
function declination(l: number): number {
  return Math.asin(Math.sin(obliquity) * Math.sin(l));
}
function rightAscension(l: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(obliquity), Math.cos(l));
}
function siderealTime(d: number, lw: number): number {
  return rad * (280.16 + 360.9856235 * d) - lw;
}

/** Sun altitude (radians) above the horizon at an instant, for the given coordinates. */
export function sunAltitude(date: Date, lat: number, lon: number): number {
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(date);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}

export interface SunTimes {
  /** Sun crosses the horizon going up. `null` during polar day/night. */
  sunrise: Date | null;
  /** Sun crosses the horizon going down. `null` during polar day/night. */
  sunset: Date | null;
  /** Sun stays above the horizon for the whole local day (midnight sun). */
  alwaysUp: boolean;
  /** Sun never reaches the horizon for the whole local day (polar night). */
  alwaysDown: boolean;
}

// SunCalc set/rise solver, specialised to the sunrise altitude.
const J0 = 0.0009;
function julianCycle(d: number, lw: number): number {
  return Math.round(d - J0 - lw / (2 * Math.PI));
}
function approxTransit(Ht: number, lw: number, n: number): number {
  return J0 + (Ht + lw) / (2 * Math.PI) + n;
}
function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}
function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
}

/**
 * Sunrise/sunset for the local day containing `noon` (pass an instant near the location's local
 * noon — e.g. the midpoint of the chart's day window). Returns `null` times with `alwaysUp` /
 * `alwaysDown` set during polar day/night.
 */
export function sunTimes(noon: Date, lat: number, lon: number): SunTimes {
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(noon);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);

  const w = hourAngle(ALT_SUNRISE, phi, dec);
  if (Number.isNaN(w)) {
    // No horizon crossing this day: decide which polar regime from the noon altitude.
    const noonAlt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec));
    const up = noonAlt > ALT_SUNRISE;
    return { sunrise: null, sunset: null, alwaysUp: up, alwaysDown: !up };
  }

  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  const Jrise = Jnoon - (Jset - Jnoon);
  return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset), alwaysUp: false, alwaysDown: false };
}

export interface SunStop {
  /** Position across the [start, end] window, 0..1. */
  offset: number;
  /** Night intensity, 0 (full daylight) .. 1 (fully dark, ≤ civil twilight). */
  intensity: number;
}

/** Map a sun altitude to night intensity: 0 at/above sunrise level, 1 at/below civil twilight. */
function nightIntensity(altRad: number): number {
  const t = (ALT_SUNRISE - altRad) / (ALT_SUNRISE - ALT_CIVIL);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Gradient stops describing the day → twilight → night shading across a chart's time window.
 * Samples the sun altitude every `stepMin` minutes and collapses flat runs, so a normal day
 * yields a handful of stops (one fade down at dusk, one up at dawn) while polar day/night and
 * "white nights" fall out naturally with no special-casing. Offsets are 0..1 across
 * `[startMs, endMs]`, ready to drive an SVG horizontal `<linearGradient>`.
 *
 * Returns `[]` when the whole window is daylight (nothing to shade).
 */
export function sunBandStops(
  startMs: number,
  endMs: number,
  lat: number,
  lon: number,
  stepMin = 10,
): SunStop[] {
  const span = endMs - startMs;
  if (span <= 0) return [];
  const stepMs = stepMin * 60_000;
  const steps = Math.max(2, Math.ceil(span / stepMs));

  const samples: SunStop[] = [];
  let maxIntensity = 0;
  for (let i = 0; i <= steps; i++) {
    const ms = startMs + (span * i) / steps;
    const intensity = Math.round(nightIntensity(sunAltitude(new Date(ms), lat, lon)) * 1000) / 1000;
    samples.push({ offset: i / steps, intensity });
    if (intensity > maxIntensity) maxIntensity = intensity;
  }
  if (maxIntensity === 0) return []; // all daylight

  // Drop interior points inside a flat run; keep run boundaries (and both ends) so the
  // gradient stays piecewise-linear with as few stops as possible.
  return samples.filter((s, i) => {
    if (i === 0 || i === samples.length - 1) return true;
    return s.intensity !== samples[i - 1].intensity || s.intensity !== samples[i + 1].intensity;
  });
}
