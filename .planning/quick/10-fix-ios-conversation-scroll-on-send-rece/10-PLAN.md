---
phase: quick
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ConversationScreen.js
  - src/components/DMInput.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'When user sends a message on iOS, the FlatList scrolls to show the new message at the bottom'
    - 'When a new message is received from the friend on iOS, the FlatList auto-scrolls to show it if user was already near the bottom'
    - 'If user has scrolled up to read old messages, incoming messages do NOT force-scroll them away from their reading position'
    - 'Android scroll behavior is not broken by these changes'
  artifacts:
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Auto-scroll logic on send and receive for inverted FlatList'
    - path: 'src/components/DMInput.js'
      provides: 'onSend callback prop to notify parent when a message is sent'
  key_links:
    - from: 'src/components/DMInput.js'
      to: 'src/screens/ConversationScreen.js'
      via: 'onSend callback prop'
      pattern: 'onSend'
    - from: 'src/screens/ConversationScreen.js'
      to: 'flatListRef'
      via: 'scrollToOffset after send/receive'
      pattern: "flatListRef\\.current\\.scrollToOffset"
---

<objective>
Fix iOS-only bug where the conversation FlatList does not auto-scroll to the latest message when the user sends a message or receives one while the conversation is open.

Purpose: On iOS, the inverted FlatList with `maintainVisibleContentPosition` keeps the scroll position stable (intended for pagination of older messages), but this prevents the list from auto-scrolling to show newly arrived messages at index 0. The fix adds explicit scroll-to-bottom logic on send and on new message arrival (when user is near the bottom).

Output: Updated ConversationScreen.js with scroll-on-send and scroll-on-receive logic, and updated DMInput.js with an onSend callback.
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
  <name>Task 1: Add scroll-to-bottom on send and auto-scroll on new message receive</name>
  <files>src/screens/ConversationScreen.js, src/components/DMInput.js</files>
  <action>
**DMInput.js changes:**

Add an optional `onSend` callback prop. In the `handleSend` function, after calling `onSendMessage(trimmedText, null)` and `setText('')`, call `onSend?.()`. Similarly in `handleGifSelected`, after calling `onSendMessage(null, gifUrl)`, call `onSend?.()`. This gives the parent screen a synchronous signal that a send was initiated, so it can scroll immediately without waiting for the Firestore round-trip.

**ConversationScreen.js changes:**

1. **Track "near bottom" state via `onScroll`:** Add a ref `isNearBottomRef = useRef(true)`. Add an `onScroll` handler on the FlatList that checks `event.nativeEvent.contentOffset.y`. Since the list is inverted, `contentOffset.y` near 0 means the user is at the bottom (newest messages). Set `isNearBottomRef.current = true` when `contentOffset.y < 150` (about 3-4 message bubbles of scroll), and `false` otherwise. Use `scrollEventThrottle={100}` on iOS to get reasonable update frequency without performance cost.

2. **Scroll to bottom on send:** Create a `scrollToBottom` callback that calls `flatListRef.current?.scrollToOffset({ offset: 0, animated: true })`. Using `scrollToOffset` with offset 0 is more reliable than `scrollToIndex` for inverted lists. Pass a new `onSend` prop to `DMInput` that calls `scrollToBottom`. Wrap in a small `setTimeout(() => scrollToBottom(), 100)` to allow the FlatList to process the new item before scrolling.

3. **Auto-scroll on new message receive:** Add a `useEffect` that watches `messages.length`. Store the previous message count in a ref (`prevMessageCountRef`). When `messages.length` increases AND `isNearBottomRef.current === true`, call `scrollToBottom()` with a 100ms delay. Update `prevMessageCountRef.current` to the new length. This ensures:
   - If the user is reading old messages (scrolled up), new incoming messages do NOT yank them to the bottom
   - If the user is at or near the bottom, new messages automatically scroll into view
   - The user's own sent messages always scroll (handled by the onSend callback above, which fires regardless of scroll position)

4. **Remove `maintainVisibleContentPosition` prop entirely:** This prop on iOS is causing the core issue -- it tells the FlatList to keep the currently visible content in place when new items are prepended. For an inverted list where new messages appear at index 0, this means the view stays put and hides the new message. The pagination use case (loading older messages at the end of the inverted list) does not need this prop because `onEndReached` loads items that append to the list's footer, which does not shift visible content. Remove the `maintainVisibleContentPosition` prop from the FlatList.

5. **Platform safety:** The `onScroll` + `scrollToOffset` approach works on both iOS and Android. No platform guards needed for the scroll logic itself. Keep `scrollEventThrottle={100}` which is primarily iOS-relevant (Android throttles differently) but harmless on Android.
   </action>
   <verify>
   <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ConversationScreen.js src/components/DMInput.js --no-error-on-unmatched-pattern 2>&1 | head -30</automated>
   <manual> 1. Open the app on iOS and navigate to a conversation with messages 2. Send a text message -- the list should immediately scroll to show the new message at the bottom 3. Send a GIF -- same scroll behavior 4. Have the friend send a message while you are at the bottom of the conversation -- should auto-scroll to show it 5. Scroll up significantly (past 3-4 messages), have the friend send a message -- should NOT scroll you away from reading position 6. Scroll back to bottom, confirm new messages are visible 7. Test on Android to confirm no regressions
   </manual>
   </verify>
   <done> - Sending a text or GIF on iOS scrolls the inverted FlatList to offset 0 (showing the newest message) - Incoming messages auto-scroll when user is near the bottom (contentOffset.y less than 150) - Incoming messages do NOT force-scroll when user has scrolled up to read old messages - Android behavior is unaffected (no regressions) - No lint errors in modified files
   </done>
   </task>

</tasks>

<verification>
- ESLint passes on both modified files
- Manual iOS testing confirms scroll-on-send works for text and GIF
- Manual iOS testing confirms auto-scroll-on-receive near bottom
- Manual iOS testing confirms no forced scroll when user is scrolled up reading history
- Manual Android testing confirms no regressions
</verification>

<success_criteria>
The conversation FlatList on iOS auto-scrolls to the latest message when sending or receiving messages while near the bottom, and does not interrupt the user when they are scrolled up reading older messages.
</success_criteria>

<output>
After completion, create `.planning/quick/10-fix-ios-conversation-scroll-on-send-rece/10-SUMMARY.md`
</output>
