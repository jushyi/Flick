# Phase 2: Message Interactions - Research

**Researched:** 2026-02-23
**Domain:** React Native gesture handling, Firestore message modeling, Cloud Functions notifications
**Confidence:** HIGH

## Summary

Phase 2 adds emoji reactions, quote replies, and message deletion to the existing DM system. The codebase already has all required libraries installed (`react-native-gesture-handler` ~2.28.0, `react-native-reanimated` ~4.1.1, `expo-haptics` ~15.0.8) and established patterns for gesture composition (`Gesture.Pan()`, `Gesture.LongPress()`, `Gesture.Tap()`, `Gesture.Race()`, `Gesture.Exclusive()`). The project uses the Gesture Handler v2 declarative API throughout, which is the correct modern approach.

The critical architecture decision -- storing reactions as separate `type: 'reaction'` message documents -- is already locked and aligns with the existing `onNewMessage` Cloud Function trigger pattern. This means the existing Cloud Function will fire for reaction messages, which needs to be extended to handle the new message types differently (reaction notification text, skipping conversation preview updates for reactions). The Firestore security rules already allow message creation by conversation participants, so no rule changes are needed for reactions or replies. Deletion (unsend) requires a new Cloud Function since client-side Firestore rules explicitly deny message deletion (`allow delete: if false`).

The existing `MessageBubble` component is simple (no gesture handling, uses `Pressable` for tap) and will need significant refactoring to support long-press, double-tap, and swipe-to-reply gestures. The `DMInput` component needs a `ReplyPreview` bar above it. The `ConversationRow` already handles `type: 'reaction'` in its preview text, showing foresight from Phase 1 planning. The `useConversation` hook's merged message list will need client-side aggregation logic to group reaction messages by their target.

**Primary recommendation:** Build reactions, replies, and deletion as three independent feature slices, each following the pattern: Firestore data model extension -> service layer -> Cloud Function -> UI component -> hook integration.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Classic 6-emoji set: heart, laugh, surprise, sad, angry, thumbs up
- Stacked emoji badges with count displayed below target messages
- Tap own reaction to toggle/remove it
- One reaction per user per message -- new reaction replaces the old one
- Can react to any message type (text, image, GIF) including your own messages
- Cannot react to reaction messages themselves (no reaction chains)
- Pixel-style heart pop animation on double-tap
- Reaction pills fade in when first appearing (no bounce)
- Floating reaction picker appears directly above the long-pressed message
- Dark semi-transparent overlay behind picker when active
- iMessage-style layout: floating emoji row above message, text-only action menu below message
- Long-pressed message scales up slightly for emphasis
- Actions (text labels only, no icons): Reply (all messages), Unsend (own messages within 15 min), Delete (own messages, labeled "Delete for me")
- Medium haptic feedback on long-press activation
- Tap anywhere outside to dismiss picker + menu
- Compose preview: Mini message bubble above DMInput showing the message being replied to
- For image/GIF messages: shows icon + label (e.g., camera icon + "Photo"), not a thumbnail
- Cancel via X button or swipe preview downward
- Sent reply rendering: Embedded mini bubble inside the reply message bubble (self-contained, iMessage-style)
- Tapping the quoted mini bubble scrolls conversation to the original message and briefly highlights it
- Flat replies only -- can reply to any message but no nested reply chains
- Deleted original shows italic gray "Original message deleted" in the mini bubble
- Auto-focus keyboard on swipe-to-reply activation
- Short swipe threshold (~40px), message bubble slides right during swipe, reply arrow icon appears behind, haptic feedback at trigger point
- Two distinct actions: Unsend (within 15 min, instant, fade-out, cascade remove reactions) and Delete for me (always available, custom pixel dialog, placeholder in your view)
- All message types support unsend and delete (text, image, GIF)
- Firestore-only soft delete -- uploaded images stay in Firebase Storage for moderation trail
- Conversation preview updates on unsend (falls back to previous message) and delete-for-me (deleter sees placeholder, other person sees original)
- Reaction push notifications include the emoji: "[Name] reacted :heart: to your message"
- Every reaction sends its own notification (no batching)
- Tapping reaction notification opens the conversation screen (no scroll-to-message)
- Reply messages trigger standard new message notifications (not reply-specific)
- If a message gets unsent while reaction picker is open: dismiss picker silently
- If original message gets unsent while composing a reply: clear reply mode, keep typed text
- Only original messages (text, image, GIF) can be reacted to -- not reaction messages

### Claude's Discretion

- Exact pixel dimensions and spacing for reaction pills, mini bubbles, and picker
- Animation easing curves and spring configurations
- Swipe-to-reply arrow icon design
- Color choices for reaction picker background and menu items
- How the "scroll to original message" highlight animation works
- Implementation of the custom pixel confirmation dialog (can reuse existing patterns if available)
- Handling of offline/network error states during reactions and deletions

### Deferred Ideas (OUT OF SCOPE)

- Custom emoji reactions beyond the 6 presets -- captured as INTER-V2-01 in v2 requirements
- "+" button on reaction picker with emoji search and editable preset row -- v2 feature
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                  | Research Support                                                                                                  |
| -------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| REACT-01 | User can double-tap a message to add a heart reaction                        | Gesture composition with `Gesture.Tap().numberOfTaps(2)` + existing reanimated patterns                           |
| REACT-02 | User can long-press a message to open a reaction picker with 6 preset emojis | `Gesture.LongPress()` pattern from FullscreenSelectsViewer; Modal overlay with positioned emoji row               |
| REACT-03 | Reactions appear as emoji badges below the target message bubble             | Client-side aggregation in useConversation; ReactionBadges component below MessageBubble                          |
| REACT-04 | Reactions stored as separate `type: 'reaction'` message documents            | New message fields: `type: 'reaction'`, `targetMessageId`, `emoji`; sendReaction service method                   |
| REACT-05 | Recipient receives push notification when someone reacts                     | Extended onNewMessage Cloud Function with reaction-specific notification template                                 |
| REPLY-01 | User can swipe right on a message to quote-reply to it                       | `Gesture.Pan()` with horizontal threshold ~40px; existing pattern from useSwipeableCard                           |
| REPLY-02 | Reply shows compact preview of original message above compose input          | ReplyPreview component rendered above DMInput; state lifted to ConversationScreen                                 |
| REPLY-03 | Sent reply renders with quoted message preview above reply bubble            | `replyTo` field with denormalized preview; ReplyBubble nested inside MessageBubble                                |
| REPLY-04 | If original message deleted, reply shows "Original message deleted"          | Check `replyTo.deleted` flag; render italic gray fallback text                                                    |
| DEL-01   | User can delete (unsend) their own sent messages                             | New `unsendMessage` Cloud Function (callable); client optimistic fade-out                                         |
| DEL-02   | Deleted messages show "This message was deleted" for both users              | `deletedAt`/`unsent` fields on message doc; MessageBubble renders placeholder                                     |
| DEL-03   | Deletion is soft-delete via Cloud Function                                   | Admin SDK bypasses security rules; sets `unsent: true` + `deletedAt` on message; updates conversation lastMessage |

</phase_requirements>

## Standard Stack

### Core (Already Installed)

| Library                          | Version | Purpose                                                      | Why Standard                                         |
| -------------------------------- | ------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| react-native-gesture-handler     | ~2.28.0 | Double-tap, long-press, swipe-to-reply gestures              | Already used throughout codebase with Gesture v2 API |
| react-native-reanimated          | ~4.1.1  | Animations for reaction picker, swipe, fade-out              | Already used for all animations in project           |
| expo-haptics                     | ~15.0.8 | Haptic feedback on long-press, swipe trigger, double-tap     | Already used in DMInput, SwipeablePhotoCard          |
| @react-native-firebase/firestore | ^23.8.6 | Message documents, reaction storage, real-time subscriptions | Core data layer                                      |
| @react-native-firebase/functions | ^23.8.6 | Callable functions for unsend/delete                         | Already installed for other callable functions       |

### Supporting (Already Installed)

| Library    | Version | Purpose                                    | When to Use                                       |
| ---------- | ------- | ------------------------------------------ | ------------------------------------------------- |
| expo-image | ~3.0.11 | Image message thumbnails in reply previews | When rendering image/GIF message references       |
| date-fns   | ^4.1.0  | Timestamp formatting in messages           | Already used in MessageBubble and ConversationRow |

### No New Dependencies Required

All Phase 2 functionality is achievable with the existing installed packages. No npm install needed.

## Architecture Patterns

### Recommended File Structure

```
src/
  components/
    MessageBubble.js           # MODIFY: Add gesture handling, reaction badges, reply rendering
    DMInput.js                 # MODIFY: Add ReplyPreview bar above input
    ReactionPicker.js          # NEW: Floating emoji picker + action menu overlay
    ReactionBadges.js          # NEW: Emoji pill badges below message bubbles
    ReplyPreview.js            # NEW: Compact reply preview above DMInput
    PixelConfirmDialog.js      # NEW: Custom pixel-themed confirmation dialog
  hooks/
    useConversation.js         # MODIFY: Add reaction aggregation, reply state, delete handling
    useMessageActions.js       # NEW: Long-press menu state, reaction logic, reply state, delete
  services/firebase/
    messageService.js          # MODIFY: Add sendReaction, sendReply, reaction aggregation queries
  screens/
    ConversationScreen.js      # MODIFY: Wire up gesture handlers, reply state, action menu state
functions/
  index.js                     # MODIFY: Extend onNewMessage for reactions/replies; add unsendMessage callable
```

### Pattern 1: Reaction as Separate Message Document

**What:** Each reaction is a standalone message document in the messages subcollection with `type: 'reaction'`, linking back to the target message via `targetMessageId`.
**When to use:** Every time a user reacts to a message.
**Why:** Preserves message immutability (no writes to original message doc), triggers existing `onNewMessage` Cloud Function, appears in real-time subscription automatically, supports future extensibility.

```javascript
// Reaction message document shape
{
  senderId: 'user123',
  type: 'reaction',
  emoji: 'heart',          // one of: heart, laugh, surprise, sad, angry, thumbs_up
  targetMessageId: 'msg456',
  text: null,
  gifUrl: null,
  imageUrl: null,
  createdAt: serverTimestamp(),
}
```

### Pattern 2: Client-Side Reaction Aggregation

**What:** The `useConversation` hook aggregates reaction messages into a lookup map keyed by `targetMessageId`, so `MessageBubble` can render emoji badges without additional queries.
**When to use:** In the `useMemo` that processes the merged message list.

```javascript
// In useConversation — compute reaction map from message list
const reactionMap = useMemo(() => {
  const map = new Map(); // targetMessageId -> { emoji: [senderId, ...], ... }
  messages.forEach(msg => {
    if (msg.type === 'reaction' && msg.targetMessageId) {
      if (!map.has(msg.targetMessageId)) {
        map.set(msg.targetMessageId, {});
      }
      const targetReactions = map.get(msg.targetMessageId);
      if (!targetReactions[msg.emoji]) {
        targetReactions[msg.emoji] = [];
      }
      // Only keep latest reaction per user per emoji (for toggle logic)
      const existing = targetReactions[msg.emoji].findIndex(r => r.senderId === msg.senderId);
      if (existing === -1) {
        targetReactions[msg.emoji].push({ senderId: msg.senderId, messageId: msg.id });
      }
    }
  });
  return map;
}, [messages]);
```

### Pattern 3: Reply Message with Denormalized Preview

**What:** Reply messages store a `replyTo` object with denormalized data from the original message, avoiding a Firestore read at render time.
**When to use:** Every time a user sends a reply.

```javascript
// Reply message document shape
{
  senderId: 'user123',
  type: 'text',             // or 'image', 'gif' — the reply content type
  text: 'Great photo!',
  gifUrl: null,
  imageUrl: null,
  replyTo: {
    messageId: 'msg456',
    senderId: 'user789',
    type: 'image',          // original message type
    text: null,             // original text (truncated if long)
    deleted: false,         // set to true if original gets unsent
  },
  createdAt: serverTimestamp(),
}
```

### Pattern 4: Gesture Composition on MessageBubble

**What:** Compose multiple gestures (double-tap, long-press, single-tap, swipe) into a single gesture handler using `Gesture.Race()` and `Gesture.Exclusive()`.
**When to use:** On every MessageBubble that is a "reactable" message (text, image, gif — not reaction type).

```javascript
// Gesture composition pattern (from existing codebase patterns)
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const doubleTapGesture = Gesture.Tap()
  .numberOfTaps(2)
  .onEnd(() => {
    runOnJS(onDoubleTap)();
  });

const longPressGesture = Gesture.LongPress()
  .minDuration(500)
  .onStart(event => {
    runOnJS(onLongPress)(event);
  });

const singleTapGesture = Gesture.Tap()
  .maxDuration(250)
  .onEnd(() => {
    runOnJS(onSingleTap)();
  });

const swipeGesture = Gesture.Pan()
  .activeOffsetX(20) // Only activate on horizontal swipe
  .failOffsetY([-15, 15]) // Fail if vertical (allow scroll)
  .onUpdate(event => {
    translateX.value = Math.max(0, event.translationX); // Only right swipe
  })
  .onEnd(event => {
    if (event.translationX > 40) {
      runOnJS(onSwipeReply)();
    }
    translateX.value = withTiming(0);
  });

// Compose: double-tap wins over single-tap; all race with long-press and swipe
const composed = Gesture.Race(
  swipeGesture,
  Gesture.Exclusive(doubleTapGesture, singleTapGesture),
  longPressGesture
);
```

### Pattern 5: Unsend via Cloud Function (Callable)

**What:** Message unsend is a callable Cloud Function because Firestore security rules explicitly deny client-side message deletion. The function performs the soft-delete, cascades reaction removal, and updates conversation metadata.
**When to use:** When user taps "Unsend" on their own message within 15 minutes.

```javascript
// Cloud Function: unsendMessage (callable)
exports.unsendMessage = onCall({ memory: '256MiB', timeoutSeconds: 30 }, async request => {
  const { conversationId, messageId } = request.data;
  const userId = request.auth.uid;

  // 1. Verify message exists and sender matches
  // 2. Verify within 15-minute window
  // 3. Set message fields: unsent: true, unsentAt: serverTimestamp()
  // 4. Delete all reaction messages targeting this message
  // 5. Update conversation lastMessage if this was the latest
  // 6. Update replyTo.deleted on any replies to this message
});
```

### Pattern 6: Delete-for-Me via Local State

**What:** "Delete for me" does not modify the Firestore message document. Instead, it stores the deleted message IDs in a per-user field on the conversation document (or local storage), and the client filters them from the message list.
**When to use:** When user taps "Delete for me" on any of their own messages.

```javascript
// Approach: Store deletedMessageIds on conversation document (per-user)
// Conversation document addition:
{
  deletedMessages: {
    [userId]: ['msgId1', 'msgId2', ...],   // Array of message IDs hidden for this user
  }
}
```

### Anti-Patterns to Avoid

- **Mutating original message docs for reactions:** Violates the immutability principle. Use separate reaction documents instead.
- **Client-side message deletion:** Firestore rules deny this (`allow delete: if false`). Must use Cloud Function with admin SDK.
- **Storing full image URLs in replyTo:** Denormalize only type and text. Images are referenced by type label ("Photo"), not by URL. This avoids signed URL expiry issues.
- **Nested gesture handlers without composition:** Use `Gesture.Race()` / `Gesture.Exclusive()` to compose, not nested `GestureDetector` wrappers.
- **Filtering reaction messages from the FlatList:** Reaction messages should be hidden from the main message list but kept in the aggregation map. Filter them in the `messagesWithDividers` useMemo.
- **Re-reading original message for reply previews:** Denormalize at send time. The `replyTo` object in the message doc is the source of truth at render time.

## Don't Hand-Roll

| Problem             | Don't Build                                | Use Instead                                                       | Why                                                                                            |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Gesture composition | Custom touch responder system              | `react-native-gesture-handler` Gesture v2 API                     | Already handles iOS/Android differences, gesture conflicts, simultaneous/exclusive recognition |
| Animated overlay    | Manual `Animated.View` with opacity toggle | Reanimated `useAnimatedStyle` + `withTiming`                      | Runs on UI thread, 60fps guaranteed, existing pattern                                          |
| Haptic feedback     | Custom vibration patterns                  | `expo-haptics` `impactAsync(Medium)`                              | Cross-platform, consistent, already mocked in tests                                            |
| Scroll-to-message   | Manual offset calculation + scrollTo       | `FlatList.scrollToIndex()` with `getItemLayout` or `scrollToItem` | FlatList handles inverted list offset math                                                     |
| Confirmation dialog | Native `Alert.alert`                       | Custom `PixelConfirmDialog` component                             | User explicitly requested pixel-themed dialog, not native OS alerts                            |

**Key insight:** The existing codebase has all the gesture, animation, and haptic infrastructure. Phase 2's complexity is in the data modeling and UI composition, not in adding new capabilities.

## Common Pitfalls

### Pitfall 1: Gesture Conflicts in Inverted FlatList

**What goes wrong:** Adding gesture handlers to MessageBubble items inside an inverted FlatList can conflict with the FlatList's scroll gesture, causing scroll to stop working or gestures to not fire.
**Why it happens:** `react-native-gesture-handler` Pan gestures compete with FlatList's native scroll. On Android, `GestureHandlerRootView` wrapping may also cause issues.
**How to avoid:** Use `activeOffsetX` and `failOffsetY` on the swipe-to-reply Pan gesture to only activate on clear horizontal swipes. The FlatList scroll is vertical, so horizontal-only Pan gestures won't conflict. The `GestureHandlerRootView` is already present in the app (verified in multiple screen components).
**Warning signs:** Scroll stuttering, gestures not firing, or gestures firing when trying to scroll.

### Pitfall 2: Double-Tap vs Single-Tap Timing

**What goes wrong:** Single-tap (show timestamp) fires before the double-tap can be detected, causing both to trigger.
**Why it happens:** Two taps register as two single taps unless you compose them with `Gesture.Exclusive()`.
**How to avoid:** Use `Gesture.Exclusive(doubleTapGesture, singleTapGesture)` so the double-tap gets priority. The system waits for the double-tap timeout before falling through to single-tap. Set `maxDuration(250)` on single-tap to give double-tap time to resolve.
**Warning signs:** Timestamp toggling on every double-tap, heart animation playing on single taps.

### Pitfall 3: Reaction Message Pollution in Message List

**What goes wrong:** Reaction messages (`type: 'reaction'`) appear as visible items in the FlatList alongside regular messages.
**Why it happens:** The real-time subscription returns ALL messages including reaction types.
**How to avoid:** Filter reaction messages from the display list in the `messagesWithDividers` useMemo. Keep them in the raw messages array for aggregation but exclude from rendering. Add `if (msg.type === 'reaction') continue;` in the divider insertion loop.
**Warning signs:** Blank or tiny items appearing in the message list, unexpected extra items.

### Pitfall 4: Stale replyTo Data After Unsend

**What goes wrong:** A reply bubble shows the original message text even after it was unsent.
**Why it happens:** The `replyTo` object is denormalized at send time and doesn't auto-update.
**How to avoid:** The unsend Cloud Function must query all messages with `replyTo.messageId == unsentMessageId` and update their `replyTo.deleted = true`. Client renders "Original message deleted" when this flag is true.
**Warning signs:** Reply bubbles showing deleted message content.

### Pitfall 5: onNewMessage Firing for Reaction Messages

**What goes wrong:** The `onNewMessage` Cloud Function increments `unreadCount` and updates `lastMessage` for every reaction, flooding the conversation with "Reacted :heart:" previews and inflating unread counts.
**Why it happens:** `onNewMessage` triggers on ALL message document creates, including reaction types.
**How to avoid:** Add a type check at the top of `onNewMessage`. For `type: 'reaction'`: send push notification with emoji template but do NOT update `lastMessage` or increment `unreadCount`. For replies: update `lastMessage` normally but use appropriate preview text.
**Warning signs:** Conversation list showing "Reacted :heart: to your message" as last message, unread badge incrementing on reactions.

### Pitfall 6: Unsend Time Window Race Condition

**What goes wrong:** User opens action menu, waits, then taps "Unsend" after the 15-minute window has passed.
**Why it happens:** The menu was rendered with the "Unsend" option visible, but time elapsed while the menu was open.
**How to avoid:** Validate the 15-minute window server-side in the Cloud Function. The client can hide the option optimistically but the server is the authority. Return an error if the window has passed.
**Warning signs:** Successful UI animation but message reappears after server rejects.

### Pitfall 7: Firestore Security Rules Block Message Updates

**What goes wrong:** Client tries to update a message document (e.g., to mark as deleted) and gets a permission denied error.
**Why it happens:** Current rules only allow non-sender updates to `viewedAt` and `screenshotted` fields. They do NOT allow the sender to update their own messages.
**How to avoid:** All message modifications (unsend, delete) must go through Cloud Functions using the admin SDK, which bypasses security rules. The conversation document rules do allow updates to `deletedAt` and `unreadCount` by participants, so `deletedMessages` field can be added there for delete-for-me.
**Warning signs:** Firestore permission denied errors in the console.

### Pitfall 8: Conversation Document Update Rules

**What goes wrong:** Trying to add a new field to the conversation document (like `deletedMessages`) and getting permission denied.
**Why it happens:** The Firestore security rules for conversations restrict updates to only `deletedAt`, `unreadCount`, and `readReceipts` fields.
**How to avoid:** Either (a) add `deletedMessages` to the allowed fields in security rules, or (b) use Cloud Function for delete-for-me operations, or (c) store deleted message IDs in AsyncStorage locally. Option (c) is simplest but doesn't persist across device changes. Option (a) is cleanest. The security rules update is a one-line change.
**Warning signs:** Permission denied when writing `deletedMessages` field.

## Code Examples

### Sending a Reaction

```javascript
// Source: Based on existing sendMessage pattern in messageService.js
export const sendReaction = async (conversationId, senderId, targetMessageId, emoji) => {
  try {
    if (!conversationId || !senderId || !targetMessageId || !emoji) {
      return { success: false, error: 'Missing required fields' };
    }

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const reactionData = {
      senderId,
      type: 'reaction',
      emoji,
      targetMessageId,
      text: null,
      gifUrl: null,
      imageUrl: null,
      createdAt: serverTimestamp(),
    };

    const reactionDoc = await addDoc(messagesRef, reactionData);
    return { success: true, messageId: reactionDoc.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Removing a Reaction (Toggle Off)

```javascript
// Source: Pattern for removing a reaction by deleting the reaction message doc
// Since Firestore rules deny client-side delete, use a Cloud Function
// OR: Add a `cancelled: true` field to the reaction message
// Simpler approach: add a new reaction message with same target + empty emoji sentinel
export const removeReaction = async (conversationId, senderId, targetMessageId) => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    // Add a "remove reaction" message that the aggregation logic interprets as removal
    const removalData = {
      senderId,
      type: 'reaction',
      emoji: null, // null emoji = reaction removed
      targetMessageId,
      text: null,
      gifUrl: null,
      imageUrl: null,
      createdAt: serverTimestamp(),
    };

    await addDoc(messagesRef, removalData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Sending a Reply Message

```javascript
// Source: Extension of existing sendMessage in messageService.js
export const sendReply = async (
  conversationId,
  senderId,
  text,
  gifUrl,
  imageUrl,
  replyToMessage
) => {
  try {
    const type = imageUrl ? 'image' : gifUrl ? 'gif' : 'text';
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    const messageData = {
      senderId,
      text: gifUrl || imageUrl ? null : text,
      gifUrl: gifUrl || null,
      imageUrl: imageUrl || null,
      type,
      replyTo: {
        messageId: replyToMessage.id,
        senderId: replyToMessage.senderId,
        type: replyToMessage.type,
        text: replyToMessage.type === 'text' ? (replyToMessage.text || '').substring(0, 100) : null,
        deleted: false,
      },
      createdAt: serverTimestamp(),
    };

    const messageDoc = await addDoc(messagesRef, messageData);
    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Extended onNewMessage for Reactions

```javascript
// Source: Extension of existing onNewMessage in functions/index.js
// Add this early in the onCreate handler, after parsing senderId and recipientId:

const messageType = message.type || 'text';

// Build conversation preview based on message type
let lastMessagePreview;
let shouldUpdateLastMessage = true;
let shouldIncrementUnread = true;

switch (messageType) {
  case 'reaction':
    // Reactions: send notification but do NOT update conversation preview or unread
    lastMessagePreview = null;
    shouldUpdateLastMessage = false;
    shouldIncrementUnread = false;
    break;
  case 'gif':
    lastMessagePreview = 'Sent a GIF';
    break;
  case 'image':
    lastMessagePreview = 'Sent a photo';
    break;
  default:
    lastMessagePreview = message.text || '';
}

// Only update conversation metadata for non-reaction messages
if (shouldUpdateLastMessage) {
  await convRef.update({
    lastMessage: {
      text: lastMessagePreview,
      senderId: senderId,
      timestamp: message.createdAt,
      type: messageType,
    },
    updatedAt: message.createdAt,
    ...(shouldIncrementUnread && {
      [`unreadCount.${recipientId}`]: admin.firestore.FieldValue.increment(1),
    }),
  });
}

// Notification body for reactions
if (messageType === 'reaction' && message.emoji) {
  const emojiMap = {
    heart: '\u2764\uFE0F',
    laugh: '\uD83D\uDE02',
    surprise: '\uD83D\uDE2E',
    sad: '\uD83D\uDE22',
    angry: '\uD83D\uDE21',
    thumbs_up: '\uD83D\uDC4D',
  };
  const emojiChar = emojiMap[message.emoji] || message.emoji;
  notificationBody = `Reacted ${emojiChar} to your message`;
}
```

### Swipe-to-Reply Gesture (Reanimated Pattern)

```javascript
// Source: Based on existing Gesture.Pan() patterns from useSwipeableCard.js
import { Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const REPLY_THRESHOLD = 40;
const translateX = useSharedValue(0);
const hasTriggeredHaptic = useSharedValue(false);

const swipeGesture = Gesture.Pan()
  .activeOffsetX(20)
  .failOffsetY([-15, 15])
  .onUpdate(event => {
    'worklet';
    const tx = Math.max(0, Math.min(event.translationX, 80));
    translateX.value = tx;

    if (tx >= REPLY_THRESHOLD && !hasTriggeredHaptic.value) {
      hasTriggeredHaptic.value = true;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    }
  })
  .onEnd(event => {
    'worklet';
    if (event.translationX >= REPLY_THRESHOLD) {
      runOnJS(onSwipeReply)();
    }
    translateX.value = withTiming(0, { duration: 200 });
    hasTriggeredHaptic.value = false;
  });

const messageAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: translateX.value }],
}));

const replyIconStyle = useAnimatedStyle(() => ({
  opacity: interpolate(translateX.value, [0, REPLY_THRESHOLD], [0, 1]),
}));
```

## State of the Art

| Old Approach                          | Current Approach                             | When Changed               | Impact                                                   |
| ------------------------------------- | -------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| `PanGestureHandler` component wrapper | `Gesture.Pan()` declarative API              | gesture-handler v2 (2022+) | Composable gestures, worklet-native callbacks            |
| `useAnimatedGestureHandler`           | `Gesture.Pan().onUpdate()` with worklet      | reanimated v3+             | Direct worklet integration, no separate handler hook     |
| `Animated.timing()` (RN core)         | `withTiming()` / `withSpring()` (reanimated) | Project standard           | UI thread animations, 60fps guaranteed                   |
| Mutating message docs for reactions   | Separate reaction message documents          | Project decision           | Immutability preserved, triggers existing Cloud Function |

**Deprecated/outdated:**

- `PanGestureHandler`, `TapGestureHandler`, `LongPressGestureHandler` components: Replaced by `Gesture.Pan()`, `Gesture.Tap()`, `Gesture.LongPress()` declarative API. Project already uses the new API exclusively.
- `useAnimatedGestureHandler`: No longer needed with gesture-handler v2 + reanimated v3+.

## Open Questions

1. **Reaction Toggle: Delete vs Nullify**
   - What we know: User needs to toggle reactions off. Firestore rules deny client-side message deletion.
   - What's unclear: Best approach for "un-reacting" -- add a new document with `emoji: null` as removal sentinel, or use a Cloud Function to delete the reaction document.
   - Recommendation: Use the null-emoji sentinel approach. It avoids needing a new Cloud Function, works within existing security rules (message create is allowed), and the client-side aggregation simply ignores reactions where the latest for a user has `emoji: null`. Simpler, fewer moving parts.

2. **Delete-for-Me Storage Location**
   - What we know: Need to track which messages a user has hidden. Options: conversation document field, AsyncStorage, or Cloud Function.
   - What's unclear: Whether adding `deletedMessages` to Firestore rules is acceptable vs using local-only storage.
   - Recommendation: Add `deletedMessages` to the allowed fields in the conversation document security rules. This persists across devices and requires only a one-line rule change. AsyncStorage would lose data on app reinstall. The rule change is: add `'deletedMessages'` to the `hasOnly()` list in the conversation update rule.

3. **Scroll-to-Original-Message in Inverted FlatList**
   - What we know: User taps quoted mini bubble, conversation should scroll to the original message and briefly highlight it.
   - What's unclear: If the original message is outside the currently loaded page (in older messages), `scrollToIndex` won't work without loading more data first.
   - Recommendation: Attempt `scrollToIndex` if the message is in the current list. If not found, show a brief toast "Message not loaded" or trigger a `loadMore` to find it. Full scroll-to-any-message is complex and can be refined post-launch. Start with best-effort.

## Validation Architecture

### Test Framework

| Property           | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| Framework          | Jest 29.7 with jest-expo preset                                   |
| Config file        | `jest.config.js` (root) + `functions/jest.config.js`              |
| Quick run command  | `npx jest --testPathPattern="__tests__/(services\|hooks)" --bail` |
| Full suite command | `npm test`                                                        |
| Estimated runtime  | ~15 seconds (client) + ~10 seconds (functions)                    |

### Phase Requirements -> Test Map

| Req ID   | Behavior                          | Test Type        | Automated Command                                                                 | File Exists?                           |
| -------- | --------------------------------- | ---------------- | --------------------------------------------------------------------------------- | -------------------------------------- |
| REACT-01 | Double-tap adds heart reaction    | unit (hook)      | `npx jest __tests__/hooks/useMessageActions.test.js -t "double-tap"`              | No - Wave 0 gap                        |
| REACT-02 | Long-press opens picker           | unit (hook)      | `npx jest __tests__/hooks/useMessageActions.test.js -t "long-press"`              | No - Wave 0 gap                        |
| REACT-03 | Reactions display as badges       | unit (service)   | `npx jest __tests__/services/messageService.test.js -t "reaction aggregation"`    | Partial - file exists, needs new tests |
| REACT-04 | Reactions stored as message docs  | unit (service)   | `npx jest __tests__/services/messageService.test.js -t "sendReaction"`            | Partial - file exists, needs new tests |
| REACT-05 | Reaction push notification        | unit (function)  | `cd functions && npx jest __tests__/triggers/notifications.test.js -t "reaction"` | Partial - file exists, needs new tests |
| REPLY-01 | Swipe-to-reply gesture            | manual-only      | N/A - gesture behavior requires device                                            | N/A                                    |
| REPLY-02 | Reply preview above input         | unit (hook)      | `npx jest __tests__/hooks/useMessageActions.test.js -t "reply preview"`           | No - Wave 0 gap                        |
| REPLY-03 | Reply renders with quoted context | unit (service)   | `npx jest __tests__/services/messageService.test.js -t "sendReply"`               | Partial - file exists, needs new tests |
| REPLY-04 | Deleted original in reply         | unit (service)   | `npx jest __tests__/services/messageService.test.js -t "deleted reply"`           | Partial - file exists, needs new tests |
| DEL-01   | User can unsend messages          | unit (function)  | `cd functions && npx jest __tests__/callable/functions.test.js -t "unsend"`       | No - Wave 0 gap                        |
| DEL-02   | Deleted messages show placeholder | unit (component) | `npx jest __tests__/components/MessageBubble.test.js -t "deleted"`                | No - Wave 0 gap                        |
| DEL-03   | Soft-delete via Cloud Function    | unit (function)  | `cd functions && npx jest __tests__/callable/functions.test.js -t "unsend"`       | No - Wave 0 gap                        |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task -> run: `npx jest --testPathPattern="__tests__/(services|hooks)" --bail`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `__tests__/hooks/useMessageActions.test.js` -- covers REACT-01, REACT-02, REPLY-02 (new hook test file)
- [ ] `__tests__/components/MessageBubble.test.js` -- covers DEL-02 (new component test file)
- [ ] `functions/__tests__/callable/functions.test.js` -- needs new test cases for unsendMessage callable (file exists but needs Phase 2 tests)
- [ ] `__tests__/services/messageService.test.js` -- needs new test cases for sendReaction, removeReaction, sendReply (file exists)
- [ ] `functions/__tests__/triggers/notifications.test.js` -- needs new test cases for reaction notification (file exists)

## Sources

### Primary (HIGH confidence)

- Project codebase analysis: `src/services/firebase/messageService.js`, `src/hooks/useConversation.js`, `src/components/MessageBubble.js`, `src/components/DMInput.js`, `src/screens/ConversationScreen.js`
- Project codebase: `functions/index.js` (onNewMessage Cloud Function, lines 2618-2748)
- Project codebase: `firestore.rules` (conversation and message security rules, lines 393-436)
- Project codebase: Existing gesture patterns in `src/hooks/useSwipeableCard.js`, `src/components/FullscreenSelectsViewer.js`, `src/components/SelectsBanner.js`
- Project codebase: `package.json` confirming `react-native-gesture-handler` ~2.28.0, `react-native-reanimated` ~4.1.1

### Secondary (MEDIUM confidence)

- react-native-gesture-handler v2 Gesture API: Declarative gesture composition with `Gesture.Race()`, `Gesture.Exclusive()`, `Gesture.Simultaneous()` verified from project usage patterns
- react-native-reanimated v4: `useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`, `runOnJS`, `interpolate` verified from project usage

### Tertiary (LOW confidence)

- None -- all findings verified from codebase analysis

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already installed and used extensively in the codebase
- Architecture: HIGH - Patterns derived from existing codebase patterns (gesture composition, message service, Cloud Functions)
- Pitfalls: HIGH - Identified from analyzing actual Firestore rules, Cloud Function behavior, and gesture-handler usage in the project
- Data modeling: HIGH - Reaction-as-message pattern is a locked decision; reply denormalization follows existing patterns

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (30 days - stable stack, no dependency changes expected)
