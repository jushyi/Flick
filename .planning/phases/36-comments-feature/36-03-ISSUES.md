# UAT Issues: Phase 36 Plan 03

**Tested:** 2026-01-26
**Source:** .planning/phases/36-comments-feature/36-03-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

None - all Round 4 issues resolved.

## Resolved Issues

### UAT-020: CommentsBottomSheet swipe-to-close doesn't work

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** abc6602
**Fix:** Added PanResponder to handle bar area with swipe-to-close gesture

### UAT-021: Keyboard covers comments content (sheet should move up)

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** 3653441
**Fix:** Sheet moves UP using translateY animation instead of expanding height

### UAT-022: Username too close to photo bottom when no comments

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** ef3817b
**Fix:** Adjusted no-comments bottom position from 100 to 102

### UAT-023: Spacing between user info and comment preview too large

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** ef3817b
**Fix:** Reduced userInfoOverlay bottom from 140 to 130 (30px gap vs 40px)

### UAT-024: Comment timestamp too far from reply button

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** 23c398a
**Fix:** Reduced dot marginHorizontal from 6 to 4

### UAT-025: Send button shorter than comment input bar

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** 79f35e5
**Fix:** Increased send button size from 36x36 to 40x40 to match input field

### UAT-026: PhotoDetailModal swipe-to-close doesn't work (feed mode)

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** 950a781
**Fix:** Lowered PanResponder swipe threshold from dy > 10 to dy > 5

### UAT-027: User info and preview comments need 6px rightward shift

**Discovered:** 2026-01-26 (Round 4)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-3
**Commit:** efb8680
**Fix:** Changed left position from 16 to 22 for profilePicContainer, userInfoOverlay, commentPreviewContainer

### UAT-011: Comment preview still misaligned with username

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-2
**Commit:** 67dd0e0
**Fix:** Removed paddingBottom from commentPreviewContainer for better alignment with username

### UAT-015: Comment rotation timing should be 2 seconds, not 4 seconds

**Discovered:** 2026-01-26 (Round 3)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-2
**Commit:** 78518f6
**Fix:** Changed rotation interval from 4000ms to 2000ms

### UAT-016: "View all comments" should only appear on feed cards

**Discovered:** 2026-01-26 (Round 3)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-2
**Commits:** 78518f6, 9f0eb7c
**Fix:** Added showViewAll prop to CommentPreview, pass showViewAll={false} in PhotoDetailModal

### UAT-019: Empty comment preview leaves excess space between photo and username

**Discovered:** 2026-01-26 (Round 3)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-2
**Commit:** 67dd0e0
**Fix:** Dynamic userInfoOverlay bottom position (140 with comments, 100 without)

### UAT-018: Comment input placeholder has asymmetric vertical padding

**Discovered:** 2026-01-26 (Round 3)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-2
**Commit:** 155f17b
**Fix:** Added textAlignVertical: 'center', changed inputWrapper alignItems to 'center'

### UAT-017: Keyboard covers comments content when typing

**Discovered:** 2026-01-26 (Round 3)
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX-2
**Commit:** ec844c6
**Fix:** Expand sheet height when keyboard visible (remove maxHeight, add flex: 1)

### UAT-002: Comment doesn't appear in list after submitting

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26 (Round 3 verified)
**Fix:** Real-time subscription now correctly shows new comments after submit
**Note:** User reported this working in Round 2, confirmed in Round 3

### UAT-009: CommentsBottomSheet cannot be closed (BLOCKER)

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX
**Commit:** f3dc8e0
**Fix:** Used wasVisible ref to track visibility transitions - only apply initialShowComments on false->true transition

### UAT-010: Comment input clips into bottom safe area

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX
**Commit:** ea0aaca
**Fix:** Added Math.max(insets.bottom, 8) for minimum safe area padding

### UAT-012: Show single rotating comment preview instead of multiple

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX
**Commit:** 3f95862
**Fix:** Single rotating comment with 4-second interval and 200ms fade animation
**Note:** Timing preference (2s vs 4s) tracked separately as UAT-015

### UAT-013: Keyboard covers comment input when typing

**Discovered:** 2026-01-26
**Partially Resolved:** 2026-01-26 - Fixed in 36-03-FIX
**Commit:** 268b87a
**Fix:** Dynamic maxHeight removal when keyboard visible
**Note:** Input remains usable, but comments content still covered - tracked as UAT-017

### UAT-014: Comment tap doesn't open sheet in feed mode (only stories work)

**Discovered:** 2026-01-26
**Resolved:** 2026-01-26 - Fixed in 36-03-FIX
**Commit:** a1fc929
**Fix:** Conditional TouchableWithoutFeedback only in stories mode - feed mode has clean touch propagation

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
_Tested: 2026-01-26 (Round 1), 2026-01-26 (Round 2), 2026-01-26 (Round 3), 2026-01-26 (Round 4)_
_Fixed: 2026-01-26 (via 36-03-FIX, 36-03-FIX-2)_
