---
phase: quick
plan: 28
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/SnapPreviewScreen.js
autonomous: true
requirements: [QUICK-28]
must_haves:
  truths:
    - "X close button and 'To: FriendName' label are vertically aligned on the same horizontal axis on both iOS and Android"
  artifacts:
    - path: 'src/screens/SnapPreviewScreen.js'
      provides: 'Fixed header alignment in SnapPreviewScreen'
      contains: 'includeFontPadding'
  key_links: []
---

<objective>
Fix horizontal alignment between the X close button and the "To: FriendName" recipient label in the SnapPreviewScreen header on both iOS and Android.

Purpose: The X button (36x36 circle) and the recipient text are visually misaligned vertically. On Android, Silkscreen pixel font adds extra internal font padding that shifts the text baseline. On iOS, the lack of an explicit lineHeight and height constraint means the text container height differs from the button height.

Output: Both elements sit on the same visual center line across platforms.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/SnapPreviewScreen.js
@src/constants/typography.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix recipientLabel vertical alignment to match 36px header elements</name>
  <files>src/screens/SnapPreviewScreen.js</files>
  <action>
In `src/screens/SnapPreviewScreen.js`, update the `recipientLabel` style (currently lines 280-285) to ensure it vertically centers to the same 36px height as the close button and spacer:

1. Add `height: 36` to `recipientLabel` — matches the closeButton and headerSpacer height exactly.
2. Add `lineHeight: 36` — vertically centers the text within its 36px container using text baseline alignment (single-line text only, which this is).
3. Add `includeFontPadding: false` — this is Android-specific; Android adds extra top/bottom padding to text by default for ascenders/descenders. Silkscreen pixel font triggers this. Setting `false` removes the extra padding so the text sits at true vertical center. On iOS this prop is ignored (no-op), so it is safe cross-platform.
4. Add `textAlignVertical: 'center'` — Android fallback for vertical centering within the text container. Ignored on iOS.

The final `recipientLabel` style should be:

```javascript
recipientLabel: {
  fontSize: typography.size.md,
  fontFamily: typography.fontFamily.body,
  color: colors.text.primary,
  textAlign: 'center',
  height: 36,
  lineHeight: 36,
  includeFontPadding: false,
  textAlignVertical: 'center',
},
```

Do NOT change the `header`, `closeButton`, or `headerSpacer` styles — they are correct. The issue is solely that the text element has no explicit height/lineHeight constraint to match its siblings.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx react-native-community_cli-platform-android --version 2>/dev/null; node -e "const fs=require('fs'); const c=fs.readFileSync('src/screens/SnapPreviewScreen.js','utf8'); const checks=['includeFontPadding: false','lineHeight: 36','height: 36','textAlignVertical']; const missing=checks.filter(k=>!c.includes(k)); if(missing.length){console.error('MISSING:',missing);process.exit(1)}else{console.log('All alignment props present')}"</automated>
<manual>Open snap preview screen on both iOS and Android. Verify the X button and "To: FriendName" text are horizontally centered on the same line.</manual>
</verify>
<done>The recipientLabel has explicit height: 36, lineHeight: 36, includeFontPadding: false, and textAlignVertical: 'center' — making it vertically aligned with the 36px close button and spacer on both iOS and Android.</done>
</task>

</tasks>

<verification>
- `recipientLabel` style contains `height: 36`, `lineHeight: 36`, `includeFontPadding: false`, `textAlignVertical: 'center'`
- No other styles in the file were modified
- App builds and runs without errors on both platforms
</verification>

<success_criteria>
The X close button and "To: FriendName" label in the SnapPreviewScreen header are visually aligned on the same horizontal center line on both iOS and Android devices.
</success_criteria>

<output>
After completion, create `.planning/quick/28-on-android-and-ios-the-x-button-and-the-/28-SUMMARY.md`
</output>
