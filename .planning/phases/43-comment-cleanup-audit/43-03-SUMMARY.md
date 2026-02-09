---
phase: 43-comment-cleanup-audit
plan: 03
subsystem: ui
tags: [comments, components, code-quality, audit]

# Dependency graph
requires:
  - phase: 43-comment-cleanup-audit
    provides: comment audit methodology from plans 01 and 02
provides:
  - All component file comments audited and cleaned
affects: [43-04, code-quality]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/components/comments/CommentInput.js
    - src/components/comments/CommentPreview.js
    - src/components/comments/CommentRow.js
    - src/components/comments/CommentsBottomSheet.js
    - src/components/comments/CommentWithReplies.js
    - src/components/comments/index.js
    - src/components/ProfileSong/ClipSelectionModal.js
    - src/components/ProfileSong/ProfileSongCard.js
    - src/components/ProfileSong/WaveformScrubber.js
    - src/components/AlbumCard.js
    - src/components/DownloadProgress.js
    - src/components/FeedLoadingSkeleton.js
    - src/components/FeedPhotoCard.js
    - src/components/FriendCard.js
    - src/components/FriendStoryCard.js
    - src/components/SelectsEditOverlay.js
    - src/components/StoriesViewerModal.js
    - src/components/SwipeablePhotoCard.js
    - src/components/TagFriendsModal.js
    - src/components/TaggedPeopleModal.js
    - src/components/index.js

key-decisions:
  - "AnimatedSplash.js 'Phase N' comments are animation sequence labels, not project phase references — kept as-is"

patterns-established: []

issues-created: []

# Metrics
duration: 14min
completed: 2026-02-09
---

# Phase 43 Plan 03: Components Comment Audit Summary

**Removed 161 lines of stale TODOs, noise comments, and verbose section headers across 21 component files in comments/, ProfileSong/, and top-level A-Z**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-09T14:27:08Z
- **Completed:** 2026-02-09T14:41:23Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments

- Audited all ~50 component files across comments/, ProfileSong/, and top-level components
- Removed stale section header comments, noise comments restating obvious code, and verbose block comments
- Fixed inaccurate comment descriptions in CommentPreview, CommentsBottomSheet, and CommentWithReplies
- Confirmed AnimatedSplash.js "Phase" references are animation sequence labels (not project phases) — kept
- Skipped ErrorBoundary.js (already audited in Plan 01)
- Zero TODO/FIXME/HACK comments remain in components/
- Zero code behavior changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit comments/, ProfileSong/, and components A-F** - `17beb2b` (chore) — 15 files, -81 lines
2. **Task 2: Audit components G-Z** - `eac7a86` (chore) — 6 files, -60 lines

## Files Created/Modified

### Task 1 (15 files modified):

- `src/components/comments/CommentInput.js` - Removed verbose section headers and noise comments
- `src/components/comments/CommentPreview.js` - Fixed inaccurate description, removed noise
- `src/components/comments/CommentRow.js` - Removed verbose block comments, kept workaround explanations
- `src/components/comments/CommentsBottomSheet.js` - Fixed inaccurate comments
- `src/components/comments/CommentWithReplies.js` - Fixed description, removed noise
- `src/components/comments/index.js` - Removed noise comment
- `src/components/ProfileSong/ClipSelectionModal.js` - Removed noise comments
- `src/components/ProfileSong/ProfileSongCard.js` - Removed verbose section headers
- `src/components/ProfileSong/WaveformScrubber.js` - Removed noise comments
- `src/components/AlbumCard.js` - Fixed inaccurate comment
- `src/components/DownloadProgress.js` - Removed noise comments
- `src/components/FeedLoadingSkeleton.js` - Removed stale section headers
- `src/components/FeedPhotoCard.js` - Removed noise comments
- `src/components/FriendCard.js` - Removed noise comments
- `src/components/FriendStoryCard.js` - Removed noise comments

### Task 2 (6 files modified):

- `src/components/SelectsEditOverlay.js` - Removed verbose section headers
- `src/components/StoriesViewerModal.js` - Removed stale/noise comments
- `src/components/SwipeablePhotoCard.js` - Removed noise comments
- `src/components/TagFriendsModal.js` - Removed verbose section headers and noise
- `src/components/TaggedPeopleModal.js` - Removed verbose section headers and noise
- `src/components/index.js` - Removed noise comment

### Files with no changes needed (~29 files):

AddFriendsPromptCard, AddToAlbumSheet, AlbumBar, AlbumPhotoViewer, AnimatedSplash, AuthCodeInput, Button, Card, DarkroomBottomSheet, DeletionRecoveryModal, DropdownMenu, FullscreenSelectsViewer, GifPicker, MentionText, InAppNotificationBanner, Input, MeStoryCard, MonthlyAlbumCard, MonthlyAlbumsSection, PhotoDetailModal, ReactionDisplay, RenameAlbumModal, SelectsBanner, StepIndicator, TakeFirstPhotoCard, YearSection, SongSearchResult, ProfileSong/index.js, ErrorBoundary (skipped)

## Decisions Made

- AnimatedSplash.js uses "Phase 1/2/3/4" to label animation sequence stages — these are functional labels, not project phase references, so they were kept as-is

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Components comment audit complete
- Ready for 43-04-PLAN.md (Screens, styles, constants comment audit) — final plan in Phase 43

---

_Phase: 43-comment-cleanup-audit_
_Completed: 2026-02-09_
