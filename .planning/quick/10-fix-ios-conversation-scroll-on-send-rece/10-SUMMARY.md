---
phase: quick
plan: 10
subsystem: ui
tags: [react-native, flatlist, scroll, ios, inverted-list, dm]

requires:
  - phase: quick-9
    provides: iOS DM input bar padding and background fix
provides:
  - Auto-scroll to newest message on send (text and GIF)
  - Auto-scroll on receive when user is near bottom of conversation
  - Scroll position preservation when user is reading older messages
affects: [conversation, messaging, dm]

tech-stack:
  added: []
  patterns:
    [
      scrollToOffset on inverted FlatList,
      onSend callback for parent notification,
      near-bottom detection via onScroll,
    ]

key-files:
  created: []
  modified:
    - src/screens/ConversationScreen.js
    - src/components/DMInput.js

key-decisions:
  - 'Remove maintainVisibleContentPosition entirely instead of working around it'
  - 'Use scrollToOffset with offset 0 instead of scrollToIndex for inverted lists'
  - '150px near-bottom threshold for auto-scroll on receive (~3-4 message bubbles)'
  - '100ms setTimeout delay to allow FlatList to process new item before scrolling'

patterns-established:
  - 'onSend callback pattern: DMInput notifies parent synchronously on send'
  - 'Near-bottom tracking: onScroll + ref for detecting user scroll position in inverted lists'

requirements-completed: []

duration: 2min
completed: 2026-02-23
---

# Quick Task 10: Fix iOS Conversation Scroll on Send/Receive Summary

**Auto-scroll to newest message on send and smart auto-scroll on receive using scrollToOffset with near-bottom detection on inverted FlatList**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T20:47:39Z
- **Completed:** 2026-02-23T20:49:25Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Sending a text or GIF on iOS now scrolls the inverted FlatList to offset 0 (showing newest message)
- Incoming messages auto-scroll when user is near the bottom (contentOffset.y < 150)
- Incoming messages do NOT force-scroll when user has scrolled up to read older messages
- Removed `maintainVisibleContentPosition` which was preventing iOS auto-scroll on new messages
- No platform guards needed -- scroll logic works identically on Android

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scroll-to-bottom on send and auto-scroll on new message receive** - `57c6090` (fix)

## Files Created/Modified

- `src/components/DMInput.js` - Added optional `onSend` callback prop, called after text and GIF sends
- `src/screens/ConversationScreen.js` - Added `scrollToBottom`, `handleScroll` near-bottom tracker, `useEffect` for auto-scroll on receive, removed `maintainVisibleContentPosition`

## Decisions Made

- **Removed maintainVisibleContentPosition entirely:** This iOS-only prop was the root cause -- it tells FlatList to keep currently visible content in place when new items prepend, which prevents seeing new messages at index 0 of an inverted list. Pagination (loading older messages) does not need this prop because `onEndReached` appends to the list footer.
- **scrollToOffset over scrollToIndex:** Using `scrollToOffset({ offset: 0 })` is more reliable for inverted lists than `scrollToIndex({ index: 0 })` since it does not depend on item measurement.
- **150px near-bottom threshold:** About 3-4 message bubbles of scroll distance, providing a comfortable buffer zone where auto-scroll still fires.
- **100ms delay on scroll:** Allows FlatList to process the new data item before attempting to scroll, preventing race conditions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Prettier formatting errors on initial commit attempt (parenthesized arrow param, long JSX line) -- fixed inline before commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- iOS conversation scroll behavior is now correct for both send and receive
- Android behavior is unaffected (no platform-specific code in the scroll logic)
- Ready for manual verification on device

## Self-Check: PASSED

- FOUND: src/screens/ConversationScreen.js
- FOUND: src/components/DMInput.js
- FOUND: 10-SUMMARY.md
- FOUND: commit 57c6090

---

_Quick task: 10-fix-ios-conversation-scroll-on-send-rece_
_Completed: 2026-02-23_
