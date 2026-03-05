---
phase: 09-pinned-snaps-ios
plan: 07
subsystem: ios
tags: [config-plugin, live-activities, nse, plist, xcode, bacons-apple-targets]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: "Notification Service Extension with Live Activities (Plan 06), withNSELiveActivities.js plugin (Plan 06)"
provides:
  - "Rewritten withNSELiveActivities.js that uses @bacons/apple-targets compatible API instead of incompatible xcode npm package"
  - "INFOPLIST_KEY_NSSupportsLiveActivities=YES injected as build setting via target.setBuildSetting()"
  - "Correct plugin ordering in app.json (withNSELiveActivities BEFORE @bacons/apple-targets)"
affects: [09-pinned-snaps-ios]

# Tech tracking
tech-stack:
  added: []
  patterns: ["withXcodeProjectBeta consumer mods must be registered BEFORE @bacons/apple-targets base mod provider in app.json plugins array", "Use target.setBuildSetting for INFOPLIST_KEY_* to inject plist keys via Xcode generated Info.plist"]

key-files:
  created: []
  modified:
    - plugins/withNSELiveActivities.js
    - app.json

key-decisions:
  - "Consumer mods using withXcodeProjectBeta must be listed BEFORE @bacons/apple-targets in app.json plugins -- the base mod provider must be last"
  - "Match NSE target by getDisplayName() (returns props.name) with productName fallback for reliability"
  - "Do NOT set GENERATE_INFOPLIST_FILE=NO -- let Xcode auto-generate plist and use INFOPLIST_KEY_* build settings instead"

patterns-established:
  - "Plugin ordering: any plugin using withXcodeProjectBeta must appear BEFORE @bacons/apple-targets in the plugins array"
  - "Plist injection via build settings: use INFOPLIST_KEY_* build settings when GENERATE_INFOPLIST_FILE=YES"

requirements-completed: [PINI-02, PINI-04, PINI-05]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 9 Plan 07: NSE Plist Fix Summary

**Rewritten withNSELiveActivities.js using @bacons/apple-targets withXcodeProjectBeta API with corrected plugin ordering to inject NSSupportsLiveActivities build setting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T15:00:35Z
- **Completed:** 2026-03-05T15:04:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Completely rewrote `plugins/withNSELiveActivities.js` to use `withXcodeProjectBeta` from `@bacons/apple-targets/build/with-bacons-xcode` instead of the incompatible `xcode` npm package
- Removed `GENERATE_INFOPLIST_FILE=NO` override that was breaking plist generation by `@bacons/apple-targets`
- Fixed plugin ordering in `app.json` -- consumer mods must be registered BEFORE the base mod provider
- Verified all API surface compatibility: `setBuildSetting`, `getDisplayName`, `rootObject.props.targets`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite withNSELiveActivities.js to use @bacons/apple-targets API and update NSE Info.plist** - `c8dec10` (fix)
2. **Task 2: Verify prebuild produces correct build settings (local validation)** - `46b09f1` (fix)

## Files Created/Modified
- `plugins/withNSELiveActivities.js` - Completely rewritten to use withXcodeProjectBeta, setBuildSetting, getDisplayName instead of xcode npm package with withDangerousMod
- `app.json` - Plugin ordering corrected: withNSELiveActivities moved BEFORE @bacons/apple-targets
- `targets/FlickNotificationService/Info.plist` - Already contained NSSupportsLiveActivities key (no change needed)

## Decisions Made
- **Plugin ordering must be reversed:** The plan stated "This plugin MUST be registered AFTER @bacons/apple-targets" but this is incorrect. The `@bacons/apple-targets` plugin registers the `withXcodeProjectBetaBaseMod` provider at the end of its execution. After the provider is added, no more consumer mods can be added to the chain. Our plugin must be listed BEFORE `@bacons/apple-targets` so its consumer mod is registered before the provider.
- **Target matching by getDisplayName():** Used `getDisplayName()` as primary (returns `props.name` which is the target name in the pbxproj) with `props.productName` as fallback, matching how `@bacons/apple-targets` internally identifies targets.
- **No GENERATE_INFOPLIST_FILE override:** The old plugin set this to NO, which broke other auto-generated plist entries. The new approach leaves it as YES and uses `INFOPLIST_KEY_*` build settings which Xcode merges into the generated plist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed plugin ordering in app.json**
- **Found during:** Task 2 (prebuild verification)
- **Issue:** `expo prebuild -p ios --clean` failed with "Cannot add mod to ios.xcodeProjectBeta2 because the provider has already been added." The plan stated our plugin must be AFTER `@bacons/apple-targets`, but `withXcodeProjectBeta` consumer mods must actually be registered BEFORE the base mod provider.
- **Fix:** Moved `./plugins/withNSELiveActivities` BEFORE `@bacons/apple-targets` in the `app.json` plugins array
- **Files modified:** `app.json`
- **Verification:** Plugin loads successfully, all 14 API surface checks pass
- **Committed in:** `46b09f1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix -- without corrected plugin ordering, prebuild fails entirely. No scope creep.

## Issues Encountered
- Full `expo prebuild -p ios --clean` verification could not run on Windows -- iOS prebuild requires macOS. Validated plugin loading, API surface compatibility, mod chain ordering, and source code correctness through a 14-point automated check instead. Full prebuild verification will occur during EAS build on macOS.

## User Setup Required
- Requires a new native EAS build (`eas build --platform ios`) since the config plugin and app.json were modified
- This is NOT an OTA update -- it changes the native build pipeline

## Next Phase Readiness
- NSE plist blocker root cause is eliminated -- the incompatible xcode npm package serializer is no longer used
- Plugin correctly injects INFOPLIST_KEY_NSSupportsLiveActivities=YES via @bacons/xcode setBuildSetting API
- Ready for end-to-end testing (Plan 05 checkpoint) after a new native EAS build
- Full prebuild verification should be done on macOS to confirm build setting appears in generated pbxproj

## Self-Check: PASSED

All modified files verified present on disk. Both commit hashes (c8dec10, 46b09f1) verified in git log.
