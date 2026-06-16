/**
 * Shared SEO metadata builders. Used by BOTH the build-time prerender script
 * (Bun) and the client `<svelte:head>` so the static and dynamic titles agree.
 * Pure + DOM-free — no Svelte, no Node.
 */

export const SITE_URL = 'https://www.lunitidal.app';
export const SITE_NAME = 'Lunitidal';
export const OG_IMAGE = `${SITE_URL}/icons/icon-512.png`;

export interface StationMeta {
  name: string;
  region?: string | null;
  country: string;
  lat: number;
  lon: number;
}

/** "Benoa, Bali, Indonesia" — region omitted when absent. */
export function placeLabel(m: StationMeta): string {
  return [m.name, m.region, m.country].filter(Boolean).join(', ');
}

export function buildTitle(m: StationMeta): string {
  return `${m.name} Tide Times & Tide Chart — ${SITE_NAME}`;
}

export function buildDescription(m: StationMeta): string {
  return `Tide predictions for ${placeLabel(m)}: today's high and low tide times and an interactive tide chart, computed on your device. Free, offline-first, no tracking.`;
}

export function stationUrl(slug: string): string {
  return `${SITE_URL}/tides/${slug}/`;
}

/** schema.org graph: the location as a Place, plus a breadcrumb to the home app. */
export function stationJsonLd(m: StationMeta, slug: string): object {
  const url = stationUrl(slug);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        '@id': `${url}#place`,
        name: m.name,
        url,
        address: {
          '@type': 'PostalAddress',
          addressCountry: m.country,
          ...(m.region ? { addressRegion: m.region } : {}),
        },
        geo: { '@type': 'GeoCoordinates', latitude: m.lat, longitude: m.lon },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: m.country },
          { '@type': 'ListItem', position: 3, name: m.name, item: url },
        ],
      },
    ],
  };
}

/** schema.org WebApplication node for the home / shell page. */
export function siteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: 'Offline-first tide predictions, computed on-device.',
    applicationCategory: 'Weather',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}
