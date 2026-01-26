---
phase: 36-comments-feature
plan: 36-03-FIX-5
subsystem: ui
tags: [gestures, panresponder, modal, styling]

requires:
  - phase: 36-03-FIX-4
    provides: UAT Round 5 fixes

provides:
  - Feed mode swipe-to-close gesture working
  - Sharper photo corners
  - Higher user info positioning
  - Tighter comment timestamp spacing

affects: [feed, stories, comments]

tech-stack:
  added: []
  patterns: [unified-touchable-wrapper]

key-files:
  modified:
    - src/components/PhotoDetailModal.js
    - src/styles/PhotoDetailModal.styles.js
    - src/styles/CommentRow.styles.js

key-decisions:
  - 'Unified TouchableWithoutFeedback for both feed and stories modes'

issues-created: []

duration: 5min
completed: 2026-01-26
---

# Phase 36 Plan 03-FIX-5: UAT Round 6 Fixes Summary

**Fixed feed mode swipe-to-close blocker and 3 cosmetic issues from UAT Round 6**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-26T15:30:00Z
- **Completed:** 2026-01-26T15:35:00Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments

- Fixed UAT-028 (BLOCKER): Feed mode swipe-to-close now works by using TouchableWithoutFeedback for touch tracking
- Fixed UAT-035: Reduced photo border radius from 24 to 12 for sharper corners
- Fixed UAT-034: Raised user info positioning 15px higher (bottom 115→130 with comments, 95→110 without)
- Fixed UAT-031: Removed dot marginHorizontal entirely for tighter Reply · timestamp spacing

## Task Commits

1. **Task 1+3: Fix UAT-028 & UAT-034** - `6dc3287` (fix)
2. **Task 2: Fix UAT-035** - `c5863c0` (fix)
3. **Task 4: Fix UAT-031** - `f11bf8e` (fix)

## Files Created/Modified

- `src/components/PhotoDetailModal.js` - Unified TouchableWithoutFeedback for both modes, adjusted userInfoOverlay bottom positions
- `src/styles/PhotoDetailModal.styles.js` - Reduced photoScrollView borderRadius from 24 to 12
- `src/styles/CommentRow.styles.js` - Removed dot marginHorizontal (was 2)

## Decisions Made

- **Unified TouchableWithoutFeedback for both modes** - Stories mode passes handleTapNavigation to onPress, feed mode passes undefined. This ensures touch tracking starts for panResponder in both modes while only stories gets tap navigation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- All 4 UAT issues from Round 6 fixed
- Ready for re-verification via /gsd:verify-work 36-03
- If all issues pass, Phase 36 can continue to plan 36-04

---

_Phase: 36-comments-feature_
_Completed: 2026-01-26_
