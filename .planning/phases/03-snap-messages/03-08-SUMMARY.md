---
phase: 03-snap-messages
plan: 08
subsystem: ui
tags: [snap, react-native, exif, image-manipulator, reactions, overlay]

# Dependency graph
requires:
  - phase: 03-snap-messages/07
    provides: SnapViewer Polaroid frame, SnapPreviewScreen layout
provides:
  - EXIF-normalized snap uploads for consistent cross-platform orientation
  - Semi-transparent SnapViewer overlay with conversation visible behind
  - Snap reaction bar (6 emojis) for recipients below Polaroid frame
affects: [snap-streaks, photo-tag-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      expo-image-manipulator EXIF normalization with empty actions array,
      snap reaction via existing sendReaction system,
    ]

key-files:
  created: []
  modified:
    - src/services/firebase/snapService.js
    - src/screens/SnapPreviewScreen.js
    - src/components/SnapViewer.js
    - src/screens/ConversationScreen.js

key-decisions:
  - 'EXIF normalization uses empty-action manipulateAsync before resize (same pattern as ProfilePhotoCropScreen.android.js)'
  - 'Snap reactions reuse existing sendReaction from messageService (no new system needed)'
  - 'Overlay opacity 0.85 keeps snap as clear focus while showing conversation context'
  - 'Reaction bar only visible to recipients, not senders viewing own snaps'

patterns-established:
  - 'EXIF normalization: manipulateAsync(uri, [], {format: JPEG}) bakes orientation before any other processing'
  - 'Snap reactions: reuse conversation message reaction system for snap emoji feedback'

requirements-completed: [SNAP-05, SNAP-07]

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 03 Plan 08: SnapViewer Overhaul Summary

**EXIF orientation normalization for cross-platform snap consistency, semi-transparent overlay, and 6-emoji reaction bar for snap recipients**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T20:38:10Z
- **Completed:** 2026-02-24T20:42:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- EXIF orientation baked into pixel data before upload, eliminating back-camera rotation mismatches between platforms
- SnapPreviewScreen and SnapViewer both use contentFit="contain" for identical sender/recipient photo framing
- Semi-transparent overlay (rgba 0,0,0,0.85) lets conversation peek through behind the snap
- Reaction bar with 6 emoji buttons (heart, laugh, surprise, sad, angry, thumbs_up) appears below Polaroid for recipients
- Snap reactions sent via existing sendReaction system, appearing in conversation thread

## Task Commits

Each task was committed atomically:

1. **Task 1: EXIF normalization and contentFit unification** - `c3ce011` (fix)
2. **Task 2: Semi-transparent overlay and snap reaction bar** - `4bcef1f` (feat)

## Files Created/Modified

- `src/services/firebase/snapService.js` - Added EXIF normalization step (empty-action manipulateAsync) before resize in compressSnapImage
- `src/screens/SnapPreviewScreen.js` - Changed contentFit from "cover" to "contain", added dark photo background (#1A1A1A)
- `src/components/SnapViewer.js` - Semi-transparent overlay, REACTION_EMOJIS array, reaction bar JSX and styles, onReaction/currentUserId props
- `src/screens/ConversationScreen.js` - Imported sendReaction from messageService, wired onReaction and currentUserId props to SnapViewer

## Decisions Made

- EXIF normalization follows same pattern as ProfilePhotoCropScreen.android.js (manipulateAsync with empty actions array)
- Snap reactions reuse existing sendReaction from messageService rather than building a separate reaction system
- Overlay opacity at 0.85 keeps snap as clear focal point while hinting at conversation below
- Reaction bar hidden for senders viewing their own snaps (no reason to react to your own snap)
- Dark background (#1A1A1A) on SnapPreviewScreen photo area provides subtle letterbox contrast within white Polaroid frame

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prettier formatting error on multiline boolean expression for showReactionBar -- resolved by splitting into two variables (isRecipient + showReactionBar)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 (Snap Messages) is now fully complete (8/8 plans)
- All UAT gaps (Tests 4 and 7) addressed by this plan
- Ready for Phase 04 (Snap Streaks) which depends on Phase 03

## Self-Check: PASSED

- All 4 modified files exist on disk
- Commit c3ce011 (Task 1) found in git log
- Commit 4bcef1f (Task 2) found in git log
- must_have artifact: SnapViewer.js contains `rgba(0` -- confirmed
- must_have artifact: snapService.js contains `manipulateAsync` -- confirmed
- must_have key_link: ConversationScreen.js wires sendReaction to SnapViewer onReaction -- confirmed

---

_Phase: 03-snap-messages_
_Completed: 2026-02-24_
