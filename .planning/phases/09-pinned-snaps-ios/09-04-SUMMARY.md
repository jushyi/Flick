---
phase: 09-pinned-snaps-ios
plan: 04
subsystem: services
tags: [live-activities, notifications, cloud-functions, snap-viewer, recipient-lifecycle]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: "Native LiveActivityManager module (plan 01), liveActivityService bridge (plan 03), snapService pinToScreen with thumbnail upload (plan 03)"
provides:
  - "Cloud Function onNewMessage sends pinned snap data (pinnedActivityId, pinnedThumbnailUrl, caption, senderName) in notification payload"
  - "App.js notification handler starts Live Activity on pinned snap receipt (iOS only, best-effort)"
  - "SnapViewer ends Live Activity after markSnapViewed succeeds for pinned snaps"
  - "5 new unit tests for pinned flag in message data and thumbnail upload behavior"
affects: [09-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Best-effort Live Activity lifecycle: start/end wrapped in try/catch, never blocking snap flow", "Notification data payload extension: string values for push notification data fields"]

key-files:
  created: []
  modified:
    - functions/index.js
    - App.js
    - src/components/SnapViewer.js
    - __tests__/services/snapService.test.js

key-decisions:
  - "Live Activity start triggered in addNotificationReceivedListener (foreground) not response listener -- activity should appear on notification arrival, not on tap"
  - "Thumbnail downloaded to FileSystem.cacheDirectory with deterministic filename (pinned_thumb_{activityId}.jpg) for deduplication"
  - "Pinned notification body uses dedicated text 'pinned a snap to your screen' rather than random snap templates"
  - "endPinnedSnapActivity uses snapMessage.id with fallback to snapMessage.pinnedActivityId for flexibility"

patterns-established:
  - "Notification payload extension: conditionally add data fields to push notification based on message properties (pinned === true)"
  - "Best-effort Live Activity: wrap all start/end calls in try/catch to never block snap send/view flow"

requirements-completed: [PINI-03, PINI-04]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 09 Plan 04: Recipient-Side Live Activity Lifecycle Summary

**Cloud Function sends pinned snap data in notification payload, App.js starts Live Activity on receipt (iOS), SnapViewer dismisses Live Activity on snap view -- all best-effort with try/catch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T15:51:48Z
- **Completed:** 2026-02-26T15:56:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended onNewMessage Cloud Function to include pinned, pinnedActivityId, pinnedThumbnailUrl, caption, senderName, conversationId in notification data when snap has pinned: true
- App.js notification received handler downloads thumbnail and starts Live Activity for pinned snap notifications (iOS only, wrapped in async IIFE with try/catch)
- SnapViewer calls endPinnedSnapActivity after markSnapViewed succeeds for pinned snaps (iOS only, best-effort)
- 5 new unit tests for pinned flag behavior: pinToScreen true/false, defaults, thumbnail upload verification, and non-upload verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Cloud Function onNewMessage to include pinned fields in snap notification payload** - `d07c006` (feat)
2. **Task 2: Wire recipient notification handler (App.js) and SnapViewer dismissal** - `c8d31dc` (feat)

## Files Created/Modified
- `functions/index.js` - onNewMessage conditionally includes pinned snap fields in notification data, pinned snap body uses dedicated template
- `App.js` - Imports Platform, FileSystem, startPinnedSnapActivity; notification received listener starts Live Activity for pinned snaps on iOS
- `src/components/SnapViewer.js` - Imports endPinnedSnapActivity; handleDismiss ends Live Activity after markSnapViewed for pinned snaps
- `__tests__/services/snapService.test.js` - 5 new tests for pinned flag in message data, thumbnail upload paths, and defaults; getDownloadURL mock added

## Decisions Made
- **Live Activity start in received listener:** The Live Activity should appear when the notification arrives (foreground), not when the user taps it. The tapping behavior uses the deep link URL set during startActivity. This means the Live Activity only starts when the app is in the foreground receiving the notification. For background delivery, the push notification payload alone handles the alert.
- **Dedicated pinned notification body:** Used "pinned a snap to your screen" instead of random snap templates for pinned snaps. This gives the recipient clear context about what happened.
- **Thumbnail to cacheDirectory:** Downloaded to `FileSystem.cacheDirectory` with deterministic filename pattern for deduplication. Cache is ephemeral -- appropriate for one-time-use thumbnails.
- **Fallback activity ID:** SnapViewer uses `snapMessage.id || snapMessage.pinnedActivityId` for ending the activity, providing flexibility whether the activity was keyed by message ID or the explicit pinnedActivityId.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Recipient-side Live Activity lifecycle is complete: start on notification, dismiss on view
- Plan 09-05 (integration testing / polish) can proceed
- Pre-existing lint warnings in App.js (getPhotoById, usePhotoDetailActions unused) are out of scope -- not caused by this plan's changes

## Self-Check: PASSED

- All 4 modified files verified present on disk
- Commit d07c006 (Task 1) verified in git log
- Commit c8d31dc (Task 2) verified in git log
- 20/20 tests passing (15 existing + 5 new pinned tests)

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-02-26*
