---
phase: quick-29
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/SnapPreviewScreen.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'When typing a snap caption, only the Polaroid frame lifts above the keyboard'
    - 'The footer (Send button) stays pinned at the bottom of the screen, does NOT move with the keyboard'
    - 'The caption input is fully visible above the keyboard on both iOS and Android'
    - 'On Android, suggestion bar / autocomplete sits between caption and keyboard without overlapping the footer'
  artifacts:
    - path: 'src/screens/SnapPreviewScreen.js'
      provides: 'Restructured layout with KAV wrapping only Polaroid, footer outside KAV'
      contains: 'KeyboardAvoidingView'
  key_links:
    - from: 'KeyboardAvoidingView'
      to: 'Polaroid frame with caption'
      via: 'KAV wraps only the Polaroid container, not the footer'
      pattern: 'KeyboardAvoidingView.*polaroid'
---

<objective>
Fix the SnapPreviewScreen so that when the keyboard opens for caption input, ONLY the Polaroid frame (containing the caption) lifts above the keyboard. The footer (Send button) must stay pinned at the bottom of the screen and NOT move up with the keyboard.

Purpose: Currently the footer moves up with the keyboard because it is inside the KeyboardAvoidingView. The user wants the footer to remain stationary at the bottom while only the caption input area shifts up.

Output: Updated SnapPreviewScreen.js with corrected layout structure.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/SnapPreviewScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure SnapPreviewScreen layout so footer stays fixed while caption lifts</name>
  <files>src/screens/SnapPreviewScreen.js</files>
  <action>
Restructure the SnapPreviewScreen layout so the KeyboardAvoidingView wraps ONLY the Polaroid frame (which contains the caption input), and the footer (Send button) sits OUTSIDE the KAV as a separate sibling pinned to the bottom.

Current structure (broken - footer moves with keyboard):

```
<View container>
  <View header />
  <KeyboardAvoidingView>       <-- wraps both Polaroid AND footer
    <GestureDetector>
      <Animated.View polaroidOuter>
        <View polaroidFrame>
          <Image photo />
          <View captionStrip>
            <TextInput caption />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
    <View footer>               <-- INSIDE KAV = moves up with keyboard
      <TouchableOpacity send />
    </View>
  </KeyboardAvoidingView>
</View>
```

Target structure (fixed - footer stays put):

```
<View container flex=1>
  <View header />
  <KeyboardAvoidingView flex=1>  <-- wraps ONLY the Polaroid
    <GestureDetector>
      <Animated.View polaroidOuter>
        <View polaroidFrame>
          <Image photo />
          <View captionStrip>
            <TextInput caption />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  </KeyboardAvoidingView>
  <View footer>                  <-- OUTSIDE KAV = stays at bottom
    <TouchableOpacity send />
  </View>
</View>
```

Specific changes to make in `src/screens/SnapPreviewScreen.js`:

1. Move the footer `<View>` (lines 232-248 currently) OUTSIDE and AFTER the closing `</KeyboardAvoidingView>` tag, making it a sibling of the KAV inside the main container, not a child of the KAV.

2. Update `keyboardVerticalOffset` on the KAV to account for the footer height that now sits below it. The footer is approximately 48px (button) + 16px (paddingTop) + Math.max(insets.bottom, 16) + 8px (paddingBottom). Use a calculated value:
   - iOS: `insets.top + 56 + 48 + 16 + Math.max(insets.bottom, 16) + 8` — however, since the footer is now outside KAV, the KAV's bottom edge is above the footer. The offset needs to account for the header above. Actually, since the KAV is between the header and footer, set `keyboardVerticalOffset` to account for the header height on iOS: `insets.top + 56` (same as current for the header). Then also need to account for footer height below KAV. Since the footer is outside KAV, the KAV's frame bottom is NOT at the screen bottom — the footer occupies space below it. The KAV with `behavior='padding'` adds padding at the bottom equal to `keyboard_height - (screen_height - kav_bottom)`. Since the footer pushes KAV bottom up, the KAV auto-accounts for the footer height. So: `keyboardVerticalOffset` on iOS should remain `insets.top + 56` to account for the header above.
   - Android: Keep `0` for Android with `behavior='padding'`.

3. Remove the comment on line 231 that says "Footer: wide send button -- inside KAV so it lifts with Polaroid" and update it to reflect the footer is now OUTSIDE the KAV and stays fixed at the bottom.

4. Remove the comment on line 192 that says "Polaroid frame + footer wrapped in KAV so both lift above keyboard" and update to "Polaroid frame wrapped in KAV so caption lifts above keyboard; footer stays fixed below".

5. Keep `behavior={Platform.select({ ios: 'padding', android: 'padding' })}` on the KAV — padding behavior works correctly for both platforms when the KAV doesn't extend to the screen bottom.

6. Verify the footer style still has `paddingBottom: Math.max(insets.bottom, 16) + 8` for safe area handling.

Do NOT change any styles, colors, dimensions, or functionality. Only restructure the JSX tree to move the footer outside the KAV.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/SnapPreviewScreen.js --no-error-on-unmatched-pattern 2>/dev/null; node -e "const fs=require('fs'); const c=fs.readFileSync('src/screens/SnapPreviewScreen.js','utf8'); const kavIdx=c.indexOf('</KeyboardAvoidingView>'); const footerIdx=c.indexOf('screenStyles.footer'); if(footerIdx > kavIdx) { console.log('PASS: footer is after KAV closing tag'); } else { console.log('FAIL: footer is still inside KAV'); process.exit(1); }"</automated>
<manual>Open SnapPreviewScreen, tap caption input. Keyboard opens: Polaroid lifts so caption is visible above keyboard. Send button stays at the bottom of the screen behind/below keyboard. Dismiss keyboard: everything returns to normal position. Test on both iOS and Android.</manual>
</verify>
<done>The footer (Send button) remains fixed at the bottom of the screen when the keyboard opens. Only the Polaroid frame with the caption input shifts up above the keyboard. Layout is correct on both iOS and Android.</done>
</task>

</tasks>

<verification>
- SnapPreviewScreen renders without errors
- Tapping caption input opens keyboard and only the Polaroid lifts
- Send button stays at the bottom, does not move with keyboard
- Caption text is fully visible above the keyboard
- Android autocomplete suggestions appear between caption and keyboard
- Swipe-down dismiss gesture still works
- Send functionality unchanged
</verification>

<success_criteria>

- Footer (Send button) does NOT move when keyboard opens
- Caption input inside Polaroid is visible above the keyboard on both platforms
- No visual regressions to Polaroid frame, photo display, or send flow
  </success_criteria>

<output>
After completion, create `.planning/quick/29-fix-snap-caption-keyboardavoidingview-fo/29-SUMMARY.md`
</output>
