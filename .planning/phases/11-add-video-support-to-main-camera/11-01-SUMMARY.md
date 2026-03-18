---
phase: 11-add-video-support-to-main-camera
plan: 01
subsystem: infra
tags: [expo-video, firebase-storage, video-upload, jest-mock, microphone-permission]

# Dependency graph
requires:
  - phase: 11-00
    provides: RED test scaffolds for video support (useCameraBase, useVideoPlayback, VideoPlayer)
provides:
  - expo-video native module installed and configured
  - Microphone permission enabled for expo-camera
  - Firebase Storage rules allowing video/* content types up to 100MB
  - uploadVideo function in storageService (no compression)
  - expo-video and expo jest mocks for test environment
affects: [11-02, 11-03, 11-04, 11-05, 11-06, 11-07]

# Tech tracking
tech-stack:
  added: [expo-video]
  patterns: [video upload without compression, content-type detection from URI extension]

key-files:
  created: []
  modified: [app.json, storage.rules, src/services/firebase/storageService.js, __tests__/setup/jest.setup.js]

key-decisions:
  - "Video files use same photos/ storage path as images, differentiated by extension (.mp4/.mov)"
  - "100MB storage limit provides headroom for higher quality or longer recordings beyond 30s at 720p"
  - "expo-video mock includes generateThumbnailsAsync for future thumbnail generation"
  - "createVideoPlayer mock exported globally for test assertions alongside useVideoPlayer"

patterns-established:
  - "Video upload pattern: no compression, detect extension from URI, set content type accordingly"
  - "expo-video mock pattern: mockVideoPlayer object with all player methods, useVideoPlayer with setup callback"

requirements-completed: [VID-09]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 11 Plan 01: Native Dependencies & Service Foundation Summary

**expo-video installed with microphone permissions, storage rules updated for video/*, uploadVideo service function with .mov/.mp4 detection, and expo-video jest mocks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T17:03:13Z
- **Completed:** 2026-03-18T17:07:00Z
- **Tasks:** 2
- **Files modified:** 6 (app.json, storage.rules, storageService.js, jest.setup.js, package.json, package-lock.json)

## Accomplishments
- Installed expo-video native module and added to app.json plugins
- Enabled microphone permission for expo-camera with descriptive permission string
- Updated Firebase Storage rules to accept video/* content types with 100MB limit
- Added uploadVideo function to storageService with withTrace performance monitoring
- Added comprehensive expo-video and expo jest mocks for test environment

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-video, configure microphone permission, update storage rules** - `ae32ef59` (feat)
2. **Task 2: Add uploadVideo to storageService and expo-video jest mock** - `b6effd28` (feat)

## Files Created/Modified
- `app.json` - Added expo-video plugin, changed microphonePermission from false to permission string
- `storage.rules` - Updated photos/ path to allow video/* content types, increased size limit to 100MB
- `src/services/firebase/storageService.js` - Added uploadVideo function with .mov/.mp4 extension detection
- `__tests__/setup/jest.setup.js` - Added expo-video mock (VideoView, useVideoPlayer, createVideoPlayer) and expo mock (useEvent)
- `package.json` - Added expo-video dependency
- `package-lock.json` - Updated lockfile with expo-video

## Decisions Made
- Video files stored in same `photos/` storage path as images, differentiated by file extension (.mp4 or .mov)
- Content type detection uses URI extension: `.mov` maps to `video/quicktime`, everything else to `video/mp4`
- 100MB size limit chosen to provide headroom beyond the ~11MB expected for 30s at 720p/3Mbps
- expo-video mock includes `generateThumbnailsAsync` returning a mock thumbnail URI for future plan usage
- Added `createVideoPlayer` to mock alongside `useVideoPlayer` for flexibility in different usage patterns

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration after this plan:**
- **Firebase Storage:** Run `firebase deploy --only storage` to deploy updated rules allowing video uploads
- **EAS Build:** Run `eas build --platform all --profile production` because expo-video adds native modules and microphone permission modifies Info.plist

## Issues Encountered
- Pre-existing test failures in `photoLifecycle.test.js`, `notificationService.test.js`, and `functions/` tests are unrelated to this plan's changes and remain out of scope
- useCameraBase.test.js has expected RED failures from Plan 11-00 TDD scaffolds (implementation in future plans)

## Next Phase Readiness
- All native dependencies installed and configured
- Storage rules ready for video uploads (pending deploy)
- uploadVideo service function ready for use by upload queue and camera hook
- Jest mocks in place so future plans can import expo-video without native module errors
- Next plan (11-02) can build on this foundation for camera recording and video playback

---
*Phase: 11-add-video-support-to-main-camera*
*Completed: 2026-03-18*
