---
phase: quick-39
plan: 01
subsystem: api
tags: [cloud-functions, firestore, streaks, bug-fix]

# Dependency graph
requires:
  - phase: 04-snap-streaks
    provides: "updateStreakOnSnap function and streak documents"
provides:
  - "Expired-streak detection in updateStreakOnSnap (race window fix)"
  - "Regression tests for streak restart after expiry"
affects: [streaks, cloud-functions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["inline expiry check before business logic in transaction"]

key-files:
  created: []
  modified:
    - "functions/index.js"
    - "functions/__tests__/triggers/streakFunctions.test.js"

key-decisions:
  - "Reset expired streak inline in updateStreakOnSnap rather than deferring to cron, closing the race window"
  - "Use atomic lastSnapBy object with participant null + sender override for clean single-write reset"

patterns-established:
  - "Expiry guard pattern: check document expiry before processing business logic in transactions"

requirements-completed: [QUICK-39]

# Metrics
duration: 1min
completed: 2026-03-05
---

# Quick Task 39: Fix Streak Reset Bug Summary

**Expired-streak detection added to updateStreakOnSnap to reset dayCount to 0 when streak has expired but cron hasn't cleaned up yet**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T16:14:42Z
- **Completed:** 2026-03-05T16:15:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed bug where new streak started at previous streak's dayCount instead of 1
- Added expiry check in updateStreakOnSnap that catches expired streaks before the 30-minute cron cleanup
- Added 2 regression tests confirming expired streaks reset and non-expired streaks increment normally
- All 23 streak tests pass (21 existing + 2 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expired-streak detection to updateStreakOnSnap** - `c3e0d28` (fix)
2. **Task 2: Add regression test for streak restart after expiry** - `8e8c99e` (test)

## Files Created/Modified
- `functions/index.js` - Added expiresAt check after streak data read, resets all streak fields and records sender's snap
- `functions/__tests__/triggers/streakFunctions.test.js` - Two new tests: expired streak reset and non-expired streak normal increment

## Decisions Made
- Reset expired streak inline in updateStreakOnSnap rather than waiting for the cron job, closing the race window between expiry and cleanup
- Used atomic lastSnapBy object construction (`{[p0]: null, [p1]: null, [senderId]: now}`) so the sender's key overwrites the null entry in a single write

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Deploy Cloud Functions to apply the fix:
```bash
firebase deploy --only functions
```

## Next Phase Readiness
- Fix is complete and tested
- Requires Cloud Functions deployment to take effect in production

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Quick Task: 39-fix-streak-reset-bug*
*Completed: 2026-03-05*
