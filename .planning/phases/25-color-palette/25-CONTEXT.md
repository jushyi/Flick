# Phase 25: Color Palette Selection & Customization - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<vision>
## How This Should Work

Users can customize the app's color palette from Settings. There's an "Appearance" section where they pick from preset themes or create their own custom palette.

**Preset Themes:** Dark (current), Light, plus 3 additional palettes from saved reference images. Users tap a theme card, see a preview, then tap "Apply" to make it permanent.

**Custom Mode:** For users who want control, they can tweak 5 key colors:

- Background color
- Card/surface color
- Primary text color
- Accent color 1 (story card outlines)
- Accent color 2 (darkroom card states)

The theme picker is also available during profile onboarding — an optional step between profile info and the selects/highlights step. New users can personalize their experience right from the start.

Changes show as a preview first, then require explicit "Apply" action. No auto-saving while picking.

</vision>

<essential>
## What Must Be Nailed

- **Teaching opportunity** — This phase serves as a learning project for a junior developer new to React Native. The plan must be detailed enough for them to implement with minimal help.
- **Preset themes work seamlessly** — Tapping a preset shows preview, Apply makes it permanent, colors update across entire app
- **Custom palette is intuitive** — Clear color pickers for the 5 customizable values, real-time preview
- **Persistence** — Selected theme persists across app restarts

</essential>

<boundaries>
## What's Out of Scope

- Font customization — just colors, no typography changes
- Import/export themes — no sharing palettes between users
- Scheduled themes — no auto-switching based on time of day
- Complex color pickers — standard palette/picker is fine, no gradient builders

</boundaries>

<specifics>
## Specific Ideas

**Presets:** User has 3 specific palettes saved as images to extract colors from (will share during planning)

**Onboarding:** Theme picker appears as optional step between profile info (step 1) and selects/highlights step

**Preview flow:** Select theme → see preview → tap Apply to confirm

</specifics>

<teaching>
## Teaching Context

This phase is designed as a learning project for a junior developer.

**Developer Background:**

- New to React Native (knows JavaScript/React basics, hasn't built RN apps)
- Needs full onboarding to the codebase and development environment

**Setup Guide Needed:**

- Environment setup (Node, Xcode/Android Studio, clone, run)
- Codebase orientation (project structure, key files, where to find examples)
- Dev workflow (making changes, hot reload, testing, debugging)

**Learning Goals:**

- React Native state management with Context API
- AsyncStorage for preference persistence
- Component architecture (color pickers, theme cards, preview areas)
- Working in an existing codebase with established patterns

**Instruction Format:**

- Logic/functions: Give strong hints, let them try, provide reveal to check their work
- UI elements: Can provide exact code (focus learning energy on concepts, not markup)
- Checkpoints throughout for review and guidance

</teaching>

<notes>
## Additional Notes

Phase 16 established the centralized color constants system (`colors.js`) that this phase builds on. The infrastructure for theme-switching is partially in place — this phase adds the user-facing selection UI and custom palette support.

The plan will serve dual purposes:

1. Implementation specification
2. Teaching guide for junior developer onboarding

</notes>

---

_Phase: 25-color-palette_
_Context gathered: 2026-02-04_
