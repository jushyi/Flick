---
phase: quick
plan: 19
type: execute
wave: 1
depends_on: []
files_modified:
  - src/styles/CameraScreen.styles.js
autonomous: true
requirements: []

must_haves:
  truths:
    - "The photo count number (e.g. '2') inside the darkroom card button is fully visible and vertically centered on iOS"
    - 'The count text is not clipped at top or bottom on any single or double digit value'
    - 'Android darkroom button text remains correctly displayed'
  artifacts:
    - path: 'src/styles/CameraScreen.styles.js'
      provides: 'Fixed darkroomCardText style with explicit lineHeight'
      contains: 'darkroomCardText'
  key_links: []
---

<objective>
Fix the darkroom card button count text ("2", etc.) being visually clipped/cut off on iOS.

Purpose: The PressStart2P pixel font has unusual vertical metrics that cause iOS to clip the rendered glyph within the text container. Without an explicit lineHeight, iOS uses the font's native ascender/descender values which are too tight for this pixel font, resulting in the top or bottom of the digit being cut off.

Output: Updated darkroomCardText style that renders the count number fully visible and vertically centered on both iOS and Android.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/styles/CameraScreen.styles.js
@src/screens/CameraScreen.js
@src/constants/typography.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix darkroom card text clipping on iOS by adding explicit lineHeight and includeFontPadding</name>
  <files>src/styles/CameraScreen.styles.js</files>
  <action>
In `src/styles/CameraScreen.styles.js`, update the `darkroomCardText` style to fix the iOS text clipping issue:

1. Add an explicit `lineHeight` to the `darkroomCardText` style. PressStart2P at fontSize 18 needs a lineHeight of approximately 28-30 to prevent iOS from clipping the glyph. Use `lineHeight: 28` (roughly 1.5x the fontSize) to give the pixel font enough vertical space.

2. Add `textAlign: 'center'` to ensure horizontal centering is explicit.

3. Add `textAlignVertical: 'center'` for Android vertical centering consistency.

4. Add `includeFontPadding: false` (Android-specific, removes extra font padding that Android adds by default for pixel fonts).

The resulting style should look like:

```js
darkroomCardText: {
    color: colors.text.primary,
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.display,
    lineHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
},
```

Do NOT change the card dimensions (CARD_WIDTH=63, CARD_HEIGHT=84), the GradientCard component, or any other styles. The fix is isolated to the text style only.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx react-native-community_cli-tools 2>/dev/null; npx expo export --dump-sourcemap 2>/dev/null || node -e "const s = require('./src/styles/CameraScreen.styles.js'); console.log(JSON.stringify(s.styles.darkroomCardText))" 2>/dev/null || echo "Visual verification required on iOS device"</automated>
<manual>Open the app on an iOS device/simulator. Navigate to the Camera tab. With photos developing in the darkroom, verify the count number (1, 2, 3, etc.) is fully visible inside the darkroom card button -- no clipping at top or bottom. Also verify on Android that the number still renders correctly.</manual>
</verify>
<done>The darkroom card button count text is fully visible and vertically centered on iOS with no clipping. Android rendering remains correct. Only the darkroomCardText style was modified.</done>
</task>

</tasks>

<verification>
- iOS: Darkroom button shows "2" (or any count) fully visible, not clipped
- Android: Darkroom button count still renders correctly
- No visual regression on card dimensions, glow, or fanning animation
</verification>

<success_criteria>
The count number inside the iOS darkroom card button is fully visible and vertically centered with no text clipping on any digit value.
</success_criteria>

<output>
After completion, create `.planning/quick/19-the-2-in-the-ios-darkroom-button-looks-c/19-SUMMARY.md`
</output>
