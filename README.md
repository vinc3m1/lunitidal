# Lunitidal

Tide predictions that work offline, computed right in your browser. No account, no API
keys, no tracking.

**→ [Open the app](https://www.lunitidal.app/)**

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
- **Day & night:** the chart is shaded with a day → twilight → night gradient and marks the
  exact sunrise/sunset, with the times listed for the day. Computed on-device from the
  location — no network, works offline.
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

## Marine forecast (waves & swell)

The waves & swell card is a separate, online-only layer from [Open-Meteo](https://open-meteo.com),
shown on top of the astronomical tide.

Open-Meteo's wave data comes from numerical **wave models** that divide the ocean surface into a
**grid** of cells — anywhere from a few kilometres to ~25 km across — and each cell holds one
forecast. Crucially, these models only run **over water**: there's no wave value for land, harbours,
or small enclosed bays.

So when you pick a spot, the API **snaps** your request to the nearest grid cell that actually has
data and tells us which cell it used. For a beach, harbour, or bayside point that cell can sit a few
kilometres away, in any direction. That's why the card labels the source like:

> Open-Meteo · ~2.8 km SSE ⓘ

The number is the distance from **your chosen point** to the **grid cell the forecast came from**,
and the compass bearing points **from you toward that cell** (here, the waves describe the water
~2.8 km to the south-southeast). It is **not** a distance to the shoreline. Tap the ⓘ for the same
explanation in-app. If no usable water cell is nearby, the card shows "No marine forecast for this
location" instead.

## Your data

There are no accounts and no server — Lunitidal runs entirely in your browser. Your saved
spots and preferences (units, time format, theme, chart datum) live in this browser's local
storage on **this device only**: they don't sync across devices, and clearing the site's data
resets them. The only network requests are for optional extras — place search, the marine
forecast, map tiles, and a one-time IP-based guess at your starting region — and nothing you
do is tracked or sent to us.

## Credits

- Tide data: TICON-4 / UHSLC via
  [@neaps/tide-database](https://github.com/neaps/tide-database) (CC-BY-4.0).
- Tide prediction engine: [@neaps/tide-predictor](https://github.com/neaps/tide-predictor)
  (MIT).
- Place search & marine forecast: [Open-Meteo](https://open-meteo.com) (CC-BY-4.0).
- Approximate IP location: [geojs.io](https://www.geojs.io).
- Map tiles: [OpenFreeMap](https://openfreemap.org) / OpenStreetMap (ODbL).

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
scripts/   build-time tooling (station-index extraction, icon generation,
           per-station prerender + sitemap)
src/
  engine/      pure, framework-agnostic core (prediction, datum, time, units,
               station lookup) — heavily unit-tested
  chart/       pure SVG chart geometry
  sources/     network sources (geocode, reverse-geocode, marine, IP location)
  stores/      Svelte stores (selection, settings, favorites, persistence)
  seo/         pure slug / meta / prerender-content builders (shared build + runtime)
  lib/         shared constants/helpers (router, external links)
  components/  UI components
  routes/      Home / Detail / Settings (history-based routing; `/tides/<slug>/` per station)
tests/e2e/   Playwright integration tests
public/data/ generated station data (git-ignored)
```

### Tests & CI

Unit tests cover the engine and data-layer boundaries; Playwright covers the UI end to end
against a production build (so the real service worker and offline paths are exercised).
Every push runs the full suite in GitHub Actions, and **deploys to GitHub Pages only if it
passes**. Please run `bun run test:all` before pushing.

See [`CLAUDE.md`](CLAUDE.md) for non-obvious gotchas worth knowing before you dig in.

### License

The application code is MIT-licensed — see [`LICENSE`](LICENSE). The third-party tide data,
forecasts, and map tiles it relies on carry their own licences (CC-BY-4.0, ODbL) with
attribution requirements; those sources are listed under [Credits](#credits).
