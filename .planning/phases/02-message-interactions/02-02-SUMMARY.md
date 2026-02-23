---
phase: 02-message-interactions
plan: 02
subsystem: api
tags: [cloud-functions, firestore, notifications, soft-delete, callable]

# Dependency graph
requires:
  - phase: 01-message-infrastructure
    provides: message type polymorphism, Firestore conversation/message schema
provides:
  - unsendMessage callable Cloud Function with 15-minute window and cascade logic
  - Extended onNewMessage trigger: reaction-aware lastMessage/unreadCount/notification handling
  - Firestore rules allowing deletedMessages field on conversation documents
affects: [02-message-interactions, 03-snap-messages]

# Tech tracking
tech-stack:
  added: []
  patterns: [callable function soft-delete with cascade, reaction sentinel pattern in triggers]

key-files:
  created: []
  modified:
    - functions/index.js
    - firestore.rules
    - functions/__tests__/callable/functions.test.js
    - functions/__tests__/triggers/notifications.test.js

key-decisions:
  - 'unsendMessage uses batch writes for atomic cascade across message, reactions, and replies'
  - 'onNewMessage returns early for reaction removal sentinels (emoji: null) to avoid noise'
  - 'Reaction messages skip lastMessage and unreadCount updates to prevent conversation list pollution'

patterns-established:
  - 'Callable function cascade: soft-delete parent + batch update related documents in one commit'
  - 'Message type branching: onNewMessage checks messageType before updating conversation metadata'

requirements-completed: [REACT-05, DEL-01, DEL-03]

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 2 Plan 02: Cloud Functions Summary

**unsendMessage callable with 15-min window + cascade deletion, onNewMessage reaction-aware routing with emoji notifications**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T22:38:03Z
- **Completed:** 2026-02-23T22:43:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- unsendMessage callable Cloud Function: validates auth, sender ownership, 15-minute window; cascades soft-delete to reactions and replyTo.deleted flag on replies; updates conversation lastMessage fallback
- onNewMessage extended: skips lastMessage/unreadCount for reaction messages, sends emoji-formatted push notification, returns early for reaction removal sentinels
- Firestore rules updated: deletedMessages added to allowed conversation update fields
- 8 new tests added (5 unsendMessage + 3 onNewMessage reaction), all 90 Cloud Function tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Create unsendMessage callable + update Firestore rules** - `fca9ca6` (feat)
2. **Task 2: Extend onNewMessage for reactions + add tests** - `ecb9cb9` (feat)

## Files Created/Modified

- `functions/index.js` - Added unsendMessage callable (~130 lines); modified onNewMessage to branch on messageType for reaction handling (~50 lines changed)
- `firestore.rules` - Added 'deletedMessages' to conversation update hasOnly list
- `functions/__tests__/callable/functions.test.js` - 5 new unsendMessage test cases with dedicated mock helper
- `functions/__tests__/triggers/notifications.test.js` - 3 new onNewMessage reaction test cases with mock helper

## Decisions Made

- Used batch writes for unsendMessage cascade to ensure atomicity across message soft-delete, reaction cascade, reply flag updates, and lastMessage fallback
- onNewMessage returns early (null) for reaction removal sentinels to avoid unnecessary user/notification lookups
- Reaction messages skip conversation metadata updates entirely (no lastMessage, no unreadCount increment) to prevent conversation list pollution
- lastMessage fallback queries last 5 messages and skips unsent + reaction types to find a valid preview

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prior plan's uncommitted changes staged by lint-staged**

- **Found during:** Task 1 commit
- **Issue:** lint-staged stash/unstash picked up uncommitted messageService.js changes from plan 02-01, committing them alongside Task 1 changes. Commit `fca9ca6` contains both 02-01 service layer and 02-02 Task 1 changes under a 02-01 commit message.
- **Fix:** Noted as deviation; actual file contents are correct. Subsequent Task 2 commit at `ecb9cb9` is clean.
- **Files modified:** src/services/firebase/messageService.js (from prior plan)
- **Verification:** All tests pass, git log shows correct file changes
- **Committed in:** fca9ca6

---

**Total deviations:** 1 auto-fixed (1 blocking - lint-staged commit scope)
**Impact on plan:** No functional impact. All code changes are correct. Commit message attribution is slightly off for Task 1.

## Issues Encountered

- lint-staged pre-commit hook stashes/unstashes all dirty working tree files, causing prior plan's uncommitted changes to be swept into the commit. This is a known behavior with husky + lint-staged when there are unstaged changes in the working tree. Future plans should ensure clean working tree before starting.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- unsendMessage callable ready for client-side integration (Plan 02-03 hook layer)
- onNewMessage correctly routes reaction vs regular messages for notification delivery
- Firestore rules ready for deleteMessageForMe client writes (Plan 02-03+)
- All 90 Cloud Function tests green - no regressions

## Self-Check: PASSED

All files verified present. All commits verified in git log.

- FOUND: functions/index.js
- FOUND: firestore.rules
- FOUND: functions/**tests**/callable/functions.test.js
- FOUND: functions/**tests**/triggers/notifications.test.js
- FOUND: fca9ca6 (Task 1 commit)
- FOUND: ecb9cb9 (Task 2 commit)

---

_Phase: 02-message-interactions_
_Completed: 2026-02-23_
