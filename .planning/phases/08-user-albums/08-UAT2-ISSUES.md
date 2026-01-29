# UAT Issues: Phase 8 (Second Round)

**Tested:** 2026-01-29
**Source:** .planning/phases/08-user-albums/\*SUMMARY.md (all plans)
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-013: Dropdown menus should be anchored to trigger element

**Discovered:** 2026-01-29
**Phase/Plan:** 08-FIX5
**Severity:** Minor
**Feature:** DropdownMenu component
**Description:** All dropdown menus appear centered on screen instead of anchored to the button/element that triggered them.
**Expected:** Menu appears directly below (or near) the 3-dot button or long-pressed album/photo
**Actual:** Menu appears in center of screen
**Repro:**

1. Open any album grid
2. Tap 3-dot menu in header
3. Menu appears centered instead of under button

**Locations affected:**

- AlbumPhotoViewer 3-dot menu
- AlbumGridScreen header 3-dot menu
- AlbumGridScreen photo long-press menu
- ProfileScreen album long-press menu

---

### UAT-014: Keyboard covers RenameAlbumModal

**Discovered:** 2026-01-29
**Phase/Plan:** 08-FIX5
**Severity:** Major
**Feature:** RenameAlbumModal component
**Description:** When the rename modal opens and keyboard appears, the keyboard covers the text input field.
**Expected:** Modal should adjust position when keyboard appears (KeyboardAvoidingView)
**Actual:** Modal stays in place and keyboard covers the input
**Repro:**

1. Open album grid
2. Tap 3-dot menu → Rename Album
3. Keyboard opens and covers the input field

---

### UAT-018: RenameAlbumModal backdrop slides up instead of fading in

**Discovered:** 2026-01-29
**Phase/Plan:** 08-FIX5
**Severity:** Minor
**Feature:** RenameAlbumModal component
**Description:** The dark backdrop behind the rename modal slides up along with the modal content.
**Expected:** Backdrop should fade in while modal content slides up separately
**Actual:** Both backdrop and modal content slide up together
**Repro:**

1. Open album grid
2. Tap 3-dot menu → Rename Album
3. Watch the animation - backdrop slides up with the modal

---

### UAT-015: Thumbnail indicator oscillates during swipe navigation

**Discovered:** 2026-01-29
**Phase/Plan:** 08-FIX4
**Severity:** Minor
**Feature:** AlbumPhotoViewer thumbnail bar
**Description:** When swiping between photos, the white border indicator on the thumbnail bar bounces back and forth between current and next photo before settling on the correct position.
**Expected:** Indicator should snap directly to next photo as transition completes
**Actual:** Indicator appears to flash/oscillate between positions before settling
**Repro:**

1. Open photo viewer with multiple photos
2. Swipe left/right to navigate
3. Watch thumbnail bar indicator during transition

---

### UAT-016: Add Photos picker allows selecting photos already in album

**Discovered:** 2026-01-29
**Phase/Plan:** 08-03
**Severity:** Minor
**Feature:** AlbumPhotoPickerScreen (add to existing album)
**Description:** When adding photos to an existing album, photos that are already in the album are still selectable.
**Expected:** Photos already in album should be grayed out or visually marked and not selectable
**Actual:** All photos appear the same and can be selected (could cause duplicates)
**Repro:**

1. Create an album with some photos
2. Open album grid
3. Tap "Add Photos" button
4. Notice photos already in album can still be selected

---

### UAT-017: Add Photos navigates to Profile instead of Album Grid

**Discovered:** 2026-01-29
**Phase/Plan:** 08-03
**Severity:** Major
**Feature:** AlbumPhotoPickerScreen (add to existing album)
**Description:** After adding photos to an existing album, navigation goes to Profile screen instead of back to the album grid.
**Expected:** After adding photos, return to the album grid showing the updated album
**Actual:** Navigates to Profile screen, user has to re-open the album to see changes
**Repro:**

1. Open an existing album
2. Tap "Add Photos" button
3. Select photos and tap Add/Done
4. Gets taken to Profile instead of back to album grid

---

## Resolved Issues

[None yet]

---

_Phase: 08-user-albums_
_Tested: 2026-01-29_
