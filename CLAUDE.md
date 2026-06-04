# CLAUDE.md

Non-obvious things to know when working in this repo. General build/test/run steps and
project layout are in **README.md → Contributing**; this file only covers what isn't
apparent from there or the code.

## Gotchas that will bite you

- **Never import `@neaps/tide-database` in browser code.** It's ~48 MB. Only
  `scripts/build-station-index.ts` (Bun, build time) reads it, emitting the small files in
  `public/data/`. Browser code reads those static files via `src/engine/stations.ts`.

- **Station ids contain slashes** (e.g. `ticon/benoa-163-idn-uhslc_fd`). Filenames use
  `stationFileSlug()` in `src/engine/paths.ts`; the extractor and the runtime loader must
  use the same function — change one, change both.

- **`persisted()` and arrays.** `src/stores/persisted.ts` deliberately does *not*
  object-spread-merge array stores. Merging `{...[]}` turns an array into an object and
  crashed `favorites` (`.some is not a function`) on reload. Keep arrays as arrays.

- **Timezone:** pass real `Date` instants (absolute UTC) to the predictor — never
  local-wall-clock Dates. Convert to an IANA timezone only for *display* (`src/engine/time.ts`).
  The display zone is the **selected location's**, not the snapped gauge's — they differ when the
  nearest station sits across a timezone line. It's resolved on `Selection.timezone`: the
  place-search geocoder already returns a zone; dropped pins / "use my location" resolve it from
  coordinates via `timezoneAt()` (`src/engine/timezone.ts`, backed by the offline `tz-lookup` lib,
  lazy-loaded). The station's own `timezone` is only the last-resort fallback. Open-Meteo (marine)
  is always fetched with `timezone=UTC` so the wave cell's zone never leaks into display.

- **Datum:** build the predictor with `offset: 0` (heights are MSL-relative) and apply the
  chart-datum offset in the display layer (`src/engine/datum.ts`). Don't bake datum into the
  predictor — the UI lets users switch reference levels live.

- **Expected inaccuracy:** Benoa heights run ~0.3–0.5 m above the official port tables.
  That's the TICON-4 (UHSLC gauge) analysis differing from the port solution — not a bug.
  Engine tests assert timing + shape, not exact heights.

## Architecture intent

- `src/engine/` is pure and DOM-free on purpose (testable; portable). Keep prediction,
  datum, timezone, units, and station lookup there. Svelte is only chrome + state.
- Routing is **hash-based** (`svelte-spa-router`) so it works under the GitHub Pages
  subpath without server config.
- **Subordinate stations:** These do not have harmonic constituents and are filtered out at build time (by `scripts/build-station-index.ts`) because the `@neaps/tide-predictor` requires constituents to perform predictions on-device. When a user searches for a subordinate beach, the app automatically snaps to the nearest reference station. (TODO: Add native support for subordinate time/height offsets by warping reference curves).
- **Marine "sample" label:** Open-Meteo's wave models only cover *water* on a coarse grid, so the API snaps each request to the nearest sea cell — sometimes km away from an inland/bayside point. `MarineCard.svelte` surfaces that as `~<dist> <bearing>` (e.g. `~2.8 km SSE`) using `haversineKm`/`bearingDeg`/`compass16` from the engine; the bearing points *from the chosen point toward the cell*, so it is **not** "distance to shore". The in-card ⓘ popover explains this to users (self-contained — no external link, so it works offline); the same explanation for repo readers lives in README → [Marine forecast](README.md#marine-forecast-waves--swell).

## Testing notes

- E2E (`tests/e2e`) run against a production `vite preview`, **not** `bun run dev` — the
  service worker is disabled in dev, so offline tests need the real build.
- The `fixtures.ts` auto console-error guard is load-bearing: it turns "app threw on
  reload" into a failing test. Don't weaken it; if an external resource error is noisy,
  add it to the ignore regex there rather than removing the check.
- First load calls geojs.io for an approximate IP default location. The e2e fixture
  (`tests/e2e/fixtures.ts`) aborts that route so the default is deterministically the Benoa
  seed; a test wanting the IP path registers its own `page.route(/get\.geojs\.io/, …)` first.
- Always add/update tests (unit tests in `src/` or E2E tests in `tests/e2e/`) when fixing bugs or implementing new features to ensure coverage remains high and prevents regressions.
- Verify changes with `bun run test:all` before committing.
