# UAT Issues: Phase 8 User Albums Display

**Tested:** 2026-01-29
**Source:** .planning/phases/08-user-albums/\*-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: Remove "New album" text under add button

**Discovered:** 2026-01-29
**Phase/Plan:** 08-02
**Severity:** Cosmetic
**Feature:** Album bar empty state / add button
**Description:** The add album button shows "New album" text underneath. User wants just the plus icon in dashed border box without the text label.
**Expected:** Plus icon only, no text
**Actual:** Plus icon with "New album" text underneath

### UAT-002: Photo picker grid should use photo aspect ratios

**Discovered:** 2026-01-29
**Phase/Plan:** 08-03
**Severity:** Minor
**Feature:** AlbumPhotoPickerScreen
**Description:** Photo grid shows square thumbnails. User wants rectangles that match the original photo aspect ratio.
**Expected:** Grid cells sized as rectangles matching photo aspect ratios
**Actual:** Square grid cells

### UAT-003: Move selected count into header

**Discovered:** 2026-01-29
**Phase/Plan:** 08-03
**Severity:** Minor
**Feature:** AlbumPhotoPickerScreen
**Description:** "X selected" count appears in its own bar. User wants it moved into the header under "Select Photos" title.
**Expected:** "Select Photos" header with "X selected" below it
**Actual:** Separate bar showing "X selected"

### UAT-004: Album grid should use photo aspect ratios

**Discovered:** 2026-01-29
**Phase/Plan:** 08-04
**Severity:** Minor
**Feature:** AlbumGridScreen
**Description:** Album photo grid shows square thumbnails. User wants rectangles that match the original photo aspect ratio.
**Expected:** Grid cells sized as rectangles matching photo aspect ratios
**Actual:** Square grid cells

### UAT-005: Add toast confirmation for cover set

**Discovered:** 2026-01-29
**Phase/Plan:** 08-05, 08-06
**Severity:** Minor
**Feature:** Set as Album Cover action
**Description:** When setting a photo as album cover, no feedback is shown. User wants an auto-dismissing toast notification.
**Expected:** Toast at bottom: "Cover set" with checkmark, auto-dismisses
**Actual:** Silent operation with no user feedback

### UAT-006: Remove photo navigates to wrong screen

**Discovered:** 2026-01-29
**Phase/Plan:** 08-05
**Severity:** Minor
**Feature:** AlbumPhotoViewer remove action
**Description:** After removing a photo from album via the viewer's 3-dot menu, it navigates back to Profile screen instead of the album grid.
**Expected:** Navigate back to AlbumGridScreen after removal
**Actual:** Navigates to ProfileScreen

### UAT-008: Delete last photo should offer album deletion

**Discovered:** 2026-01-29
**Phase/Plan:** 08-05
**Severity:** Minor
**Feature:** Remove photo from album
**Description:** When removing the last photo from an album, instead of showing an error dialog, prompt the user with "Deleting last photo will delete album. Are you sure you want to proceed?" with Cancel and Delete Album options.
**Expected:** Confirmation prompt offering to delete album when removing last photo
**Actual:** Error dialog saying album must have at least one photo

### UAT-010: Add thumbnail navigation bar to photo viewer

**Discovered:** 2026-01-29
**Phase/Plan:** 08-05
**Severity:** Major
**Feature:** AlbumPhotoViewer
**Description:** Full-screen photo viewer needs a horizontal thumbnail bar at the bottom to help users navigate and see their position. Should look similar to Selects bottom picker with white outline on current photo, horizontally scrollable.
**Expected:** Horizontal scrollable thumbnail bar at bottom with white outline on current
**Actual:** Only position text indicator (e.g., "2/5")

### UAT-011: Swipe down to close photo viewer

**Discovered:** 2026-01-29
**Phase/Plan:** 08-05
**Severity:** Minor
**Feature:** AlbumPhotoViewer
**Description:** Swiping down on the full-screen photo viewer should close it (common iOS pattern).
**Expected:** Swipe down gesture dismisses viewer
**Actual:** Only back button closes viewer

## Resolved Issues

### UAT-007: Replace Alert.alert menus with dropdown menus

**Discovered:** 2026-01-29
**Resolved:** 2026-01-29 (08-FIX5)
**Phase/Plan:** 08-04, 08-05, 08-06
**Severity:** Minor
**Feature:** 3-dot menus and long-press menus
**Description:** All menus (3-dot header menu, long-press menus) use Alert.alert popups. User wants dropdown-style menus for better UI/UX.
**Resolution:** Created reusable DropdownMenu component and replaced all Alert.alert menus in AlbumPhotoViewer, AlbumGridScreen, and ProfileScreen.

### UAT-009: Rename album should use half-screen modal

**Discovered:** 2026-01-29
**Resolved:** 2026-01-29 (08-FIX5)
**Phase/Plan:** 08-06
**Severity:** Minor
**Feature:** Album rename
**Description:** Rename uses Alert.prompt which is a small system dialog. User wants a half-screen modal with proper input field styling.
**Resolution:** Created RenameAlbumModal component with styled input field, character count, and slide-up animation.

### UAT-012: Redesign empty album state

**Discovered:** 2026-01-29
**Resolved:** 2026-01-29 (08-FIX3)
**Phase/Plan:** 08-02
**Severity:** Minor
**Feature:** Album bar empty state
**Description:** When user has no albums, instead of showing a small square add button, the entire album container should transform into a tappable area with dotted border, light gray background, and text "Tap here to make your first album".
**Resolution:** Implemented full-width TouchableOpacity with dashed border, subtle gray background, and centered prompt text.

---

_Phase: 08-user-albums_
_Tested: 2026-01-29_
