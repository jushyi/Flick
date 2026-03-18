---
phase: 11-add-video-support-to-main-camera
plan: 00
subsystem: testing
tags: [jest, tdd, red-scaffold, video, useCameraBase, uploadQueue, mute-context]

# Dependency graph
requires:
  - phase: none
    provides: none (Wave 0 - first plan in phase)
provides:
  - RED test scaffolds for hold-to-record gesture behavior (useCameraBase)
  - RED test scaffolds for video upload queue with mediaType/duration fields (uploadQueueService)
  - RED test scaffolds for VideoMuteContext mute toggle and persistence
affects: [11-02-PLAN, 11-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED test scaffold pattern: write failing tests before implementation to define behavioral contracts"

key-files:
  created:
    - __tests__/hooks/useCameraBase.test.js
    - __tests__/services/uploadQueueService.test.js
    - __tests__/context/VideoMuteContext.test.js
  modified: []

key-decisions:
  - "Used eslint-disable-next-line for VideoMuteContext import since module does not exist yet"
  - "useCameraBase tests use renderHook with fake timers to test hold threshold timing"
  - "uploadQueueService tests mock both uploadPhoto and uploadVideo to verify routing"

patterns-established:
  - "Video test pattern: mock camera ref with takePictureAsync/recordAsync/stopRecording for gesture tests"
  - "Context test pattern: use wrapper prop in renderHook to provide VideoMuteProvider"

requirements-completed: [VID-01, VID-03, VID-05, VID-10]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 11 Plan 00: Wave 0 RED Test Scaffolds Summary

**RED test scaffolds defining behavioral contracts for hold-to-record, video upload queue, and global mute state**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T16:55:49Z
- **Completed:** 2026-03-18T16:59:46Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Created 8 failing tests for useCameraBase hold-to-record gesture (handlePressIn/Out, isRecording, cameraMode, tap-vs-hold, MAX_RECORDING_DURATION)
- Created 6 tests for uploadQueueService video support (mediaType, duration, uploadVideo routing, video thumbnail, Firestore video fields, backward compatibility) -- 4 failing, 2 trivially passing
- Created 5 failing tests for VideoMuteContext (default muted, toggleMute, double toggle, setMuted, shared state)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RED test scaffold for useCameraBase hold-to-record** - `647df07e` (test)
2. **Task 2: Create RED test scaffolds for uploadQueueService video + VideoMuteContext** - `1b5c478e` (test)

## Files Created/Modified
- `__tests__/hooks/useCameraBase.test.js` - 8 RED tests for hold-to-record gesture behavior
- `__tests__/services/uploadQueueService.test.js` - 6 tests for video upload queue (4 RED)
- `__tests__/context/VideoMuteContext.test.js` - 5 RED tests for global mute state context

## Decisions Made
- Used `eslint-disable-next-line import/no-unresolved` for VideoMuteContext import (module created in Plan 11-02)
- useCameraBase tests use `jest.useFakeTimers()` and `jest.advanceTimersByTime()` to test the 500ms hold threshold
- uploadQueueService tests mock both `uploadPhoto` and `uploadVideo` from storageService to verify correct routing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ESLint import/no-unresolved error for VideoMuteContext**
- **Found during:** Task 2 (commit attempt)
- **Issue:** ESLint errored on importing from non-existent `../../src/context/VideoMuteContext` module
- **Fix:** Added `eslint-disable-next-line import/no-unresolved` comment
- **Files modified:** `__tests__/context/VideoMuteContext.test.js`
- **Verification:** Lint passed, commit succeeded
- **Committed in:** 1b5c478e (Task 2 commit)

**2. [Rule 3 - Blocking] Removed unused imports in uploadQueueService test**
- **Found during:** Task 2 (commit attempt)
- **Issue:** ESLint no-unused-vars warning for `initializeQueue` and `getQueueLength` imports
- **Fix:** Removed unused imports, kept only `addToQueue` and `processQueue`
- **Files modified:** `__tests__/services/uploadQueueService.test.js`
- **Verification:** Lint passed, commit succeeded
- **Committed in:** 1b5c478e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required for lint-staged pre-commit hook to pass. No scope creep.

## Issues Encountered
- Pre-existing issue: `expo-screen-capture` mock in `jest.setup.js` references a module not yet installed (Phase 8 prep). This causes `--bail` test runs across all three files to fail at the setup level, but individual test file runs work correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RED test scaffolds are in place for Plans 11-02 (uploadQueue + VideoMuteContext) and 11-04 (useCameraBase hold-to-record)
- Plan 11-01 (native config: expo-video install, microphone permission, storage rules) can proceed independently
- Pre-existing `expo-screen-capture` issue in jest.setup.js should be tracked but does not block Phase 11 execution

## Self-Check: PASSED

- All 3 test files exist at expected paths
- Both task commits verified (647df07e, 1b5c478e)
- SUMMARY.md created

---
*Phase: 11-add-video-support-to-main-camera*
*Completed: 2026-03-18*
