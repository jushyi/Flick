---
phase: quick-1
plan: '01'
subsystem: comments
tags: [android, keyboard, reanimated, bug-fix]
dependency_graph:
  requires: []
  provides: [KAV-01]
  affects: [CommentsBottomSheet]
tech_stack:
  added: []
  patterns: [useAnimatedKeyboard, useAnimatedStyle, Reanimated.View]
key_files:
  created: []
  modified:
    - src/components/comments/CommentsBottomSheet.js
decisions:
  - "useAnimatedKeyboard runs on UI thread and tracks keyboard height continuously, including keyboard type switches that don't fire keyboardDidShow"
  - 'Android kbHeight computed from SCREEN_HEIGHT - screenY to include keyboard toolbar area excluded from endCoordinates.height'
  - 'setKeyboardHeight guarded to iOS-only because Android padding is now driven by the animated style, not state'
metrics:
  duration: '~2 min'
  completed: 2026-02-26
---

# Quick Task 1: Android Keyboard Avoidance Regression Fix Summary

**One-liner:** Reanimated useAnimatedKeyboard replaces state-driven paddingBottom for Android comment input, fixing hidden input on keyboard type switches.

## Objective

Fix the Android keyboard avoidance regression in CommentsBottomSheet where the comment input gets hidden behind the keyboard, particularly when switching between standard and emoji keyboards.

## What Was Built

Replaced the state-driven `paddingBottom` on the comment input wrapper with a Reanimated animated style driven by `useAnimatedKeyboard`. This hook runs on the UI thread and continuously tracks keyboard height changes — including intermediate transitions when switching keyboard types on Android — which `Keyboard.addListener('keyboardDidShow')` misses entirely.

## Tasks Completed

| Task | Name                                                                      | Commit  | Files                                          |
| ---- | ------------------------------------------------------------------------- | ------- | ---------------------------------------------- |
| 1    | Replace state-driven keyboard padding with useAnimatedKeyboard on Android | e5ec1ea | src/components/comments/CommentsBottomSheet.js |

## Key Changes

**`src/components/comments/CommentsBottomSheet.js`**

1. Added `import Reanimated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated'`

2. Added hooks after `insets`:

   ```js
   const keyboard = useAnimatedKeyboard();
   const animatedInputStyle = useAnimatedStyle(() => ({
     paddingBottom: keyboard.height.value > 0 ? keyboard.height.value : Math.max(insets.bottom, 8),
   }));
   ```

3. Updated `keyboardDidShow` handler to compute height from `screenY` on Android (includes toolbar) and guard `setKeyboardHeight` to iOS-only:

   ```js
   const kbHeight =
     Platform.OS === 'android' && event.endCoordinates.screenY > 0
       ? SCREEN_HEIGHT - event.endCoordinates.screenY
       : event.endCoordinates.height;
   setKeyboardVisible(true);
   keyboardHeightRef.current = kbHeight;
   if (Platform.OS === 'ios') {
     setKeyboardHeight(kbHeight);
   }
   ```

4. Updated `keyboardDidHide` handler to guard `setKeyboardHeight(0)` to iOS-only.

5. Replaced `<View testID="comment-input-area" style={{ paddingBottom: keyboardVisible ? keyboardHeight : ... }}>` with `<Reanimated.View testID="comment-input-area" style={animatedInputStyle}>`.

## Verification

Automated check: PASS (all 5 code markers present, old pattern removed).

Manual verification required on Android device/emulator:

- Open CommentsBottomSheet, tap comment input — input stays above keyboard
- Switch to emoji keyboard — input stays above
- Switch back to standard keyboard — input stays above
- iOS: keyboard avoidance behavior unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- File `src/components/comments/CommentsBottomSheet.js` exists and modified: FOUND
- Commit e5ec1ea exists: FOUND
- All 5 automated checks pass: PASS
