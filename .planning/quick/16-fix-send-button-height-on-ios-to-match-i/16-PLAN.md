---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
autonomous: true
requirements: [QUICK-16]
must_haves:
  truths:
    - 'Send button height visually matches the input box height on iOS'
    - 'Send button remains properly aligned with the input box on Android'
    - 'Both elements stay bottom-aligned in the input row when text is multiline'
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Fixed send button styling for height parity with input wrapper'
      contains: 'sendButton'
  key_links:
    - from: 'sendButton style'
      to: 'inputWrapper style'
      via: 'matching height calculation'
      pattern: 'sendButton.*height|minHeight'
---

<objective>
Fix the send button height on iOS so it exactly matches the input box (inputWrapper) height when the text input is a single line. Currently the send button is slightly taller than the input wrapper on iOS, creating a visual mismatch.

Purpose: Visual polish -- the send button should appear as the same height as the input pill it sits next to.
Output: Updated DMInput.js with aligned send button and input wrapper heights on iOS.
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
  <name>Task 1: Fix send button height to match input wrapper on iOS</name>
  <files>src/components/DMInput.js</files>
  <action>
The height mismatch comes from the send button's content (20px icon + 16px vertical padding + 2px border = 38px) being taller than the input wrapper's single-line content (fontSize 14 text ~17px line height + 16px vertical padding + 2px border = ~35px).

Fix by adjusting the sendButton style to match the inputWrapper height on iOS:

1. Change sendButton `padding: 8` to use `paddingHorizontal: 8` and `paddingVertical` with a Platform.select that aligns it with the inputWrapper. Since the inputWrapper uses `paddingVertical: Platform.select({ ios: 8, android: 4 })` and contains text at fontSize 14 (~17px line height), and the send icon is 20px, the iOS vertical padding should be reduced.

   Calculation for iOS:
   - inputWrapper total = 1 + 8 + ~17 + 8 + 1 = ~35px
   - sendButton needs: 1 + padTop + 20 + padBottom + 1 = 35px => padTop + padBottom = 13px
   - Use `paddingVertical: Platform.select({ ios: 6, android: 8 })` (6+6=12, close to 13, slight rounding is fine -- or use 7 for 14px total which makes 36px matching a slightly taller text render)

   Actually, the cleanest approach: give both inputWrapper and sendButton the same explicit `minHeight` so they always match regardless of content. Set `minHeight: 36` on both the inputWrapper and sendButton styles. Keep existing padding as-is for internal content centering.

   Specifically:
   - Add `minHeight: 36` to the `inputWrapper` style
   - Change `sendButton` style: replace `padding: 8` with `paddingHorizontal: 8`, add `minHeight: 36`, add `justifyContent: 'center'`, add `alignItems: 'center'`
   - This ensures both elements are exactly the same height on iOS and Android

2. Verify the `inputRow` still has `alignItems: 'flex-end'` so when multiline text makes the inputWrapper taller, the send button stays bottom-aligned.
   </action>
   <verify>
   <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js --quiet</automated>
   <manual>Open a DM conversation on iOS. Confirm the send button is the same height as the input pill. Type multiple lines and confirm the send button stays bottom-aligned.</manual>
   </verify>
   <done>Send button and input wrapper have identical heights (36px) on iOS single-line state. Both use minHeight: 36. Send button is vertically centered with its icon. On multiline, send button stays bottom-aligned via flex-end.</done>
   </task>

</tasks>

<verification>
- ESLint passes on DMInput.js
- Visual inspection on iOS confirms send button height matches input wrapper
- Multiline text still keeps send button bottom-aligned
- Android layout is not regressed
</verification>

<success_criteria>
The send button height exactly matches the input box height on iOS. No visual mismatch between the two elements.
</success_criteria>

<output>
After completion, create `.planning/quick/16-fix-send-button-height-on-ios-to-match-i/16-SUMMARY.md`
</output>
