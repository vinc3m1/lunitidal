/**
 * Minimal history-based router (replaces svelte-spa-router). We switched off hash
 * routing so each station gets a real, crawlable URL `/tides/<slug>/`; hashes are
 * invisible to search engines. Tiny on purpose — the app has only three views plus
 * the dynamic station route.
 *
 * GitHub Pages serves `dist/404.html` (a copy of the SPA shell, written by the
 * prerender step) for any path without a static file, so deep links boot the shell
 * which then routes from `location.pathname` — no query-string redirect hack needed.
 */
import { writable } from 'svelte/store';

export type RouteName = 'home' | 'detail' | 'settings';

function baseUrl(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

/** Strip the deploy base prefix (e.g. a GitHub Pages subpath) → root-relative path. */
function stripBase(p: string): string {
  const b = baseUrl().replace(/\/$/, '');
  let rel = b && p.startsWith(b) ? p.slice(b.length) : p;
  if (!rel.startsWith('/')) rel = `/${rel}`;
  return rel.replace(/\/{2,}/g, '/');
}

/** Prefix the deploy base back onto a root-relative target for history. */
function withBase(to: string): string {
  const b = baseUrl().replace(/\/$/, '');
  if (!b || to.startsWith(b)) return to;
  return `${b}${to}`;
}

function currentPath(): string {
  return typeof location !== 'undefined' ? location.pathname : '/';
}

export const path = writable<string>(currentPath());

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => path.set(currentPath()));
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (typeof history === 'undefined') return;
  const url = withBase(to);
  if (opts.replace) history.replaceState({}, '', url);
  else history.pushState({}, '', url);
  path.set(currentPath());
}

/** Which top-level view a path renders. `/tides/<slug>/` renders Home (the slug just preselects a station). */
export function matchRoute(p: string): RouteName {
  const rel = stripBase(p);
  if (rel === '/detail') return 'detail';
  if (rel === '/settings') return 'settings';
  return 'home';
}

/** The station slug in a `/tides/<slug>/` path, or null for any other path. */
export function stationSlugFromPath(p: string): string | null {
  const m = stripBase(p).match(/^\/tides\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Drop-in replacement for svelte-spa-router's `use:link` action: intercept
 * plain left-clicks on same-document `<a href="/…">` and route client-side.
 */
export function link(node: HTMLAnchorElement) {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const target = node.getAttribute('target');
    if (target && target !== '_self') return;
    const href = node.getAttribute('href');
    if (!href || !href.startsWith('/')) return; // external / hash / mailto: let the browser handle it
    e.preventDefault();
    navigate(href);
  };
  node.addEventListener('click', onClick);
  return {
    destroy() {
      node.removeEventListener('click', onClick);
    },
  };
}
