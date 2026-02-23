# Phase 1: Message Infrastructure & Read Receipts - Research

**Researched:** 2026-02-23
**Domain:** Firestore schema extension, real-time messaging, read receipt UX
**Confidence:** HIGH

## Summary

Phase 1 extends the existing messaging infrastructure with a `type` discriminator field on messages, adds `readReceipts` to conversation documents, updates Firestore security rules, and ships the first user-visible improvement: iMessage-style read receipts. The existing codebase is well-structured with clear separation of concerns (messageService -> useConversation hook -> ConversationScreen), making surgical extensions straightforward.

The critical insight is that **all read receipt state lives on the conversation document**, not on individual messages. The conversation document is already subscribed to in real-time by both participants via `subscribeToConversations`, so read receipt updates propagate to the sender without any additional listeners. The existing `markConversationRead` function (which already resets `unreadCount`) is the natural place to also write the `readReceipts` timestamp.

The Cloud Function `onNewMessage` already handles `lastMessage` preview text generation and needs extension for new message types. The Firestore security rules currently restrict conversation updates to only `['deletedAt', 'unreadCount']` fields -- this MUST be extended to also allow `readReceipts` updates.

**Primary recommendation:** Extend `markConversationRead` to atomically update both `unreadCount` and `readReceipts` in a single Firestore write, then surface the read state in ConversationScreen via the existing conversation document subscription.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Read Indicator Style:**

- iMessage-style "Read" text label with timestamp (e.g., "Read 2:45 PM")
- "Delivered" state shown before "Read" (two states: Delivered -> Read)
- "Delivered" shows no timestamp, just the word; "Read" includes the time
- Indicator appears only below the sender's most recent sent message (not every message)
- Muted secondary color (#7B7B9E) for both "Delivered" and "Read" text
- Readable sans-serif font (body font, not pixel/retro display font)
- Font size should match existing timestamp styling (~10px)

**Read Trigger Behavior:**

- "Read" triggered when recipient opens the conversation screen (on mount) -- same trigger as current `markConversationRead`
- Real-time updates via Firestore conversation document subscription -- sender sees "Read" appear live
- First-read timestamp only -- if friend re-opens the conversation later, the timestamp does NOT update
- Only mark as read when app is in foreground (not while backgrounded, even if conversation screen was left open)
- Opening from push notification follows the same behavior -- marks read on screen load
- Unread dot in conversation list tied to the read receipt system (clearing one clears the other)
- Auto-dismiss pending push notifications when conversation is opened (existing behavior, keep it)

**Message Type Previews (Conversation List):**

- When YOU sent the last message: show status word instead of message content
  - Text messages: "Sent" (unread by friend) / "Seen" (read by friend)
  - Snap messages: "Delivered" (snap not opened) / "Opened" (snap viewed)
- When FRIEND sent the last message: show descriptive text
  - Text: actual message text
  - GIF: "Sent a GIF" (existing behavior, keep it)
  - Snap: "Sent you a snap"
  - Reaction: "Reacted [emoji] to your message" (shows actual emoji)
  - Reply: show the reply text directly (like a normal message)
  - Tagged photo: "Tagged you in a photo"

**Read Receipt Privacy:**

- Global toggle in Privacy settings (not per-conversation)
- Mutual privacy model: turning off hides YOUR read status AND hides others' read status from you
- When either user has receipts off, sender's messages stay at "Delivered" permanently -- never shows "Read"
- In conversation list, "Seen" is also hidden when receipts off -- stays at "Sent"
- Show explanation when user toggles off: "When you turn off read receipts, you also won't see when others read your messages."
- Default state for new users: read receipts ON
- Toggle stored on user's Firestore profile document

**Read Indicator Animation:**

- "Delivered" fades in after message bubble lands (subtle entrance animation)
- "Delivered" -> "Read [time]" transition uses a subtle fade (200-300ms crossfade)
- Conversation list status transitions ("Sent" -> "Seen") are instant, no animation
- No artificial delay before showing "Delivered" -- appears immediately on Firestore write confirmation

**Conversation List Behavior:**

- Sorted chronologically by last message time (newest first) -- no special unread positioning
- Sending a message updates conversation's last activity time, jumping it to the top
- Unread indicator upgraded from simple 8x8 dot to count badge: cyan circle with white number inside
- Count badge replaces the dot when there are unread messages (shows "1", "2", "3", etc.)

### Claude's Discretion

- Exact animation easing curves and durations
- Badge sizing and positioning relative to conversation row
- "Delivered" confirmation logic (optimistic vs wait for Firestore)
- Privacy settings section layout and toggle component style
- How to handle the `type` field on existing messages that predate the schema update

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                          | Research Support                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| READ-01  | Sender can see "Read" status on their last message when the recipient has opened the conversation                    | ConversationScreen reads conversation doc which will contain `readReceipts[friendId]` timestamp; compare against last sent message `createdAt` to determine Delivered vs Read state |
| READ-02  | Read receipt uses a conversation-level `readReceipts` timestamp (not per-message writes) to minimize Firestore costs | Extended `markConversationRead` writes `readReceipts.[userId]` alongside existing `unreadCount.[userId]` reset -- single Firestore write                                            |
| READ-03  | Read indicator updates in real-time via existing conversation document subscription                                  | Conversation document is already subscribed to via `subscribeToConversations` in useMessages hook; `readReceipts` field changes trigger snapshot callbacks automatically            |
| INFRA-01 | Firestore security rules updated to allow snap `viewedAt` updates by recipient                                       | New message update rule for `viewedAt` and `screenshotted` fields restricted to conversation participants who are NOT the sender                                                    |
| INFRA-02 | Firestore security rules updated to allow `readReceipts` field updates on conversation documents                     | Extend existing conversation update rule `hasOnly` list from `['deletedAt', 'unreadCount']` to `['deletedAt', 'unreadCount', 'readReceipts']`                                       |

</phase_requirements>

## Standard Stack

### Core (Already Installed)

| Library                            | Version  | Purpose                                      | Why Standard                                                                  |
| ---------------------------------- | -------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `@react-native-firebase/firestore` | ^23.8.6  | Firestore reads/writes/subscriptions         | Project's established Firebase SDK                                            |
| `@react-native-firebase/auth`      | ^23.8.6  | User authentication state                    | Auth state drives read receipt logic                                          |
| `react-native` (Animated API)      | 0.81.5   | Fade animations for Delivered/Read indicator | Project uses RN core Animated for simple animations (see PixelToggle pattern) |
| `date-fns`                         | ^4.1.0   | Timestamp formatting ("2:45 PM")             | Already used in ConversationRow for `formatMessageTime`                       |
| `expo-notifications`               | ~0.32.16 | Notification dismissal on conversation open  | Already used in useConversation hook                                          |

### Supporting (Already Installed)

| Library                   | Version | Purpose                                      | When to Use                                                                  |
| ------------------------- | ------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `react-native-reanimated` | ~4.1.1  | Complex gesture animations                   | NOT needed for this phase -- RN core Animated is sufficient for simple fades |
| `expo-image`              | ~3.0.11 | Profile photo rendering in conversation list | Already used in ConversationRow for avatars                                  |

### No New Dependencies Required

This phase requires zero new npm packages. All functionality is achievable with the existing stack.

**Installation:** None needed.

## Architecture Patterns

### Recommended File Changes

```
src/
├── services/firebase/
│   └── messageService.js         # EXTEND: markConversationRead adds readReceipts timestamp
├── hooks/
│   └── useConversation.js        # EXTEND: subscribe to conversation doc for read state
├── screens/
│   ├── ConversationScreen.js     # EXTEND: render ReadReceiptIndicator below last sent message
│   └── SettingsScreen.js         # EXTEND: add "Read Receipts" toggle to Privacy section
├── components/
│   ├── ReadReceiptIndicator.js   # NEW: "Delivered" / "Read 2:45 PM" text component
│   ├── ConversationRow.js        # EXTEND: status preview text + count badge
│   └── MessageBubble.js          # MINOR: no changes needed (indicator is outside bubble)
├── constants/
│   └── colors.js                 # REFERENCE ONLY: use existing colors.text.secondary (#7B7B9E)
functions/
├── index.js                      # EXTEND: onNewMessage to handle new message type previews
firestore.rules                   # EXTEND: conversation update and message update rules
```

### Pattern 1: Conversation-Level Read Receipts

**What:** Store a per-user `lastReadAt` timestamp on the conversation document rather than marking individual messages as read.
**When to use:** Always -- this is the only approach for this project (per CONTEXT.md decision).
**Example:**

```javascript
// messageService.js - Extended markConversationRead
export const markConversationRead = async (conversationId, userId) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  await updateDoc(conversationRef, {
    [`unreadCount.${userId}`]: 0,
    [`readReceipts.${userId}`]: serverTimestamp(),
  });
  return { success: true };
};
```

### Pattern 2: First-Read-Only Semantics

**What:** Only write `readReceipts` if the current value is null or if there are unread messages.
**When to use:** To satisfy the "first-read timestamp does NOT update on re-opens" requirement.
**Example:**

```javascript
// useConversation.js - mark as read only when there are unread messages
useEffect(() => {
  if (!conversationId || !currentUserId) return;
  // Only mark read if there are actually unread messages
  // This prevents overwriting the readReceipts timestamp on re-opens
  if (hasUnreadMessages) {
    markConversationRead(conversationId, currentUserId);
  }
  dismissConversationNotifications(conversationId);
}, [conversationId, currentUserId, hasUnreadMessages]);
```

### Pattern 3: Deriving Read State from Conversation Doc

**What:** Determine Delivered vs Read by comparing `readReceipts[friendId]` against the last sent message timestamp.
**When to use:** In ConversationScreen to decide which indicator text to show.
**Example:**

```javascript
// ConversationScreen - derive read status
const friendReadAt = conversationDoc?.readReceipts?.[friendId];
const lastSentMessage = messages.find(m => m.senderId === currentUserId);
const isRead =
  friendReadAt &&
  lastSentMessage?.createdAt &&
  friendReadAt.toMillis() >= lastSentMessage.createdAt.toMillis();
```

### Pattern 4: Privacy-Aware Read Receipts

**What:** Check both users' `readReceiptsEnabled` profile field before showing read state.
**When to use:** Before displaying "Read" indicator and before writing `readReceipts` timestamp.
**Example:**

```javascript
// The sender sees "Read" only if BOTH users have receipts enabled
const senderEnabled = currentUserProfile?.readReceiptsEnabled !== false;
const recipientEnabled = friendProfile?.readReceiptsEnabled !== false;
const showReadStatus = senderEnabled && recipientEnabled;
```

### Pattern 5: Conversation List Status Preview

**What:** Replace message text preview with status words when the current user is the sender.
**When to use:** In ConversationRow when `lastMessage.senderId === currentUserId`.
**Example:**

```javascript
const getPreviewText = () => {
  if (!lastMessage) return 'No messages yet';

  // When I sent the last message: show status
  if (lastMessage.senderId === currentUserId) {
    const friendReadAt = conversation.readReceipts?.[friendId];
    const isRead =
      friendReadAt &&
      lastMessage.timestamp &&
      friendReadAt.toMillis?.() >= lastMessage.timestamp.toMillis?.();

    if (lastMessage.type === 'text' || lastMessage.type === 'gif') {
      return isRead ? 'Seen' : 'Sent';
    }
    // Future: snap type returns 'Opened' / 'Delivered'
  }

  // When friend sent: show content
  if (lastMessage.type === 'gif') return 'Sent a GIF';
  return lastMessage.text || 'No messages yet';
};
```

### Anti-Patterns to Avoid

- **Per-message read tracking:** NEVER write a `readAt` field on individual message documents. This causes N writes per conversation open and violates INFRA requirement. The conversation-level approach requires exactly 1 write.
- **Overwriting readReceipts on every open:** Do NOT blindly call `markConversationRead` every time the screen mounts. Check if there are actually unread messages first. Otherwise, the "first-read timestamp" requirement is violated.
- **Separate listener for read receipts:** Do NOT create a new Firestore subscription for read state. The conversation document is already subscribed to -- piggyback on it.
- **Blocking on friend profile fetch for privacy check:** Do NOT make an extra Firestore read to check the friend's `readReceiptsEnabled` on every message. Cache the friend profile (useMessages already caches friend profiles) and read from cache.

## Don't Hand-Roll

| Problem                        | Don't Build               | Use Instead                        | Why                                                                                                               |
| ------------------------------ | ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Timestamp formatting           | Custom date formatter     | `date-fns format(date, 'h:mm a')`  | Already used in ConversationRow and MessageBubble; handles AM/PM, locale-aware                                    |
| Toggle component               | Custom switch UI          | Existing `PixelToggle` component   | Already matches the retro UI theme, handles animation, accessibility                                              |
| Fade animation                 | Custom opacity management | `Animated.timing` from RN core     | Already the established pattern in PixelToggle; 200-300ms duration aligns with `animations.duration.slow` (250ms) |
| Real-time conversation updates | Custom polling            | Existing `onSnapshot` subscription | `subscribeToConversations` already handles this; `readReceipts` field changes fire automatically                  |

**Key insight:** This phase is primarily about extending existing infrastructure, not building new systems. Every service function, hook, and component already exists -- they just need surgical additions.

## Common Pitfalls

### Pitfall 1: Firestore Rules Block readReceipts Updates

**What goes wrong:** Client writes to `readReceipts.[userId]` are rejected with `permission-denied` error.
**Why it happens:** Current Firestore rules restrict conversation updates to `hasOnly(['deletedAt', 'unreadCount'])`. The `readReceipts` field is not in this allowlist.
**How to avoid:** Update `firestore.rules` to add `readReceipts` to the allowed fields list BEFORE implementing client-side writes.
**Warning signs:** `markConversationRead` fails silently (the function returns `{ success: false }` but the error may be swallowed).

### Pitfall 2: readReceipts Timestamp Overwrites on Re-open

**What goes wrong:** User opens conversation, sees "Read 2:45 PM". Later re-opens. Timestamp changes to "Read 5:30 PM".
**Why it happens:** `markConversationRead` is called on every mount without checking if there are unread messages.
**How to avoid:** Only call `markConversationRead` when `unreadCount[userId] > 0`. If unreadCount is 0, skip the write entirely. This preserves the original read timestamp.
**Warning signs:** Read timestamps keep changing even though no new messages were sent.

### Pitfall 3: Race Condition Between Message Send and Read Receipt Check

**What goes wrong:** User A sends a message. User B opens the conversation. The `readReceipts` timestamp is written, but the `onNewMessage` cloud function hasn't yet updated `unreadCount`. The read receipt timestamp is stale.
**Why it happens:** Cloud Function `onNewMessage` updates `unreadCount` asynchronously after the message write.
**How to avoid:** The read receipt comparison uses the friend's `readReceipts` timestamp against the message's `createdAt`, NOT the `unreadCount`. This makes the logic resilient to cloud function timing.
**Warning signs:** "Read" indicator flickers or shows incorrectly for rapidly sent messages.

### Pitfall 4: Conversation Document Missing readReceipts Field

**What goes wrong:** Existing conversations created before this update don't have a `readReceipts` field. Reading `conversation.readReceipts?.[friendId]` returns `undefined`, which is falsy -- correctly defaulting to "Delivered" state.
**Why it happens:** Firestore documents are schemaless; old docs won't have the new field.
**How to avoid:** Always use optional chaining (`?.`) when accessing `readReceipts`. The `undefined` -> falsy behavior is actually correct: old conversations start in "Delivered" state until the recipient opens them.
**Warning signs:** Crashes on `readReceipts.toMillis()` if not guarded with `?.`.

### Pitfall 5: Existing Messages Missing `type` Field

**What goes wrong:** Messages created before the schema update may not have an explicit `type` field, or have `type` as `'text'` or `'gif'` only.
**Why it happens:** The current `sendMessage` function already sets `type` as `'text'` or `'gif'`, so existing messages DO have the field. However, the `lastMessage` object on some conversation docs may not include `type` if they predate the `onNewMessage` function update.
**How to avoid:** Default to `'text'` when `type` is missing: `const msgType = lastMessage?.type || 'text'`. This is safe because the only pre-existing types are text and gif.
**Warning signs:** Conversation list shows wrong preview text for old conversations.

### Pitfall 6: Privacy Toggle Not Fetched for Friend

**What goes wrong:** The sender sees "Read" even though the friend has read receipts turned off.
**Why it happens:** Only the current user's profile is checked; the friend's `readReceiptsEnabled` field is not available.
**How to avoid:** The `useMessages` hook already caches friend profiles. Add `readReceiptsEnabled` to the cached friend profile fields. In ConversationScreen, receive the friend profile from route params (already passed) and check the field.
**Warning signs:** Privacy toggle seems to not work from the friend's perspective.

### Pitfall 7: Count Badge Overflow for Large Numbers

**What goes wrong:** Badge shows "999" which overflows the circular badge container.
**Why it happens:** Very active conversations can accumulate large unread counts.
**How to avoid:** Cap display at "99+" for counts above 99. The underlying count remains accurate in Firestore; only the display is capped.
**Warning signs:** Badge text extends beyond the circular container on small screens.

## Code Examples

Verified patterns from the existing codebase:

### Extended markConversationRead

```javascript
// Source: Existing messageService.js pattern, extended per ARCHITECTURE.md
export const markConversationRead = async (conversationId, userId) => {
  try {
    if (!conversationId || !userId) {
      return { success: false, error: 'Missing required fields' };
    }

    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0,
      [`readReceipts.${userId}`]: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    logger.error('messageService.markConversationRead: Failed', {
      conversationId,
      userId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
};
```

### ReadReceiptIndicator Component

```javascript
// Source: Project animation pattern from PixelToggle.js + colors.text.secondary
import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';

const ReadReceiptIndicator = ({ isRead, readAt, visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250, // animations.duration.slow
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacity]);

  // Crossfade when status changes from Delivered to Read
  useEffect(() => {
    if (isRead) {
      // Brief fade out then fade in for crossfade effect
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [isRead, opacity]);

  const statusText = isRead ? `Read ${format(readAt.toDate(), 'h:mm a')}` : 'Delivered';

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.text}>{statusText}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  text: {
    fontSize: 10, // Match existing timestamp styling
    color: '#7B7B9E', // colors.text.secondary (muted)
    fontFamily: 'SpaceMono_400Regular', // typography.fontFamily.readable
  },
});
```

### Firestore Rules Extension

```
// firestore.rules - Conversation update rule
allow update: if isConversationMemberById(conversationId) &&
                 request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['deletedAt', 'unreadCount', 'readReceipts']);

// Message update rule for snap fields (INFRA-01)
// Only recipient (NOT sender) can update viewedAt and screenshotted
match /messages/{messageId} {
  allow read: if isConversationMemberById(conversationId);
  allow create: if isConversationMemberById(conversationId) &&
                   request.resource.data.senderId == request.auth.uid &&
                   request.resource.data.keys().hasAll(['senderId', 'type', 'createdAt']);
  allow update: if isConversationMemberById(conversationId) &&
                   resource.data.senderId != request.auth.uid &&
                   request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['viewedAt', 'screenshotted']);
  allow delete: if false;
}
```

### Unread Count Badge

```javascript
// ConversationRow - Replace dot with count badge
const UnreadBadge = ({ count }) => {
  if (!count || count <= 0) return null;
  const displayCount = count > 99 ? '99+' : String(count);
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.badgeText}>{displayCount}</Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00D4FF', // colors.interactive.primary (cyan)
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 10,
    color: '#0A0A1A', // colors.text.inverse (dark on cyan)
    fontFamily: 'SpaceMono_700Bold', // typography.fontFamily.readableBold
    fontWeight: '700',
  },
});
```

### Privacy Toggle in Settings

```javascript
// SettingsScreen.js - Add to Privacy section
{
  id: 'readReceipts',
  label: 'Read Receipts',
  icon: 'eye-outline',
  isToggle: true,
  value: userProfile?.readReceiptsEnabled !== false,  // Default ON
  onToggle: async (newValue) => {
    await updateDoc(doc(db, 'users', user.uid), {
      readReceiptsEnabled: newValue,
    });
    updateUserProfile({ ...userProfile, readReceiptsEnabled: newValue });
  },
  subtitle: 'When off, you won\'t send or receive read receipts',
}
```

## State of the Art

| Old Approach                 | Current Approach                            | When Changed                               | Impact                                                                 |
| ---------------------------- | ------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Per-message `readBy` array   | Conversation-level `readReceipts` timestamp | Project architecture decision (2026-02-23) | 1 write per open instead of N writes per message; lower Firestore cost |
| Simple unread dot            | Count badge with number                     | Phase 1 upgrade                            | Users see "how much did I miss" at a glance                            |
| Message text preview for all | Status word for own messages                | Phase 1 upgrade                            | Snapchat-style "Sent"/"Seen" for your own messages                     |

**Deprecated/outdated:**

- The `unreadDot` style in ConversationRow (8x8 cyan dot) will be replaced by the count badge component.

## Discretion Recommendations

### Animation Easing and Duration

**Recommendation:** Use `animations.duration.slow` (250ms) for both fade-in and crossfade. This aligns with the existing PixelToggle animation timing and provides a noticeable but non-distracting transition. Use `useNativeDriver: true` for opacity animations (supported).

### Badge Sizing and Positioning

**Recommendation:** 18px minimum width/height circle, centered in the `rightColumn` of ConversationRow (same position as current `unreadDot`). For single-digit counts, the circle is perfectly round. For double-digit counts (10-99), the pill shape expands horizontally with 4px padding. Cap at "99+".

### "Delivered" Confirmation Logic

**Recommendation:** Show "Delivered" optimistically as soon as `sendMessage` succeeds (the `addDoc` promise resolves). Do NOT wait for the Cloud Function to update the conversation metadata. The message is in Firestore at that point, which is sufficient for "delivered" semantics. This avoids a visible delay between sending and seeing "Delivered".

### Privacy Settings Layout

**Recommendation:** Add "Read Receipts" as a toggle item in the existing "Privacy" section of SettingsScreen, positioned after "Sync Contacts" and before "Blocked Users". Use the existing `PixelToggle` component. Show an explanation Alert when toggling off: "When you turn off read receipts, you also won't see when others read your messages."

### Handling Existing Messages Without `type` Field

**Recommendation:** All existing messages already have a `type` field (`'text'` or `'gif'`) because the current `sendMessage` function always sets it. For `lastMessage` objects on conversation documents, default to `'text'` when missing: `lastMessage?.type || 'text'`. No migration needed.

## Open Questions

1. **Should markConversationRead skip the write when already read?**
   - What we know: The requirement says "first-read timestamp only". Currently `markConversationRead` always writes.
   - What's unclear: Should we check unreadCount client-side before calling, or should the service function itself check?
   - Recommendation: Check client-side in the hook. The hook already has access to `unreadCount` from the conversation data. Only call `markConversationRead` when `unreadCount > 0`. This avoids an unnecessary Firestore write on every re-open.

2. **How to get conversation doc data into ConversationScreen?**
   - What we know: ConversationScreen currently only subscribes to messages via `useConversation`. It does not subscribe to the conversation document itself.
   - What's unclear: Should we add a conversation document subscription to `useConversation`, or pass it from `useMessages` via navigation params?
   - Recommendation: Add a lightweight `onSnapshot` subscription to the conversation document within `useConversation` hook. This provides real-time `readReceipts` updates to the sender while they are in the conversation. The subscription cleanup is already handled by the hook's useEffect pattern.

3. **When to show "Delivered" for the very first message?**
   - What we know: "Delivered" should appear after the message is successfully written to Firestore.
   - What's unclear: The sender sees their own message appear via the real-time subscription. At that point, should "Delivered" appear immediately?
   - Recommendation: Show "Delivered" once the message appears in the local message list (real-time subscription fires). The `sendMessage` function resolves before the subscription fires, so use the subscription callback as the "delivered" signal.

## Validation Architecture

### Test Framework

| Property                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Framework               | Jest 29.7 with jest-expo preset (client) + Jest 29.7 with node env (functions) |
| Config file (client)    | `jest.config.js`                                                               |
| Config file (functions) | `functions/jest.config.js`                                                     |
| Quick run command       | `npx jest __tests__/services/messageService.test.js --no-coverage`             |
| Full suite command      | `npm test`                                                                     |
| Estimated runtime       | ~15 seconds (client) + ~5 seconds (functions)                                  |

### Phase Requirements -> Test Map

| Req ID   | Behavior                                                        | Test Type   | Automated Command                                                                            | File Exists?                                                    |
| -------- | --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| READ-01  | markConversationRead writes readReceipts timestamp              | unit        | `npx jest __tests__/services/messageService.test.js -t "readReceipts" --no-coverage`         | No - Wave 0 gap                                                 |
| READ-02  | Read receipt uses conversation-level timestamp, not per-message | unit        | `npx jest __tests__/services/messageService.test.js -t "markConversationRead" --no-coverage` | No - existing test file may exist but needs new test cases      |
| READ-03  | Real-time updates via conversation subscription                 | unit        | `npx jest __tests__/hooks/useConversation.test.js --no-coverage`                             | No - Wave 0 gap                                                 |
| INFRA-01 | Firestore rules allow snap viewedAt updates                     | manual-only | Deploy rules with `firebase deploy --only firestore:rules` and test in Firebase console      | N/A - rules are tested via Firestore emulator or manual testing |
| INFRA-02 | Firestore rules allow readReceipts field updates                | manual-only | Deploy rules with `firebase deploy --only firestore:rules` and test in Firebase console      | N/A - rules are tested via Firestore emulator or manual testing |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task -> run: `npx jest __tests__/services/ --no-coverage`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `__tests__/services/messageService.test.js` -- may need new test cases for readReceipts in markConversationRead (file may already exist, needs extending)
- [ ] `__tests__/hooks/useConversation.test.js` -- covers conversation doc subscription and read state derivation
- [ ] `__tests__/components/ReadReceiptIndicator.test.js` -- covers Delivered/Read display logic and privacy gating
- [ ] `__tests__/components/ConversationRow.test.js` -- covers status preview text and count badge rendering

## Sources

### Primary (HIGH confidence)

- **Existing codebase** - `src/services/firebase/messageService.js`, `src/hooks/useConversation.js`, `src/hooks/useMessages.js`, `src/screens/ConversationScreen.js`, `src/components/ConversationRow.js`, `src/components/MessageBubble.js` -- full source read
- **Existing Firestore rules** - `firestore.rules` -- current conversation update rule confirmed as `hasOnly(['deletedAt', 'unreadCount'])`
- **Existing Cloud Function** - `functions/index.js` lines 2618-2738 -- `onNewMessage` handler fully reviewed
- **Architecture research** - `.planning/research/ARCHITECTURE.md` -- `readReceipts` conversation schema extension and rationale confirmed
- **CONTEXT.md** - `.planning/phases/01-message-infrastructure-read-receipts/01-CONTEXT.md` -- all user decisions

### Secondary (MEDIUM confidence)

- **React Native Animated API** - Used throughout codebase (PixelToggle, InAppNotificationBanner); `Animated.timing` with `useNativeDriver: true` for opacity confirmed working
- **date-fns format** - Used in ConversationRow (`formatMessageTime`) and MessageBubble (`format(date, 'h:mm a')`) -- pattern verified in codebase

### Tertiary (LOW confidence)

- None -- all findings verified against existing codebase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already installed and used in existing messaging code
- Architecture: HIGH - Schema extension matches architecture research doc; patterns follow existing codebase conventions
- Pitfalls: HIGH - Derived from direct code review (Firestore rules allowlist, markConversationRead behavior, optional chaining needs)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable -- no expected library changes)
