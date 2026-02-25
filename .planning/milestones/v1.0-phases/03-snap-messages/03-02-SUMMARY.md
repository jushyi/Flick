---
phase: 03-snap-messages
plan: 02
subsystem: ui
tags: [react-native, camera, snap-mode, polaroid, expo-camera, reanimated, gesture-handler]

# Dependency graph
requires:
  - phase: 03-snap-messages
    provides: snapService.js with uploadAndSendSnap function
provides:
  - CameraScreen snap mode (mode='snap' route param hides darkroom, routes to preview)
  - SnapPreviewScreen with Polaroid-framed photo, WYSIWYG caption input, send/retake
  - useCameraBase snap mode awareness (skip upload queue, return photo URI directly)
  - SnapCamera and SnapPreviewScreen routes registered in AppNavigator
affects: [03-03 snap viewer, 03-04 snap bubbles, 03-05 snap input button, 03-06 integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      'CameraScreen reuse via mode param (snap vs normal) instead of separate screen',
      'Polaroid frame layout: white border + thick bottom caption strip',
      'Swipe-down gesture dismiss with reanimated spring animation',
      'navigation.pop(2) to return past both SnapPreview and SnapCamera to conversation',
    ]

key-files:
  created:
    - src/screens/SnapPreviewScreen.js
  modified:
    - src/screens/CameraScreen.js
    - src/hooks/useCameraBase.js
    - src/hooks/useCamera.ios.js
    - src/hooks/useCamera.android.js
    - src/styles/CameraScreen.styles.js
    - src/navigation/AppNavigator.js

key-decisions:
  - 'CameraScreen reused with mode param per locked user decision (no separate SnapCameraModal)'
  - 'Zoom controls hidden in snap mode to keep camera simple'
  - 'Full-screen camera container in snap mode (no tab bar, no darkroom footer)'
  - 'Swipe-down dismiss threshold of 120px with spring-back animation'
  - 'Send button uses amber/orange color to match snap theme'
  - 'navigation.pop(2) for returning to conversation after send'

patterns-established:
  - 'Camera mode param pattern: route.params.mode controls CameraScreen behavior'
  - 'useCameraBase accepts options object for mode-dependent behavior'
  - 'Snap capture returns photo URI directly instead of queueing (isSnapMode check)'

requirements-completed: [SNAP-01, SNAP-02]

# Metrics
duration: 6min
completed: 2026-02-24
---

# Phase 3 Plan 2: Snap Camera and Preview UI Summary

**CameraScreen snap mode with darkroom-hidden UI and Polaroid-framed SnapPreviewScreen with WYSIWYG caption input and swipe-down dismiss**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-24T17:51:43Z
- **Completed:** 2026-02-24T17:57:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- CameraScreen supports snap mode via route.params.mode='snap': hides darkroom button, photo stack, zoom controls; keeps flash/flip/capture; adds X close button
- useCameraBase accepts mode option and returns photo URI directly in snap mode (skips upload queue)
- New SnapPreviewScreen with Polaroid frame layout: white border, 4:3 photo aspect ratio, thick bottom strip with caption TextInput (150 char max)
- Swipe-down gesture dismiss using react-native-reanimated + gesture-handler with spring-back animation
- Send calls uploadAndSendSnap with retriesExhausted error handling (Alert with retry option)
- Both SnapCamera and SnapPreviewScreen registered in AppNavigator root stack

## Task Commits

Each task was committed atomically:

1. **Task 1: Add snap mode to CameraScreen and useCamera hook** - `bb2cf87` (feat)
2. **Task 2: Create SnapPreviewScreen with Polaroid frame and caption** - `70f9e29` (feat)

## Files Created/Modified

- `src/screens/SnapPreviewScreen.js` - New: Polaroid-framed snap preview with caption input, swipe-down dismiss, send button
- `src/screens/CameraScreen.js` - Modified: snap mode conditional rendering, X close button, capture routes to preview
- `src/hooks/useCameraBase.js` - Modified: accepts mode option, skips queue in snap mode, returns URI directly
- `src/hooks/useCamera.ios.js` - Modified: passes options to useCameraBase, removed unused Platform import
- `src/hooks/useCamera.android.js` - Modified: passes options to useCameraBase
- `src/styles/CameraScreen.styles.js` - Modified: added cameraContainerSnap style for full-screen snap camera
- `src/navigation/AppNavigator.js` - Modified: registered SnapCamera and SnapPreviewScreen routes

## Decisions Made

- CameraScreen reused with mode param per locked user decision (no separate camera component)
- Zoom controls hidden in snap mode to keep camera simple per user decision
- Full-screen camera in snap mode (no tab bar or footer offset) for immersive capture experience
- Swipe-down dismiss threshold set at 120px with spring-back animation on insufficient swipe
- Send button colored amber/orange to match snap theme (colors.status.developing)
- navigation.pop(2) used to return past both SnapPreview and SnapCamera screens to conversation
- Removed pre-existing unused Platform import from useCamera.ios.js (deviation Rule 3 - blocking lint error)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed unused Platform import in useCamera.ios.js**

- **Found during:** Task 1 (commit attempt)
- **Issue:** Pre-existing unused `Platform` import caused lint-staged eslint failure
- **Fix:** Removed the unused import
- **Files modified:** src/hooks/useCamera.ios.js
- **Verification:** Lint passes, commit succeeds
- **Committed in:** bb2cf87 (Task 1 commit)

**2. [Rule 3 - Blocking] Deferred AppNavigator registration to Task 2**

- **Found during:** Task 1 (commit attempt)
- **Issue:** AppNavigator imported SnapPreviewScreen which didn't exist yet, causing import/no-unresolved lint error
- **Fix:** Moved AppNavigator changes to Task 2 commit (after SnapPreviewScreen creation)
- **Files modified:** src/navigation/AppNavigator.js
- **Verification:** Lint passes with both files staged together
- **Committed in:** 70f9e29 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both fixes were necessary for successful commits. No scope creep.

## Issues Encountered

- Pre-existing test failures in `photoLifecycle.test.js` and `SettingsScreen.test.js` (8 tests) -- unrelated to snap changes, confirmed by checking test output against unmodified files. 819 of 836 tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Snap camera and preview screens complete and ready for Plan 03 (snap viewer for recipients)
- SnapCamera route navigates with mode='snap' + conversation params -- ConversationScreen can navigate to it via `navigation.navigate('SnapCamera', { mode: 'snap', conversationId, friendId, friendDisplayName })`
- SnapPreviewScreen calls uploadAndSendSnap from snapService (Plan 01) and handles all error states
- Plan 04 (snap message bubbles) can render snap type messages in conversation thread
- Plan 05 (DMInput camera button) can trigger navigation to SnapCamera route

## Self-Check: PASSED

- [x] src/screens/SnapPreviewScreen.js - FOUND
- [x] src/screens/CameraScreen.js (snap mode support) - FOUND
- [x] src/hooks/useCameraBase.js (mode option) - FOUND
- [x] src/navigation/AppNavigator.js (routes registered) - FOUND
- [x] Commit bb2cf87 (Task 1) - FOUND
- [x] Commit 70f9e29 (Task 2) - FOUND

---

_Phase: 03-snap-messages_
_Completed: 2026-02-24_
