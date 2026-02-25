---
phase: 02-message-interactions
plan: 01
subsystem: api
tags: [firestore, reactions, replies, message-service, arrayUnion]

# Dependency graph
requires:
  - phase: 01-message-infrastructure-read-receipts
    provides: messageService.js with sendMessage, conversation CRUD, subscriptions
provides:
  - sendReaction service function for creating reaction message documents
  - removeReaction service function using null-emoji sentinel pattern
  - sendReply service function with denormalized replyTo preview
  - deleteMessageForMe service function using arrayUnion on conversation doc
affects:
  [
    02-message-interactions plans 02-06,
    useConversation hook,
    MessageBubble component,
    Cloud Functions,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      reaction-as-message-document,
      null-emoji-removal-sentinel,
      denormalized-reply-preview,
      per-user-deleted-messages-array,
    ]

key-files:
  created: []
  modified:
    - src/services/firebase/messageService.js
    - __tests__/services/messageService.test.js

key-decisions:
  - 'Reaction removal uses null-emoji sentinel instead of Cloud Function delete'
  - 'Reply text truncated to 100 chars to keep denormalized preview compact'
  - 'Image URLs excluded from replyTo to avoid signed URL expiry issues'
  - 'deleteMessageForMe uses arrayUnion for atomic array updates on conversation doc'

patterns-established:
  - "Reaction message pattern: type:'reaction' with emoji and targetMessageId fields"
  - 'Removal sentinel pattern: emoji:null signals reaction removal in client-side aggregation'
  - 'Reply denormalization: replyTo object with messageId, senderId, type, text, deleted flag'

requirements-completed: [REACT-04, REPLY-03]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 2 Plan 1: Message Service Functions Summary

**Four service functions (sendReaction, removeReaction, sendReply, deleteMessageForMe) with 13 new tests covering reactions as separate message docs, null-emoji removal sentinel, and denormalized reply previews**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T22:37:38Z
- **Completed:** 2026-02-23T22:41:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added sendReaction and removeReaction following the reaction-as-message-document pattern with null-emoji removal sentinel
- Added sendReply with denormalized replyTo object containing original message preview (text truncated to 100 chars, no image URLs)
- Added deleteMessageForMe using arrayUnion for atomic per-user message hiding on conversation doc
- Added 13 comprehensive tests covering happy paths, validation failures, and document shape verification
- All 20 tests pass (7 existing + 13 new) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sendReaction, removeReaction, and sendReply to messageService** - `fca9ca6` (feat)
2. **Task 2: Add deleteMessageForMe and write tests for all new functions** - `e6b11ae` (test)

## Files Created/Modified

- `src/services/firebase/messageService.js` - Added sendReaction, removeReaction, sendReply, deleteMessageForMe service functions with arrayUnion import
- `__tests__/services/messageService.test.js` - Added 13 new tests across 4 describe blocks for all new functions

## Decisions Made

- Used null-emoji sentinel pattern for reaction removal (avoids needing a Cloud Function, works within existing security rules)
- Reply text truncated to 100 characters in denormalized preview to keep documents compact
- Image/GIF URLs excluded from replyTo object to avoid signed URL expiry issues (only type label stored)
- deleteMessageForMe uses arrayUnion on conversation document field for atomic array updates

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four service functions ready for consumption by hooks and UI components in plans 02-06
- Cloud Function extension (onNewMessage for reactions) needed in a later plan
- Firestore security rules already updated (pre-existing change adds deletedMessages to allowed fields)

## Self-Check: PASSED

- FOUND: src/services/firebase/messageService.js
- FOUND: **tests**/services/messageService.test.js
- FOUND: fca9ca6 (Task 1 commit)
- FOUND: e6b11ae (Task 2 commit)

---

_Phase: 02-message-interactions_
_Completed: 2026-02-23_
