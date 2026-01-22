---
phase: 17-darkroom-ux-polish
plan: FIX-6
subsystem: ui
tags: [animation, reanimated, triage, buttons]

# Dependency graph
requires:
  - phase: 17-FIX-4
    provides: cascade animation, button triage system
provides:
  - Slower button-triggered animations (1200ms vs 400ms)
affects: [18.1-batched-triage]

# Tech tracking
tech-stack:
  added: []
  patterns: [separate-button-vs-swipe-timing]

key-files:
  created: []
  modified: [src/components/SwipeablePhotoCard.js]

key-decisions:
  - "BUTTON_EXIT_DURATION 1200ms (3x swipe) for satisfying button animation pace"
  - "Deferred UAT-015 (black flash) to Phase 18.1 where batch-based triage will simplify the fix"

patterns-established:
  - "Separate animation durations for button vs swipe gestures"

issues-created: []

# Metrics
duration: 12min
completed: 2026-01-22
---

# Phase 17 Plan FIX-6: UAT Round 6 Fixes Summary

**Slower button-triggered triage animations (1200ms) for more satisfying visual feedback; black flash issue deferred to Phase 18.1**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-22T17:20:00Z
- **Completed:** 2026-01-22T17:32:00Z
- **Tasks:** 1/2 completed (1 deferred)
- **Files modified:** 1

## Accomplishments

- Button-triggered animations now 3x slower (1200ms vs 400ms)
- Swipe gestures unchanged at 400ms
- More satisfying visual feedback when using Archive/Journal/Delete buttons
- Identified that UAT-015 (black flash) is better solved in Phase 18.1 with batch-based triage

## Task Commits

1. **Task 2: Fix UAT-016 (button animation too fast)** - `5b6c8da` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/SwipeablePhotoCard.js` - Added BUTTON_EXIT_DURATION constant, updated triggerArchive/triggerJournal/triggerDelete

## Decisions Made

- **BUTTON_EXIT_DURATION = 1200ms**: Button taps trigger instant animation from rest position with no lead-in, making the same 400ms duration feel faster than swipes. 1200ms (3x) gives button animations similar perceived pace.
- **Defer UAT-015 to Phase 18.1**: The black flash after cascade animation is caused by timing mismatch between exit animation and spring-based cascade. Phase 18.1's batch-based triage with local state will make this easier to solve since cards won't be removed from array until session ends.

## Deviations from Plan

### Deferred Issues

- UAT-015 (black flash after cascade) deferred to Phase 18.1 (batched darkroom triage)
  - Multiple fix attempts (transparent backgrounds, timing delays, removing cascade) all introduced other issues
  - Root cause: animation timing between exit and cascade spring is inherently difficult to synchronize
  - Phase 18.1's batch-based approach with local decisions will fundamentally change the architecture, making this easier to solve

---

**Total deviations:** 0 auto-fixed, 1 deferred to Phase 18.1
**Impact on plan:** 1 of 2 issues fixed; deferred issue will be addressed in upcoming phase

## Issues Encountered

- UAT-015 fix attempts caused regressions:
  - Transparent backgrounds caused photo behind to flash briefly
  - Removing cascade entirely broke the visual flow
  - Decision to defer to Phase 18.1 where architecture change will help

## Next Phase Readiness

- Phase 17 complete with known issue (UAT-015) deferred
- Ready for Phase 17.1 (Darkroom Animation Refinements)
- UAT-015 will be addressed in Phase 18.1 (Batched Darkroom Triage with Undo)

---
*Phase: 17-darkroom-ux-polish*
*Completed: 2026-01-22*
