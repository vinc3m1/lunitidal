# Lunitidal

Tide predictions that work offline, computed right in your browser. No account, no API
keys, no tracking.

**→ [Open the app](https://vinc3m1.github.io/lunitidal/)**

Install it to your home screen and it keeps working without a connection.

## What it does

- **Now + next:** whether the tide is rising or falling, the current height, and a
  countdown to the next high or low.
- **Scrub the day:** drag across the chart — or use the arrow keys — to read the predicted
  tide at any moment. Times are labelled with the station's timezone, so they're never
  mistaken for your own clock.
- **Pick anywhere:** use your location, search for a place or beach, or tap the map.
  Lunitidal snaps to the nearest tide station and tells you how far away it is and how
  trustworthy the match is. On a first visit it guesses your region from your IP and
  starts there (falling back to Benoa, Bali).
- **Waves & swell:** an optional marine forecast layered on top of the astronomical tide
  (needs a connection; degrades gracefully offline).
- **Make it yours:** save favorite spots and set your units (m/ft, km/mi), time format,
  theme, and chart datum.

## How to use it

1. Open the app. It starts at an approximate location based on your IP (or Benoa, Bali, if
   that's unavailable), then remembers your last location next time.
2. Tap **Change** to use your location, search a place/beach/station, or open the map.
3. Read the big readout for the current state; drag the chart to see any time of day; use
   ‹ › to move between days, or tap the date to jump back to today.
4. Tap **ⓘ Source & accuracy** to see which station the data comes from, switch the chart
   datum, and view the underlying harmonic constituents.
5. Tap **☆** to save a spot; manage saved spots and preferences in **Settings** (⚙).

## A note on accuracy

Predictions are **astronomical only** — the regular rise and fall driven by the moon and
sun. They don't include weather effects (wind, pressure, storm surge), and they come from
the *nearest* tide station, which may be some distance from your exact spot. Treat them as
a good guide, **not for navigation**.

Tide data is from TICON-4 (UHSLC sea-level analysis). Heights can differ from official
port tables by a few tenths of a metre because it's an independent analysis, not the
official port solution.

## Credits

- Tide data: TICON-4 / UHSLC via
  [@neaps/tide-database](https://github.com/neaps/tide-database) (CC-BY-4.0).
- Tide prediction engine: [@neaps/tide-predictor](https://github.com/neaps/tide-predictor)
  (MIT).
- Place search & marine forecast: [Open-Meteo](https://open-meteo.com) (CC-BY-4.0).
- Approximate IP location: [geojs.io](https://www.geojs.io).
- Map tiles: [OpenFreeMap](https://openfreemap.org) / OpenStreetMap.

---

## Contributing

Lunitidal is a no-backend, offline-first PWA: **Svelte + Vite + TypeScript**, tooling via
**[Bun](https://bun.sh)**, deployed to GitHub Pages.

### Prerequisites

- [Bun](https://bun.sh) (package manager, script runner, and test runtime)

### Setup

```sh
bun install
bun run dev        # http://localhost:5173
```

`predev`/`prebuild` automatically run `build:data` first — a build-time script that reads
the large `@neaps/tide-database` package and emits the small static files the browser uses
(a slim station index, a bundled Benoa seed, and per-station constituent files). The raw
database is never shipped to the client.

### Common commands

```sh
bun run dev          # dev server
bun run build        # production build (outputs to dist/)
bun run preview      # serve the production build locally
bun run build:data   # regenerate public/data/* from @neaps/tide-database
bun run test         # unit tests (Vitest)
bun run test:e2e     # end-to-end tests (Playwright)
bun run test:all     # unit + e2e — run this before pushing
bun run check        # type-check (svelte-check)
```

For e2e you'll need the browser once: `bunx playwright install chromium`.

### Project layout

```
scripts/   build-time tooling (station-index extraction, icon generation)
src/
  engine/      pure, framework-agnostic core (prediction, datum, time, units,
               station lookup) — heavily unit-tested
  chart/       pure SVG chart geometry
  sources/     network sources (geocode, marine, IP location)
  stores/      Svelte stores (selection, settings, favorites, persistence)
  components/  UI components
  routes/      Home / Detail / Settings (hash-based routing)
tests/e2e/   Playwright integration tests
public/data/ generated station data (git-ignored)
```

### Tests & CI

Unit tests cover the engine and data-layer boundaries; Playwright covers the UI end to end
against a production build (so the real service worker and offline paths are exercised).
Every push runs the full suite in GitHub Actions, and **deploys to GitHub Pages only if it
passes**. Please run `bun run test:all` before pushing.

See [`docs/DESIGN_REVIEW.md`](docs/DESIGN_REVIEW.md) for the current UX/design backlog, and
[`CLAUDE.md`](CLAUDE.md) for non-obvious gotchas worth knowing before you dig in.

### License

MIT (see `LICENSE`). Note the data attribution requirements above.
