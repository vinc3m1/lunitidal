/**
 * Human-readable, SEO-friendly station slugs (e.g. "benoa-indonesia") and a
 * deterministic, collision-free bijection between station ids and slugs.
 *
 * This is a SEPARATE concept from `stationFileSlug()` in `src/engine/paths.ts`:
 * that one keeps a filesystem-safe basename for the data files; this one is the
 * pretty `/tides/<slug>/` URL segment. Both the build-time prerender/sitemap
 * scripts (Bun) and the runtime router (browser) build the map from the SAME
 * `stations-index.json`, so they always agree — no extra file is shipped.
 */

export interface SlugEntry {
  id: string;
  name: string;
  region?: string | null;
  country: string;
}

export interface SlugMaps {
  slugToId: Record<string, string>;
  idToSlug: Record<string, string>;
}

/** Lowercase, strip diacritics, collapse non-alphanumerics to single hyphens. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Base slug for a station: "<name>-<country>", falling back to the id. */
export function stationSeoSlug(entry: SlugEntry): string {
  return slugify(`${entry.name} ${entry.country}`) || slugify(entry.id) || 'station';
}

/**
 * Build the id<->slug maps. Iterate ids in a stable sorted order so that the
 * collision-resolution (region qualifier, then numeric suffix) is identical at
 * build time and at runtime regardless of array order.
 */
export function buildSlugMap(index: SlugEntry[]): SlugMaps {
  const slugToId: Record<string, string> = {};
  const idToSlug: Record<string, string> = {};
  const sorted = [...index].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const e of sorted) {
    const base = stationSeoSlug(e);
    const candidates = [base];
    if (e.region) candidates.push(slugify(`${e.name} ${e.region} ${e.country}`));

    let slug = candidates.find((c) => c && !(c in slugToId));
    if (!slug) {
      let n = 2;
      while (`${base}-${n}` in slugToId) n++;
      slug = `${base}-${n}`;
    }

    slugToId[slug] = e.id;
    idToSlug[e.id] = slug;
  }

  return { slugToId, idToSlug };
}
