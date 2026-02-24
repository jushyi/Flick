---
phase: quick-20
plan: 01
subsystem: ui
tags: [react-native, flatlist, animation, scroll, DM]

requires:
  - phase: 02-message-interactions
    provides: Reply system with scroll-to-message and highlight in ConversationScreen

provides:
  - Correct scroll-to-message targeting using messagesWithDividers index
  - Deferred highlight timing that plays after scroll animation completes
  - Two-phase pulse highlight animation with cyan accent tint

affects: [conversations, messaging]

tech-stack:
  added: []
  patterns: [deferred-highlight-after-scroll, two-phase-pulse-animation]

key-files:
  created: []
  modified:
    - src/screens/ConversationScreen.js
    - src/components/MessageBubble.js

key-decisions:
  - '600ms highlight delay covers both happy path (~300ms scroll) and onScrollToIndexFailed retry (500ms + scroll)'
  - 'Two-phase pulse (flash in, hold, fade out) instead of single fade for stronger visual cue'
  - 'Cyan rgba(0,212,255,0.15) highlight matches interactive.primary accent used throughout DM UI'

patterns-established:
  - 'Deferred highlight: always delay visual feedback until scroll animation completes'

requirements-completed: [QUICK-20]

duration: 1min
completed: 2026-02-24
---

# Quick Task 20: Fix Reply Scroll-to-Message and Highlight Summary

**Fixed DM reply scroll targeting to use messagesWithDividers index, deferred highlight by 600ms so flash plays after scroll completes, and improved visibility with two-phase cyan pulse animation**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-24T15:43:49Z
- **Completed:** 2026-02-24T15:45:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed scroll index lookup to use `messagesWithDividers` (the FlatList data source) instead of `messages`, so scroll targets the correct position even with date dividers interleaved
- Deferred highlight activation by 600ms after scroll initiation, covering both normal scroll path and onScrollToIndexFailed retry path
- Replaced single-phase fade animation (0.4 to 0 over 1500ms) with two-phase pulse: flash in (0 to 0.5 over 150ms), hold (300ms), fade out (0.5 to 0 over 1200ms)
- Changed highlight overlay color from purple tint to cyan `rgba(0, 212, 255, 0.15)` matching the app's interactive.primary accent

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix scroll index to use messagesWithDividers and defer highlight** - `aaece43` (fix)
2. **Task 2: Make MessageBubble highlight animation more visible** - `b9744b6` (fix)

## Files Modified

- `src/screens/ConversationScreen.js` - Changed scrollToMessage to use messagesWithDividers.findIndex, deferred setHighlightedMessageId by 600ms, increased highlight duration to 1800ms
- `src/components/MessageBubble.js` - Replaced single fade with RNAnimated.sequence two-phase pulse, changed highlight overlay to cyan tint

## Decisions Made

- Used 600ms delay to cover both happy path (~300ms scroll animation) and retry path (500ms onScrollToIndexFailed + scroll time), rather than complex ref-based coordination between callbacks
- Two-phase pulse animation (flash in / hold / fade out) provides a stronger visual signal than a single fade, helping users notice the highlighted message
- Cyan highlight color matches interactive.primary accent used in sent message bubbles and other DM UI elements, maintaining visual consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

- All 2 modified files exist on disk
- All 2 task commits verified (aaece43, b9744b6)
- Key pattern `messagesWithDividers.findIndex` confirmed in ConversationScreen.js
- Key pattern `RNAnimated.sequence` confirmed in MessageBubble.js

---

_Phase: quick-20_
_Completed: 2026-02-24_
