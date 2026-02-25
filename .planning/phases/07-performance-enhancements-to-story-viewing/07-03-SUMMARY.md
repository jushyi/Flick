---
phase: 07-performance-enhancements-to-story-viewing
plan: 03
subsystem: ui, performance
tags: [progressive-loading, expo-image, placeholder, subscription-management, prefetching, auto-skip]

# Dependency graph
requires:
  - phase: 07-01
    provides: thumbnailDataURL field in Firestore photo documents, feed story card pagination
  - phase: 07-02
    provides: Reanimated cube transitions with SharedValue cubeProgress, Gesture.Pan horizontal swipe
provides:
  - Progressive loading with blurred placeholder crossfade (200ms transition via expo-image)
  - Dark loading overlay on photo change (immediate visual feedback)
  - Firestore subscription pause/resume during cube transitions
  - Auto-skip on image load failure (5s timeout in stories mode)
  - Next-friend first photo prefetching when near end of current friend story
affects: [PhotoDetailScreen, usePhotoDetailModal, FeedScreen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "expo-image placeholder prop with base64 thumbnailDataURL for progressive loading"
    - "Subscription pause/resume pattern using refs for Firestore real-time listener lifecycle"
    - "Load failure timeout with auto-skip for resilient story navigation"
    - "Callback-based next-friend prefetch via PhotoDetailContext getCallbacks"

key-files:
  created: []
  modified:
    - src/screens/PhotoDetailScreen.js
    - src/hooks/usePhotoDetailModal.js
    - src/screens/FeedScreen.js

key-decisions:
  - "Dark overlay uses zIndex 2 to fully cover the image during loading, replacing old centered spinner"
  - "transition={200} only when thumbnailDataURL exists; transition={0} for existing photos without thumbnails"
  - "Subscription pause is called before cubeProgress is set to 0 in all transition handlers"
  - "Auto-skip timeout only active in stories mode; feed mode has no auto-skip"
  - "startLoadTimer/clearLoadTimer exposed via refs to avoid circular dependency with usePhotoDetailModal"
  - "getNextFriendFirstPhotoURL callback added to FeedScreen setCallbacks rather than modifying PhotoDetailContext schema"

patterns-established:
  - "Dark loading overlay pattern: full-screen black + centered spinner with zIndex covers previous image"
  - "Progressive placeholder pattern: expo-image placeholder + placeholderContentFit + transition duration"
  - "Subscription lifecycle pattern: pauseSubscription() before animation, auto-resume via useEffect on photo id change"

requirements-completed: [PERF-01, PERF-02, PERF-04, PERF-06, PERF-07]

# Metrics
duration: 10min
completed: 2026-02-25
---

# Phase 07 Plan 03: Progressive Loading & Performance Optimizations Summary

**Progressive image loading with blurred placeholder crossfade, dark loading overlay on navigation, Firestore subscription pause/resume during transitions, auto-skip on 5s load failure, and next-friend photo prefetching**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-25T20:08:30Z
- **Completed:** 2026-02-25T20:18:33Z
- **Tasks:** 2 auto + 1 checkpoint (pending)
- **Files modified:** 3

## Accomplishments
- Tapping to next photo immediately shows dark background + spinner instead of lingering on previous image
- Photos with thumbnails show blurred placeholder that crossfades to full resolution over 200ms
- Cube transition incoming face shows dark overlay until image loads (natural behavior from loading state)
- Outgoing cube face includes thumbnail placeholder for frozen snapshot
- Firestore photo subscription pauses during all cube transitions (forward, backward, interactive swipe) and auto-resumes when photo id changes
- Failed image loads auto-skip to next photo after 5 seconds in stories mode
- Next friend's first photo is prefetched when viewing within 2 photos of end of current friend's story

## Task Commits

Each task was committed atomically:

1. **Task 1: Dark loading overlay and progressive placeholder on PhotoDetailScreen** - `c4f9038` (feat)
2. **Task 2: Subscription pause/resume, auto-skip on failure, and next-friend prefetching** - `ac5fe52` (feat)
3. **Task 3: Verify complete story viewing performance on device** - pending (checkpoint:human-verify)

## Files Created/Modified
- `src/screens/PhotoDetailScreen.js` - Dark loading overlay, progressive placeholder via expo-image, subscription pause/resume, snapshot thumbnailDataURL, load timer refs
- `src/hooks/usePhotoDetailModal.js` - LOAD_FAILURE_TIMEOUT auto-skip timer, startLoadTimer/clearLoadTimer, onGetNextFriendPhotoURL prop, next-friend prefetch effect
- `src/screens/FeedScreen.js` - getNextFriendFirstPhotoURL callback in setCallbacks

## Decisions Made
- Dark overlay uses `zIndex: 2` and `StyleSheet.absoluteFillObject` to fully cover the Image component during loading, replacing the old centered-spinner approach that let the previous image show through.
- `transition` prop is conditionally set: 200ms when `thumbnailDataURL` exists (for placeholder-to-full crossfade), 0 otherwise (no crossfade needed without placeholder).
- Image `priority` is set to `'normal'` during transitions and `'high'` otherwise, to reduce network contention during cube animations.
- Load timer functions (`startLoadTimer`/`clearLoadTimer`) are exposed from `usePhotoDetailModal` and synced via refs in PhotoDetailScreen to avoid circular dependency (handlers defined before hook call).
- `getNextFriendFirstPhotoURL` callback is added to FeedScreen's existing `setCallbacks` rather than modifying `PhotoDetailContext` schema, keeping the context API unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in `photoLifecycle.test.js` (3 tests) confirmed as unrelated to this plan's changes (verified by running tests without changes applied). These failures were already documented as out of scope in 07-02 SUMMARY.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 7 performance features are implemented and committed
- Checkpoint Task 3 (device verification) is pending user approval
- After verification, Phase 7 is complete and Phase 8 (Screenshot Detection) can begin
- All changes are OTA-deployable (no native build required)

---
## Self-Check: PASSED

All files exist: src/screens/PhotoDetailScreen.js, src/hooks/usePhotoDetailModal.js, src/screens/FeedScreen.js, 07-03-SUMMARY.md
All commits exist: c4f9038, ac5fe52

---
*Phase: 07-performance-enhancements-to-story-viewing*
*Completed: 2026-02-25*
