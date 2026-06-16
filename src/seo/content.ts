/**
 * Pure HTML-string builders for the prerendered station pages. Kept separate
 * from `scripts/prerender.ts` (which does the file I/O) so the markup is
 * unit-testable without a build.
 *
 * The `#app` content this produces is throwaway: `mount()` clears `#app` on boot
 * (see `src/main.ts`), so the SPA overwrites it with the live interactive UI.
 * Only crawlers and no-JS visitors ever see it — which is exactly who we want it
 * for. The build-time tide numbers are therefore "example" data, never shown to
 * a normal user, so they can't go stale in the UI.
 */
import {
  buildDescription,
  buildTitle,
  OG_IMAGE,
  placeLabel,
  SITE_NAME,
  SITE_URL,
  stationJsonLd,
  stationUrl,
  type StationMeta,
} from './meta';

export interface TideRow {
  day: string;
  time: string;
  kind: 'High' | 'Low';
  height: string;
}

export interface NearbyLink {
  name: string;
  slug: string;
  distance: string;
}

export interface ContentOptions {
  datumLabel: string;
  sourceName: string;
  referenceDay: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape a JSON string for safe embedding in `<script type="application/ld+json">`.
 * HTML never parses entities inside a script element, so we can't use `esc()` here;
 * instead neutralise the only sequences that could close the tag (`<`, `>`, `&`) as
 * `\uXXXX` — still valid JSON, but a station name like `</script>` can't break out.
 */
function escJsonLd(json: string): string {
  return json.replace(/[<>&]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** `<head>` tags for a station page — replaces the shell's default SEO block. */
export function buildHeadTags(m: StationMeta, slug: string): string {
  const title = buildTitle(m);
  const desc = buildDescription(m);
  const url = stationUrl(slug);
  const ld = escJsonLd(JSON.stringify(stationJsonLd(m, slug)));
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<script type="application/ld+json">${ld}</script>`,
  ].join('\n    ');
}

/** Crawlable static content injected into `#app` (overwritten by the SPA on boot). */
export function buildAppContent(
  m: StationMeta,
  rows: TideRow[],
  nearby: NearbyLink[],
  opts: ContentOptions,
): string {
  const place = placeLabel(m);
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.day)}</td><td>${esc(r.time)}</td><td>${r.kind}</td><td>${esc(r.height)}</td></tr>`,
    )
    .join('');
  const nearbyHtml = nearby
    .map((n) => `<li><a href="/tides/${n.slug}/">${esc(n.name)}</a> · ${esc(n.distance)}</li>`)
    .join('');

  return `<div class="seo-prerender">
      <h1>${esc(m.name)} Tide Times &amp; Tide Chart</h1>
      <p>Tide predictions for ${esc(place)} (${m.lat.toFixed(4)}, ${m.lon.toFixed(4)}). Heights are shown relative to ${esc(opts.datumLabel)}. Source: ${esc(opts.sourceName)}.</p>
      <h2>Example tide times for ${esc(opts.referenceDay)}</h2>
      <table>
        <thead><tr><th>Day</th><th>Time</th><th>Tide</th><th>Height</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p><strong>${SITE_NAME}</strong> computes live tide predictions on your device — open the page for the current tide state, today's tide chart, and predictions for any future day. No account, no tracking, works offline.</p>
      ${nearby.length ? `<h2>Nearby tide stations</h2>\n      <ul>${nearbyHtml}</ul>` : ''}
      <p><a href="/">${SITE_NAME} — offline-first tide predictions for thousands of coastal locations</a> · <a href="${SITE_URL}/">${SITE_URL}</a></p>
    </div>`;
}
