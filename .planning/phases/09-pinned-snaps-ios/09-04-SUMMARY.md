---
phase: 09-pinned-snaps-ios
plan: 04
subsystem: services
tags: [live-activities, notifications, cloud-functions, snap-viewer, ios, deep-link]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: "liveActivityService.js bridge (Plan 03), snapService pinned snap support (Plan 03), LiveActivityManager native module (Plan 01)"
provides:
  - "Cloud Function onNewMessage includes pinned fields in snap notification data payload"
  - "App.js notification received handler starts Live Activity for pinned snap notifications (iOS only)"
  - "SnapViewer ends Live Activity via endPinnedSnapActivity when pinned snap is viewed"
  - "5 new snapService tests covering pinned flag, thumbnail upload, and defaults"
affects: [09-05, 10-pinned-snaps-android]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Notification received handler triggers Live Activity start with thumbnail download", "Best-effort Live Activity lifecycle wrapping in try/catch", "Conditional notification data fields for pinned snaps in Cloud Function"]

key-files:
  created: []
  modified:
    - functions/index.js
    - App.js
    - src/components/SnapViewer.js
    - __tests__/services/snapService.test.js

key-decisions:
  - "Live Activity started in notification received listener (not response listener) so it appears immediately on lock screen"
  - "Thumbnail downloaded to cache directory via expo-file-system before passing to startPinnedSnapActivity"
  - "Pinned snap body text uses 'pinned a snap to your screen' instead of randomized templates for clarity"
  - "All notification data values are strings (push notification constraint) -- pinned sent as 'true' string"
  - "endPinnedSnapActivity uses snapMessage.id as activityId with pinnedActivityId as fallback"

patterns-established:
  - "Notification-to-Live-Activity pattern: download thumbnail to cache, then call startPinnedSnapActivity in async IIFE"
  - "Best-effort Live Activity dismissal: wrapped in try/catch after markSnapViewed success, never blocks snap flow"

requirements-completed: [PINI-03, PINI-04]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 9 Plan 04: Recipient-Side Live Activity Lifecycle Summary

**Cloud Function pinned snap notification payload, App.js Live Activity start on notification receipt, and SnapViewer dismissal on view**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T16:43:08Z
- **Completed:** 2026-03-04T16:46:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Updated Cloud Function onNewMessage to conditionally include pinned, pinnedActivityId, pinnedThumbnailUrl, caption, senderName in notification data for pinned snaps
- Wired App.js notification received listener to download thumbnail and start Live Activity on iOS when pinned snap notification arrives
- Added endPinnedSnapActivity call in SnapViewer after markSnapViewed succeeds for pinned snaps
- Extended snapService tests with 5 new tests covering pinned flag in message data, thumbnail upload to snap-thumbnails/ path, and default behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Cloud Function onNewMessage to include pinned fields in snap notification payload** - `7e67657` (feat)
2. **Task 2: Wire recipient notification handler (App.js) and SnapViewer dismissal** - `8997d10` (feat)

## Files Created/Modified
- `functions/index.js` - Added conditional pinned fields to notification data in onNewMessage snap handler, custom body text for pinned snaps
- `App.js` - Added Platform import, FileSystem import, startPinnedSnapActivity import; notification received listener downloads thumbnail and starts Live Activity for pinned snaps (iOS only)
- `src/components/SnapViewer.js` - Added endPinnedSnapActivity import; handleDismiss calls endPinnedSnapActivity after markSnapViewed success when snap.pinned is true (iOS only)
- `__tests__/services/snapService.test.js` - Added mockGetDownloadURL, ImageManipulator import, 5 new tests for pinned flag behavior

## Decisions Made
- **Notification body for pinned snaps:** Used a distinct "pinned a snap to your screen" body text instead of the randomized SNAP_BODY_TEMPLATES, since the Live Activity is the primary UX and the notification text should clearly indicate pinning
- **Thumbnail download location:** Used FileSystem.cacheDirectory (not documentDirectory) since the thumbnail is ephemeral and only needed for Live Activity creation
- **Live Activity trigger point:** Starts in the notification received listener (fires immediately when notification arrives) rather than the response listener (fires on tap), so the Live Activity appears on the lock screen without user interaction
- **Activity ID for dismissal:** Uses snapMessage.id (the Firestore message document ID) as the primary activityId, with pinnedActivityId as fallback, since the message ID is reliably available in SnapViewer context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed CRLF line endings on all modified files**
- **Found during:** Task 2
- **Issue:** Write/Edit tool creates files with CRLF line endings on Windows, but project uses LF
- **Fix:** Ran `npx eslint --fix` on all source files to normalize line endings
- **Files modified:** App.js, src/components/SnapViewer.js, __tests__/services/snapService.test.js
- **Verification:** `npx eslint` passes cleanly (0 errors, only pre-existing warnings)
- **Committed in:** 8997d10 (part of Task 2 commit via lint-staged)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Line ending normalization is standard Windows development overhead. No functional impact.

## Issues Encountered
None -- plan executed cleanly.

## User Setup Required
None - no external service configuration required. Cloud Function changes require `firebase deploy --only functions` when ready.

## Next Phase Readiness
- Complete recipient-side Live Activity lifecycle is wired: notification triggers start, viewing triggers end
- Plan 05 (end-to-end testing/polish) can now verify the full pinned snap flow from send to dismiss
- Cloud Function needs deployment (`firebase deploy --only functions`) to activate the notification payload changes in production
- All 20 snapService tests pass, lint clean

## Self-Check: PASSED

All 4 modified files verified present on disk. Both commit hashes (7e67657, 8997d10) verified in git log.

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-04*
