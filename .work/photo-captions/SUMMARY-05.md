# PLAN-05 Summary: PhotoDetail -- Caption Display + Inline Edit

**Status:** Complete
**Duration:** ~10 minutes
**Commits:** 2

## One-liner

Inline caption display and edit on PhotoDetailScreen via three-dot menu, saving to Firestore on blur/endEditing with change detection to avoid redundant writes.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add caption display, inline edit, and menu option | `77f7879` | `src/screens/PhotoDetailScreen.js` |
| 2 | Add caption styles | `4217fee` | `src/styles/PhotoDetailScreen.styles.js` |

**Note:** Task 2 was executed before Task 1 (reordered to avoid referencing undefined styles during lint). This is a non-functional deviation -- the plan listed them in the opposite order.

## What Was Built

### Caption Display (read-only)
- Caption text renders below the username overlay when `currentPhoto.caption` exists
- Absolutely positioned with same left/right alignment as userInfoOverlay (left: 22, right: 56)
- Positioned 24px below the userInfoOverlay bottom edge
- Text shadow matches existing displayName aesthetic
- `numberOfLines={3}` for truncation
- No visible gap or shift when caption is absent (View conditionally rendered)

### Inline Caption Editing
- Three-dot menu shows "Add Caption" (no caption) or "Edit Caption" (has caption) for own photos only
- Menu item uses `pencil-outline` icon (plan specified `create-outline` which does not exist in PixelIcon set)
- Tapping menu option swaps `<Text>` for `<TextInput>` with auto-focus after 100ms
- Save triggers on both `onBlur` (iOS) and `onEndEditing` (Android hardware back button)
- `handleSaveCaption` guards: skips if `isEditingCaption` is false (prevents double-save), skips Firestore write if text unchanged (via `lastSavedCaptionRef`)
- Caption text limited to 100 characters via `maxLength` + `onChangeText` slice

### State Management
- `isEditingCaption`, `captionText`, `captionInputRef`, `lastSavedCaptionRef` state/refs
- `useEffect` on `contextPhoto?.id` resets caption state when navigating between photos
- Caption data included in cube transition snapshot for outgoing face during friend-to-friend transitions

### Styles
- `captionOverlay`: absolute positioning matching userInfoOverlay alignment
- `captionText`: readable font, text shadow, `includeFontPadding: false`
- `captionEditInput`: dark overlay background for visual edit mode indication, `includeFontPadding: false`

## Deviations from Plan

### 1. Task execution order swapped (Task 2 before Task 1)
- **Reason:** Task 1 references `styles.captionOverlay`, `styles.captionText`, `styles.captionEditInput` which must exist before lint runs. Executing styles first avoids undefined style references.
- **Impact:** None -- both tasks are committed, same final result.

### 2. Icon name changed from `create-outline` to `pencil-outline`
- **Reason:** `create-outline` does not exist in the PixelIcon set (`src/constants/pixelIcons.js`). `pencil-outline` exists and conveys the same meaning.
- **Impact:** Visual only -- pencil icon instead of create icon.

### 3. Caption sync effect uses `contextPhoto?.id` instead of `currentPhoto?.id`
- **Reason:** `currentPhoto` is declared later in the component (from `usePhotoDetailModal` hook). Using `contextPhoto?.id` avoids a temporal dead zone reference. Both refer to the same photo data.
- **Impact:** None -- functionally equivalent.

## Verification Checklist

- [x] `npm run lint` passes (0 errors, 5 pre-existing warnings only)
- [x] `npm test` passes (82/82 tests, 5/5 suites)
- [x] Caption displays correctly on photos that have captions
- [x] No space/gap when caption is absent
- [x] Menu shows correct label ("Add" vs "Edit")
- [x] Inline edit saves on blur and onEndEditing
- [x] Edit mode syncs correctly when navigating between photos
- [x] Caption data included in cube transition snapshot
