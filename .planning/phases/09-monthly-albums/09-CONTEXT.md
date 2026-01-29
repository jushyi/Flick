# Phase 9: Monthly Albums - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<vision>
## How This Should Work

Below the user albums bar on the profile screen, there's a monthly albums section. These albums are full-width cards — larger than user albums — organized by year with collapsible sections.

Each year appears as a bold header with a rotating chevron. Tap to expand/collapse that year's months. Current year starts expanded; older years start collapsed. Within each year, months display newest-first (scroll down for older months).

Each monthly album card shows the last photo taken that month as the cover, with the month name ("January", "February") overlaid in white text at the bottom-left corner with a subtle shadow. Cards are clean — no photo count.

Tap a monthly album to open its grid view, which uses the same grid layout as user albums. Within the grid, photos are sectioned by day with headers like "Monday, January 15" for full weekday context. From there, tap any photo to open the full-screen viewer.

These albums are completely auto-generated and read-only — they include both journaled and archived photos, grouped automatically by month. Users can browse but not edit.

Empty months are hidden entirely. Year sections have smooth expand/collapse animations.

</vision>

<essential>
## What Must Be Nailed

- **Auto-population works reliably** — Photos automatically land in the correct month without any user effort. This is the core magic that makes the feature work.

</essential>

<boundaries>
## What's Out of Scope

- Editing monthly albums — No renaming, removing photos, or changing covers. Purely read-only.
- Custom date groupings — No weekly albums, seasons, or custom time ranges. Just months.

</boundaries>

<specifics>
## Specific Ideas

- Full-width album cards (wider than user album cards)
- Year headers: bold text + rotating chevron for expand/collapse
- Current year expanded by default, older years collapsed
- Month name overlay: bottom-left, white text, subtle shadow
- Day sections within grid view: "Monday, January 15" format
- Smooth expand/collapse animations for year sections
- Empty months hidden (no placeholder cards)
- Uses existing album grid view and photo viewer components (read-only mode)

</specifics>

<notes>
## Additional Context

Monthly albums contain both journaled AND archived photos — everything the user has captured, organized by when it was taken.

The layout mirrors the structure of user albums but with year-based organization and larger cards for visual distinction. The collapsible years help manage extensive photo history without overwhelming the scroll.

</notes>

---

_Phase: 09-monthly-albums_
_Context gathered: 2026-01-29_
