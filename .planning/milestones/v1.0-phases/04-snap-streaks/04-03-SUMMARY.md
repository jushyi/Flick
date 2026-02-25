---
phase: 04-snap-streaks
plan: 03
subsystem: hooks
tags: [react-hooks, firestore, real-time, countdown-timer, streak, notification-preferences]

# Dependency graph
requires:
  - phase: 04-01
    provides: Server-side streak engine with Cloud Functions and Firestore streaks collection
  - phase: 04-02
    provides: streakService with subscribeToStreak, subscribeToUserStreaks, deriveStreakState, getStreakColor
provides:
  - 'useStreak hook for single conversation streak data with local countdown timer'
  - 'useStreakMap hook for batch streak data with single Firestore listener'
  - 'Streak warning notification preference toggle in NotificationSettingsScreen'
affects: [04-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Local countdown timer for streak expiry (60s interval with isExpired fallback)'
    - 'Single-listener batch hook pattern (useStreakMap) to avoid N+1 subscriptions'
    - 'Opt-out notification preference (streakWarnings !== false)'

key-files:
  created:
    - src/hooks/useStreaks.js
    - __tests__/hooks/useStreaks.test.js
  modified:
    - src/screens/NotificationSettingsScreen.js

key-decisions:
  - 'warning-outline icon for streak toggle (flame-outline does not exist in PixelIcon set)'
  - 'Messaging section header added to group streak toggle separately from photo notification types'

patterns-established:
  - 'useStreak returns { streakData, streakState, dayCount, streakColor, timeRemaining, isExpired }'
  - 'useStreakMap returns { streakMap, loading } with streakMap keyed by streak document ID'
  - 'Local countdown timer: 60s interval computes timeRemaining from expiresAt, sets isExpired=true at zero'

requirements-completed: [STRK-04, STRK-05]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 4 Plan 3: Streak Hooks & Notification Toggle Summary

**useStreak/useStreakMap hooks with real-time Firestore subscriptions, 60s local countdown timer for expiry, and opt-out streak warning toggle in notification settings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T21:42:10Z
- **Completed:** 2026-02-24T21:45:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created useStreak hook with single-conversation streak subscription, derived state/color, and local countdown timer that sets isExpired=true before server update
- Created useStreakMap hook with single Firestore listener for all user streaks (avoids N+1 per Research Pitfall 6)
- Added "Streak Warnings" toggle to NotificationSettingsScreen under new Messaging section with opt-out default (enabled unless explicitly disabled)
- 18 tests covering subscription setup/cleanup, state derivation, timer countdown, expiry detection, and null guards

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useStreak and useStreakMap hooks + tests** - `ceecc5d` (feat)
2. **Task 2: Add streak warning notification toggle to settings** - `72cec05` (feat)

**Plan metadata:** [pending final commit]

## Files Created/Modified

- `src/hooks/useStreaks.js` - useStreak (single conversation with countdown) and useStreakMap (batch for messages list) hooks
- `__tests__/hooks/useStreaks.test.js` - 18 tests: 11 for useStreak (subscription, state, color, dayCount, cleanup, null guards, timer, expiry) and 7 for useStreakMap (subscription, map population, state derivation, cleanup, empty array)
- `src/screens/NotificationSettingsScreen.js` - Added Messaging section with Streak Warnings toggle using warning-outline PixelIcon

## Decisions Made

- Used `warning-outline` PixelIcon instead of `flame-outline` (flame icon does not exist in the project's pixel icon set; warning-outline fits the "Streak Warnings" label semantically)
- Added a "Messaging" section header to group the streak toggle separately from photo-related notification types (likes, comments, tags, etc.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed flame-outline to warning-outline icon**

- **Found during:** Task 2
- **Issue:** Plan suggested `flame-outline` icon but it does not exist in the PixelIcon pixel icon grid data
- **Fix:** Used `warning-outline` which exists in the icon set and fits the "Streak Warnings" label
- **Files modified:** src/screens/NotificationSettingsScreen.js
- **Committed in:** 72cec05

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor icon substitution. No functional or scope impact.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- useStreak and useStreakMap hooks are ready for integration into conversation UI (Plan 04)
- useStreak provides all data needed for ConversationHeader streak badge
- useStreakMap provides all data needed for ConversationRow streak indicators
- NotificationSettingsScreen toggle is wired to the same preference field the Cloud Function checks

## Self-Check: PASSED

- [x] src/hooks/useStreaks.js exists
- [x] **tests**/hooks/useStreaks.test.js exists
- [x] src/screens/NotificationSettingsScreen.js contains streakWarnings
- [x] Commit ceecc5d exists
- [x] Commit 72cec05 exists
- [x] 18/18 tests pass

---

_Phase: 04-snap-streaks_
_Completed: 2026-02-24_
