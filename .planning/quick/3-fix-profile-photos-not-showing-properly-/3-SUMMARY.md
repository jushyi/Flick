---
phase: quick-03
plan: 01
subsystem: ui
tags: [react-native, firestore, caching, ttl, profile-photos, messages]

# Dependency graph
requires:
  - phase: 01-01
    provides: messageService and useMessages hook infrastructure
provides:
  - TTL-based friend profile cache in useMessages hook
  - Fresh friend profile fetch on ConversationScreen mount
affects: [messages, conversations, profile-photos]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      TTL cache invalidation for Firestore document references,
      fresh-fetch-on-mount with nav-param fallback,
    ]

key-files:
  created: []
  modified:
    - src/hooks/useMessages.js
    - src/screens/ConversationScreen.js

key-decisions:
  - '5-minute TTL for friend profile cache -- balances freshness with Firestore read cost'
  - 'Nav param as initial state for liveFriendProfile -- prevents UI flash while fresh data loads'

patterns-established:
  - 'TTL cache: wrap cached objects with {data, fetchedAt} and filter on Date.now() - fetchedAt > TTL_MS'
  - 'Fresh-fetch-on-mount: useState(navParam) + useEffect fetch pattern for screens receiving stale data via navigation'

requirements-completed: [QUICK-03]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Quick Task 3: Fix Profile Photos Not Showing Properly Summary

**TTL-based cache invalidation for friend profiles in useMessages and fresh Firestore fetch on ConversationScreen mount to fix stale Firebase Storage download URLs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T20:12:21Z
- **Completed:** 2026-02-23T20:15:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Friend profile cache in useMessages now expires entries after 5 minutes, forcing re-fetch with fresh Firebase Storage download URLs
- ConversationScreen fetches fresh friend profile data from Firestore on mount, independent of the useMessages cache
- No change to external API shape -- all downstream components (ConversationRow, ConversationHeader) receive the same profile fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TTL-based cache invalidation to useMessages friend profile cache** - `aa5ef39` (fix)
2. **Task 2: Fetch fresh friend profile in ConversationScreen on mount** - `23d3042` (fix)

## Files Created/Modified

- `src/hooks/useMessages.js` - Added CACHE_TTL_MS constant, changed cache structure to {data, fetchedAt}, added TTL check in uncachedIds filter, updated cache reads to extract .data
- `src/screens/ConversationScreen.js` - Added liveFriendProfile state with useEffect fresh fetch from Firestore, replaced all friendProfile JSX references with liveFriendProfile, added logger and Firestore imports

## Decisions Made

- 5-minute TTL chosen as balance between photo freshness and Firestore read cost (profile photos change infrequently, but stale tokens break within hours)
- Used navigation param as initial value for liveFriendProfile to prevent any visible flash while the fresh fetch completes
- Added friendProfile?.username and friendProfile?.displayName to useEffect dependency array to satisfy exhaustive-deps lint rule (stable values from nav params)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed eslint exhaustive-deps warning in ConversationScreen useEffect**

- **Found during:** Task 2 (Verification step)
- **Issue:** useEffect referenced friendProfile?.username and friendProfile?.displayName as fallbacks but didn't include them in the dependency array
- **Fix:** Added both to the dependency array -- they are stable nav param values, so no behavioral change
- **Files modified:** src/screens/ConversationScreen.js
- **Verification:** eslint passes with zero warnings
- **Committed in:** 23d3042 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint compliance fix. No scope creep.

## Issues Encountered

- Pre-existing test failures in photoLifecycle.test.js (3 tests) -- unrelated to messaging changes, not caused by this task

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Profile photo display is now self-healing across the Messages tab
- No blockers for subsequent messaging features

## Self-Check: PASSED

- [x] src/hooks/useMessages.js exists
- [x] src/screens/ConversationScreen.js exists
- [x] 3-SUMMARY.md exists
- [x] Commit aa5ef39 exists (Task 1)
- [x] Commit 23d3042 exists (Task 2)

---

_Quick Task: 3-fix-profile-photos-not-showing-properly_
_Completed: 2026-02-23_
