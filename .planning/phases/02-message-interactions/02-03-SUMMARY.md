---
phase: 02-message-interactions
plan: 03
subsystem: hooks
tags: [react-hooks, useMemo, useCallback, reactions, replies, message-filtering, haptics]

# Dependency graph
requires:
  - phase: 02-message-interactions plan 01
    provides: sendReaction, removeReaction, sendReply, deleteMessageForMe service functions
provides:
  - reactionMap aggregation in useConversation (Map keyed by targetMessageId)
  - Filtered message list excluding reaction messages, with unsent/deleted-for-me placeholders
  - useMessageActions hook for action menu, reply mode, and reaction dispatch state
affects: [02-message-interactions plans 04-06, ConversationScreen, MessageBubble, ReactionPicker]

# Tech tracking
tech-stack:
  added: []
  patterns: [reaction-map-aggregation, message-filtering-pipeline, action-state-hook]

key-files:
  created:
    - src/hooks/useMessageActions.js
    - __tests__/hooks/useMessageActions.test.js
  modified:
    - src/hooks/useConversation.js
    - __tests__/services/messageService.test.js

key-decisions:
  - 'reactionMap uses compound key (targetMessageId_senderId) for one-reaction-per-user enforcement'
  - 'Unsent and deleted-for-me messages kept in list with placeholder flags rather than filtered out'
  - 'handleReaction accepts reactionMap as parameter rather than storing it in hook state'

patterns-established:
  - 'Reaction aggregation: filter reaction-type messages, sort chronologically, last-wins per user per target'
  - 'Message placeholder pattern: _isUnsent and _isDeletedForMe flags with nulled content fields'
  - 'Action state hook pattern: separate hook for UI interaction state, receives callbacks from data hook'

requirements-completed: [REACT-01, REACT-02, REACT-03, REPLY-02, DEL-02]

# Metrics
duration: 8min
completed: 2026-02-23
---

# Phase 2 Plan 03: Hook Layer for Reactions, Replies, and Message Filtering Summary

**useConversation extended with reactionMap aggregation and message filtering; useMessageActions created for action menu, reply, and reaction state management**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-23T22:38:03Z
- **Completed:** 2026-02-23T22:46:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended useConversation with reactionMap computation that aggregates reaction-type messages by targetMessageId, enforcing one reaction per user per message
- Added message filtering pipeline: reaction messages hidden from display list, unsent messages replaced with placeholder (\_isUnsent), deleted-for-me messages replaced with placeholder (\_isDeletedForMe)
- Created useMessageActions hook managing action menu visibility/position, reply target, reaction dispatch (with toggle logic), unsend via Cloud Function, and delete-for-me
- 11 tests for useMessageActions covering all interaction paths, all 80 hook tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useConversation with reaction aggregation and message filtering** - `e6b11ae` (feat)
2. **Task 2: Create useMessageActions hook with tests** - `f3dd6fb` (feat)

Note: Both commits were captured via pre-commit hooks alongside concurrent plan execution. The code changes are verified and correct.

## Files Created/Modified

- `src/hooks/useConversation.js` - Extended with reactionMap useMemo, filtered messages useMemo, useCallback wrappers for sendReaction/removeReaction/sendReply/deleteMessageForMe
- `src/hooks/useMessageActions.js` - New hook managing action menu state, reply mode, reaction dispatch with toggle, unsend via httpsCallable, delete-for-me
- `__tests__/hooks/useMessageActions.test.js` - 11 tests covering openActionMenu, closeActionMenu, handleReaction (send + toggle), handleDoubleTapHeart (send + toggle), startReply, cancelReply, handleUnsend (success + error), handleDeleteForMe
- `__tests__/services/messageService.test.js` - Added mocks and tests for new service functions (pre-existing from Plan 01)

## Decisions Made

- **reactionMap as parameter to handleReaction**: Rather than storing reactionMap inside useMessageActions, it is passed as a parameter. This avoids duplicating the data and keeps useMessageActions focused on UI state while useConversation owns the data.
- **Placeholder flags over filtering**: Unsent and deleted-for-me messages are kept in the list with `_isUnsent` / `_isDeletedForMe` flags and nulled content, rather than being removed entirely. This preserves conversation flow and enables rendering "This message was deleted" placeholders.
- **Timestamp handling in reactionMap**: The sorting logic handles three timestamp formats (toMillis, toDate, raw Date) for robustness across Firestore snapshot types and optimistic local state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Service functions from Plan 01 needed as prerequisite**

- **Found during:** Task 1 (useConversation extension)
- **Issue:** Plan 03 imports sendReaction, removeReaction, sendReply, deleteMessageForMe from messageService but these were being committed by a concurrent Plan 01 execution
- **Fix:** The functions were already present in messageService.js from concurrent execution; no manual fix needed
- **Verification:** All imports resolved, tests pass
- **Committed in:** e6b11ae (concurrent with Plan 01)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency resolved by concurrent execution)
**Impact on plan:** No scope creep. Dependency was satisfied by concurrent Plan 01 execution.

## Issues Encountered

- Pre-commit hooks (lint-staged) captured task commits alongside concurrent plan execution, resulting in task commits being bundled with related changes. All code is correctly committed and verified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- useConversation now provides reactionMap and filtered messages for UI components (Plans 04-06)
- useMessageActions provides complete state management for action menu, reply mode, and reaction dispatch
- Plans 04-06 can consume these hooks directly to build MessageBubble reactions, ReactionPicker, ReplyPreview, and ActionMenu UI components

## Self-Check: PASSED

- [x] src/hooks/useConversation.js - FOUND
- [x] src/hooks/useMessageActions.js - FOUND
- [x] **tests**/hooks/useMessageActions.test.js - FOUND
- [x] .planning/phases/02-message-interactions/02-03-SUMMARY.md - FOUND
- [x] Commit e6b11ae - FOUND
- [x] Commit f3dd6fb - FOUND
- [x] All 80 hook tests pass (6 suites)
- [x] All 20 messageService tests pass

---

_Phase: 02-message-interactions_
_Completed: 2026-02-23_
