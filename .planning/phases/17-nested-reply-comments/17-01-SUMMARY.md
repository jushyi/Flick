---
phase: 17-nested-reply-comments
plan: 01
subsystem: comments
tags: [comments, replies, mentions, firestore]

# Dependency graph
requires:
  - phase: 16
    provides: Color constants standardization
provides:
  - Reply-to-reply comment support with flat thread structure
  - mentionedCommentId field for tracking reply targets
  - Auto @mention insertion in comment input
affects: [17-02, comments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Flat thread structure with parentId resolution for nested replies
    - mentionedCommentId for scroll-to functionality (Plan 02)
    - initialMention state propagation through component hierarchy

key-files:
  created: []
  modified:
    - src/services/firebase/commentService.js
    - src/hooks/useComments.js
    - src/components/comments/CommentWithReplies.js
    - src/components/comments/CommentRow.js
    - src/components/comments/CommentInput.js
    - src/components/comments/CommentsBottomSheet.js

key-decisions:
  - "Flat thread structure: replies to replies use original parent's parentId"
  - 'mentionedCommentId tracks specific comment being replied to'
  - 'Reply button shown on all comments (top-level and replies)'
  - '@username auto-inserted via initialMention prop on CommentInput'

patterns-established:
  - 'Reply-to-reply resolves to original thread parent for flat visual structure'
  - 'initialMention state flows: useComments → CommentsBottomSheet → CommentInput'

issues-created: []

# Metrics
duration: 12 min
completed: 2026-02-03
---

# Phase 17 Plan 01: Reply Infrastructure Summary

**Reply-to-reply support with flat thread structure and auto @mention insertion**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-03T14:30:00Z
- **Completed:** 2026-02-03T14:42:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Updated commentService.addComment to accept replies to any comment (including replies)
- Implemented flat thread structure where replies to replies use original parent's parentId
- Added mentionedCommentId field to track specific comment being replied to
- Enabled Reply button on all comments (top-level and replies)
- Auto-insert @username in input when tapping Reply via initialMention prop

## Task Commits

Each task was committed atomically:

1. **Task 1: Update commentService for reply-to-reply** - `dee597b` (feat)
2. **Task 2: Enable Reply button on replies with auto @mention** - `3e5fa0f` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/services/firebase/commentService.js` - Added mentionedCommentId parameter, resolve parentId to original thread, store mentionedCommentId in document
- `src/hooks/useComments.js` - Added initialMention state, pass mentionedCommentId to service, set initialMention on setReplyingTo
- `src/components/comments/CommentWithReplies.js` - Pass onReply to reply comments (was null)
- `src/components/comments/CommentRow.js` - Show Reply button based on onReply callback (not isTopLevel)
- `src/components/comments/CommentInput.js` - Added initialMention prop with useEffect to pre-fill input
- `src/components/comments/CommentsBottomSheet.js` - Pass initialMention from useComments to CommentInput

## Decisions Made

- **Flat thread structure**: All replies appear under the same top-level parent visually. When replying to a reply, the new comment's parentId is set to the original thread's parent (not the reply being replied to).
- **mentionedCommentId**: A new field that tracks which specific comment was replied to. This enables Plan 02's scroll-to-comment and @mention highlighting features.
- **Reply button visibility**: Changed from `isTopLevel` condition to `onReply` callback presence, allowing replies to also have Reply buttons.
- **initialMention flow**: The username to @mention flows from useComments hook through CommentsBottomSheet to CommentInput via props.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Reply infrastructure complete, ready for Plan 02: @Mention rendering and scroll-to-comment navigation
- mentionedCommentId is stored in Firestore, ready to be used for highlighting/scrolling

---

_Phase: 17-nested-reply-comments_
_Completed: 2026-02-03_
