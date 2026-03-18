---
phase: 11-add-video-support-to-main-camera
plan: 05
subsystem: ui
tags: [feed, video-playback, autoplay, viewport-detection, mute-toggle, duration-badge, expo-video]

# Dependency graph
requires:
  - phase: 11-03
    provides: VideoPlayer wrapper component for video playback
  - phase: 11-02
    provides: VideoMuteContext with global mute state at App.js root level
affects: [11-06, 11-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [viewport-based autoplay via onViewableItemsChanged, conditional media rendering in feed cards]

key-files:
  created: []
  modified:
    - src/components/FeedPhotoCard.js
    - src/screens/FeedScreen.js
    - src/styles/FeedPhotoCard.styles.js

key-decisions:
  - "Video cards use tap-to-toggle-mute (not tap-to-open); PhotoDetail is accessed via info row below video"
  - "Viewport detection uses 50% itemVisiblePercentThreshold for autoplay trigger"
  - "Duration badge and video icon overlay positioned absolute within photoContainer"
  - "Memo comparison updated to include isVisible prop for correct re-render on viewport change"

patterns-established:
  - "Conditional media rendering: isVideo flag (mediaType === 'video') gates VideoPlayer vs Image rendering in shared card component"
  - "Viewport autoplay: onViewableItemsChanged with stable useRef callbacks feeds isVisible prop to child components"

requirements-completed: [VID-05, VID-06]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 11 Plan 05: Feed Video Cards Summary

**Video-aware FeedPhotoCard with autoplay-muted viewport detection, tap-to-unmute via global mute context, duration badge, and video icon overlay**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T17:22:50Z
- **Completed:** 2026-03-18T17:25:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- FeedPhotoCard conditionally renders VideoPlayer for video items with autoplay-muted behavior, preserving existing Image rendering for photo items
- Viewport detection via onViewableItemsChanged tracks visible feed items at 50% threshold, controlling video autoplay/pause
- Duration badge (bottom-right) and video icon overlay (top-left) provide clear visual indicators for video content in the feed
- Tap-to-toggle-mute on video cards uses global VideoMuteContext so mute state persists across all videos

## Task Commits

Each task was committed atomically:

1. **Task 1: Add video rendering to FeedPhotoCard with duration badge** - `55a10b88` (feat)
2. **Task 2: Add viewport detection and visibility tracking to FeedScreen** - `77596e29` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/components/FeedPhotoCard.js` - Conditional VideoPlayer/Image rendering, formatDuration helper, isVisible prop, video icon overlay, duration badge, useVideoMute integration
- `src/screens/FeedScreen.js` - visibleItemIds state, onViewableItemsChanged callback, viewabilityConfig, isVisible prop passed to FeedPhotoCard
- `src/styles/FeedPhotoCard.styles.js` - durationBadge, durationBadgeText, videoIconOverlay styles

## Decisions Made
- Video cards use tap-to-toggle-mute behavior (tapping the video area toggles mute via useVideoMute context). PhotoDetail is still accessible via the info row below the video. This matches Instagram-style behavior where tapping a video controls sound.
- Viewport detection uses 50% itemVisiblePercentThreshold -- a feed card is considered "visible" when at least half of it is in the viewport. This prevents premature autoplay of partially visible items.
- Duration badge and video icon overlay are positioned absolute within the photoContainer, overlaying the video/photo content. Duration badge shows formatted M:SS time.
- Memo comparison updated to include isVisible prop to ensure FeedPhotoCard re-renders when viewport visibility changes (required for autoplay/pause).
- formatDuration helper defined outside the component as a pure function for reusability.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing integration test failure in photoLifecycle.test.js (unrelated to this plan's changes, documented in prior summaries)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Feed video playback is ready for end-to-end testing with video content in Firestore
- VideoPlayer integration in PhotoDetail modal and stories view is next (Plans 11-06, 11-07)
- Global mute state correctly flows from App.js VideoMuteProvider through FeedPhotoCard to VideoPlayer

## Self-Check: PASSED

- FOUND: src/components/FeedPhotoCard.js
- FOUND: src/screens/FeedScreen.js
- FOUND: src/styles/FeedPhotoCard.styles.js
- FOUND: 11-05-SUMMARY.md
- FOUND: commit 55a10b88
- FOUND: commit 77596e29

---
*Phase: 11-add-video-support-to-main-camera*
*Completed: 2026-03-18*
