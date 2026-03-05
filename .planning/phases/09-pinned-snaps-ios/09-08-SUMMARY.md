---
phase: 09-pinned-snaps-ios
plan: 08
subsystem: infra
tags: [nse, notification-service-extension, live-activity, cleanup, rich-notifications, swift]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: Live Activity infrastructure (plans 01-04, 06-07) that is now removed
provides:
  - Clean codebase with zero Live Activity references
  - Simplified NSE (~85 lines) that creates UNNotificationAttachment from snap thumbnail
  - NSE target config without ActivityKit framework or App Groups entitlement
affects: [09-09, 09-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NSE thumbnail-only pattern: download to temp dir, create UNNotificationAttachment"
    - "Expo body data 3-path parsing preserved for NSE compatibility"

key-files:
  created: []
  modified:
    - targets/FlickNotificationService/NotificationService.swift
    - targets/FlickNotificationService/expo-target.config.js
    - targets/FlickNotificationService/Info.plist
    - app.json
    - App.js
    - src/components/SnapViewer.js
    - src/screens/SettingsScreen.js

key-decisions:
  - "Replaced ~298-line ActivityKit NSE with ~85-line thumbnail-attachment-only version"
  - "Lowered NSE deploymentTarget from 16.2 to 16.0 (ActivityKit no longer required)"
  - "Version display changed from TouchableOpacity with diagnostics to plain View"
  - "SnapViewer handleDismiss left TODO placeholder for dismissPinnedSnapNotification (Plan 09-09)"

patterns-established:
  - "NSE downloads thumbnail to FileManager.default.temporaryDirectory (not App Groups)"
  - "threadIdentifier set to pinned-{conversationId} for notification grouping"

requirements-completed: [PINI-02, PINI-04, PINI-05]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 9 Plan 08: Remove Live Activity Infrastructure Summary

**Deleted all Live Activity code (widget, native module, JS service, config plugin) and rewrote NSE to ~85-line thumbnail-attachment-only version for rich notifications**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T19:02:33Z
- **Completed:** 2026-03-05T19:06:57Z
- **Tasks:** 2
- **Files modified:** 22 (19 deleted, 3 rewritten/modified)

## Accomplishments
- Removed entire FlickLiveActivity widget extension (5 files), live-activity-manager native module (6 files), liveActivityService.js, its test, withNSELiveActivities config plugin, and NSE PinnedSnapAttributes.swift
- Cleaned App.js, SnapViewer.js, SettingsScreen.js, and app.json of all Live Activity references
- Rewrote NotificationService.swift from ~298 lines to ~85 lines: downloads thumbnail via URLSession, creates UNNotificationAttachment for rich notification display
- Stripped NSE target config of ActivityKit framework, App Groups entitlement, lowered deploymentTarget

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete Live Activity infrastructure and clean up references** - `519e669` (feat)
2. **Task 2: Rewrite NSE for thumbnail-only rich notifications** - `a1306b7` (feat)

## Files Created/Modified
- `targets/FlickLiveActivity/` - DELETED (entire directory, 5 files)
- `modules/live-activity-manager/` - DELETED (entire directory, 6 files)
- `src/services/liveActivityService.js` - DELETED
- `__tests__/services/liveActivityService.test.js` - DELETED
- `plugins/withNSELiveActivities.js` - DELETED
- `targets/FlickNotificationService/PinnedSnapAttributes.swift` - DELETED
- `targets/FlickNotificationService/NotificationService.swift` - Rewritten: thumbnail download + UNNotificationAttachment, no ActivityKit
- `targets/FlickNotificationService/expo-target.config.js` - Stripped ActivityKit framework and App Groups
- `targets/FlickNotificationService/Info.plist` - Removed NSSupportsLiveActivities key
- `app.json` - Removed withNSELiveActivities plugin and NSSupportsLiveActivities from infoPlist
- `App.js` - Removed liveActivityService import and Live Activity start block from notification listener
- `src/components/SnapViewer.js` - Removed endPinnedSnapActivity, added TODO for Plan 09-09
- `src/screens/SettingsScreen.js` - Removed NSE diagnostics imports, handler, and onLongPress

## Decisions Made
- Replaced ~298-line ActivityKit NSE with ~85-line thumbnail-attachment-only version
- Lowered NSE deploymentTarget from 16.2 to 16.0 since ActivityKit is no longer required
- Changed SettingsScreen version display from TouchableOpacity (with diagnostics onLongPress) to plain View
- Left TODO placeholder in SnapViewer handleDismiss for dismissPinnedSnapNotification (Plan 09-09 will wire this)
- Removed Platform import from App.js since it was only used for the Live Activity iOS guard
- Kept Platform import in SnapViewer since it's used for Android back button and shadow styles

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Note: a native EAS build is required to deploy the NSE changes (this is not OTA-deployable).

## Next Phase Readiness
- NSE is simplified and ready for Plan 09-09 (wire dismissPinnedSnapNotification)
- Cloud Function notification payload preserved (pinned, pinnedActivityId, pinnedThumbnailUrl, mutableContent) for NSE to consume
- Codebase is clean of all Live Activity debt

## Self-Check: PASSED

- All 8 expected files FOUND
- All 6 deleted files/directories CONFIRMED DELETED
- Commits 519e669 and a1306b7 verified in git log

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-05*
