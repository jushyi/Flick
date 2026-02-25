---
phase: 01-message-infrastructure-read-receipts
plan: 01
subsystem: messaging
tags: [firestore, read-receipts, real-time, onSnapshot, AppState, security-rules]

# Dependency graph
requires: []
provides:
  - Firestore rules allowing readReceipts and snap field updates on conversation/message documents
  - Extended markConversationRead writing readReceipts timestamps atomically with unreadCount reset
  - useConversation hook conversation document subscription exposing real-time readReceipts data
  - First-read-only and foreground-only guards for read receipt writes
  - Comprehensive tests for messageService readReceipts and useConversation subscription
affects: [01-02, 01-03, 01-04, 05-photo-tag-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Conversation-level read receipts via readReceipts map field on conversation document'
    - 'First-read-only semantics: check unreadCount > 0 before writing readReceipts'
    - 'Foreground-only guard: gate Firestore writes on AppState.currentState === active'
    - 'AppState listener pattern for triggering actions on foreground return'

key-files:
  created:
    - __tests__/services/messageService.test.js
    - __tests__/hooks/useConversation.test.js
  modified:
    - firestore.rules
    - src/services/firebase/messageService.js
    - src/hooks/useConversation.js

key-decisions:
  - 'readReceipts stored as conversation-level map field, not per-message writes (1 write per conversation open)'
  - 'First-read-only: markConversationRead only called when unreadCount > 0, preserving original read timestamp on re-opens'
  - 'Foreground-only guard: AppState check prevents read receipt writes while app is backgrounded'
  - 'onNewMessage Cloud Function already includes type field in lastMessage - no changes needed'

patterns-established:
  - 'Conversation document subscription in useConversation via onSnapshot for real-time metadata'
  - 'AppState.addEventListener pattern for foreground-return triggers with cleanup'
  - 'Service test pattern: mock functions at module scope, jest.mock with delegation, require after mocks'

requirements-completed: [INFRA-01, INFRA-02, READ-02, READ-03]

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 01 Plan 01: Backend Infrastructure Summary

**Firestore rules for readReceipts and snap fields, conversation-level read receipts via extended markConversationRead, real-time conversation document subscription in useConversation with first-read-only and foreground-only guards**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-23T19:26:52Z
- **Completed:** 2026-02-23T19:33:18Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Firestore security rules extended to allow readReceipts on conversations and viewedAt/screenshotted on messages by non-senders
- markConversationRead atomically writes both unreadCount reset and readReceipts timestamp in a single Firestore write
- useConversation hook now subscribes to the conversation document via onSnapshot, exposing real-time readReceipts data
- Read receipt writes are gated by both first-read-only semantics (unreadCount > 0) and foreground-only guard (AppState === active)
- 15 new tests covering all service and hook changes (7 messageService + 8 useConversation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Firestore rules and extend messageService with readReceipts** - `8df8f68` (feat)
2. **Task 2: Extend useConversation hook with conversation doc subscription and read guards** - `32c411e` (feat)
3. **Task 3: Write tests for messageService readReceipts and useConversation subscription** - `a9487e7` (test)

## Files Created/Modified

- `firestore.rules` - Added readReceipts to conversation update allowlist, added message update rule for viewedAt/screenshotted by non-senders
- `src/services/firebase/messageService.js` - Extended markConversationRead to write readReceipts.[userId] alongside unreadCount reset
- `src/hooks/useConversation.js` - Added conversation document onSnapshot subscription, first-read-only guard, foreground-only guard, AppState listener, exposed conversationDoc in return
- `__tests__/services/messageService.test.js` - New test file: 7 tests for readReceipts write, success/error returns, missing params, serverTimestamp usage
- `__tests__/hooks/useConversation.test.js` - New test file: 8 tests for conversation doc subscription, readReceipts exposure, first-read-only guard, foreground-only guard, AppState foreground return, cleanup

## Decisions Made

- readReceipts stored as conversation-level map field (readReceipts.[userId]: serverTimestamp), not per-message writes. This follows the architecture decision in CONTEXT.md for 1 write per conversation open.
- First-read-only semantics implemented in the hook layer (checking unreadCount > 0), not in the service function. The service always writes when called; the hook decides when to call.
- Foreground-only guard uses AppState.currentState check plus an AppState change listener to handle the case where the user backgrounds the app with a conversation open and then returns.
- onNewMessage Cloud Function already includes type field in lastMessage object (line 2662: `type: message.type || 'text'`). Verified and left as-is per plan instructions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend infrastructure for read receipts is complete and tested
- Subsequent plans (01-02 through 01-04) can now build UI components that consume readReceipts data from the conversation document
- Firestore rules are deployed-ready for readReceipts and snap field updates

## Self-Check: PASSED

All 5 created/modified files verified present. All 3 task commits verified in git log. Key patterns (readReceipts in firestore.rules, messageService.js, useConversation.js) confirmed.

---

_Phase: 01-message-infrastructure-read-receipts_
_Completed: 2026-02-23_
