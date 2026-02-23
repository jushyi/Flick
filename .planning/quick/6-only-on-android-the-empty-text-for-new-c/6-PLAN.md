---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-6]
must_haves:
  truths:
    - 'Empty conversation text reads right-side-up on Android'
    - 'Empty conversation text still reads right-side-up on iOS'
  artifacts:
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Platform-conditional scaleY transform on emptyStateWrapper'
      contains: "Platform.OS === 'ios'"
  key_links:
    - from: 'emptyStateWrapper style'
      to: 'Platform.OS check'
      via: 'conditional transform'
      pattern: "Platform\\.OS.*scaleY"
---

<objective>
Fix the empty conversation "Say hi to..." text rendering upside-down on Android.

Purpose: On Android, React Native's inverted FlatList uses native scroll reversal rather than a CSS scaleY transform. The ListEmptyComponent is NOT flipped on Android, so applying scaleY: -1 to counter-flip it actually makes it backwards. The fix is to only apply the scaleY: -1 counter-transform on iOS.

Output: Patched ConversationScreen.js with platform-conditional transform.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/ConversationScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make emptyStateWrapper scaleY transform iOS-only</name>
  <files>src/screens/ConversationScreen.js</files>
  <action>
In `src/screens/ConversationScreen.js`, modify the `emptyStateWrapper` style (line ~303-308) to conditionally apply the `scaleY: -1` transform only on iOS.

Change:

```javascript
emptyStateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ scaleY: -1 }],
},
```

To:

```javascript
emptyStateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    transform: Platform.OS === 'ios' ? [{ scaleY: -1 }] : undefined,
},
```

`Platform` is already imported on line 9. No other changes needed.

Also update the JSDoc comment above the EmptyConversation component (line 27-31) to mention the platform-conditional behavior:

```javascript
/**
 * Empty state shown when no messages exist in the conversation.
 * On iOS, wrapped with scaleY: -1 to counter the inverted FlatList's CSS transform.
 * On Android, no counter-transform needed — FlatList inversion uses native scroll reversal.
 */
```

  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && node -e "const fs = require('fs'); const src = fs.readFileSync('src/screens/ConversationScreen.js', 'utf8'); const hasConditional = src.includes(\"Platform.OS === 'ios' ? [{ scaleY: -1 }]\"); const noUnconditional = !src.match(/transform:\s*\[\{\s*scaleY:\s*-1\s*\}\]/); console.log('Conditional transform:', hasConditional); console.log('No unconditional transform:', noUnconditional); if (!hasConditional || !noUnconditional) process.exit(1); console.log('PASS');"</automated>
    <manual>Open a new conversation on Android and verify the "Say hi to..." text renders right-side-up. Then verify the same on iOS.</manual>
  </verify>
  <done>The emptyStateWrapper transform is platform-conditional: scaleY: -1 on iOS, no transform on Android. The empty conversation text renders correctly on both platforms.</done>
</task>

</tasks>

<verification>
- `npm run lint` passes with no new errors
- The `Platform.OS === 'ios'` guard exists in the emptyStateWrapper style
- No unconditional `scaleY: -1` remains in emptyStateWrapper
</verification>

<success_criteria>

- Empty conversation "Say hi to..." text renders right-side-up on both iOS and Android
- No regressions to iOS behavior (counter-transform still applied on iOS)
- Lint passes cleanly
  </success_criteria>

<output>
After completion, create `.planning/quick/6-only-on-android-the-empty-text-for-new-c/6-SUMMARY.md`
</output>
