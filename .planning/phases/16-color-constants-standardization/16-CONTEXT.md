# Phase 16: Color & Style Constants Standardization - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<vision>
## How This Should Work

A single, well-organized constants file that controls the entire app's visual identity. When you want to change a color or style, you edit one place and the whole app updates. No more hunting through components to find hardcoded values.

The app should feel cohesive — consistent black backgrounds everywhere, subtle dark gray cards that lift content just enough to create hierarchy, and the accent purple showing up intentionally throughout interactive elements, highlights, and subtle touches.

Navigation should be seamless with no white flashes at screen edges. Every screen, modal, and component should feel like part of the same family.

</vision>

<essential>
## What Must Be Nailed

- **Consistent black backgrounds** — Every screen has the same pure black, no white flash during navigation
- **Subtle content blocks** — Cards and info sections get a dark gray that's barely visible but creates hierarchy
- **Accent purple throughout** — Used for interactive elements (buttons, toggles), highlights (active tabs, selections), and subtle touches (borders, icons)
- **Text hierarchy** — Primary white for important text, dimmed gray for secondary/labels
- **Error/success colors** — Standardized red and green for feedback states
- **No hardcoded values** — Every hex/rgb replaced with a constant for easy palette changes

</essential>

<boundaries>
## What's Out of Scope

- Light mode / theme switching — just standardizing the current dark theme
- User-selectable accent colors — no personalization features
- Dynamic theming — not building a theme provider system
- Runtime theme changes — this is about code cleanup, not new features

</boundaries>

<specifics>
## Specific Ideas

**Colors:**

- Pure black (#000000) for all screen backgrounds
- Subtle dark gray for content blocks — just barely visible lift from background
- Brand purple for accents across interactive elements, focus states, and subtle touches
- White for primary text, dimmed gray for secondary text
- Standard red/green for error/success states

**Styling (included in this phase):**

- Border radii: Context-dependent — buttons more rounded, cards subtler
- Icon sizes: Standard small/medium/large sizes
- Icon library: All Ionicons, no mixing libraries
- Icon colors: Clear rules for when white vs gray vs accent purple
- Spacing/padding: Systematized for maintainability (no specific issues, just standardize)

**Documentation:**

- Quick reference document — simple scannable list of constants with their purpose
- No heavy documentation, just what you need at a glance

</specifics>

<notes>
## Additional Context

The white flash issue during navigation is caused by screens not having their background explicitly set, so React Navigation's default white shows through at the edges. This phase will fix that by ensuring every screen uses the background constant.

This phase expanded from "Color Constants" to include styling standardization (borders, icons, spacing) — one comprehensive cleanup pass rather than splitting into multiple phases.

The goal is maintainability and cohesion, not new features. After this phase, adding a new screen should be straightforward: import the constants, follow the quick reference, and everything matches.

</notes>

---

_Phase: 16-color-constants-standardization_
_Context gathered: 2026-01-29_
