---
phase: 09-pinned-snaps-ios
plan: 17
subsystem: ui
tags: [activitykit, live-activity, swiftui, widget, stacking, expo-modules]

requires:
  - phase: 09-pinned-snaps-ios
    provides: "Live Activity single-snap Polaroid rendering, persistence, and JS bridge (plans 01-16)"
provides:
  - "Stacked Live Activity with array-based ContentState for multiple pinned snaps"
  - "removeFromStack native method for individual snap removal"
  - "Stacked Polaroid widget layout with count badge and sender summary"
  - "JS removePinnedSnap bridge function"
affects: [09-pinned-snaps-ios, 10-pinned-snaps-android]

tech-stack:
  added: []
  patterns:
    - "Array-based ContentState for accumulating entries in a single Live Activity"
    - "Stack-aware start (add to existing or create new) pattern"
    - "Individual removal from stack with auto-end when empty"

key-files:
  created: []
  modified:
    - targets/FlickLiveActivity/PinnedSnapAttributes.swift
    - modules/live-activity-manager/src/PinnedSnapAttributes.swift
    - targets/FlickNotificationService/PinnedSnapAttributes.swift
    - modules/live-activity-manager/src/LiveActivityManagerModule.swift
    - targets/FlickLiveActivity/FlickLiveActivityWidget.swift
    - src/services/liveActivityService.js
    - src/components/SnapViewer.js
    - __tests__/services/liveActivityService.test.js

key-decisions:
  - "Stack ID uses fixed 'pinned-stack' string for the single stacked activity"
  - "Stack capped at 10 entries to stay under 4KB ContentState limit"
  - "Newest entries inserted at index 0 (top of stack)"
  - "endActivity delegates to removeFromStack logic for snap-level IDs"
  - "persistentActivities stores lastStack tuple for re-creation with full state"
  - "getActiveActivityIds returns snapActivityIds from stack (not activity ID)"

patterns-established:
  - "Stack-aware start: check existing activities, add entry or create new"
  - "Individual removal: removeFromStack removes one entry, ends if empty"

requirements-completed: [PINI-01, PINI-03, PINI-04, PINI-05]

duration: 6min
completed: 2026-03-19
---

# Phase 09 Plan 17: Stacked Pinned Snaps Live Activity Summary

**Single stacked Live Activity accumulating multiple pinned snaps with overlapping Polaroid widget layout and individual snap removal**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T20:51:02Z
- **Completed:** 2026-03-19T20:57:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Converted one-activity-per-snap model to single stacked Live Activity with array ContentState
- Widget renders stacked Polaroids (up to 3 visible) with sender summary and +N more badge
- Individual snap removal via removeFromStack ends activity when stack is empty
- All 3 PinnedSnapAttributes copies kept byte-identical with StackEntry struct

## Task Commits

Each task was committed atomically:

1. **Task 1: Update PinnedSnapAttributes with StackEntry and sync all 3 copies** - `cb047654` (feat)
2. **Task 2: Native module stack-aware methods and stacked widget layout** - `ece96640` (feat)
3. **Task 3: JS bridge stack operations and App.js integration** - `d06a6a20` (feat)

## Files Created/Modified
- `targets/FlickLiveActivity/PinnedSnapAttributes.swift` - Added StackEntry struct and stack array to ContentState
- `modules/live-activity-manager/src/PinnedSnapAttributes.swift` - Synced copy of PinnedSnapAttributes
- `targets/FlickNotificationService/PinnedSnapAttributes.swift` - Synced copy of PinnedSnapAttributes
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` - Stack-aware start/remove/end methods, tuple-based persistence
- `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` - singleSnapLayout and stackedLayout with ZStack Polaroids
- `src/services/liveActivityService.js` - Added removePinnedSnap export calling removeFromStack
- `src/components/SnapViewer.js` - Uses removePinnedSnap instead of endPinnedSnapActivity
- `__tests__/services/liveActivityService.test.js` - Added removePinnedSnap test cases and removeFromStack mock

## Decisions Made
- Stack ID uses fixed "pinned-stack" string for the single stacked activity
- Stack capped at 10 entries to stay under 4KB ContentState limit
- Newest entries inserted at index 0 (top of stack) for visual prominence
- endActivity delegates to removeFromStack logic when given a snap-level ID (backward compat)
- persistentActivities changed from `[String: PinnedSnapAttributes]` to tuple `(attributes, lastStack)` for re-creation with full state
- getActiveActivityIds returns snapActivityIds from stack entries (not the stack activity ID)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prettier lint error in removePinnedSnap**
- **Found during:** Task 3 (JS bridge)
- **Issue:** Unnecessary parentheses around single parameter `(snapActivityId)` flagged by prettier
- **Fix:** Changed to `snapActivityId` without parens
- **Files modified:** src/services/liveActivityService.js
- **Verification:** `npx eslint src/services/liveActivityService.js` passes
- **Committed in:** d06a6a20 (Task 3 commit)

**2. [Rule 2 - Missing Critical] Added removeFromStack mock and test cases**
- **Found during:** Task 3 (JS bridge)
- **Issue:** Test file lacked mock for removeFromStack and tests for removePinnedSnap
- **Fix:** Added mockRemoveFromStack, updated mock factories, added 3 test cases
- **Files modified:** __tests__/services/liveActivityService.test.js
- **Verification:** New tests cover iOS success, error, and Android guard paths
- **Committed in:** d06a6a20 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- liveActivityService.test.js has 10 pre-existing test failures due to expo-modules-core import issues in test environment (unrelated to our changes, confirmed by testing before/after). Out of scope per deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stacked Live Activity ready for device testing with native build
- Push-to-start (plan 16) and stacking (plan 17) complete; plan 18 (Firebase migration) can proceed
- Pre-existing test failures in liveActivityService.test.js should be addressed in a future test infrastructure plan

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-19*
