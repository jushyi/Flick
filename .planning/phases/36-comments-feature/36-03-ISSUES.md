# UAT Issues: Phase 36 Plan 03

**Tested:** 2026-01-26
**Source:** .planning/phases/36-comments-feature/36-03-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-002: Comment doesn't appear in list after submitting

**Discovered:** 2026-01-26
**Phase/Plan:** 36-03
**Severity:** Major
**Feature:** CommentsBottomSheet comment submission
**Description:** When user types and submits a comment, it saves but doesn't appear in the comments list within the bottom sheet.
**Expected:** New comment immediately appears in the comments list
**Actual:** Comment doesn't show in the list (but may be saving to Firestore)
**Status:** Needs verification - real-time subscription code appears correct, UX fixes may resolve this

## Resolved Issues

### UAT-001: Footer layout is ~1/3 not 50/50 as designed

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** 3732516
**Fix:** Changed `commentInputTrigger` and `emojiPickerScrollView` to `flex: 1` for equal 50/50 split

### UAT-003: CommentsBottomSheet closes on comment send

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** 1925bf2
**Fix:** Removed close behavior, added refocus to input after successful comment submit

### UAT-004: Preview comments overlap with user's name in modal

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** 3732516
**Fix:** Adjusted userInfoOverlay to bottom: 140 and commentPreviewContainer to absolute positioning at bottom: 100

### UAT-005: Comment button on feed cards doesn't open CommentsBottomSheet

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** d1757f0
**Fix:** Added `onCommentPress` prop to FeedPhotoCard, `initialShowComments` prop to PhotoDetailModal

### UAT-006: Client-side filtering is a bandaid for Firestore composite index issue

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** 0954989
**Fix:** Created firestore.indexes.json with composite index, updated getPreviewComments to use server-side filtering
**Deploy:** Run `firebase deploy --only firestore:indexes` to activate

### UAT-007: Keyboard doesn't auto-open when CommentsBottomSheet appears

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** 1925bf2
**Fix:** Added auto-focus to inputRef after sheet animation completes with 100ms delay

### UAT-008: CommentsBottomSheet has poor empty state

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26
**Commit:** 1925bf2
**Fix:** Added MIN_SHEET_HEIGHT (50% screen) to sheet and emptyContainer styles for consistent height

---

_Phase: 36-comments-feature_
_Plan: 03_
_Tested: 2026-01-26_
_Fixed: 2026-01-26_
