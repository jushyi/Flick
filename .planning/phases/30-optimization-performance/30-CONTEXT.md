# Phase 30: Optimization and Performance Enhancements - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<vision>
## How This Should Work

Fix the known pain point first (monthly album photo loading), then do a systematic profiling pass to ensure the entire app is optimized for scale. The app should feel fast everywhere — that's the bar.

Monthly albums are the primary issue: photos load slowly in the grid view, fullscreen viewer, and horizontal thumbnail strip. The rest of the app feels okay for now, but profiling should catch any hidden issues and ensure readiness for growth.

The goal is to prepare the app for real usage — users with many photos, users with many friends, and many concurrent users. When done, the app should handle all growth scenarios without feeling sluggish.

</vision>

<essential>
## What Must Be Nailed

- **Monthly album photo loading** — Grid, fullscreen viewer, and horizontal thumbnails must load photos quickly
- **Feels fast everywhere** — The success metric is feel, not arbitrary numbers
- **Scale readiness** — App should perform well with lots of users, lots of photos, lots of friends

</essential>

<boundaries>
## What's Out of Scope

- No new features — purely optimization work
- App startup is fine — no focus needed there
- Backend changes and architecture adjustments are fair game if they improve performance

</boundaries>

<specifics>
## Specific Ideas

No specific references — open to standard optimization approaches.

**Priority order:**

1. Fix monthly albums photo loading (known issue)
2. Profile entire app to find hidden bottlenecks
3. Ensure scale readiness for growth

**Output expected:**

- Detailed profiling document with before/after metrics and findings for future reference

</specifics>

<notes>
## Additional Context

- Testing primarily on latest iPhone — if it feels slow on flagship hardware, there's definitely room for improvement
- The rest of the app feels good right now; monthly albums is the main complaint
- Want documentation of what was found and fixed, not just silent improvements

</notes>

---

_Phase: 30-optimization-performance_
_Context gathered: 2026-02-05_
