# Phase 31: Personalization Scaffolding - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<vision>
## How This Should Work

Users can pick an accent color that tints the interactive parts of the app - buttons, the hold-to-reveal ring, active tab indicators. It's a single color choice that personalizes their experience without overhauling the entire visual identity.

The purple/pink Rewind brand remains the default, but users who want to make it "theirs" can swap to blue, green, orange, or other preset accents. The rest of the app (backgrounds, text, gradients in non-interactive areas) stays consistent with the dark Rewind aesthetic.

</vision>

<essential>
## What Must Be Nailed

- **Infrastructure that scales** - The theming system should make adding new color palettes trivial later. No hardcoded colors scattered through components.
- **Feels instant** - When you pick a color, the whole app updates immediately. No reload, no flash, no delay.
- **Sensible defaults** - The purple/pink brand works perfectly out of the box. Customization is entirely optional - the app should feel complete without it.

</essential>

<boundaries>
## What's Out of Scope

- User-facing color picker UI - Build the infrastructure now, the settings screen comes in a later phase
- Dark/light mode toggle - Keep dark theme only, light mode is a separate effort
- Gradient overhauls - Not changing the purple→pink storytelling gradients, just accent colors on interactive elements

</boundaries>

<specifics>
## Specific Ideas

- React Context pattern: ThemeContext provides colors, components consume via useTheme hook
- Primary UI elements affected: buttons, hold-to-reveal ring, active tab indicators
- Preset color palettes rather than freeform color input

</specifics>

<notes>
## Additional Context

This is "future feature prep" - laying groundwork so personalization can be added later without refactoring. The goal is invisible infrastructure that makes the eventual user-facing feature straightforward to build.

</notes>

---

_Phase: 31-personalization-scaffolding_
_Context gathered: 2026-01-25_
