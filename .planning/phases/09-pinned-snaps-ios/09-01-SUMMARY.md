---
phase: 09-pinned-snaps-ios
plan: 01
subsystem: infra
tags: [activitykit, live-activities, swiftui, expo-native-module, apple-targets, widget-extension, ios]

# Dependency graph
requires:
  - phase: 08-screenshot-detection
    provides: shared EAS native build baseline
provides:
  - Local Expo native module (live-activity-manager) bridging JS to ActivityKit
  - SwiftUI widget extension target (FlickLiveActivity) with branded compact layout
  - App Groups configuration for thumbnail sharing between main app and widget
  - PinnedSnapAttributes ActivityAttributes struct for Live Activity data model
  - NSSupportsLiveActivities enabled in app config
affects: [09-02, 09-03, 09-04, 09-05, 10-pinned-snaps-android]

# Tech tracking
tech-stack:
  added: ["@bacons/apple-targets", "live-activity-manager (local Expo module)", "ActivityKit", "SwiftUI WidgetKit"]
  patterns: ["App Groups file I/O for cross-target image sharing", "Expo native module with AsyncFunction bridge", "Widget extension via @bacons/apple-targets"]

key-files:
  created:
    - modules/live-activity-manager/index.ts
    - modules/live-activity-manager/expo-module.config.json
    - modules/live-activity-manager/src/LiveActivityManagerModule.swift
    - modules/live-activity-manager/src/PinnedSnapAttributes.swift
    - targets/FlickLiveActivity/expo-target.config.js
    - targets/FlickLiveActivity/index.swift
    - targets/FlickLiveActivity/FlickLiveActivityWidget.swift
    - targets/FlickLiveActivity/PinnedSnapAttributes.swift
    - targets/FlickLiveActivity/Info.plist
  modified:
    - package.json
    - package-lock.json
    - app.json
    - app.config.js

key-decisions:
  - "Used .system(design: .monospaced) font in widget extension as pixel font fallback -- custom font embedding in widget targets not supported by @bacons/apple-targets"
  - "Thumbnails stored in App Groups /thumbnails/ subdirectory for clean separation"
  - "Cap enforcement (5 max) implemented in native module by ending oldest activity before starting new one"
  - "Widget extension uses compact-only layout with minimal Dynamic Island fallback views"

patterns-established:
  - "App Groups pattern: main app writes to shared container, widget reads from same path"
  - "Expo native module AsyncFunction pattern: Swift functions bridged to TS promises via ExpoModulesCore"
  - "PinnedSnapAttributes must be kept identical in both modules/live-activity-manager/src/ and targets/FlickLiveActivity/"

requirements-completed: [PINI-02, PINI-05]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 9 Plan 01: Native Infrastructure Summary

**ActivityKit native module with 4 async functions (start/end/endAll/getActiveCount), SwiftUI widget extension with dark-themed compact layout, and App Groups thumbnail sharing via @bacons/apple-targets**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T16:24:44Z
- **Completed:** 2026-03-04T16:29:12Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Created local Expo native module (`live-activity-manager`) with full ActivityKit bridge: startActivity, endActivity, endAllActivities, getActiveCount
- Created SwiftUI widget extension (`FlickLiveActivity`) with branded dark-themed compact layout showing photo thumbnail, sender name, and optional caption
- Configured App Groups (`group.com.spoodsjs.flick`) for thumbnail sharing between main app and widget extension
- Implemented 5-activity cap enforcement and 48-hour auto-expiry via staleDate
- Installed @bacons/apple-targets and configured as Expo plugin for widget extension target generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @bacons/apple-targets, create local Expo module, configure App Groups** - `bffb76c` (feat)
2. **Task 2: Create Swift native module and SwiftUI widget extension** - `b6d49fc` (feat)

## Files Created/Modified
- `modules/live-activity-manager/index.ts` - TypeScript exports with platform-safe lazy loading of native module
- `modules/live-activity-manager/expo-module.config.json` - iOS-only Expo module configuration
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` - Swift ActivityKit bridge with cap enforcement and App Groups file I/O
- `modules/live-activity-manager/src/PinnedSnapAttributes.swift` - ActivityAttributes struct (module copy)
- `targets/FlickLiveActivity/expo-target.config.js` - Widget extension target config (type: widget, frameworks, entitlements)
- `targets/FlickLiveActivity/index.swift` - Widget bundle entry point
- `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` - SwiftUI Live Activity layout with dark theme, thumbnail, sender name, caption
- `targets/FlickLiveActivity/PinnedSnapAttributes.swift` - ActivityAttributes struct (widget copy, identical to module)
- `targets/FlickLiveActivity/Info.plist` - Widget extension Info.plist with NSSupportsLiveActivities
- `package.json` - Added @bacons/apple-targets dependency
- `package-lock.json` - Updated lockfile
- `app.json` - Added NSSupportsLiveActivities to infoPlist, @bacons/apple-targets to plugins
- `app.config.js` - Added App Groups entitlement to iOS entitlements

## Decisions Made
- **Monospaced font fallback in widget:** Custom pixel font (Silkscreen) cannot be embedded in widget extensions via @bacons/apple-targets. Used `.system(size:design:.monospaced)` as the closest approximation of pixel-art styling. Documented as a code comment for future revisiting.
- **Thumbnails subdirectory:** Stored thumbnails in `{containerURL}/thumbnails/{activityId}.jpg` rather than root of App Groups container, for cleaner organization.
- **Cap enforcement on native side:** The 5-activity cap is enforced entirely in the Swift native module (not JS), matching the architecture where cap check happens on the recipient device.
- **Minimal Dynamic Island:** Provided minimal compactLeading/compactTrailing/minimal views for Dynamic Island to satisfy the API, but primary presentation is the lock screen compact layout per user decision.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. However, this plan introduces native code changes that will require a full EAS build (not just OTA update) before the Live Activity feature can be tested on a physical iOS device.

## Next Phase Readiness
- Native module and widget extension are ready for JS integration in Plan 09-02 (pin toggle UI) and Plan 09-03 (liveActivityService.js)
- The liveActivityService.js (Plan 09-03) will use the exports from `modules/live-activity-manager/index.ts`
- Widget extension will be compiled and signed during the next EAS build
- EAS build may require manual provisioning profile creation for the widget extension bundle identifier (`com.spoodsjs.flick.FlickLiveActivity`)

## Self-Check: PASSED

All 10 created files verified present. Both task commits (bffb76c, b6d49fc) verified in git log.

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-04*
