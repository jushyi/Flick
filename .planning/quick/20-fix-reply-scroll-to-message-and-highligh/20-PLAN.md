---
phase: quick-20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ConversationScreen.js
  - src/components/MessageBubble.js
autonomous: true
requirements: [QUICK-20]

must_haves:
  truths:
    - 'Tapping a reply scrolls the FlatList to the correct original message position'
    - 'The highlight flash begins only after the scroll has completed, not during the scroll'
    - 'The highlighted message is visible and centered on screen when the flash plays'
    - 'onScrollToIndexFailed fallback still works and triggers highlight after retry scroll completes'
  artifacts:
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Fixed scrollToMessage using messagesWithDividers index and deferred highlight'
      contains: 'messagesWithDividers.findIndex'
    - path: 'src/components/MessageBubble.js'
      provides: 'Highlight animation that plays on demand without immediate auto-start'
  key_links:
    - from: 'src/screens/ConversationScreen.js'
      to: 'src/components/MessageBubble.js'
      via: 'highlighted prop triggers flash animation'
      pattern: "highlighted.*===.*item\\.id"
---

<objective>
Fix reply scroll-to-message and highlight timing in DM conversations.

Purpose: When a user taps a reply's "original message" block, the conversation should scroll to the correct original message and flash-highlight it AFTER the scroll completes so the user actually sees the highlight. Currently there are three bugs: (1) the scroll index is computed against `messages` but the FlatList renders `messagesWithDividers` which includes date divider items, causing the scroll to land on the wrong position; (2) the highlight animation starts immediately and fades out during the scroll, so it's done before the user sees the target message; (3) the `onScrollToIndexFailed` retry doesn't coordinate with highlight timing at all.

Output: Fixed ConversationScreen.js and MessageBubble.js with correct scroll targeting and deferred highlight.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/ConversationScreen.js
@src/components/MessageBubble.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix scroll index to use messagesWithDividers and defer highlight until scroll completes</name>
  <files>src/screens/ConversationScreen.js</files>
  <action>
Fix the `scrollToMessage` callback (around line 207) with two changes:

**Fix 1 — Use correct data array for index lookup:**
Change `messages.findIndex(m => m.id === messageId)` to `messagesWithDividers.findIndex(m => m.id === messageId)`. The FlatList's `data` prop is `messagesWithDividers` which interleaves date divider items, so the index must be computed against that same array. Update the dependency array to include `messagesWithDividers` instead of `messages`.

**Fix 2 — Defer highlight until after scroll animation completes:**
Remove the immediate `setHighlightedMessageId(messageId)` call. Instead, set the highlight after a delay that allows the scroll animation to finish. Use approximately 400-500ms delay for the animated scroll to complete before triggering the highlight. The pattern should be:

```javascript
const scrollToMessage = useCallback(
  messageId => {
    const index = messagesWithDividers.findIndex(m => m.id === messageId);
    if (index !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } catch {
        // onScrollToIndexFailed handler will retry via approximate offset
      }
      // Delay highlight until scroll animation completes
      setTimeout(() => {
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 1500);
      }, 500);
    }
  },
  [messagesWithDividers]
);
```

**Fix 3 — Coordinate onScrollToIndexFailed with highlight:**
Update `onScrollToIndexFailed` (around line 406) to also defer highlight. Add a `highlightPendingRef` (useRef) that stores the messageId to highlight. In `scrollToMessage`, set `highlightPendingRef.current = messageId` instead of the setTimeout above. Then in `onScrollToIndexFailed`, after the retry scrollToIndex in the setTimeout (the 500ms one), add another setTimeout of 500ms to trigger the highlight from the ref. Clear the ref after highlighting.

Actually, a simpler and more robust approach: keep the setTimeout approach in scrollToMessage but increase the delay to 600ms to account for the onScrollToIndexFailed retry path (which uses its own 500ms setTimeout). The failed path does: immediate approximate scroll + 500ms retry. So a 600ms highlight delay covers both the happy path (scroll completes in ~300-400ms) and the retry path (500ms + a bit of scroll time). This is simpler than cross-referencing refs between two callbacks.

Final pattern for scrollToMessage:

```javascript
const scrollToMessage = useCallback(
  messageId => {
    const index = messagesWithDividers.findIndex(m => m.id === messageId);
    if (index !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } catch {
        // onScrollToIndexFailed will retry via approximate offset
      }
      // Defer highlight: 600ms covers normal scroll (~300ms) and retry path (500ms + scroll)
      setTimeout(() => {
        setHighlightedMessageId(messageId);
        setTimeout(() => setHighlightedMessageId(null), 1800);
      }, 600);
    }
  },
  [messagesWithDividers]
);
```

Also increase the highlight duration from 1500 to 1800ms so the user has more time to notice it.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ConversationScreen.js --no-error-on-unmatched-pattern --max-warnings=0 2>&1 | head -20</automated>
<manual>Open a conversation with reply messages. Tap a reply's original message quote. Verify: (1) the list scrolls to the correct original message, (2) the highlight flash begins only after the scroll stops, (3) the flash is clearly visible for ~1.8 seconds.</manual>
</verify>
<done>scrollToMessage finds the correct index in messagesWithDividers (not messages), and the highlight is deferred by 600ms so it plays after the scroll animation completes.</done>
</task>

<task type="auto">
  <name>Task 2: Make MessageBubble highlight animation more visible with a two-phase flash</name>
  <files>src/components/MessageBubble.js</files>
  <action>
Update the highlight animation in MessageBubble (around line 50-61) to be more noticeable. Currently it starts at opacity 0.4 and fades to 0 over 1500ms — a single linear fade that's subtle and easy to miss.

Replace with a two-phase "pulse then fade" animation:

1. Flash IN: animate from 0 to 0.5 opacity over 150ms (quick attention-grab)
2. Hold briefly at 0.5 for emphasis
3. Fade OUT: animate from 0.5 to 0 over 1200ms

Implementation using RN Animated sequence:

```javascript
useEffect(() => {
  if (highlighted) {
    highlightOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(highlightOpacity, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.delay(300),
      RNAnimated.timing(highlightOpacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  }
}, [highlighted, highlightOpacity]);
```

This gives a "flash on, hold, fade out" effect that's much more noticeable than a single fade-from-visible.

Also change the highlight overlay color from `colors.overlay.purpleTint` to a slightly brighter tint for better visibility. Use `'rgba(0, 212, 255, 0.15)'` (matching the cyan interactive.primary accent used throughout the DM UI) as the backgroundColor for `highlightOverlay` style. This ties the highlight to the app's existing color language and stands out better against the dark background.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/MessageBubble.js --no-error-on-unmatched-pattern --max-warnings=0 2>&1 | head -20</automated>
<manual>After tapping a reply quote, observe the target message: it should flash cyan briefly, hold, then smoothly fade out over ~1.2 seconds. The flash should be clearly visible on both sent (blue) and received (dark) message bubbles.</manual>
</verify>
<done>Highlight animation uses a two-phase sequence (flash in 150ms, hold 300ms, fade out 1200ms) with cyan tint color that's clearly visible against the dark UI.</done>
</task>

</tasks>

<verification>
- Lint passes on both modified files
- Tapping a reply's original message block scrolls to the CORRECT message (not offset by divider count)
- Highlight flash is visible AFTER scroll completes, not during
- Flash is clearly noticeable with the pulse-then-fade animation
- onScrollToIndexFailed path still works (test by scrolling far from the target before tapping reply)
- No regressions: normal message sending, scrolling, reactions, timestamps all still work
</verification>

<success_criteria>

1. Reply tap scrolls to the correct original message (index matches messagesWithDividers, not messages)
2. Highlight begins after scroll animation finishes (~600ms delay)
3. Highlight is clearly visible with two-phase pulse animation
4. Both happy path (index in render window) and retry path (onScrollToIndexFailed) show the highlight correctly
   </success_criteria>

<output>
After completion, create `.planning/quick/20-fix-reply-scroll-to-message-and-highligh/20-SUMMARY.md`
</output>
