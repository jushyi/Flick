# Plan 23-02: Photo Management Menu UI - Summary

**Status:** Complete
**Completed:** 2026-02-05

## Objective

Add three-dot menu to PhotoDetailScreen with delete/archive/restore actions for photo owners, plus extend functionality to album photo viewers.

## Tasks Completed

### Task 1: Add three-dot menu button and DropdownMenu

**Commit:** `bc98f2a` - `feat(23-02): add photo management menu to PhotoDetailScreen`

Added menu UI to PhotoDetailScreen:

1. **Imports** - Added Alert, photo service functions, DropdownMenu, colors
2. **State** - Added `showPhotoMenu` and `menuAnchor` for menu control
3. **Menu button** - Vertical ellipsis icon positioned bottom-right (above footer)
4. **Dynamic options** - useMemo builds menu based on `currentPhoto.photoState`:
   - Journal photos: "Remove from Journal" + "Delete Forever"
   - Archived photos: "Restore to Journal" + "Delete Forever"
5. **DropdownMenu** - Anchored positioning near trigger button

### Task 2: Implement menu action handlers with confirmations

**Commit:** `bc98f2a` (same commit)

Implemented three action handlers:

- **handleArchive** - Confirmation dialog, calls archivePhoto, closes viewer on success
- **handleRestore** - No confirmation (non-destructive), calls restorePhoto, shows success alert
- **handleDeleteConfirm** - Serious confirmation dialog, calls deletePhotoCompletely, closes viewer

### Task 3: Human verification + UI fixes

**Commit:** `2a6b3b6` - `feat(23-02): add auto-refresh and album photo management`

Based on user verification feedback:

1. **UI adjustments:**
   - Changed icon from horizontal to vertical ellipsis
   - Removed background from menu button
   - Adjusted size (height: 46, icon size: 28) and position (right: 8, bottom: 102)
   - Increased DropdownMenu width to 220px with more right padding

2. **Auto-refresh on photo state change:**
   - Added `onPhotoStateChanged` callback to PhotoDetailContext
   - FeedScreen registers callback to refresh feed, friend stories, and own stories
   - Feed/stories update automatically when photos archived/deleted/restored

3. **Album photo viewer integration:**
   - AlbumPhotoViewer gains archive/restore/delete handlers
   - MonthlyAlbumGridScreen detects own profile and passes required props
   - AlbumGridScreen passes currentUserId and onPhotoStateChanged
   - Monthly albums now show menu for restoring archived photos

## Files Modified

- `src/screens/PhotoDetailScreen.js` - Menu UI, handlers, state
- `src/styles/PhotoDetailScreen.styles.js` - photoMenuButton style
- `src/context/PhotoDetailContext.js` - onPhotoStateChanged callback
- `src/screens/FeedScreen.js` - Register onPhotoStateChanged callback
- `src/components/AlbumPhotoViewer.js` - Archive/restore/delete handlers
- `src/screens/MonthlyAlbumGridScreen.js` - isOwnProfile detection, new props
- `src/screens/AlbumGridScreen.js` - currentUserId, onPhotoStateChanged props
- `src/components/DropdownMenu.js` - Width and padding adjustments

## Verification

- [x] Menu button renders only for own photos
- [x] DropdownMenu shows correct options based on photoState
- [x] Archive shows confirmation and hides photo from active views
- [x] Restore works and returns photo to journal
- [x] Delete shows serious confirmation and permanently removes photo
- [x] Feed/stories auto-refresh on photo state changes
- [x] Monthly album view shows restore menu for archived photos
- [x] No errors in console during operations
- [x] `npm run lint` passes (only pre-existing warnings)

## Deviations

1. **Additional auto-refresh feature** - User requested feed/stories refresh automatically instead of requiring pull-to-refresh
2. **Monthly album restore fix** - User reported menus not visible in monthly albums; added isOwnProfile detection and required props
3. **UI adjustments** - Several iterations on icon orientation, size, position, and menu styling per user feedback

## Notes

- Phase 23 complete - both data layer (23-01) and UI (23-02) implemented
- Archive/restore/delete available from PhotoDetailScreen, user albums, and monthly albums
- Next phase (23.1) will add 30-day soft delete grace period
