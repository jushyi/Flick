---
phase: quick-32
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
autonomous: true
requirements: [QUICK-32]
must_haves:
  truths:
    - 'Send button height matches the inputWrapper height on both iOS and Android'
    - 'Snap camera button height matches the inputWrapper height on both iOS and Android'
    - 'Button stays bottom-aligned with input when text wraps to multiple lines'
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Height-matched send/snap button alongside input bar'
      contains: 'alignSelf'
  key_links:
    - from: 'sendButton style'
      to: 'inputWrapper style'
      via: 'flex stretch in inputRow'
      pattern: 'alignSelf.*stretch'
---

<objective>
Fix the send/snap button height in DMInput so it visually matches the input bar height on both iOS and Android.

Purpose: The send arrow (and snap camera) button next to the DM input bar is the wrong height — it does not match the input wrapper, creating a visual mismatch.
Output: DMInput.js with send/snap button that stretches to match the inputWrapper height.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/DMInput.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix send/snap button height to match input bar</name>
  <files>src/components/DMInput.js</files>
  <action>
The root cause: The sendButton is wrapped in an Animated.View that does not stretch to the full height of the inputRow. The inputRow uses `alignItems: 'flex-end'` (bottom-align), and the Animated.View wrapper defaults to auto-sizing around its content rather than stretching to match the inputWrapper sibling.

Fix the layout so the button container stretches to match the input bar:

1. On both Animated.View wrappers (the canSend branch and the snap camera branch around lines 296 and 311), add `style` that includes `alignSelf: 'stretch'` so they fill the full height of inputRow alongside the inputWrapper.

2. Remove `minHeight: 40` from the `sendButton` style — the button should derive its height from the parent stretch, not from its own minimum. Keep `flex: 1` or use `height: '100%'` on sendButton so it fills the Animated.View.

3. The updated styles should be:
   - Both `Animated.View` wrappers: add `alignSelf: 'stretch'` to their existing style (merge with the opacity style)
   - `sendButton` style: remove `minHeight: 40`, remove `alignSelf: 'stretch'`, add `flex: 1` so the button fills the Animated.View wrapper completely

4. The inputRow already has `alignItems: 'flex-end'` which keeps things bottom-aligned when the text input grows. The `alignSelf: 'stretch'` on the Animated.View overrides this for just the button container, making it match the full row height (which is driven by the inputWrapper).

This ensures the button matches the inputWrapper height at all times — when single-line (short) and when multiline (tall).
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx react-native-community/cli doctor 2>/dev/null; echo "Manual visual check needed — verify send button height matches input bar on iOS and Android"</automated>
<manual>Open a DM conversation on both iOS and Android. Verify: (1) The send button (arrow icon) is exactly the same height as the input bar when typing text. (2) The snap camera button (polaroid icon) is the same height as the input bar when no text is entered. (3) When typing multiple lines, the button stretches to stay matched with the input bar height.</manual>
</verify>
<done>Send/snap button height visually matches the input bar height on both iOS and Android, for single-line and multiline input states.</done>
</task>

</tasks>

<verification>
Visual check on both iOS and Android simulators/devices:
- Open any DM conversation
- With empty input: snap camera button height === input bar height
- Type text: send button height === input bar height
- Type enough text to wrap 2-3 lines: send button stretches to match
</verification>

<success_criteria>
The send and snap buttons are the same height as the input wrapper on both platforms, for all input states (empty, single-line, multiline).
</success_criteria>

<output>
After completion, create `.planning/quick/32-on-both-android-and-ios-the-send-or-snap/32-SUMMARY.md`
</output>
