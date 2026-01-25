# Phase 29: Documentation - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<vision>
## How This Should Work

Comprehensive documentation covering both developer onboarding AND code-level reference. When someone clones this repo, they should quickly understand:

1. **What this app is** — Lapse clone, friends-only photo sharing, darkroom concept
2. **The tech stack** — React Native, Expo, Firebase at a glance
3. **How to run it** — Clone, install, configure, run

For returning contributors (including future me), the code should explain itself through minimal JSDoc comments, and the complex animation system should have both inline documentation and a high-level overview explaining the "why" behind timing decisions.

</vision>

<essential>
## What Must Be Nailed

- **README update** — What it is → tech stack → how to run (in that order)
- **CONTRIBUTING.md** — For potential collaborators (friends/colleagues) who need to understand conventions
- **Animation documentation** — JSDoc inline + high-level ANIMATIONS.md explaining the card stacking, arc motion, cascade timing
- **JSDoc on services** — Function signature only (brief description + @param types + @returns)

All areas equally important — no single priority dominates.

</essential>

<boundaries>
## What's Out of Scope

- **User-facing docs** — No app store descriptions, user guides, or marketing copy
- **Generated docs site** — No Docusaurus or similar — just markdown and JSDoc
- **Video/visual guides** — No screen recordings or architecture diagrams — text-based only
- **Full open-source formality** — No code of conduct, issue templates, or PR guidelines — just conventions
- **Verbose JSDoc** — No @example blocks, edge case documentation, or TypeScript-style detailed annotations
- **Emojis** — No emojis in any documentation

</boundaries>

<specifics>
## Specific Ideas

- **Style**: Minimal and practical — just enough to understand, no fluff
- **Tone**: Match the existing CLAUDE.md balance (developer-focused, concise)
- **JSDoc depth**: Brief description + @param types + @returns only
- **Animation docs**: Separate ANIMATIONS.md for the high-level system overview

</specifics>

<notes>
## Additional Context

This is the final phase of v1.6 (Code Quality, Security & Documentation milestone). The documentation should be maintainable and practical — written for collaborators who might contribute, not for public open-source consumption.

The codebase has gone through significant refactoring in Phase 28, with custom hooks extracted for SwipeablePhotoCard, CameraScreen, DarkroomScreen, and PhotoDetailModal. Documentation should reflect this clean architecture.

</notes>

---

_Phase: 29-documentation_
_Context gathered: 2026-01-25_
