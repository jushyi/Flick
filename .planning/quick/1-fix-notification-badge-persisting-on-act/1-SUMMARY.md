---
phase: quick
plan: 01
subsystem: notifications
tags: [firestore, react-native, useEffect, badge, onSnapshot]

# Dependency graph
requires: []
provides:
  - Auto-clear notification badge on Activity screen load
affects: [ActivityScreen, FeedScreen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Firestore-only mark-as-read pattern: update Firestore without changing local state to clear remote-driven badges'

key-files:
  created: []
  modified:
    - src/screens/ActivityScreen.js

key-decisions:
  - 'Fire-and-forget markNotificationsAsRead call (no await) since badge clearance is non-blocking'
  - 'Preserve local unread dots for individual notification UX while clearing global badge via Firestore'

patterns-established:
  - 'Badge clearance via Firestore write + onSnapshot: update Firestore read field to clear badges driven by real-time listeners elsewhere'

requirements-completed: [NOTIF-BADGE-FIX]

# Metrics
duration: 1min
completed: 2026-02-23
---

# Quick Task 1: Fix Notification Badge Persisting on Activity Screen

**Auto-mark all notifications as read in Firestore when ActivityScreen loads, clearing the FeedScreen red dot badge via existing onSnapshot listener**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-23T18:32:16Z
- **Completed:** 2026-02-23T18:33:20Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Notification red dot on Feed header heart icon now clears after opening Activity screen
- Individual unread dots in Activity list preserved until user taps each notification
- No unnecessary Firestore writes when all notifications are already read
- "Read all" button continues to work as before (idempotent `markNotificationsAsRead`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Auto-mark notifications as read when Activity screen loads** - `4a43597` (fix)

## Files Created/Modified

- `src/screens/ActivityScreen.js` - Added useEffect that calls markNotificationsAsRead after notifications load, with guards for loading state, user auth, and presence of unread items

## Decisions Made

- Used fire-and-forget pattern (no await) for the markNotificationsAsRead call since badge clearance is a background concern and the function is already idempotent
- Dependency array includes `[loading, user?.uid, notifications]` to trigger on initial load and pull-to-refresh without excessive re-runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Steps

- Manual verification: trigger an unread notification, see red dot on heart icon, open Activity, go back to Feed -- red dot should be gone
- Verify individual notification rows still show blue unread dots until individually tapped
- Deploy via `eas update --branch production --message "fix: auto-clear notification badge on Activity screen load"`

## Self-Check: PASSED

- [x] `src/screens/ActivityScreen.js` exists
- [x] Commit `4a43597` exists in git log
- [x] `1-SUMMARY.md` exists

---

_Quick Task: 1-fix-notification-badge-persisting-on-act_
_Completed: 2026-02-23_
