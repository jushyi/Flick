---
phase: 04-snap-streaks
plan: 01
subsystem: api
tags: [firebase, cloud-functions, firestore, streaks, scheduled-functions, transactions]

# Dependency graph
requires:
  - phase: 03-snap-messages
    provides: onNewMessage Cloud Function with snap message handling, snap message type
provides:
  - Server-side streak engine (updateStreakOnSnap + processStreakExpiry)
  - Firestore streaks collection with security rules (read-only for participants)
  - Tiered expiry window system (36h/48h/72h based on dayCount)
  - Warning notification system with streakWarnings preference check
  - 21 comprehensive Cloud Function tests for streak logic
affects: [04-02-PLAN, 04-03-PLAN, 04-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Firestore transaction-based atomic streak updates (race condition prevention)
    - Tiered expiry window calculation via getExpiryWindowMs helper
    - Dual-query scheduled function (warnings + expiry in single run)
    - warningAt pre-computed field for efficient Firestore range queries

key-files:
  created:
    - functions/__tests__/triggers/streakFunctions.test.js
  modified:
    - functions/index.js
    - firestore.rules

key-decisions:
  - 'warningAt pre-computed field instead of arithmetic in queries (Firestore cannot do computed queries)'
  - 'Shared mock pattern for processStreakExpiry tests (both queries use same collection mock)'

patterns-established:
  - 'Streak document ID matches conversation ID: [lowerUserId]_[higherUserId]'
  - 'Best-effort streak updates: log errors but do not fail message delivery'
  - 'Transaction-wrapped streak reads/writes for concurrent snap safety'

requirements-completed: [STRK-01, STRK-02, STRK-05, STRK-06, STRK-07]

# Metrics
duration: 8min
completed: 2026-02-24
---

# Phase 4 Plan 1: Server-Side Streak Engine Summary

**Transaction-based mutual snap tracking with tiered expiry windows (36h/48h/72h), processStreakExpiry scheduled function for warnings and resets, and read-only Firestore security rules**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24T21:30:03Z
- **Completed:** 2026-02-24T21:38:03Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Implemented updateStreakOnSnap with Firestore transactions for atomic mutual snap tracking, 24h day gate, tiered expiry calculation, and warning state management
- Added processStreakExpiry scheduled Cloud Function (every 30 min) that processes streak warnings with push notifications and resets expired streaks
- Added Firestore security rules for streaks collection: read-only for participants, all writes via admin SDK
- Created 21 comprehensive tests covering all streak state transitions, edge cases, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement streak Cloud Functions with tests** - `74e492b` (feat)

**Plan metadata:** [pending final commit]

## Files Created/Modified

- `functions/index.js` - Added streak constants (STREAK_EXPIRY_TIERS, STREAK_WARNING_TEMPLATES), getExpiryWindowMs helper, updateStreakOnSnap transaction-based helper, processStreakExpiry scheduled function, hooked streak update into onNewMessage for snap messages
- `firestore.rules` - Added streaks collection match block with read-only access for participants and write denied
- `functions/__tests__/triggers/streakFunctions.test.js` - 21 tests covering: new streak creation, one-sided snap, mutual dayCount increment, 24h gate, tiered expiry (36/48/72h), warning flag, push notification with preference check, streak reset, transaction atomicity, best-effort error handling, warningAt calculation

## Decisions Made

- Used warningAt pre-computed field (set at expiresAt - 4h) instead of trying arithmetic in Firestore queries, since Firestore cannot do computed field queries
- Used shared mock pattern for processStreakExpiry tests where both warning and expiry queries return from the same mock object to properly sequence mockResolvedValueOnce calls
- Streak error in onNewMessage is best-effort (caught and logged, not thrown) matching existing onSnapViewed pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Mock setup for processStreakExpiry tests initially failed because each call to `mockDb.collection('streaks')` returned a fresh mock object, losing the `mockResolvedValueOnce` sequence. Fixed by extracting a shared streaks collection mock referenced by all calls.
- Pre-existing test failure in `notifications.test.js` (reaction handling test) confirmed to exist before this plan's changes -- not caused by streak implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Server-side streak engine is complete and tested
- Plans 02-04 can now build client-side streak service, StreakIndicator component, and conversation integration
- processStreakExpiry function needs `firebase deploy --only functions` to go live
- streakWarnings notification preference toggle needs to be added to NotificationSettingsScreen (Plan 03/04)

## Self-Check: PASSED

- [x] functions/index.js exists
- [x] firestore.rules exists
- [x] functions/**tests**/triggers/streakFunctions.test.js exists
- [x] .planning/phases/04-snap-streaks/04-01-SUMMARY.md exists
- [x] Commit 74e492b exists
- [x] 21/21 streak tests pass

---

_Phase: 04-snap-streaks_
_Completed: 2026-02-24_
