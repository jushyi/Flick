# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

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

### ISS-001: Optimize photo display for full viewing in albums

- **Discovered:** Phase 8 Task 1 (2026-01-29)
- **Closed:** 2026-02-06
- **Type:** UX
- **Resolution:** Fixed in Phase 32-01 by changing `contentFit` from `cover` to `contain` in AlbumPhotoViewer. Photos now display in full without cropping, with letterboxing if aspect ratio differs from screen. Feed/stories views kept `cover` mode per user preference for immersive full-screen experience.
- **Files modified:** `src/components/AlbumPhotoViewer.js`

### ISS-010: Duplicate day headers in monthly albums when journaling old photos

- **Discovered:** Phase 18 testing (2026-02-04)
- **Closed:** 2026-02-04
- **Type:** Bug
- **Resolution:** Fixed by adding `getMonthFromTimestamp()` helper and updating `triagePhoto()` to recalculate `month` from `capturedAt` when journaling. Now photos are assigned to the correct month based on when they were taken, not when they were triaged.
- **Files modified:** `src/services/firebase/photoService.js`
- **Note:** Existing photos with incorrect `month` fields are not auto-migrated. New triage actions will use correct month. Manual data fix may be needed for already-affected photos.

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
- **Reopened as:** ISS-009
- **Type:** Bug (Regression)
- **Resolution:** Attempted fix in Phase 15.4-02-FIX by resetting `frozenOrder` state when photo changes. However, verification showed reactions still not sorting correctly. Issue reopened as ISS-009 for further investigation.

### ISS-009: Reactions still not sorting by count (highest left)

- **Discovered:** Phase 15.4-02-FIX verification (2026-02-03)
- **Closed:** 2026-02-03
- **Type:** Bug
- **Resolution:** Fixed in Phase 15.4-03-FIX with two root causes identified:
  1. **Stale data in useMemo**: The `groupedReactions` useMemo depended on a destructured `reactions` variable, but React's dependency comparison wasn't detecting changes when photos loaded from Firestore. Fix: Read directly from `currentPhoto?.reactions` inside the memo and depend on `currentPhoto`.
  2. **Custom emojis not sorted**: The `orderedEmojis` logic only sorted curated emojis by count - custom emojis (added via emoji picker) were prepended without sorting. Fix: Changed to sort ALL emojis (custom + curated) together by total count.
- **Files modified:** `src/hooks/usePhotoDetailModal.js`
- **Pattern:** Always read from source object inside useMemo/useCallback rather than relying on destructured variables for React dependency comparison.

### ISS-011: Custom profile photo crop UI with circular preview

- **Discovered:** Phase 22 Task 2 (2026-02-05)
- **Closed:** 2026-02-06
- **Type:** Enhancement
- **Resolution:** Fixed in Phase 32-02 by creating custom ProfilePhotoCropScreen with:
  1. SVG-based circular mask overlay (transparent circle, 70% dimmed outside)
  2. Pinch-to-zoom and pan gestures using react-native-gesture-handler + react-native-reanimated
  3. expo-image-manipulator for cropping to square 1:1 output
  4. Direct gesture response (no bouncy animations)
  5. Zoom limits: minimum fills circle, maximum 4x
- **Files created:** `src/screens/ProfilePhotoCropScreen.js`
- **Files modified:** `src/screens/EditProfileScreen.js`, `src/screens/ProfileSetupScreen.js`, `src/navigation/AppNavigator.js`
- **Note:** "Edit existing photo" capability (re-cropping uploaded photo) not included in this fix - would require downloading current photo from Firebase Storage first.
