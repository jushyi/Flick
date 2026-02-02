# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-001: Optimize photo capture for full-screen display

- **Discovered:** Phase 8 Task 1 (2026-01-29)
- **Type:** UX
- **Description:** Photos taken in the app should be captured at an aspect ratio that fills the full screen when viewed in AlbumPhotoViewer (and other full-screen viewers). Currently photos may have different aspect ratios causing black bars or cropping when displayed full-screen.
- **Impact:** Low (works correctly with cover/contain modes, this would enhance visual experience)
- **Effort:** Medium (requires camera capture settings adjustment and potentially migration for existing photos)
- **Suggested phase:** Future

### ~~ISS-002: Comment avatar profile navigation not working~~ (FIXED)

- **Discovered:** Phase 15.2 FIX2 verification (2026-02-02)
- **Fixed:** Phase 15.3 Plan 02 (2026-02-02)
- **Type:** Bug
- **Description:** Tapping commenter avatars in CommentsBottomSheet doesn't navigate to their profile. The simplified handler calls `onAvatarPress(userId, userName)` but the navigation may not be firing correctly.
- **Resolution:** Fixed by wiring up `handleCommentAvatarPress` in PhotoDetailScreen to call `contextAvatarPress` which routes through FeedScreen's callback to navigate to OtherUserProfile. Navigation now works correctly.
- **Related:** ISS-004 tracks the follow-up issue where comments close during this navigation

### ISS-003: Modal stacking architecture - underlying modals hidden on profile navigation

- **Discovered:** Phase 15.2 FIX2 verification (2026-02-02)
- **Type:** Architecture
- **Description:** When navigating to OtherUserProfile from PhotoDetailModal or Stories, the underlying modal/viewer is hidden. This is because `fullScreenModal` presentation hides the parent screen. Instagram and TikTok keep their interfaces open by either:
  1. Using `transparentModal` or `containedTransparentModal` presentation (keeps parent visible)
  2. Using navigation screens instead of Modal components for photo viewers
  3. Using portal-based rendering to decouple UI from navigation hierarchy
- **Research findings:**
  - `fullScreenModal` = parent hidden, no gesture dismiss
  - `transparentModal` = parent visible and mounted
  - `containedTransparentModal` = parent visible on both iOS/Android
  - Warning: Mixing modal types in one stack can cause freezes/crashes on iOS
- **Impact:** High (core UX expectation - return to where you were)
- **Effort:** High (may require architectural change to PhotoDetailModal/Stories)
- **Options:**
  1. Change OtherUserProfile to `transparentModal` (quick but may have issues)
  2. Convert PhotoDetailModal to a navigation screen instead of Modal component
  3. Use portal-based approach (react-native-portal) to render modals outside nav hierarchy
- **Suggested phase:** 15.3 or dedicated architectural phase

### ISS-004: Comments sheet closes when navigating to profile

- **Discovered:** Phase 15.3 Plan 02 verification (2026-02-02)
- **Type:** Bug
- **Description:** When tapping a commenter's avatar to view their profile, the comments sheet closes. When returning from the profile, comments should still be open but they reset to closed state. This happens despite storing `showComments` in PhotoDetailContext - the underlying CommentsBottomSheet Modal component seems to be dismissed by the system when OtherUserProfile (fullScreenModal) is pushed.
- **Root cause:** React Native Modal component inside a transparentModal navigation screen gets dismissed when another modal screen stacks on top. The context state is preserved but the Modal's internal visibility state is reset.
- **Attempted fixes:**
  1. Moved `showComments` state from local to context - state preserved but Modal still closes
  2. Removed the `setShowComments(false)` call before navigation - no effect
- **Potential solutions:**
  1. Replace Modal-based CommentsBottomSheet with an Animated.View that's always rendered
  2. Use a portal-based approach to render comments outside navigation hierarchy
  3. Change OtherUserProfile from fullScreenModal to card presentation
- **Impact:** Medium (users lose their place in comments thread)
- **Effort:** Medium-High (may require CommentsBottomSheet refactor)
- **Suggested phase:** 15.4 or 16

### ISS-005: Swipe up on photo to open comments

- **Discovered:** Phase 15.3 Plan 02 verification (2026-02-02)
- **Type:** Enhancement
- **Description:** Add gesture support to swipe up on the photo in PhotoDetailScreen to open the comments sheet. This is a common pattern in social apps (Instagram, TikTok) for quick access to comments.
- **Implementation notes:**
  1. Add PanResponder or gesture handler on photo area
  2. Detect upward swipe gesture (dy < -threshold)
  3. Call `setShowComments(true)` on swipe up
  4. Already have swipe down to dismiss - this complements it
- **Impact:** Low (UX enhancement, not blocking functionality)
- **Effort:** Low (simple gesture addition)
- **Suggested phase:** 15.4 or 16

## Closed Enhancements

[Moved here when addressed]
