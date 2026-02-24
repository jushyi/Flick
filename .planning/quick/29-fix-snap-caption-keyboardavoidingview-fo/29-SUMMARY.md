---
phase: quick-29
plan: 01
subsystem: snap-preview
tags: [keyboard, layout, KAV, snap, UI]
dependency_graph:
  requires: []
  provides:
    - Fixed snap preview keyboard layout (footer stays pinned)
  affects:
    - src/screens/SnapPreviewScreen.js
tech_stack:
  added: []
  patterns:
    - KAV wrapping only the content that needs to shift, not fixed UI elements
key_files:
  modified:
    - src/screens/SnapPreviewScreen.js
decisions:
  - Footer outside KAV for fixed positioning during keyboard open
metrics:
  duration: 45s
  completed: 2026-02-24
---

# Quick Task 29: Fix Snap Caption KeyboardAvoidingView Footer

Restructured SnapPreviewScreen JSX tree so KeyboardAvoidingView wraps only the Polaroid frame (containing the caption input), while the footer (Send button) sits outside as a sibling pinned to the screen bottom.

## What Changed

### Task 1: Restructure SnapPreviewScreen layout so footer stays fixed while caption lifts

**Commit:** `3688dd8`

Moved the footer `<View>` (containing the Send button) from inside the `<KeyboardAvoidingView>` to outside it, making it a sibling element in the main container.

**Before:**

```
<View container>
  <View header />
  <KeyboardAvoidingView>
    <GestureDetector>...</GestureDetector>
    <View footer />              <!-- Inside KAV: moves with keyboard -->
  </KeyboardAvoidingView>
</View>
```

**After:**

```
<View container>
  <View header />
  <KeyboardAvoidingView>
    <GestureDetector>...</GestureDetector>
  </KeyboardAvoidingView>
  <View footer />                <!-- Outside KAV: stays at bottom -->
</View>
```

**Files modified:**

- `src/screens/SnapPreviewScreen.js` - Moved footer outside KAV, updated comments

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- ESLint: PASS (0 errors)
- Structural check: PASS (footer appears after `</KeyboardAvoidingView>` closing tag)
- Safe area handling preserved: `paddingBottom: Math.max(insets.bottom, 16) + 8`
- `keyboardVerticalOffset` unchanged (header-only offset: `insets.top + 56` on iOS, `0` on Android)
- No styles, colors, dimensions, or functionality changed

## Commits

| Task | Commit    | Description                                              |
| ---- | --------- | -------------------------------------------------------- |
| 1    | `3688dd8` | Move snap footer outside KAV so it stays fixed at bottom |

## Self-Check: PASSED

- [x] `src/screens/SnapPreviewScreen.js` exists
- [x] Commit `3688dd8` exists
- [x] `29-SUMMARY.md` exists
