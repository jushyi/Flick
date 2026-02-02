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

### ISS-002: Comment avatar profile navigation not working

- **Discovered:** Phase 15.2 FIX2 verification (2026-02-02)
- **Type:** Bug
- **Description:** Tapping commenter avatars in CommentsBottomSheet doesn't navigate to their profile. The simplified handler calls `onAvatarPress(userId, userName)` but the navigation may not be firing correctly.
- **Impact:** Medium (users can't view commenter profiles from comments)
- **Effort:** Low (likely a prop passing or handler wiring issue)
- **Suggested phase:** 15.2 or 16

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

## Closed Enhancements

[Moved here when addressed]
