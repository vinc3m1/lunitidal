import { afterEach, describe, expect, it, vi } from 'vitest';
import { geolocationErrorMessage, getCurrentPosition } from './geolocate';

describe('geolocationErrorMessage', () => {
  it('gives actionable guidance for a denied permission (the Android PWA case)', () => {
    const msg = geolocationErrorMessage({ code: 1, message: 'User denied Geolocation' });
    expect(msg).toMatch(/permission denied/i);
    expect(msg).toMatch(/settings/i);
  });

  it('explains an unavailable position', () => {
    expect(geolocationErrorMessage({ code: 2, message: '' })).toMatch(/location services/i);
  });

  it('explains a timeout', () => {
    expect(geolocationErrorMessage({ code: 3, message: '' })).toMatch(/timed out/i);
  });

  it('falls back to the raw message for unknown codes', () => {
    expect(geolocationErrorMessage({ code: 99, message: 'boom' })).toBe('boom');
    expect(geolocationErrorMessage({})).toBe('Geolocation failed');
  });
});

describe('getCurrentPosition', () => {
  const original = globalThis.navigator;
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
  });

  function stubNavigator(geolocation: unknown) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation },
      configurable: true,
    });
  }

  it('resolves to a plain {lat, lon}', async () => {
    stubNavigator({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: 1.5, longitude: -2.5 } } as GeolocationPosition),
    });
    await expect(getCurrentPosition()).resolves.toEqual({ lat: 1.5, lon: -2.5 });
  });

  it('rejects with a friendly message on error', async () => {
    stubNavigator({
      getCurrentPosition: (_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
    });
    await expect(getCurrentPosition()).rejects.toThrow(/permission denied/i);
  });

  it('rejects when geolocation is unsupported', async () => {
    stubNavigator(undefined);
    await expect(getCurrentPosition()).rejects.toThrow(/not available/i);
  });
});
