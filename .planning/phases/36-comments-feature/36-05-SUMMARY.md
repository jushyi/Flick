---
phase: 36-comments-feature
plan: 05
subsystem: ui
tags: [react-native, comments, threading, replies, bottom-sheet]

# Dependency graph
requires:
  - phase: 36-04
    provides: Comment likes and delete functionality
provides:
  - One-level threaded replies with expand/collapse toggle
  - isTopLevel prop for CommentRow to control Reply button visibility
  - CommentWithReplies component managing reply visibility state
affects: [36-comments-feature]

# Tech tracking
tech-stack:
  added: []
  patterns: [Component extraction for local state in FlatList]

key-files:
  created:
    - src/components/comments/CommentWithReplies.js
  modified:
    - src/components/comments/CommentRow.js
    - src/components/comments/CommentsBottomSheet.js
    - src/components/comments/index.js
    - src/styles/CommentsBottomSheet.styles.js

key-decisions:
  - 'Extracted CommentWithReplies component to manage expand/collapse state since hooks cannot be used in FlatList renderItem callbacks'
  - 'Used visual left border with indentation to show reply nesting hierarchy'

patterns-established:
  - 'Component extraction: When FlatList items need local state, extract to separate component'
  - 'Reply threading: One level deep only - replies cannot have further replies'

issues-created: []

# Metrics
duration: 12min
completed: 2026-01-26
---

# Phase 05: Comment Threading Replies Summary

**One-level Instagram-style threaded replies with expand/collapse toggle and visual nesting indicators**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-26
- **Completed:** 2026-01-26
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added isTopLevel prop to CommentRow to show Reply button only on top-level comments
- Created CommentWithReplies component to manage expand/collapse state for replies
- Added "View X replies" / "Hide replies" toggle with visual left border nesting
- Replies visually indented with border-left indicator

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reply functionality to comment input** - `7f8500d` (feat)
2. **Task 2: Display threaded replies with visual nesting** - `5f7010e` (feat)

**Plan metadata:** `fc726ca` (docs: complete plan)

## Files Created/Modified

- `src/components/comments/CommentWithReplies.js` - New component managing reply expand/collapse state
- `src/components/comments/CommentRow.js` - Added isTopLevel prop to conditionally show Reply button
- `src/components/comments/CommentsBottomSheet.js` - Replaced inline reply rendering with CommentWithReplies
- `src/components/comments/index.js` - Exported CommentWithReplies component
- `src/styles/CommentsBottomSheet.styles.js` - Added repliesSection, viewRepliesButton, viewRepliesLine, viewRepliesText, replyItem styles

## Decisions Made

- **Component extraction:** Created separate CommentWithReplies component instead of trying to use hooks in renderItem callback - React hooks rules require they be called at component top level
- **Visual design:** Used horizontal line + "View X replies" text toggle matching Instagram-style threading UX

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## Next Phase Readiness

- Threading system complete for one-level replies
- Ready for Phase 06 (media comments with image/GIF picker)

---

_Phase: 36-comments-feature_
_Completed: 2026-01-26_
