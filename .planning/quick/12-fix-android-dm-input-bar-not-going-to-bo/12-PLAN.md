---
phase: quick-12
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-12]

must_haves:
  truths:
    - 'On Android, after dismissing the keyboard the DM input bar returns to the bottom of the screen (no floating)'
    - 'On Android, the spacing below the input pill is visually minimal while still clearing the gesture nav bar'
    - 'On iOS, DM input bar behavior is completely unchanged from quick-9 fix'
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Android keyboard tracking and reduced bottom padding'
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Android-appropriate KeyboardAvoidingView behavior'
  key_links:
    - from: 'src/components/DMInput.js'
      to: 'Keyboard API'
      via: 'keyboardDidShow/keyboardDidHide listeners (Android-only)'
      pattern: 'keyboardDid(Show|Hide)'
    - from: 'src/screens/ConversationScreen.js'
      to: 'KeyboardAvoidingView'
      via: 'Platform-conditional behavior prop'
      pattern: 'behavior.*Platform'
---

<objective>
Fix two Android-specific DM input bar issues: (1) the input bar not returning to the screen bottom when the keyboard is dismissed, and (2) excessive bottom spacing beneath the input pill.

Purpose: On Android, KeyboardAvoidingView with behavior="height" has a known issue where it sometimes fails to reset its height after keyboard dismiss, leaving the input bar floating in the middle of the screen. Additionally, the full safe area inset creates too much visual spacing below the input pill on edge-to-edge Android devices.

Output: Fixed DMInput.js and ConversationScreen.js with Android-specific keyboard handling
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/DMInput.js
@src/screens/ConversationScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Android KeyboardAvoidingView behavior and add Android keyboard tracking</name>
  <files>src/screens/ConversationScreen.js, src/components/DMInput.js</files>
  <action>
**ConversationScreen.js — Fix KeyboardAvoidingView for Android:**

On Android, `behavior="height"` in KeyboardAvoidingView has a known bug where it sometimes fails to recalculate its height when the keyboard dismisses, leaving the input bar stuck at an elevated position. Fix this by changing the Android behavior to `"padding"` instead of `"height"`.

In BOTH KeyboardAvoidingView instances (the loading state and the main conversation view):

- Change `behavior={Platform.select({ ios: 'padding', android: 'height' })}` to `behavior={Platform.select({ ios: 'padding', android: 'padding' })}`
  (Or simplify to just `behavior="padding"` since both platforms now use the same value.)
- Keep `keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}` as-is (may need adjustment during verification).

**DMInput.js — Add Android keyboard tracking and reduce bottom spacing:**

1. Extend the existing keyboard visibility tracking to cover Android. Currently the `useEffect` at line 42-52 exits early with `if (Platform.OS !== 'ios') return;`. Change this to track keyboard on BOTH platforms but use platform-appropriate events:
   - iOS: `keyboardWillShow` / `keyboardWillHide` (already implemented — fires before animation)
   - Android: `keyboardDidShow` / `keyboardDidHide` (Android does NOT support `keyboardWill*` events)

   Replace the current useEffect with:

   ```javascript
   useEffect(() => {
     const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
     const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

     const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
     const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

     return () => {
       showSub.remove();
       hideSub.remove();
     };
   }, []);
   ```

2. Update the `bottomPadding` calculation (line 87) to handle Android keyboard state:

   ```javascript
   const bottomPadding = keyboardVisible
     ? Platform.OS === 'ios'
       ? 8
       : 4
     : Math.max(insets.bottom, 8);
   ```

   When the keyboard is open on Android, use a small 4px padding (the system handles pushing content above keyboard). When keyboard is closed, use the safe area inset to clear the gesture nav bar.

3. Reduce the resting (keyboard closed) bottom spacing on Android specifically. The current `Math.max(insets.bottom, 8)` gives full gesture bar clearance which may feel excessive. If `insets.bottom` is large (e.g. 48px on some devices), reduce to a tighter value:
   ```javascript
   const bottomPadding = keyboardVisible
     ? Platform.OS === 'ios'
       ? 8
       : 4
     : Platform.OS === 'android'
       ? Math.max(insets.bottom - 4, 8)
       : Math.max(insets.bottom, 8);
   ```
   This subtracts 4px from the Android inset to tighten the spacing while still clearing the gesture bar. If insets.bottom is 0 (no gesture bar), falls back to 8px minimum.

IMPORTANT: Do NOT change any iOS behavior. The iOS keyboard handling (using keyboardWillShow/keyboardWillHide and the 8px padding) must remain exactly as implemented in quick-9. All Android changes must be behind Platform checks.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js src/screens/ConversationScreen.js --no-error-on-unmatched-pattern</automated>
<manual>On Android device/emulator: (1) Open a DM conversation, (2) Tap the input field to open keyboard, (3) Dismiss keyboard by tapping outside or pressing back — input bar should return to the very bottom of the screen, not float. (4) Verify the gap below the input pill is small but still clears the gesture nav bar. (5) On iOS, verify behavior is unchanged from before.</manual>
</verify>
<done> - Android: Input bar returns to screen bottom when keyboard is dismissed (no floating) - Android: Bottom spacing below input pill is reduced (gesture bar clearance maintained, excess padding removed) - iOS: All keyboard and padding behavior is unchanged from quick-9 implementation - No lint errors in modified files
</done>
</task>

</tasks>

<verification>
- Lint passes on both modified files
- On Android: keyboard open then dismiss cycle correctly repositions input bar to bottom
- On Android: visual spacing below input pill is tight but clears gesture navigation bar
- On iOS: no behavioral change (keyboardWillShow/keyboardWillHide still used, 8px padding when keyboard open, full safe area when closed)
</verification>

<success_criteria>

- Android DM input bar snaps back to screen bottom on keyboard dismiss (no floating)
- Android bottom spacing under input pill is visually minimal
- iOS behavior is identical to pre-change
- Both files pass lint
  </success_criteria>

<output>
After completion, create `.planning/quick/12-fix-android-dm-input-bar-not-going-to-bo/12-SUMMARY.md`
</output>
