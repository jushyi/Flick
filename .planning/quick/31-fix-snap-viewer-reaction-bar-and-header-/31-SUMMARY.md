---
phase: quick-31
plan: 01
subsystem: snap-viewer
tags: [ui, snap, reactions, theme]
dependency_graph:
  requires: [colors.background.tertiary, colors.border.default]
  provides: [unified-reaction-bar, clean-snap-header]
  affects: [snap-viewing-experience]
tech_stack:
  patterns: [themed-pill-bar, gesture-tap-isolation]
key_files:
  modified:
    - src/components/SnapViewer.js
decisions:
  - Reaction bar moved outside GestureDetector to fix tap interception
  - senderName prop kept in function signature for backward compat but not rendered
metrics:
  duration: 68s
  completed: 2026-02-24
---

# Quick Task 31: Fix Snap Viewer Reaction Bar and Header Summary

Unified snap viewer reaction bar into single themed pill and removed sender name from header.

## What Changed

### 1. Removed sender name from header

- Deleted the `{senderName && (...)}` JSX block that rendered sender name at top-left
- Deleted the `senderName` style from the StyleSheet
- The `senderName` prop remains in the function signature for backward compatibility but is no longer rendered
- Only the X close button remains visible at the top of the snap viewer

### 2. Restyled reaction bar as unified themed bar

- Replaced individual circular `reactionButton` backgrounds (rgba white circles) with a single container bar
- `reactionBar` now uses `backgroundColor: colors.background.tertiary` (#252540), `borderRadius: 24`, `borderWidth: 1`, `borderColor: colors.border.default` (#353555)
- Individual `reactionButton` styles simplified to transparent with `padding: 6` (no more fixed width/height/borderRadius/backgroundColor)
- Gap reduced from 16 to 12 for tighter spacing within the pill
- Result: one dark indigo rounded pill containing all 6 emojis, matching the app's retro CRT theme

### 3. Fixed reaction taps not working

- Reaction bar was inside the `GestureDetector` wrapping the pan gesture, causing the pan gesture to intercept taps
- Moved `Animated.View` (polaroidContainer) to wrap both the `GestureDetector` and the reaction bar
- Reaction bar is now OUTSIDE `GestureDetector` but still inside `Animated.View`, so it animates with the polaroid on swipe-down but taps reach the `GHTouchableOpacity` buttons directly

## Commits

| Task | Name                                                              | Commit  | Files                        |
| ---- | ----------------------------------------------------------------- | ------- | ---------------------------- |
| 1    | Remove sender name and restyle reaction bar as unified themed bar | 8ae7770 | src/components/SnapViewer.js |

## Verification

- ESLint passes on SnapViewer.js with no errors
- Pre-commit hooks (lint-staged) passed successfully

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/components/SnapViewer.js
- FOUND: commit 8ae7770
- FOUND: 31-SUMMARY.md
