/**
 * Shared, framework-agnostic path helpers used by BOTH the build-time extractor
 * (Bun/Node) and the runtime loader (browser). Station ids can contain slashes
 * (e.g. "noaa/1610367"), which are not valid in flat filenames — slug them.
 */

/** Map a station id to a flat, filesystem-safe basename (no extension). */
export function stationFileSlug(id: string): string {
  return id.replace(/\//g, '__');
}

/** Path (relative to the public/ root) of a station's full record. */
export function stationFileRelPath(id: string): string {
  return `data/stations/${stationFileSlug(id)}.json`;
}
