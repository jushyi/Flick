---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-05]

must_haves:
  truths:
    - 'DMInput bar is visible immediately when opening any conversation, even while messages are loading'
    - 'DMInput bar is visible when starting a new conversation from NewMessageScreen'
    - 'User can type and send a message without waiting for the loading spinner to finish'
  artifacts:
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Loading state with DMInput visible'
      contains: 'DMInput'
  key_links:
    - from: 'ConversationScreen loading state'
      to: 'DMInput'
      via: 'rendered inside KeyboardAvoidingView alongside loading spinner'
      pattern: 'loading.*DMInput|DMInput.*loading'
---

<objective>
Fix the missing input bar when opening or starting a new conversation.

Purpose: When navigating to ConversationScreen (from MessagesScreen or NewMessageScreen), the loading state renders a header and spinner but omits the DMInput component entirely. The user sees no way to type a message until loading completes. This is a brief but jarring UX gap, especially for new conversations where the user's intent is clearly to type immediately.

Output: ConversationScreen always shows the DMInput bar, including during the loading state.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/ConversationScreen.js
@src/components/DMInput.js
@src/hooks/useConversation.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add DMInput to ConversationScreen loading state</name>
  <files>src/screens/ConversationScreen.js</files>
  <action>
In ConversationScreen.js, the loading state (the early return when `loading` is true, around lines 167-191) renders only:
- ConversationHeader
- A flex:1 View with PixelSpinner centered

It does NOT render DMInput. The fix:

1. Wrap the loading state body (everything below ConversationHeader) in a KeyboardAvoidingView identical to the one in the main render path:

   ```jsx
   <KeyboardAvoidingView
     style={styles.flex}
     behavior={Platform.select({ ios: 'padding', android: 'height' })}
     keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
   >
   ```

2. Keep the existing `<View style={styles.loadingContainer}><PixelSpinner size="large" /></View>` inside that KeyboardAvoidingView.

3. Add `<DMInput onSendMessage={handleSendMessage} disabled={isReadOnly} placeholder="Message..." />` below the loading container, inside the KeyboardAvoidingView — exactly like the main render path.

The resulting loading state JSX should be:

```jsx
return (
  <View style={styles.container}>
    <ConversationHeader ... />
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
    >
      <View style={styles.loadingContainer}>
        <PixelSpinner size="large" />
      </View>
      <DMInput onSendMessage={handleSendMessage} disabled={isReadOnly} placeholder="Message..." />
    </KeyboardAvoidingView>
  </View>
);
```

This works because `handleSendMessage` from useConversation guards against missing conversationId (returns early with error), so even if the user types and sends before loading completes, it degrades gracefully. Once loading finishes, the main render path takes over seamlessly with the same DMInput.

Do NOT change the main (non-loading) render path. Only modify the loading early-return block.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ConversationScreen.js --no-error-on-unmatched-pattern</automated>
<manual>Open the app, navigate to any existing conversation. The input bar should be visible immediately even during the brief loading spinner. Then go to New Message, select a friend to start a new conversation. The input bar should appear immediately alongside the loading spinner.</manual>
</verify>
<done>DMInput is rendered in the ConversationScreen loading state, wrapped in KeyboardAvoidingView, so the input bar is always visible from the moment the screen appears.</done>
</task>

</tasks>

<verification>
- ConversationScreen loading state renders DMInput below the spinner
- ConversationScreen main render state still renders DMInput below the FlatList (unchanged)
- ESLint passes with no errors
- No other files modified
</verification>

<success_criteria>

- The input bar is visible the instant ConversationScreen appears, regardless of loading state
- Keyboard behavior works correctly during loading (KeyboardAvoidingView present)
- No regressions in the main (loaded) conversation view
  </success_criteria>

<output>
After completion, create `.planning/quick/5-fix-missing-input-bar-when-opening-or-st/5-SUMMARY.md`
</output>
