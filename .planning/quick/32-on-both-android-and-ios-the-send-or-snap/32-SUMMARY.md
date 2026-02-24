---
phase: quick-32
plan: 01
subsystem: messaging-ui
tags: [dm-input, button-height, layout-fix, cross-platform]
dependency_graph:
  requires: []
  provides: [height-matched-send-snap-button]
  affects: [DMInput]
tech_stack:
  added: []
  patterns: [alignSelf-stretch-override, flex-fill-parent]
key_files:
  created: []
  modified:
    - src/components/DMInput.js
decisions:
  - "alignSelf:'stretch' on Animated.View overrides inputRow's alignItems:'flex-end' for button only"
  - 'flex:1 on sendButton fills parent instead of minHeight:40 fixed size'
metrics:
  duration: 54s
  completed: 2026-02-24
---

# Quick Task 32: Fix Send/Snap Button Height to Match Input Bar

Stretch both Animated.View wrappers with alignSelf:'stretch' and replace sendButton minHeight with flex:1 so the button fills the full inputRow height on iOS and Android.

## What Changed

### src/components/DMInput.js

**Both Animated.View wrappers (send arrow + snap camera):**

- Added `alignSelf: 'stretch'` to inline style, merged with existing opacity animation
- This overrides the parent `inputRow`'s `alignItems: 'flex-end'` for just the button container, making it stretch to match the full row height driven by the `inputWrapper` sibling

**sendButton style:**

- Removed `minHeight: 40` (was creating a fixed height independent of input bar)
- Removed `alignSelf: 'stretch'` (no longer needed; parent Animated.View handles stretch)
- Added `flex: 1` so the TouchableOpacity fills the Animated.View wrapper completely

### How It Works

The `inputRow` uses `flexDirection: 'row'` with `alignItems: 'flex-end'` for bottom-alignment when text wraps. The `inputWrapper` drives the row height (it grows with multiline text). By setting `alignSelf: 'stretch'` on the Animated.View, the button container ignores `flex-end` and stretches to match the full cross-axis (vertical) size. The `flex: 1` on the inner `sendButton` then fills that container completely.

## Commits

| Task | Description                                    | Commit  | Files                     |
| ---- | ---------------------------------------------- | ------- | ------------------------- |
| 1    | Fix send/snap button height to match input bar | bbfcec2 | src/components/DMInput.js |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Automated: ESLint passed with no errors
- Manual: Visual check needed on iOS and Android - send button and snap camera button should match input bar height for empty, single-line, and multiline states

## Self-Check: PASSED

- [x] src/components/DMInput.js modified with correct changes
- [x] Commit bbfcec2 exists
- [x] No lint errors
