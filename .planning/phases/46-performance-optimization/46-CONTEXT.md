# Phase 46: Performance Optimization - Context

**Gathered:** 2026-02-10
**Status:** Ready for research

<vision>
## How This Should Work

A holistic, systematic sweep across the entire app — Firebase queries, UI rendering, Cloud Functions, image loading, animations — making everything feel fast and production-ready for real users. No specific pain points identified yet; this is about raising the bar across the board so every interaction feels instant and polished.

The app should feel like a finished product. Zero jank. Every scroll buttery, every transition silky, every photo loading instantly. This is a photo-sharing app — images are the core experience and should load with no visible delay. When someone picks up the app, nothing should feel slow or unfinished.

Cloud Functions optimization is preventive — no known issues, but they should be tuned before real users hit them. Speed matters more than cost savings — if it makes the app faster, do it.

</vision>

<essential>
## What Must Be Nailed

- **Zero jank tolerance** — Every interaction, scroll, and transition must feel instant with no stutters or dropped frames
- **Image loading is top priority** — Photos are the core of the app and must load instantly, no visible placeholders lingering
- **Silky animations** — All transitions, modals, and gestures should run at 60fps smooth with no drops
- **Holistic coverage** — No weak spots anywhere in the app; every screen and flow should feel equally fast

</essential>

<boundaries>
## What's Out of Scope

- No architecture changes — optimize within the existing structure, don't restructure or rewrite major systems
- No new features — pure performance work, don't add caching UIs, loading indicators, or new functionality
- Offline support is not a concern — users will be online, focus effort on speed instead
- Cost optimization is not the goal — speed first, even if it means more Firebase reads

</boundaries>

<specifics>
## Specific Ideas

- Image caching and lazy loading should be a special focus given this is a photo app
- All animations should target 60fps — use native driver wherever possible
- Cloud Functions should be preventively optimized (cold starts, memory, timeouts) before real users arrive
- The standard to hit: someone using the app should never think "that was slow"

</specifics>

<notes>
## Additional Context

User hasn't done a deep performance audit yet — trusting the builder's judgment on what to optimize. The goal is App Store readiness: the app should feel as polished and fast as any well-made social app. This is the first phase of the v1.0.0 Release Readiness milestone.

Previous codebase: 57,005 lines JavaScript/JSX across 45 shipped phases. Performance work should cover all existing features without breaking any of them.

</notes>

---

_Phase: 46-performance-optimization_
_Context gathered: 2026-02-10_
