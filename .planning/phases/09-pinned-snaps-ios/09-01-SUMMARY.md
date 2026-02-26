---
phase: 09-pinned-snaps-ios
plan: 01
subsystem: infra
tags: [activitykit, swiftui, live-activities, expo-module, apple-targets, widget-extension, app-groups]

# Dependency graph
requires:
  - phase: 08-screenshot-detection
    provides: "Base app with expo-screen-capture native module pattern"
provides:
  - "Local Expo native module (live-activity-manager) bridging JS to ActivityKit"
  - "SwiftUI widget extension target (FlickLiveActivity) with branded Live Activity layout"
  - "App Groups configuration for shared file access between main app and widget"
  - "@bacons/apple-targets installed and configured as Expo plugin"
  - "NSSupportsLiveActivities enabled in app.json infoPlist"
affects: [09-pinned-snaps-ios, 10-pinned-snaps-android]

# Tech tracking
tech-stack:
  added: ["@bacons/apple-targets", "ActivityKit", "SwiftUI", "WidgetKit"]
  patterns: ["Local Expo native module for iOS-only features", "App Groups shared container for widget-main app file sharing", "@bacons/apple-targets for widget extension targets"]

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
  - "Used monospaced system font (.system(design: .monospaced)) as fallback for pixel font in widget extension -- custom fonts cannot be reliably embedded in iOS widget extensions via @bacons/apple-targets"
  - "Thumbnail stored in pinned_thumbnails/ subdirectory within App Groups container for clean organization"
  - "Cap enforcement (max 5 activities) implemented in native module on recipient device, not sender side"
  - "Dynamic Island included with minimal compact presentation for devices that support it"

patterns-established:
  - "Local Expo module pattern: modules/{name}/index.ts + src/*.swift for iOS-only native features"
  - "Widget extension target: targets/{name}/expo-target.config.js + SwiftUI files via @bacons/apple-targets"
  - "App Groups file sharing: native module copies files to shared container, widget reads from same path"
  - "PinnedSnapAttributes must be identical in both module and widget target (different comment pointing to counterpart)"

requirements-completed: [PINI-02, PINI-05]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 9 Plan 01: Native Infrastructure Summary

**ActivityKit bridge module with start/end/count functions, SwiftUI widget extension with dark-themed compact layout, and App Groups thumbnail sharing via @bacons/apple-targets**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T15:36:07Z
- **Completed:** 2026-02-26T15:40:05Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Local Expo native module (`live-activity-manager`) with 4 async functions: startActivity, endActivity, endAllActivities, getActiveCount
- SwiftUI widget extension target (`FlickLiveActivity`) with branded dark-themed compact layout showing thumbnail, sender name, and caption
- App Groups file I/O for thumbnail sharing between main app and widget extension
- Cap enforcement (max 5 active activities) with automatic oldest-dismissal
- 48-hour auto-expiry via staleDate configuration
- @bacons/apple-targets installed and configured as Expo plugin

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @bacons/apple-targets, create local Expo module, configure App Groups** - `0a95ea9` (feat)
2. **Task 2: Create Swift native module and SwiftUI widget extension** - `9b5e7f7` (feat)

## Files Created/Modified
- `modules/live-activity-manager/index.ts` - TypeScript exports for startActivity, endActivity, endAllActivities, getActiveCount with Platform.OS guards
- `modules/live-activity-manager/expo-module.config.json` - iOS-only module configuration
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` - Swift ActivityKit bridge with cap enforcement, App Groups file I/O, 48h staleDate
- `modules/live-activity-manager/src/PinnedSnapAttributes.swift` - ActivityAttributes struct (module copy)
- `targets/FlickLiveActivity/expo-target.config.js` - Widget extension target config for @bacons/apple-targets
- `targets/FlickLiveActivity/index.swift` - Widget bundle entry point
- `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` - SwiftUI Live Activity layout with dark theme, thumbnail, sender name, caption
- `targets/FlickLiveActivity/PinnedSnapAttributes.swift` - ActivityAttributes struct (widget copy, identical to module)
- `targets/FlickLiveActivity/Info.plist` - NSSupportsLiveActivities and extension point identifier
- `package.json` - Added @bacons/apple-targets dependency
- `app.json` - Added NSSupportsLiveActivities, @bacons/apple-targets plugin
- `app.config.js` - Added App Groups entitlement (group.com.spoodsjs.flick)

## Decisions Made
- **Monospaced font fallback for widget:** Custom pixel fonts (PressStart2P, Silkscreen) cannot be reliably embedded in iOS widget extensions via @bacons/apple-targets. The font must be added to both the host app AND the extension target's resource bundle, and apple-targets does not currently support font resource bundling for widget targets. Used `.system(size: 14, design: .monospaced)` as the closest approximation. Documented in code for future revisit.
- **Thumbnail subdirectory:** Used `pinned_thumbnails/` subdirectory within App Groups container rather than root-level files, for cleaner organization and easier cleanup.
- **Cap enforcement on recipient device:** The 5-activity cap is enforced in the native module's startActivity function, which runs on the recipient's device. This avoids race conditions from multiple senders.
- **Dynamic Island minimal support:** Included compact leading/trailing and minimal Dynamic Island presentations for devices that support it, even though expanded state is intentionally empty per user decision (compact only).
- **File URI handling:** Native module handles both `file://` URL strings and plain file paths for thumbnail source, ensuring compatibility with various image manipulation output formats.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all files created and verifications passed on first attempt.

## User Setup Required
**This plan adds native code that requires a new EAS build.** The user must run a new native build before these changes take effect:
```bash
eas build --platform ios --profile production
```
The @bacons/apple-targets plugin, widget extension, and native module will be compiled during the native build. OTA updates alone will NOT include these changes.

## Next Phase Readiness
- Native infrastructure complete: ActivityKit bridge and widget extension are ready
- Plan 09-02 can proceed: JS pin toggle UI (usePinPreference hook, PinToggle component)
- Plan 09-03 can proceed: JS service layer (liveActivityService.js using this native module)
- EAS build signing for widget extension target may need manual provisioning profile creation in Apple Developer portal

## Self-Check: PASSED

- All 10 created files verified present on disk
- Commit 0a95ea9 (Task 1) verified in git log
- Commit 9b5e7f7 (Task 2) verified in git log

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-02-26*
