# Design review — backlog (TODO)

A UX/design review (against the north stars: beginner-first, mobile-first, honest
accuracy, offline-first). Captured here as a future backlog — **not yet tackled**.

Status legend: ⬜ todo · ✅ done · 🚧 partial/deferred

## P1 — bugs / honesty / accessibility

- ✅ **Timezone is unlabeled.** Day nav now shows "· GMT+8" and the tides card notes
  "Times shown in GMT+8 — the station's local time" (via `tzAbbrev()`), so a traveler
  viewing a far-away station can tell the times aren't on their own clock.
- ✅ **Favorites stored coords+label but not the station** (silent drift) and
  `favoriteId` collided at ~110 m. Now persist stationId/stationName/distance, re-select
  the exact station, show it in the list, and key ids to ~11 m. Plus a one-time
  migration of old "My location"/"Dropped pin" labels.
- ✅ **Chart slider not keyboard-operable.** Added arrow/Home/End/PageUp-Down handling,
  a visible `:focus-visible` outline, and `aria-valuetext` (time + height).

## P2 — clarity / ergonomics

- ⬜ No visible "drag the chart" affordance (discoverability of the core feature). S
- ⬜ "Next high/low" vanishes after the day's last extreme; should peek into tomorrow.
  Confirm rising/falling sampling at the day boundary. M
- ⬜ Datum: a beginner can switch to MSL and see unexplained negative heights; "LAT" is
  jargon on Home. Add a plain-language gloss + a note that MSL can read negative. S
- ⬜ Confidence colours fail contrast; "fair" is invisible in LocationBar and missing in
  Detail; meaning is colour-only. Give each level a contrast-checked colour + a glyph. S
- ⬜ Marine card blurs wave vs tide height (same "1.2 m" formatting), "peak" unexplained,
  sparkline is `aria-hidden` with no caption. Label clearly. S
- ⬜ Sheets/modals (LocationSearch, StationMap): no focus trap, no Escape-to-close, no
  body scroll-lock, search input not auto-focused. M
- ⬜ First-run IP default can land far away (e.g. Benoa for a Norway user) with no "we
  guessed your area" framing or nudge to set a location. M

## P3 — polish

- ⬜ Settings: no rename / undo / reorder for favorites. M
- ⬜ Day navigation is unbounded (paging to meaningless far-future dates); the
  date-label-resets-to-today affordance is undiscoverable. Cap horizon + add a "Today"
  button when navigated away. S
- ⬜ Home hard-error state ("Couldn't load tide data.") is a dead end — add Try again /
  Choose a location. S
- ⬜ LocationSearch: "tide station" vs "place" distinction is unexplained; geocoder-error
  hint mixes with successful station results. S
- ⬜ Consistency: en-GB ("Metres") vs en-US ("miles") mix; emoji icons render
  inconsistently; "not for navigation" disclaimer absent in the location sheets. S
- ⬜ MarineCard refetches on every day-nav; fetch once per location and window
  client-side; distinguish "no marine data here" from "not available this far ahead". M

---
_Source: automated design-review agent, plus the "My location" label fix that prompted
it. See git history around the favorites/labelling fixes for examples of the bug class._
