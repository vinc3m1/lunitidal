import { afterEach, describe, expect, it, vi } from 'vitest';
import { link, matchRoute, navigate, stationSlugFromPath } from './router';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('router', () => {
  it('accepts trailing slashes on settings and source pages', () => {
    expect(matchRoute('/settings/')).toBe('settings');
    expect(matchRoute('/detail/')).toBe('detail');
  });

  it('treats malformed percent escapes as an unknown route without crashing', () => {
    expect(stationSlugFromPath('/tides/%E0%A4/')).toBeNull();
    expect(stationSlugFromPath('/tides/benoa-indonesia/')).toBe('benoa-indonesia');
  });

  it('matches deployment bases on a complete path segment', () => {
    vi.stubEnv('BASE_URL', '/tide/');
    expect(stationSlugFromPath('/tide/tides/benoa/')).toBe('benoa');
    expect(stationSlugFromPath('/tides/benoa/')).toBe('benoa');
    const pushState = vi.fn();
    vi.stubGlobal('history', { pushState });
    navigate('/tides/benoa/');
    expect(pushState).toHaveBeenCalledWith({}, '', '/tide/tides/benoa/');
  });

  it('preserves native modified clicks and protocol-relative external links', () => {
    const handlers: Record<string, (e: any) => void> = {};
    const attrs = new Map([['href', '/settings']]);
    const node = {
      getAttribute: (key: string) => attrs.get(key) ?? null,
      setAttribute: (key: string, value: string) => attrs.set(key, value),
      hasAttribute: (key: string) => attrs.has(key),
      addEventListener: (key: string, fn: (e: any) => void) => { handlers[key] = fn; },
      removeEventListener: vi.fn(),
    };
    vi.stubEnv('BASE_URL', '/app/');
    const action = link(node as unknown as HTMLAnchorElement);
    expect(attrs.get('href')).toBe('/app/settings');
    const preventDefault = vi.fn();
    handlers.click({ button: 0, ctrlKey: true, preventDefault });
    attrs.set('href', '//example.com/settings');
    handlers.click({ button: 0, preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    action.destroy();
    expect(node.removeEventListener).toHaveBeenCalled();
  });
});
