/**
 * Thin wrapper around the browser Geolocation API.
 *
 * There is deliberately no "geolocation" entry in the web app manifest — the
 * manifest has no field that grants or affects geolocation. Permission is
 * mediated entirely by the browser/OS. On an installed Android PWA (a Chrome
 * WebAPK) the location prompt is delegated to Android, so a denial here can
 * mean the OS-level app permission is off, not just a per-site choice. The
 * message mapping below turns the terse `GeolocationPositionError` text into
 * something a user can act on.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

// Numeric codes are stable across browsers; the named constants aren't always
// present on the prototype in every engine, so compare against the numbers.
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

/** Turn a GeolocationPositionError into an actionable, human-readable message. */
export function geolocationErrorMessage(err: { code?: number; message?: string }): string {
  switch (err.code) {
    case PERMISSION_DENIED:
      // The common Android-PWA failure: site allowed, but the OS app
      // permission is off, or the user dismissed/denied the prompt.
      return 'Location permission denied. Allow location for this app in your device settings (Settings → Apps → Lunitidal → Permissions → Location), then try again.';
    case POSITION_UNAVAILABLE:
      return "Couldn't determine your location. Check that location services are turned on.";
    case TIMEOUT:
      return 'Timed out finding your location. Try again, or search for a place instead.';
    default:
      return err.message || 'Geolocation failed';
  }
}

/**
 * Resolve the current position as a plain {lat, lon}, rejecting with a friendly
 * Error message. Defaults favour a fast network/wifi fix and tolerate a
 * slightly stale reading, which matters on Android where a fresh GPS lock can
 * exceed a short timeout.
 */
export function getCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(geolocationErrorMessage(err))),
      options,
    );
  });
}
