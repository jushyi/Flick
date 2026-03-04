---
phase: quick-38
plan: 01
subsystem: ui
tags: [reanimated, animation, snap-viewer, expand-collapse, gesture]

# Dependency graph
requires:
  - phase: 03-snap-messages
    provides: "SnapViewer, SnapBubble, ConversationScreen snap handling"
provides:
  - "Expand-from-source / suck-back-to-source animation for SnapViewer"
  - "SnapBubble measureInWindow source rect measurement"
  - "sourceRect prop wiring through ConversationScreen"
affects: [snap-messages, conversation]

# Tech tracking
tech-stack:
  added: []
  patterns: [expand-suck-back animation using Reanimated shared values and interpolate]

key-files:
  created: []
  modified:
    - src/components/SnapViewer.js
    - src/components/SnapBubble.js
    - src/screens/ConversationScreen.js

key-decisions:
  - "Used Reanimated shared values (not RN Animated) since SnapViewer already uses Reanimated"
  - "Suck-back close resets openProgress to 0 for unified source position interpolation"
  - "isClosingRef prevents double-dismiss from rapid close + swipe interactions"

patterns-established:
  - "sourceRect measurement via measureInWindow for expand/collapse animations"

requirements-completed: [QUICK-38]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Quick Task 38: Snap Expand/Suck-Back Animation Summary

**SnapViewer now expands from the tapped bubble position and suck-backs on close, matching story viewer UX with Reanimated interpolation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T20:58:54Z
- **Completed:** 2026-03-04T21:02:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- SnapBubble measures its screen position via measureInWindow and passes sourceRect through onPress
- SnapViewer opens by expanding from source bubble position using Reanimated openProgress interpolation
- Close button, swipe-down, and Android back button all trigger suck-back animation to source position
- Swipe-down includes scale-down effect during drag (matching story viewer feel)
- Graceful fallback to fade-in / slide-down when no sourceRect available (notification deep link auto-open)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sourceRect measurement to SnapBubble and wire through ConversationScreen** - `0da51fb` (feat)
2. **Task 2: Replace SnapViewer Modal fade with expand/suck-back animation** - `cbda9de` (feat)

## Files Created/Modified
- `src/components/SnapBubble.js` - Added useRef + measureInWindow to measure bubble position on press
- `src/screens/ConversationScreen.js` - Added snapSourceRect state, wired sourceRect from SnapBubble to SnapViewer
- `src/components/SnapViewer.js` - Replaced fade/slide animation with expand/suck-back using Reanimated openProgress interpolation

## Decisions Made
- Used Reanimated shared values (not RN Animated) since SnapViewer already uses Reanimated for swipe gesture
- Suck-back close resets openProgress to 0 for unified source position interpolation (simpler than separate dismiss values)
- Added isClosingRef guard to prevent double-dismiss from rapid close + swipe interactions
- borderRadius 4 in sourceRect matches SnapBubble's bubble borderRadius style

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Snap viewer animation now matches story viewer UX
- Reminder: deploy with `eas update --branch production --message "snap expand/suck-back animation"`

## Self-Check: PASSED

All files exist, all commits verified.

---
*Quick Task: 38*
*Completed: 2026-03-04*
