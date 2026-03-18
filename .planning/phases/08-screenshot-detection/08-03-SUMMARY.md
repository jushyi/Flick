---
phase: 08-screenshot-detection
plan: 03
subsystem: messaging
tags: [snap-bubble, screenshot-indicator, visual-state, conversation-ui, unit-test]

# Dependency graph
requires:
  - "08-01: screenshotService sets screenshottedAt on snap message documents"
  - "08-02: MessageBubble passes full message object (including screenshottedAt) to SnapBubble"
provides:
  - "SnapBubble 5th visual state: screenshotted snaps render dimmed amber bubble with eye-outline icon"
  - "Screenshotted state takes priority over Opened when both timestamps exist"
  - "20 unit tests covering all 5 SnapBubble visual states"
affects: [08-screenshot-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screenshotted state priority: isScreenshotted checked before isOpened in boolean derivation"
    - "Dimmed amber palette (0.08 BG, 0.2 border, 0.6 opacity) for screenshotted visual distinction"

key-files:
  created: []
  modified:
    - "src/components/SnapBubble.js"
    - "__tests__/components/SnapBubble.test.js"

key-decisions:
  - "isScreenshotted evaluated before isOpened so screenshotted takes priority when both timestamps present"
  - "Dimmed amber palette (SNAP_SCREENSHOTTED_BG/BORDER) distinct from opened gray and unopened bright amber"
  - "eye-outline icon used instead of camera to visually distinguish screenshotted from opened state"
  - "Opacity 0.6 sits between unopened (1.0) and opened (0.5) for subtle visual hierarchy"

patterns-established:
  - "5-state snap bubble: Sending > Error > Screenshotted > Opened > Unopened priority order in renderContent"

requirements-completed: [SCRN-01, SCRN-02, SCRN-03]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 8 Plan 03: Snap Bubble Screenshotted State Summary

**5th SnapBubble visual state with dimmed amber background, eye-outline icon, and screenshotted-over-opened priority via TDD**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T17:57:34Z
- **Completed:** 2026-03-18T18:01:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 5th "Screenshotted" visual state to SnapBubble with dimmed amber background, eye-outline icon, and "Screenshotted" label
- Screenshotted state takes priority over Opened when both viewedAt and screenshottedAt are present
- Screenshotted bubble is non-interactive (renders View, not TouchableOpacity)
- Timestamp displays "Screenshotted [time]" using screenshottedAt field
- All 20 unit tests pass (15 existing + 5 new screenshotted state tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add screenshotted state tests (TDD RED)** - `b56c499d` (test)
2. **Task 2: Add screenshotted visual state to SnapBubble.js (TDD GREEN)** - `dbcbfa3a` (feat)

_Note: Task 2 changes were included in commit dbcbfa3a due to lint-staged stash/restore behavior during the RED commit._

## Files Created/Modified
- `src/components/SnapBubble.js` - Added 5th screenshotted visual state with SNAP_SCREENSHOTTED_BG/BORDER constants, isScreenshotted boolean, screenshotted renderContent branch, screenshottedBubble style, and timestamp formatting
- `__tests__/components/SnapBubble.test.js` - Added 5 tests in "Screenshotted state" describe block: label+icon, no-Opened-label, priority, non-interactive, timestamp

## Decisions Made
- **isScreenshotted evaluated first:** Placed before isOpened derivation so screenshotted takes priority. isOpened gated by `!isScreenshotted` to prevent both being true simultaneously.
- **Dimmed amber palette:** SNAP_SCREENSHOTTED_BG (0.08 alpha) and SNAP_SCREENSHOTTED_BORDER (0.2 alpha) are dimmer than unopened amber but still amber-family, visually distinct from opened gray.
- **eye-outline icon:** Conveys "someone saw/captured this" -- distinct from the camera icon used in all other states.
- **Opacity 0.6:** Between unopened (1.0) and opened (0.5) for subtle visual hierarchy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- lint-staged stash/restore during RED commit caused SnapBubble.js working tree changes to be picked up by a concurrent commit (dbcbfa3a). The implementation is correct and all tests pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 (Screenshot Detection) is fully complete -- all 4 plans (00, 01, 02, 03) executed
- SnapBubble now renders all 5 visual states: Sending, Error, Screenshotted, Opened, Unopened
- Requires native EAS build before device testing (expo-screen-capture native module from Plan 08-01)

## Self-Check: PASSED

- [x] src/components/SnapBubble.js contains isScreenshotted (6 occurrences)
- [x] src/components/SnapBubble.js contains SNAP_SCREENSHOTTED_BG
- [x] src/components/SnapBubble.js contains SNAP_SCREENSHOTTED_BORDER
- [x] src/components/SnapBubble.js contains screenshottedBubble style
- [x] src/components/SnapBubble.js contains eye-outline icon
- [x] src/components/SnapBubble.js contains "five visual states" in header
- [x] src/components/SnapBubble.js contains formatScreenshottedTimestamp
- [x] __tests__/components/SnapBubble.test.js contains describe('Screenshotted state')
- [x] __tests__/components/SnapBubble.test.js contains screenshottedAt
- [x] All 20 SnapBubble tests pass
- [x] Commit b56c499d exists (Task 1 RED)
- [x] Commit dbcbfa3a exists (Task 2 GREEN)

---
*Phase: 08-screenshot-detection*
*Completed: 2026-03-18*
