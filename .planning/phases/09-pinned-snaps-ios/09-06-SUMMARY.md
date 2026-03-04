---
phase: 09-pinned-snaps-ios
plan: 06
subsystem: services
tags: [live-activities, notification-service-extension, nse, push-notifications, ios, activitykit, cloud-functions]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: "LiveActivityManager native module (Plan 01), liveActivityService.js bridge (Plan 03), Cloud Function pinned payload and App.js notification start (Plan 04)"
provides:
  - "Notification Service Extension (FlickNotificationService) that starts Live Activities in all app states (foreground, background, killed)"
  - "Cloud Function sends mutableContent flag for pinned snap notifications to trigger NSE on iOS"
  - "Native module deduplication prevents double Live Activities when both NSE and JS handler could fire"
  - "App.js foreground handler cleaned up -- NSE handles all Live Activity starts"
affects: [10-pinned-snaps-android]

# Tech tracking
tech-stack:
  added: [UNNotificationServiceExtension]
  patterns: ["NSE intercepts push with mutable-content flag to start Live Activity in separate process", "Deduplication by activityId before starting new Live Activity", "Expo _mutableContent flag triggers APNS mutable-content header"]

key-files:
  created:
    - targets/FlickNotificationService/expo-target.config.js
    - targets/FlickNotificationService/NotificationService.swift
    - targets/FlickNotificationService/PinnedSnapAttributes.swift
    - targets/FlickNotificationService/Info.plist
  modified:
    - modules/live-activity-manager/src/LiveActivityManagerModule.swift
    - functions/notifications/sender.js
    - functions/index.js
    - App.js

key-decisions:
  - "NSE downloads thumbnail via URLSession to App Groups container (same path as native module uses) for widget access"
  - "Deduplication checks activityId attribute match -- returns existing activity.id if already running"
  - "Used Expo SDK _mutableContent field which maps to APNS mutable-content:1 header"
  - "Removed Platform, FileSystem, and startPinnedSnapActivity imports from App.js since NSE handles all states"
  - "Cap enforcement in NSE runs after Activity.request (not before) to avoid race with newly created activity"

patterns-established:
  - "NSE pattern: intercept push, download media, start Live Activity, deliver notification -- all within 30s limit"
  - "mutableContent opt-in: only pinned snap notifications get _mutableContent flag, all others unaffected"

requirements-completed: [PINI-03, PINI-04]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 9 Plan 06: Notification Service Extension for Background Live Activities Summary

**UNNotificationServiceExtension that starts Live Activities from push notifications in all app states, with Cloud Function mutableContent flag and native module deduplication**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T17:50:09Z
- **Completed:** 2026-03-04T17:54:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created FlickNotificationService target with UNNotificationServiceExtension that intercepts pinned snap push notifications and starts Live Activities in all app states (foreground, background, killed)
- NSE downloads thumbnail to App Groups container via URLSession for widget extension display
- Added deduplication check in native LiveActivityManagerModule to skip starting a Live Activity if the NSE already started one with the same activityId
- Updated Cloud Function sendPushNotification with optional mutableContent option that sets _mutableContent flag on Expo push messages
- Cleaned up App.js foreground notification handler by removing the Live Activity start block (NSE handles it now) and removing unused imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Notification Service Extension target** - `1f1e375` (feat)
2. **Task 2: Add deduplication to native module and update Cloud Function for mutableContent** - `ca84eec` (feat)

## Files Created/Modified
- `targets/FlickNotificationService/expo-target.config.js` - @bacons/apple-targets config for notification-service extension type with ActivityKit framework and App Groups entitlement
- `targets/FlickNotificationService/NotificationService.swift` - UNNotificationServiceExtension that intercepts pinned snap pushes, downloads thumbnail, starts Live Activity with deduplication and cap enforcement
- `targets/FlickNotificationService/PinnedSnapAttributes.swift` - Synced copy of ActivityAttributes struct for NSE process
- `targets/FlickNotificationService/Info.plist` - NSExtension configuration for notification service principal class
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` - Added deduplication check before cap enforcement in startActivity
- `functions/notifications/sender.js` - Added optional 6th parameter (options) with _mutableContent support
- `functions/index.js` - Pass mutableContent: true for pinned snap notifications in onNewMessage handler
- `App.js` - Removed Live Activity start block from foreground notification listener, removed unused FileSystem/Platform/startPinnedSnapActivity imports

## Decisions Made
- **Thumbnail download in NSE:** Used URLSession.shared.data(from:) since no third-party dependencies are available in extension processes. Saves to same App Groups thumbnails/ path the widget reads from.
- **Deduplication placement:** Added deduplication before cap enforcement in native module so that if NSE already started the activity, the JS call returns the existing activity ID without side effects.
- **mutableContent backwards compatibility:** The 6th parameter defaults to empty object `{}`, so all existing callers continue to work unchanged without passing options.
- **App.js cleanup:** Removed Platform import entirely since no other code in App.js uses it after the Live Activity block was removed. FileSystem and startPinnedSnapActivity imports also removed.
- **Cap enforcement timing in NSE:** Runs after Activity.request() to ensure the new activity exists before potentially ending the oldest, avoiding a count mismatch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None -- plan executed cleanly.

## User Setup Required
- Requires a new native EAS build (the NSE is native code, not OTA-deployable)
- Cloud Function changes require `firebase deploy --only functions` to activate mutableContent in production

## Next Phase Readiness
- Complete NSE + deduplication + mutableContent pipeline is wired for pinned snap Live Activities
- All 3 PinnedSnapAttributes.swift copies (native module, widget extension, NSE) are verified identical
- Phase 9 Pinned Snaps iOS is feature-complete pending Plan 05 (end-to-end testing/polish)
- Requires new native build before testing (NSE is native code)

## Self-Check: PASSED

All 4 created files verified present on disk. Both commit hashes (1f1e375, ca84eec) verified in git log.

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-04*
