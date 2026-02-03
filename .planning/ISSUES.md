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
- **Suggested phase:** Phase 16 (natural fit with modal/navigation architecture work)

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
- **Suggested phase:** Phase 16 (touches same PhotoDetailScreen gesture handling)

## Closed Enhancements

### ISS-002: Comment avatar profile navigation not working

- **Discovered:** Phase 15.2 FIX2 verification (2026-02-02)
- **Closed:** 2026-02-03
- **Type:** Bug
- **Resolution:** Fixed in Phase 15.3-02 by wiring up `handleCommentAvatarPress` in PhotoDetailScreen to call `contextAvatarPress` which routes through FeedScreen's callback to navigate to OtherUserProfile. Navigation now works correctly.
- **Related:** ISS-004 tracks the follow-up issue where comments close during this navigation

### ISS-003: Modal stacking architecture - underlying modals hidden on profile navigation

- **Discovered:** Phase 15.2 FIX2 verification (2026-02-02)
- **Closed:** 2026-02-03
- **Type:** Architecture
- **Resolution:** Fixed in Phase 15.3-02 by converting PhotoDetailModal from Modal component to navigation screen using `transparentModal` presentation. Previous screens now stay visible underneath when navigating to profiles.

### ISS-006: Own story ring indicator doesn't update after viewing

- **Discovered:** Phase 15.4 FIX verification (2026-02-03)
- **Closed:** 2026-02-03
- **Type:** Bug
- **Resolution:** Fixed in Phase 15.4-02-FIX by using refs for close handlers. Root cause was stale closure - the `setCallbacks` useEffect captured an old version of `handleCloseMyStories` that had null `myStories` state. Fix: Added `handleCloseMyStoriesRef` and `handleCloseStoriesRef` refs, update them on each render, and call via refs in the callback.

### ISS-007: Own story doesn't resume at correct position

- **Discovered:** Phase 15.4 FIX verification (2026-02-03)
- **Closed:** 2026-02-03
- **Type:** Bug
- **Resolution:** Fixed in Phase 15.4-02-FIX (same fix as ISS-006). The stale closure meant `markPhotosAsViewed` was never called with valid photo IDs, so `getFirstUnviewedIndex` didn't see any photos as viewed. With the ref-based handlers, photos are now correctly marked as viewed.

### ISS-008: Reactions not sorting by count (highest left)

- **Discovered:** Phase 15.4 FIX verification (2026-02-03)
- **Closed:** 2026-02-03
- **Type:** Bug (Regression)
- **Resolution:** Fixed in Phase 15.4-02-FIX by resetting `frozenOrder` state when photo changes. Root cause was that `frozenOrder` (which freezes emoji order briefly after tapping) persisted across photo changes. Added `setFrozenOrder(null)` to the existing photo change useEffect in `usePhotoDetailModal.js`.
