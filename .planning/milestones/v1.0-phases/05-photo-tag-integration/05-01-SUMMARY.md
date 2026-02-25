---
phase: 05-photo-tag-integration
plan: 01
subsystem: api
tags: [cloud-functions, firestore, push-notifications, dm-messages, photo-tagging, attribution]

# Dependency graph
requires:
  - phase: 01-message-infrastructure
    provides: conversations collection, onNewMessage trigger, DM message types
provides:
  - sendTaggedPhotoNotification creates type:tagged_photo DM messages for each tagged user
  - onNewMessage handles tagged_photo type for lastMessage preview and push notifications
  - addTaggedPhotoToFeed callable Cloud Function with attribution and idempotency
  - getOrCreateConversationServer helper for server-side conversation creation
affects: [05-02, 05-03, photo-tag-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      server-side conversation creation helper,
      Promise.allSettled for concurrent user processing,
      message-based tag delivery via DM pipeline,
      callable function with idempotency guard,
    ]

key-files:
  created:
    - functions/__tests__/callable/addTaggedPhotoToFeed.test.js
    - .planning/phases/05-photo-tag-integration/deferred-items.md
  modified:
    - functions/index.js
    - functions/__tests__/triggers/notifications.test.js

key-decisions:
  - 'DM messages replace activity feed notifications for tags (migration: new tags only)'
  - 'Block check before conversation creation prevents blocked users from receiving tag DMs'
  - 'Promise.allSettled for concurrent tag processing (one failure does not block others)'
  - 'Photographer notification uses exact text not randomized templates per user decision'
  - 'Idempotency via addedToFeedBy map field on message document'

patterns-established:
  - 'getOrCreateConversationServer: deterministic conversation ID creation for Admin SDK'
  - 'tagged_photo message type: new DM message type with photoId, photoURL, photoOwnerId fields'
  - 'addedToFeedBy map: per-recipient tracking of reshared photos on message documents'
  - 'attribution object: photographerId, photographerUsername, photographerDisplayName, originalPhotoId'

requirements-completed: [TAG-01, TAG-03]

# Metrics
duration: 9min
completed: 2026-02-24
---

# Phase 05 Plan 01: Server-Side Photo Tag Pipeline Summary

**Cloud Functions pipeline for tag-to-DM delivery with getOrCreateConversation, tagged_photo message type in onNewMessage, and addTaggedPhotoToFeed callable with attribution and idempotency**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-24T22:39:41Z
- **Completed:** 2026-02-24T22:49:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Refactored sendTaggedPhotoNotification from push+activity-notification to DM message creation with block checking and concurrent processing
- Extended onNewMessage to handle tagged_photo type for lastMessage preview, notification body, and notification data type mapping
- Created addTaggedPhotoToFeed callable with full auth, validation, idempotency, attribution, and photographer notification
- 17 new tests covering all three Cloud Function changes (6 tag DM, 3 onNewMessage, 8 addTaggedPhotoToFeed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify sendTaggedPhotoNotification + extend onNewMessage + create addTaggedPhotoToFeed** - `e61d14b` (feat)
2. **Task 2: Tests for Cloud Function changes** - `d5695ce` (test)

## Files Created/Modified

- `functions/index.js` - Modified sendTaggedPhotoNotification, extended onNewMessage, added getOrCreateConversationServer helper, added addTaggedPhotoToFeed callable
- `functions/__tests__/triggers/notifications.test.js` - Updated existing tag test, added 6 DM message creation tests, added 3 onNewMessage tagged_photo tests
- `functions/__tests__/callable/addTaggedPhotoToFeed.test.js` - New test file with 8 tests for the addTaggedPhotoToFeed callable
- `.planning/phases/05-photo-tag-integration/deferred-items.md` - Documented pre-existing test failure

## Decisions Made

- DM messages replace activity feed notifications for tags (new tags only; existing activity notifications left as-is)
- Block check queries blocks collection where blockerId==taggedUser and blockedId==tagger before creating conversation
- Promise.allSettled used for concurrent tag processing so one user's failure does not block others
- Photographer notification uses exact text "[Name] added your photo to their feed" (not randomized templates) per user decision from CONTEXT.md
- Idempotency implemented via addedToFeedBy map field on message document -- calling addTaggedPhotoToFeed twice returns existing newPhotoId
- Attribution object stores photographerId, photographerUsername, photographerDisplayName, originalPhotoId permanently on reshared photo
- Reshared photos use status:'triaged', photoState:'journal' to skip darkroom and appear on feed immediately

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing sendTaggedPhotoNotification test to match refactored behavior**

- **Found during:** Task 2 (Tests)
- **Issue:** Existing test `should send notification immediately when user is tagged` expected sendPushNotification to be called directly, but refactored function creates DM messages instead (onNewMessage handles push)
- **Fix:** Updated test to verify sendPushNotification is NOT called directly (DM message creation is tested in new test suite)
- **Files modified:** functions/**tests**/triggers/notifications.test.js
- **Verification:** Test passes with updated assertion
- **Committed in:** d5695ce (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix on existing test)
**Impact on plan:** Necessary correction to match refactored behavior. No scope creep.

## Issues Encountered

- Pre-existing test failure in `onNewMessage - reaction handling > should not update lastMessage or unreadCount for reaction messages` -- test assertion is wrong (code intentionally updates lastMessage for reactions, only unreadCount is skipped). Logged to deferred-items.md. Not caused by Phase 05 changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Server-side pipeline complete: tags create DM messages, onNewMessage handles tagged_photo type, addTaggedPhotoToFeed callable ready
- Plan 02 can build TaggedPhotoBubble component and MessageBubble delegation on top of these Cloud Function changes
- Plan 03 can build FeedPhotoCard attribution display using the attribution object structure established here

## Self-Check: PASSED

All files exist, all commits verified:

- functions/index.js: FOUND
- functions/**tests**/triggers/notifications.test.js: FOUND
- functions/**tests**/callable/addTaggedPhotoToFeed.test.js: FOUND
- .planning/phases/05-photo-tag-integration/05-01-SUMMARY.md: FOUND
- Commit e61d14b: FOUND
- Commit d5695ce: FOUND

---

_Phase: 05-photo-tag-integration_
_Completed: 2026-02-24_
