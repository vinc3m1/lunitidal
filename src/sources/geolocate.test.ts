import { afterEach, describe, expect, it } from 'vitest';
import {
  geolocationErrorMessage,
  geolocationPermissionState,
  getCurrentPosition,
} from './geolocate';

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
  const originalNav = globalThis.navigator;
  const originalWin = (globalThis as { window?: unknown }).window;
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNav, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: originalWin, configurable: true });
  });

  function stubNavigator(geolocation: unknown, permissions?: unknown) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { geolocation, permissions },
      configurable: true,
    });
  }

  function stubWindow(isSecureContext: boolean) {
    Object.defineProperty(globalThis, 'window', {
      value: { isSecureContext },
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

  it('rejects without prompting on an insecure context (the "never requested" case)', async () => {
    let called = false;
    stubNavigator({
      getCurrentPosition: () => {
        called = true;
      },
    });
    stubWindow(false);
    await expect(getCurrentPosition()).rejects.toThrow(/secure \(https\) connection/i);
    expect(called).toBe(false); // never reached the browser API → no prompt
  });
});

describe('geolocationPermissionState', () => {
  const originalNav = globalThis.navigator;
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNav, configurable: true });
  });

  it('returns "unsupported" when the Permissions API is missing', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    await expect(geolocationPermissionState()).resolves.toBe('unsupported');
  });

  it('returns the queried state when supported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { permissions: { query: async () => ({ state: 'denied' }) } },
      configurable: true,
    });
    await expect(geolocationPermissionState()).resolves.toBe('denied');
  });
});
