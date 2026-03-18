---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/comments/CommentsBottomSheet.js
autonomous: true
requirements: [KAV-01]
must_haves:
  truths:
    - 'Comment input stays visible above keyboard on Android when opening comments'
    - 'Comment input stays visible when switching between standard and emoji keyboards on Android'
    - 'iOS keyboard avoidance behavior is unchanged'
  artifacts:
    - path: 'src/components/comments/CommentsBottomSheet.js'
      provides: 'Reanimated-based keyboard tracking for Android comment input'
      contains: 'useAnimatedKeyboard'
  key_links:
    - from: 'src/components/comments/CommentsBottomSheet.js'
      to: 'react-native-reanimated'
      via: 'useAnimatedKeyboard hook'
      pattern: 'useAnimatedKeyboard'
---

<objective>
Fix the Android keyboard avoidance regression in CommentsBottomSheet where the comment input gets hidden behind the keyboard.

Purpose: The comment input in CommentsBottomSheet uses a state-driven `paddingBottom` based on `keyboardDidShow` events. On Android, this approach has two problems: (1) `event.endCoordinates.height` can exclude the keyboard toolbar area, and (2) switching between standard/emoji/alternate keyboards does NOT fire new `keyboardDidShow` events with updated heights, causing the input to slip behind the keyboard. A fix using `useAnimatedKeyboard` from react-native-reanimated already exists on other branches (commit 0a786d6) but was never merged to main.

Output: CommentsBottomSheet.js with Reanimated-based keyboard tracking on Android, state-based tracking preserved for iOS.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/comments/CommentsBottomSheet.js
@src/styles/CommentInput.styles.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace state-driven keyboard padding with useAnimatedKeyboard on Android</name>
  <files>src/components/comments/CommentsBottomSheet.js</files>
  <action>
Port the fix from commit 0a786d6 to the current CommentsBottomSheet.js on main. The changes are:

1. **Add Reanimated import** at the top of the file:

   ```js
   import Reanimated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
   ```

2. **Add animated keyboard tracking** after the `insets` line (around line 68), before the `keyboardVisible` state:

   ```js
   const keyboard = useAnimatedKeyboard();
   const animatedInputStyle = useAnimatedStyle(() => ({
     paddingBottom: keyboard.height.value > 0 ? keyboard.height.value : Math.max(insets.bottom, 8),
   }));
   ```

3. **Update the keyboard show listener** (around line 231-235) to calculate height from `screenY` on Android and only update `keyboardHeight` state on iOS:
   - Replace `const kbHeight = event.endCoordinates.height;` with:
     ```js
     const kbHeight =
       Platform.OS === 'android' && event.endCoordinates.screenY > 0
         ? SCREEN_HEIGHT - event.endCoordinates.screenY
         : event.endCoordinates.height;
     ```
   - Keep `setKeyboardVisible(true)` and `keyboardHeightRef.current = kbHeight`
   - Wrap `setKeyboardHeight(kbHeight)` in `if (Platform.OS === 'ios')` guard

4. **Update the keyboard hide listener** (around line 251-254):
   - Keep `setKeyboardVisible(false)` and `keyboardHeightRef.current = 0`
   - Wrap `setKeyboardHeight(0)` in `if (Platform.OS === 'ios')` guard

5. **Replace the comment input wrapper View** (around line 1103-1108):
   - Change from:
     ```jsx
     <View testID="comment-input-area" style={{ paddingBottom: keyboardVisible ? keyboardHeight : Math.max(insets.bottom, 8) }}>
     ```
   - To:
     ```jsx
     <Reanimated.View testID="comment-input-area" style={animatedInputStyle}>
     ```
   - Change the closing `</View>` (around line 1128) to `</Reanimated.View>`

**Why useAnimatedKeyboard instead of Keyboard.addListener:** The Reanimated hook runs on the UI thread and continuously tracks keyboard height changes, including when switching between standard/emoji/alternate keyboards on Android. The Keyboard.addListener approach misses these intermediate height changes on Android because `keyboardDidShow` doesn't re-fire for keyboard type switches.

**Why keep Keyboard.addListener:** The `keyboardVisible` state and `keyboardHeightRef` are still needed for the auto-expand logic (expanding sheet to fullscreen when keyboard opens) and for PanResponder closure access. Only the `paddingBottom` rendering is moved to the animated style.

**Do NOT modify:** iOS behavior (keyboardWillShow/keyboardWillHide events), the auto-expand logic, PanResponder gestures, or any other keyboard-related behavior outside the padding calculation.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && node -e "const fs = require('fs'); const c = fs.readFileSync('src/components/comments/CommentsBottomSheet.js','utf8'); const checks = [c.includes('useAnimatedKeyboard'), c.includes('useAnimatedStyle'), c.includes('Reanimated.View'), c.includes('animatedInputStyle'), c.includes('SCREEN_HEIGHT - event.endCoordinates.screenY'), !c.includes('paddingBottom: keyboardVisible ? keyboardHeight')]; console.log(checks.every(Boolean) ? 'PASS' : 'FAIL: ' + JSON.stringify(checks));"</automated>
<manual>On an Android device/emulator: open CommentsBottomSheet, tap comment input, verify input stays above keyboard. Switch to emoji keyboard, verify input stays above. Switch back to standard keyboard, verify input stays above. On iOS: verify keyboard avoidance still works as before.</manual>
</verify>
<done> - useAnimatedKeyboard from react-native-reanimated drives the comment input paddingBottom on the UI thread - Android keyboard height calculated from screenY to include toolbar - keyboardHeight state updates guarded to iOS-only (state still used for auto-expand logic) - Comment input wrapper uses Reanimated.View with animated style - iOS behavior unchanged (keyboardWillShow/keyboardWillHide still set state)
</done>
</task>

</tasks>

<verification>
1. File compiles without syntax errors: `npx expo export --platform android 2>&1 | tail -5` (or `npx expo start` loads without red screen)
2. Automated check confirms all 5 code markers are present and old pattern is removed
3. Manual: Android comment input stays visible above keyboard in all keyboard modes
4. Manual: iOS comment input behavior unchanged
</verification>

<success_criteria>

- CommentsBottomSheet comment input is visible above the keyboard on Android
- Switching between standard/emoji keyboards on Android does not hide the input
- iOS keyboard avoidance continues to work correctly
- No regression in sheet expand/collapse behavior
  </success_criteria>

<output>
After completion, create `.planning/quick/1-regression-in-the-keyboard-avoiding-view/1-SUMMARY.md`
</output>
