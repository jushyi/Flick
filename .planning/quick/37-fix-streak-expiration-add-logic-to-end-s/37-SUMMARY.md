---
phase: quick-37
plan: 01
subsystem: ui
tags: [react-hooks, streaks, expiry, useMemo, real-time]

# Dependency graph
requires:
  - phase: 04-snap-streaks
    provides: "useStreak/useStreakMap hooks and streakService"
provides:
  - "Local expiry override in useStreak and useStreakMap for instant UI feedback"
affects: [streaks, messages-list, conversation-header]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Local expiry override pattern: derive raw state, then override based on isExpired flag"]

key-files:
  created: []
  modified:
    - src/hooks/useStreaks.js
    - __tests__/hooks/useStreaks.test.js

key-decisions:
  - "Override applied in hooks after deriveStreakState, not in streakService (preserves pure function)"
  - "useStreakMap uses same 3-way timestamp fallback pattern (toMillis/toDate/new Date) as useStreak"
  - "Removed unused useCallback import during lint cleanup"

patterns-established:
  - "Local expiry override: compute effective state from raw state + isExpired flag via useMemo"

requirements-completed: [QUICK-37]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Quick Task 37: Fix Streak Expiration Summary

**Local expiry override in useStreak and useStreakMap so expired streaks immediately show default state without waiting for Cloud Function**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T16:36:53Z
- **Completed:** 2026-03-04T16:39:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- useStreak now overrides streakState to 'default' and dayCount to 0 when isExpired is true, providing instant UI feedback
- useStreakMap checks expiresAt against Date.now() for each streak and overrides expired entries to default state
- 4 new tests verify expiry override behavior in both hooks (22 total tests, all passing)
- deriveStreakState in streakService.js left completely unmodified (pure function preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add local expiry override to useStreak and useStreakMap hooks** - `781271f` (fix)
2. **Task 2: Add tests for local expiry override behavior** - `5991492` (test)

## Files Created/Modified
- `src/hooks/useStreaks.js` - Added effectiveStreakState/effectiveDayCount/effectiveStreakColor useMemo overrides in useStreak; added expiresAt expiry check in useStreakMap forEach callback
- `__tests__/hooks/useStreaks.test.js` - Added 4 new test cases for expiry override in both useStreak and useStreakMap

## Decisions Made
- Override logic placed in hooks (useStreak, useStreakMap) rather than in deriveStreakState, preserving the pure function contract in streakService.js
- useStreakMap uses the same 3-way timestamp fallback pattern (toMillis/toDate/new Date) already established in the useStreak countdown timer
- Removed unused useCallback import discovered during lint check (Rule 1 auto-fix, pre-existing unused import)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused useCallback import**
- **Found during:** Task 1 (lint verification)
- **Issue:** useCallback was imported but never used in useStreaks.js
- **Fix:** Removed from import statement
- **Files modified:** src/hooks/useStreaks.js
- **Verification:** `npx eslint src/hooks/useStreaks.js` passes clean
- **Committed in:** 781271f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - unused import)
**Impact on plan:** Minor cleanup, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Streak expiry is now reflected instantly in the UI
- When the Cloud Function eventually resets the streak document, the UI remains consistent (no flicker) because deriveStreakState will return 'default' for the reset document, matching what the override already shows

## Self-Check: PASSED

All files exist:
- src/hooks/useStreaks.js
- __tests__/hooks/useStreaks.test.js
- .planning/quick/37-fix-streak-expiration-add-logic-to-end-s/37-SUMMARY.md

All commits exist:
- 781271f (Task 1)
- 5991492 (Task 2)

---
*Phase: quick-37*
*Completed: 2026-03-04*
