---
phase: 03-snap-messages
plan: 07
subsystem: ui
tags: [react-native, safe-area, keyboard-avoiding, polaroid, layout, snap-camera]

# Dependency graph
requires:
  - phase: 03-snap-messages (plans 01-06)
    provides: Snap camera, SnapPreviewScreen, ConversationRow with snap UI
provides:
  - Dynamic safe area footer padding for snap camera mode
  - Recipient name header pill in snap camera mode
  - Thicker Polaroid frame (16px border) for realistic appearance
  - Fixed keyboard avoidance lifting both Polaroid and send button
  - Absolutely positioned unread badge that does not displace snap button
affects: [snap-messages, ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Dynamic safe area insets applied inline for snap mode footer (no tab bar)'
    - 'KAV wraps both content and footer for correct keyboard lift'
    - 'Absolute positioning for overlay badges to prevent flow displacement'

key-files:
  created: []
  modified:
    - src/styles/CameraScreen.styles.js
    - src/screens/CameraScreen.js
    - src/screens/SnapPreviewScreen.js
    - src/components/ConversationRow.js

key-decisions:
  - 'Dynamic Math.max(insets.bottom, 16) for snap footer instead of hardcoded 20px'
  - 'Recipient header as absolute pill with semi-transparent overlay background'
  - 'Polaroid border doubled to 16px for realistic thickness on mobile'
  - 'Footer moved inside KAV with behavior=padding on both platforms'
  - 'Unread badge uses position:absolute to avoid flow layout displacement'

patterns-established:
  - 'Inline safe area insets for snap-specific layout (no shared StyleSheet access to hooks)'

requirements-completed: [SNAP-01, SNAP-02]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 3 Plan 7: Snap UI Layout Fixes Summary

**Dynamic safe area footer, recipient header, thicker Polaroid frame, fixed keyboard lift, and absolute unread badge positioning across snap camera/preview/conversation screens**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T20:32:03Z
- **Completed:** 2026-02-24T20:35:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Snap camera footer buttons now use dynamic safe area insets instead of hardcoded padding, correct on both iOS and Android
- "To: FriendName" recipient header pill visible at top of snap camera mode
- Polaroid frame border doubled from 8px to 16px for realistic thickness; strip height increased from 56px to 64px
- KeyboardAvoidingView now wraps both Polaroid and footer, with platform-specific offsets for correct keyboard lift
- Unread badge uses absolute positioning so it never displaces the snap camera shortcut button

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix snap camera footer padding and add recipient header** - `3cadec6` (fix)
2. **Task 2: Thicken Polaroid frame, fix KAV offset, and fix unread badge layout** - `d3b241a` (fix)

## Files Created/Modified

- `src/styles/CameraScreen.styles.js` - Removed hardcoded paddingBottom from footerControlsSnap
- `src/screens/CameraScreen.js` - Added useSafeAreaInsets for dynamic footer padding, added "To: FriendName" recipient header pill with snap-specific styles
- `src/screens/SnapPreviewScreen.js` - Increased Polaroid border (8->16) and strip height (56->64), moved footer inside KAV, set behavior=padding with keyboardVerticalOffset
- `src/components/ConversationRow.js` - Changed unread badge to absolute positioning (top: 22, right: 0), added position:relative and minHeight to rightColumn

## Decisions Made

- Dynamic `Math.max(insets.bottom, 16)` for snap footer: ensures minimum 16px padding on devices without home indicators while respecting actual safe area on devices with them
- Recipient header as absolute pill: overlays camera preview without affecting layout flow, uses semi-transparent dark background for readability
- Polaroid border doubled to 16px: 8px looked too thin on mobile screens, 16px matches realistic Polaroid proportions
- Footer moved inside KAV: root cause of under-compensation was footer sitting outside KAV, so KAV didn't account for its height
- KAV behavior changed to 'padding' on both platforms: 'height' was unreliable on Android per debug diagnosis
- Unread badge absolute positioning: prevents flow-based height growth of rightColumn which was causing vertical re-centering of the snap button

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four UAT gaps (Tests 1, 2, 3, 6) addressed by this plan
- Plan 08 (remaining gap closure) can proceed independently
- OTA update recommended after visual verification on device

---

_Phase: 03-snap-messages_
_Completed: 2026-02-24_
