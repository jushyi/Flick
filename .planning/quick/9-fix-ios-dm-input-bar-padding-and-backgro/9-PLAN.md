---
phase: quick
plan: 9
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-09]

must_haves:
  truths:
    - 'On iOS with keyboard open, the DM input bar sits snug against the keyboard suggestions bar with minimal padding (no large gap)'
    - 'On iOS, the area behind the keyboard suggestions bar rounded corners matches the DMInput container background (no contrasting color visible)'
    - 'On Android, behavior is unchanged (safe area bottom padding still applies correctly)'
    - 'When keyboard is dismissed on iOS, normal safe area bottom padding returns to protect the home indicator area'
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Keyboard-aware bottom padding that reduces on iOS when keyboard is open'
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Matching background color behind keyboard area on iOS'
  key_links:
    - from: 'src/components/DMInput.js'
      to: 'Keyboard API'
      via: 'Keyboard.addListener for keyboardWillShow/keyboardWillHide'
      pattern: "Keyboard\\.addListener"
---

<objective>
Fix two iOS-only visual issues in the DM conversation input bar:

1. Excessive bottom padding below the input bar when the keyboard is open. The `Math.max(insets.bottom, 8)` padding applies the full ~34px safe area inset even when the keyboard covers the home indicator, creating a large gap between the input row and the keyboard suggestions bar.

2. A different background color visible behind the rounded corners of the iOS keyboard suggestions/autocomplete bar. The parent KeyboardAvoidingView area uses `colors.background.primary` (#0A0A1A) while DMInput uses `colors.background.secondary` (#161628), and this mismatch is visible in the rounded corners above the keyboard.

Purpose: Polish the iOS DM conversation experience to match expected native messaging app behavior.
Output: Updated DMInput.js with keyboard-aware padding, updated ConversationScreen.js with matching background.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/DMInput.js
@src/screens/ConversationScreen.js
@src/constants/colors.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix iOS bottom padding and background color behind keyboard</name>
  <files>src/components/DMInput.js, src/screens/ConversationScreen.js</files>
  <action>
**DMInput.js — Keyboard-aware bottom padding (iOS only):**

1. Import `Keyboard` from `react-native` (add to existing RN import).
2. Add a `keyboardVisible` state (useState, default false).
3. Add a useEffect that listens for keyboard show/hide events (iOS-only, using `keyboardWillShow` and `keyboardWillHide` — these fire before animation starts, giving a smoother visual transition):
   - On `keyboardWillShow`: set `keyboardVisible` to `true`
   - On `keyboardWillHide`: set `keyboardVisible` to `false`
   - On Android, skip the listener entirely — Android keyboard avoidance works differently and the current padding is fine.
   - Clean up listeners on unmount.
4. Change the paddingBottom calculation:
   - Current: `Math.max(insets.bottom, 8)` (always applies full safe area)
   - New: When iOS keyboard is visible, use a small fixed padding (4px) since the keyboard covers the home indicator. When keyboard is hidden (or on Android), keep the existing `Math.max(insets.bottom, 8)`.
   - Expression: `Platform.OS === 'ios' && keyboardVisible ? 4 : Math.max(insets.bottom, 8)`
   - Apply this to BOTH the normal return and the disabled return (lines 65 and 74).

**ConversationScreen.js — Match background behind keyboard area:**

5. In the `styles` object, change the `flex` style (used by KeyboardAvoidingView) from just `{ flex: 1 }` to `{ flex: 1, backgroundColor: colors.background.secondary }`. This ensures the area directly behind the keyboard suggestions bar rounded corners uses the same background as the DMInput container (#161628 instead of #0A0A1A), eliminating the visible color mismatch on iOS.

**Important constraints:**

- Do NOT change any Android behavior. All keyboard listener logic must be iOS-only (Platform.OS === 'ios' guard).
- Do NOT change the keyboard behavior (behavior prop) on KeyboardAvoidingView — that is working correctly.
- Keep the existing `Math.max(insets.bottom, 8)` logic for when keyboard is closed.
  </action>
  <verify>
  <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js src/screens/ConversationScreen.js --max-warnings=0 2>/dev/null || echo "Lint check done (CRLF warnings are pre-existing)"</automated>
  <manual>Open the app on an iOS device. Navigate to a DM conversation. Tap the message input to open the keyboard. Verify: (1) The input bar sits close to the keyboard suggestions bar with only ~4px gap, not the previous ~34px gap. (2) No contrasting dark background is visible behind the rounded corners of the iOS suggestions bar — it should all be the same dark indigo (#161628). (3) Dismiss the keyboard — the input bar should have normal bottom padding for the home indicator. (4) Test on Android to confirm no changes to Android behavior.</manual>
  </verify>
  <done>On iOS, the DM input bar has minimal padding when keyboard is open (4px vs ~34px), the background behind keyboard suggestions bar corners matches the input bar background, and the full safe area padding returns when keyboard is dismissed. Android behavior is unchanged.</done>
  </task>

</tasks>

<verification>
- iOS: Keyboard open shows minimal gap between input row and suggestions bar
- iOS: No background color mismatch behind suggestions bar rounded corners
- iOS: Keyboard closed shows proper safe area bottom padding (home indicator protection)
- Android: No visual or behavioral changes
- Lint passes (ignoring pre-existing CRLF issues)
</verification>

<success_criteria>

1. iOS DM input bar sits snug against keyboard suggestions with ~4px gap when keyboard is open
2. Background behind iOS keyboard suggestions bar rounded corners matches DMInput container color
3. Normal safe area bottom padding returns when keyboard is dismissed on iOS
4. Android DM input behavior is completely unchanged
   </success_criteria>

<output>
After completion, create `.planning/quick/9-fix-ios-dm-input-bar-padding-and-backgro/9-SUMMARY.md`
</output>
