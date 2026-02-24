---
phase: 03-snap-messages
plan: 01
subsystem: messaging
tags: [firebase, cloud-functions, storage, signed-urls, snaps, ephemeral]

# Dependency graph
requires:
  - phase: 01-message-infrastructure
    provides: messageService.js, onNewMessage Cloud Function, conversation data model
provides:
  - snapService.js client service (uploadAndSendSnap, markSnapViewed, getSignedSnapUrl)
  - getSignedSnapUrl Cloud Function (5-minute signed URLs for snap-photos/ paths)
  - onSnapViewed Cloud Function (deletes Storage file on viewedAt transition)
  - cleanupExpiredSnaps scheduled function (orphan cleanup every 2 hours)
  - onNewMessage snap type handling (lastMessage preview, push notifications)
affects: [03-02 snap camera UI, 03-03 snap viewer, 03-04 snap bubbles, 03-05 snap input button]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      snap-photos/ Storage path with no-cache headers,
      48h expiresAt safety net,
      5-min signed URLs for ephemeral content,
      auto-retry with exponential backoff,
    ]

key-files:
  created:
    - src/services/firebase/snapService.js
    - __tests__/services/snapService.test.js
    - functions/__tests__/snapFunctions.test.js
  modified:
    - functions/index.js

key-decisions:
  - '5-minute signed URL expiry for snap photos (shorter than 24h for regular photos)'
  - 'Auto-retry 3x with exponential backoff (1s, 2s, 4s) returns retriesExhausted flag for UI'
  - 'Snap lastMessage preview uses text:null and type:snap (client renders icon+label)'
  - 'Randomized push notification templates without emojis per user decision'
  - 'onSnapViewed is best-effort cleanup (logs errors but does not throw)'

patterns-established:
  - 'Snap storage path pattern: snap-photos/{senderId}/{snapId}.jpg with cacheControl: no-store'
  - 'Snap message document schema: type:snap with snapStoragePath, caption, viewedAt, expiresAt fields'
  - 'Client-side path validation before calling Cloud Functions (snap-photos/ prefix guard)'

requirements-completed: [SNAP-03, SNAP-06, SNAP-07, SNAP-08]

# Metrics
duration: 6min
completed: 2026-02-24
---

# Phase 3 Plan 1: Snap Service Layer Summary

**Complete snap lifecycle service layer with auto-retry upload, 5-min signed URLs, view-once cleanup, and scheduled orphan deletion**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-24T17:41:48Z
- **Completed:** 2026-02-24T17:47:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Built snapService.js with three client functions following project service pattern ({success, error} returns)
- uploadAndSendSnap includes 3-retry exponential backoff with retriesExhausted flag for tap-to-retry UI
- Added 3 new Cloud Functions: getSignedSnapUrl (callable), onSnapViewed (trigger), cleanupExpiredSnaps (scheduled)
- Extended onNewMessage to handle type:snap for lastMessage preview and randomized push notifications
- 30 total tests passing (15 client + 15 Cloud Functions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create snapService.js client service + tests** - `649e57f` (feat)
2. **Task 2: Add snap Cloud Functions + extend onNewMessage + tests** - `ec2d4bc` (feat)

## Files Created/Modified

- `src/services/firebase/snapService.js` - Client service: uploadAndSendSnap, markSnapViewed, getSignedSnapUrl
- `__tests__/services/snapService.test.js` - 15 unit tests for client service including retry scenarios
- `functions/index.js` - 3 new Cloud Functions + onNewMessage snap type handling + SNAP_BODY_TEMPLATES
- `functions/__tests__/snapFunctions.test.js` - 15 unit tests for Cloud Functions

## Decisions Made

- 5-minute signed URL expiry for snap photos (much shorter than the 24-hour expiry for regular photos, matching the ephemeral nature of snaps)
- Auto-retry 3 attempts with exponential backoff (1s, 2s, 4s delays) returns retriesExhausted:true so UI can show tap-to-retry state
- Snap lastMessage preview sets text to null and type to 'snap' (client renders camera icon + "Snap" label)
- Three randomized push notification templates without emojis: "sent you a snap", "just snapped you", "New snap"
- onSnapViewed uses best-effort cleanup pattern (logs errors but does not throw, allowing degraded behavior)
- cleanupExpiredSnaps limited to 100 per run to avoid Cloud Function timeout

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failure found in `functions/__tests__/triggers/notifications.test.js` for reaction message handling in onNewMessage. The test expects reactions to NOT update lastMessage, but the production code does update it. This is unrelated to our snap changes (confirmed by running the test on the prior commit). Logged as out-of-scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Snap service layer complete and fully tested -- ready for Plan 02 (snap camera UI), Plan 03 (snap viewer), and Plan 04 (snap message bubbles) to consume
- All three client functions (uploadAndSendSnap, markSnapViewed, getSignedSnapUrl) exported and available for import
- Cloud Functions deployed to functions/index.js -- user should deploy via `firebase deploy --only functions` when ready
- Infrastructure configuration (Firestore TTL on expiresAt, GCS lifecycle on snap-photos/) covered by separate plans (INFRA-03, INFRA-04)

## Self-Check: PASSED

- [x] src/services/firebase/snapService.js - FOUND
- [x] **tests**/services/snapService.test.js - FOUND
- [x] functions/**tests**/snapFunctions.test.js - FOUND
- [x] .planning/phases/03-snap-messages/03-01-SUMMARY.md - FOUND
- [x] Commit 649e57f (Task 1) - FOUND
- [x] Commit ec2d4bc (Task 2) - FOUND

---

_Phase: 03-snap-messages_
_Completed: 2026-02-24_
