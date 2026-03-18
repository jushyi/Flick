---
phase: 10-pinned-snaps-android
plan: 01
subsystem: notifications
tags: [expo-push, android-channel, richContent, BigPictureStyle, signed-url, deep-link]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: "Pinned snap concept, message.pinned field, pinnedThumbnailUrl, NSE mutableContent pattern"
provides:
  - "sendPushNotification accepts richContent and mutableContent via options object"
  - "channelId read from data.channelId (overrideable per notification type)"
  - "pinned-snaps Android notification channel (HIGH importance)"
  - "pinned_snap notification type handler navigating to Conversation with autoOpenSnapId"
  - "onNewMessage pinned snap branch with signed URL generation and richContent push"
  - "Error fallback from pinned snap notification to standard snap notification"
affects: [10-02-PLAN, phase-10-pinned-snaps-android]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "options object pattern for sendPushNotification extensibility (richContent + mutableContent)"
    - "data.channelId overrides default channelId in push notifications"
    - "Signed URL with 30-minute expiry for notification delivery reliability"

key-files:
  created: []
  modified:
    - "functions/notifications/sender.js"
    - "functions/index.js"
    - "src/services/firebase/notificationService.js"
    - "__tests__/services/notificationService.test.js"

key-decisions:
  - "Used options object {richContent, mutableContent} instead of positional params for backward compatibility"
  - "channelId extracted from data payload (data.channelId) allowing per-notification-type channel routing"
  - "notificationData.type set to 'pinned_snap' for pinned snaps (distinct from 'snap') enabling separate tap handler"
  - "30-minute signed URL expiry for FCM delivery latency tolerance"
  - "pinnedThumbnailUrl preferred over snapStoragePath for richContent image (avoids redundant storage access)"

patterns-established:
  - "Options object pattern: sendPushNotification(token, title, body, data, userId, {richContent, mutableContent})"
  - "Channel routing: data.channelId field determines Android notification channel"

requirements-completed: [PINA-01, PINA-02]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 10 Plan 01: Pinned Snap Notification Infrastructure Summary

**Extended sendPushNotification with richContent/channelId, added pinned-snaps Android channel, pinned_snap tap handler, and onNewMessage signed URL branch**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T17:03:37Z
- **Completed:** 2026-03-18T17:11:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended `sendPushNotification` in sender.js with `richContent` (Android BigPictureStyle) and `mutableContent` (iOS NSE) via options object, with channelId read from data.channelId
- Added `pinned-snaps` Android notification channel (HIGH importance) to `initializeNotifications()` and `pinned_snap` case to `handleNotificationTapped()` routing to Conversation with autoOpenSnapId
- Implemented onNewMessage pinned snap branch: generates 30-minute signed URL from pinnedThumbnailUrl or snapStoragePath, sends richContent push with "Pinned snap from {senderName}" title, falls back to standard notification on error
- Added tests for pinned-snaps channel creation on Android and pinned_snap notification tap handler (58 total tests pass)

## Task Commits

Code changes were applied in a prior commit that bundled Phase 10-01 work:

1. **Task 1: Extend sendPushNotification and add client notification infrastructure** - `48cb86e3` (feat)
2. **Task 2: Add pinned snap branch in onNewMessage cloud function** - `48cb86e3` (feat)

Note: Both tasks' changes were already committed in `48cb86e3` (bundled with VideoMuteProvider wiring). This summary documents the verification and plan completion.

## Files Created/Modified
- `functions/notifications/sender.js` - Extended sendPushNotification with options object {richContent, mutableContent}, channelId from data.channelId
- `functions/index.js` - Added pinned snap branch in onNewMessage: type='pinned_snap', channelId='pinned-snaps', signed URL generation, richContent push, error fallback
- `src/services/firebase/notificationService.js` - Added pinned-snaps channel in initializeNotifications, pinned_snap case in handleNotificationTapped
- `__tests__/services/notificationService.test.js` - Added pinned-snaps channel creation test, pinned_snap notification tap handler tests (2 new tests)

## Decisions Made
- **Options object over positional params:** Used `options = {}` with destructuring `{richContent, mutableContent}` for the 6th parameter instead of separate positional args. This preserves backward compatibility with all existing callers.
- **channelId from data payload:** Instead of a separate channelId parameter, the channelId is read from `data.channelId || 'default'`. This allows each notification type to route to its own Android channel by setting channelId in the data object.
- **Distinct notification type:** Pinned snaps use `type: 'pinned_snap'` (not `type: 'snap'`) enabling a separate tap handler and distinct client-side behavior.
- **pinnedThumbnailUrl preferred:** The richContent image URL prefers the pre-existing `message.pinnedThumbnailUrl` field before falling back to generating a signed URL from `message.snapStoragePath`.
- **30-minute signed URL:** Longer than the standard 5-minute expiry to account for FCM delivery latency (push notifications may be delayed by device doze mode, network conditions, etc.).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted sender.js signature to options object pattern**
- **Found during:** Task 1
- **Issue:** Plan specified changing 6th param from `options` to `richContent` positional parameter, but this would break the existing `mutableContent` callers
- **Fix:** Kept `options` object as 6th param, destructured `{richContent, mutableContent}` from it. Both old and new callers work seamlessly.
- **Files modified:** functions/notifications/sender.js
- **Verification:** All existing callers (5-arg) still work; new pinned snap caller passes options object
- **Committed in:** 48cb86e3

**2. [Rule 1 - Bug] Used message.pinned instead of message.isPinned**
- **Found during:** Task 2
- **Issue:** Plan referenced `message.isPinned` but existing codebase uses `message.pinned` (established in Phase 9)
- **Fix:** Used `message.pinned === true` consistent with existing code
- **Files modified:** functions/index.js
- **Verification:** Matches existing pinned snap detection pattern throughout codebase
- **Committed in:** 48cb86e3

---

**Total deviations:** 2 auto-fixed (2 bugs - naming/signature compatibility)
**Impact on plan:** Both fixes necessary for backward compatibility and codebase consistency. No scope creep.

## Issues Encountered
- Pre-existing test failures in functions suite (3 failures: 2 in screenshotNotification.test.js from incomplete Phase 8, 1 in notifications.test.js - known pre-existing reaction lastMessage issue). None caused by Phase 10-01 changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification infrastructure complete; Plan 10-02 can now implement pin toggle UI, isPinned field persistence, notification dismissal on snap view, and 48h expiry cloud function
- The `pinned_snap` notification type and `pinned-snaps` channel are ready for Android client-side rendering

## Self-Check: PASSED

- [x] functions/notifications/sender.js - FOUND (4 richContent references)
- [x] functions/index.js - FOUND (pinned_snap type, pinned-snaps channel, richContent, getSignedUrl)
- [x] src/services/firebase/notificationService.js - FOUND (pinned-snaps channel)
- [x] __tests__/services/notificationService.test.js - FOUND (8 pinned_snap references)
- [x] 10-01-SUMMARY.md - FOUND
- [x] Commit 48cb86e3 - FOUND

---
*Phase: 10-pinned-snaps-android*
*Completed: 2026-03-18*
