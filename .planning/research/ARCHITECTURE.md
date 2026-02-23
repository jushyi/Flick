# Architecture Research: Advanced Messaging Features

**Domain:** Social messaging (ephemeral snaps, streaks, reactions, read receipts, replies, photo tag integration)
**Researched:** 2026-02-23
**Confidence:** HIGH (existing codebase is well-documented; Firestore patterns are established; expo-screen-capture verified via official docs)

## System Overview

The new messaging features extend the existing layered architecture without replacing it. Every new component slots into an existing layer (service, hook, component, cloud function) and follows established patterns.

```
+------------------------------------------------------------------+
|                     SCREENS (UI Layer)                            |
|  ConversationScreen  CameraScreen  MessagesListScreen            |
|  [extend existing]   [add snap mode] [add streak indicators]     |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                     HOOKS (Business Logic)                       |
|  useConversation   useStreaks    useSnapCamera   useMessages     |
|  [extend]          [NEW]        [NEW]            [extend]        |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                   SERVICES (Firebase Abstraction)                 |
|  messageService   streakService  snapService   storageService    |
|  [extend]         [NEW]          [NEW]         [extend]          |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                   CLOUD FUNCTIONS (Server-side)                   |
|  onNewMessage     processStreaks  cleanupSnaps   onSnapViewed    |
|  [extend]         [NEW scheduled] [NEW scheduled] [NEW trigger]  |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                   FIRESTORE + STORAGE                             |
|  conversations/   streaks/        snap-photos/                   |
|  [schema extend]  [NEW collection] [NEW storage path]            |
+------------------------------------------------------------------+
```

### Component Responsibilities

| Component                                  | Responsibility                                                                             | Communicates With                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `snapService.js` (NEW)                     | Upload snap photos, create snap messages, mark as viewed, track screenshot events          | storageService, messageService, Cloud Functions |
| `streakService.js` (NEW)                   | Read/write streak documents, calculate streak state, check expiry warnings                 | Firestore streaks collection, Cloud Functions   |
| `useSnapCamera` hook (NEW)                 | Snap camera UI state, capture flow, caption input, send-to-friend selection                | snapService, useCamera (shared utilities)       |
| `useStreaks` hook (NEW)                    | Real-time streak subscription for a user pair, countdown timer for expiry, streak status   | streakService                                   |
| `useConversation` hook (EXTEND)            | Add snap message rendering, reaction overlay state, reply-to state, read receipt tracking  | messageService (extended)                       |
| `useMessages` hook (EXTEND)                | Add streak indicators to conversation list, snap unread badges                             | streakService, messageService                   |
| `MessageBubble` (EXTEND)                   | Render snap, reaction, reply message types alongside existing text/gif types               | N/A (presentational)                            |
| `SnapViewer` component (NEW)               | Full-screen snap display with timer, screenshot detection, caption overlay                 | expo-screen-capture, snapService                |
| `ReactionPicker` component (NEW)           | Emoji tapback overlay on long-press of message bubble                                      | messageService                                  |
| `ReplyPreview` component (NEW)             | Quoted message preview above input when replying                                           | N/A (presentational)                            |
| `onNewMessage` Cloud Function (EXTEND)     | Handle new message types (snap, reaction, reply), update streak state, route notifications | Firestore, FCM                                  |
| `processStreakExpiry` Cloud Function (NEW) | Scheduled: check for expired streaks, send warning notifications                           | Firestore streaks, FCM                          |
| `cleanupViewedSnaps` Cloud Function (NEW)  | Scheduled: delete viewed snap photos from Storage, remove expired snap documents           | Firebase Storage, Firestore                     |

## Firestore Schema Extensions

### Extended: `conversations/{conversationId}/messages/{messageId}`

Current schema supports `type: 'text' | 'gif'`. Extend to support new message types.

```javascript
// Snap message
{
  senderId: string,
  type: 'snap',                    // NEW type
  snapURL: string,                 // Firebase Storage URL (snap-photos/{senderId}/{messageId}.jpg)
  caption: string | null,          // Optional caption text
  viewedAt: Timestamp | null,      // When recipient opened it (null = unviewed)
  expiresAt: Timestamp,            // TTL field: auto-delete after viewing + buffer
  screenshotted: boolean,          // Set to true if recipient screenshotted
  createdAt: Timestamp,
  // text: null, gifUrl: null      // Existing fields remain null for snaps
}

// Reaction message (tapback on another message)
{
  senderId: string,
  type: 'reaction',                // NEW type
  reactionEmoji: string,           // The emoji used (e.g., heart, laughing, fire)
  targetMessageId: string,         // The message being reacted to
  createdAt: Timestamp,
}

// Reply message (quote reply)
{
  senderId: string,
  type: 'text',                    // Still a text message
  text: string,
  replyTo: {                       // NEW field: null for non-replies
    messageId: string,
    senderId: string,
    preview: string,               // Truncated text/type label of original message
    type: string,                  // Original message type for rendering
  } | null,
  createdAt: Timestamp,
}
```

**Why reactions are message documents, not a map on the target message:**
The current Firestore rules make messages immutable after creation (`allow update, delete: if false`). Storing reactions as separate message documents (type: 'reaction') avoids changing this security model. The Cloud Function can aggregate reaction counts on the target message using the admin SDK if needed for display. This also gives reactions their own timestamps for proper ordering in the chat timeline.

### Extended: `conversations/{conversationId}`

```javascript
{
  // EXISTING fields unchanged
  participants: [string, string],
  lastMessage: {
    text: string,                  // Extended: "Sent a snap", "Reacted [emoji]", etc.
    senderId: string,
    timestamp: Timestamp,
    type: string,                  // Extended: 'text' | 'gif' | 'snap' | 'reaction'
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt: { [userId]: Timestamp | null },
  unreadCount: { [userId]: number },

  // NEW fields
  readReceipts: {                  // NEW: per-user last-read timestamp
    [userId]: Timestamp,           // Last time user read messages in this conversation
  },
}
```

**Why `readReceipts` lives on the conversation document:**
Read receipts are a per-conversation, per-user value updated frequently (every time the user opens the conversation). Storing it on the conversation document avoids creating extra subcollection documents. The existing `markConversationRead` already updates the conversation doc, so adding a `readReceipts` field there is a natural extension. The conversation document is already subscribed to in real-time by both participants, so the other user sees read receipt updates without any additional listener.

### NEW: `streaks/{streakId}` (root collection)

Document ID format: `[lowerUserId]_[higherUserId]` (deterministic, matches conversation ID pattern).

```javascript
{
  participants: [string, string],  // Same as conversation participants
  count: number,                   // Current streak day count (0 = no active streak)
  startedAt: Timestamp | null,     // When the current streak began (null if count=0)
  lastSnapBy: {                    // Track who sent snaps today
    [userId]: Timestamp,           // Last snap sent by this user (for the current day)
  },
  lastMutualDay: string | null,    // "YYYY-MM-DD" of last day both users sent snaps
  expiresAt: Timestamp | null,     // When the streak will expire if no mutual snap
  status: 'inactive' | 'building' | 'active' | 'warning',
  // 'inactive': count=0, no recent snaps
  // 'building': 1-2 consecutive mutual days (not yet 3-day threshold)
  // 'active': 3+ consecutive mutual days (streak is alive)
  // 'warning': active streak but approaching expiry (within 4 hours)
  longestStreak: number,           // All-time longest streak between these two users
  updatedAt: Timestamp,
}
```

**Why a root collection instead of a field on conversations:**
Streaks need to be queried independently of conversations (e.g., "all streaks about to expire" for the scheduled function, "all active streaks for a user" for the profile). A subcollection under conversations would work but limits query flexibility. A root collection with the same deterministic ID pattern keeps it simple and queryable.

**Streak state machine:**

```
inactive --[user A sends snap]--> building (waiting for B)
building --[user B sends snap same day]--> building (day 1 mutual)
building --[3 consecutive mutual days]--> active (streak=3, fire emoji)
active   --[within 4 hours of expiry]--> warning (hourglass emoji)
warning  --[mutual snap before expiry]--> active (streak increments)
active/warning --[24h without mutual snap]--> inactive (streak resets to 0)
```

### NEW: Firebase Storage path for snaps

```
snap-photos/{senderId}/{messageId}.jpg
```

**Why separate from `photos/`:**
Snap photos are ephemeral -- they need different storage rules (any authenticated participant can read, not just the owner), different lifecycle (auto-deleted after viewing), and different compression settings (lower quality is acceptable for ephemeral content). Keeping them in a separate path makes Storage rules and cleanup functions cleaner.

### Extended: Firestore Security Rules

```
// Snap photos in Storage -- participants can read
match /snap-photos/{userId}/{allPaths=**} {
  allow read: if isAuthenticated();  // Simplified: snaps are short-lived
  allow write: if isAuthenticated() && isOwner(userId)
               && request.resource.contentType.matches('image/.*')
               && request.resource.size < 5 * 1024 * 1024;  // 5MB max for snaps
}

// Streaks collection
match /streaks/{streakId} {
  // Read: Only participants (uses same ID parsing as conversations)
  allow read: if isConversationMemberById(streakId);

  // Create: Only participants, with required fields
  allow create: if isConversationMemberById(streakId) &&
                   request.resource.data.participants.hasAll([request.auth.uid]);

  // Update: Only participants can update snap tracking fields
  // Cloud Functions handle count/status updates via admin SDK
  allow update: if isConversationMemberById(streakId) &&
                   request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['lastSnapBy']);

  allow delete: if false;
}

// Messages: extend to allow updates for snap viewing
// Change from current "allow update, delete: if false"
match /messages/{messageId} {
  allow read: if isConversationMemberById(conversationId);
  allow create: if isConversationMemberById(conversationId) &&
                   request.resource.data.senderId == request.auth.uid;
  // NEW: Allow recipient to update viewedAt and screenshotted on snap messages
  allow update: if isConversationMemberById(conversationId) &&
                   request.auth.uid != resource.data.senderId &&
                   resource.data.type == 'snap' &&
                   request.resource.data.diff(resource.data).affectedKeys()
                     .hasOnly(['viewedAt', 'screenshotted']);
  allow delete: if false;
}

// Conversations: extend updateable fields to include readReceipts
allow update: if isConversationMemberById(conversationId) &&
                 request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['deletedAt', 'unreadCount', 'readReceipts']);
```

## Data Flow

### Snap Photo Send Flow

```
[CameraScreen: Snap Mode]
    |
    | 1. User captures photo, selects friend, adds optional caption
    v
[snapService.sendSnap(friendId, photoUri, caption)]
    |
    | 2. Compress image (lower quality than feed photos)
    | 3. Upload to snap-photos/{userId}/{messageId}.jpg
    | 4. Create snap message document in conversation
    v
[Firestore: conversations/{id}/messages/{id}]
    |
    | 5. onNewMessage Cloud Function fires
    v
[Cloud Function: onNewMessage]
    |
    | 6. Detect type='snap', update lastMessage preview to "Sent a snap"
    | 7. Increment recipient's unreadCount
    | 8. Update streak tracking: streaks/{id}.lastSnapBy.{senderId} = now
    | 9. If both users have sent snaps today, increment streak count
    | 10. Send push notification with snap-specific template
    v
[Recipient's ConversationScreen]
    |
    | 11. Real-time listener picks up new snap message
    | 12. Snap renders as "tap to view" bubble (blurred thumbnail)
    v
[User taps snap bubble]
    |
    | 13. SnapViewer opens full-screen
    | 14. expo-screen-capture: preventScreenCaptureAsync + addScreenshotListener
    | 15. Timer starts (configurable, e.g., 10 seconds)
    | 16. Update message: viewedAt = serverTimestamp()
    v
[Snap viewed / timer expires]
    |
    | 17. allowScreenCaptureAsync (re-enable capture)
    | 18. SnapViewer closes, message shows "Opened" state
    | 19. Cloud Function: set expiresAt for TTL cleanup (viewedAt + 24h buffer)
    v
[cleanupViewedSnaps scheduled function]
    |
    | 20. Delete snap photo from Storage
    | 21. Optionally clear snapURL from message document
```

### Streak Lifecycle Flow

```
[User A sends snap to User B]
    |
    v
[onNewMessage Cloud Function]
    |
    | 1. Read streaks/{A_B} document
    | 2. Update lastSnapBy.{A} = now
    | 3. Check: has B also sent snap today?
    |     NO  --> status stays as-is, expiresAt = end of tomorrow
    |     YES --> mutual day! Increment count, update lastMutualDay
    |             If count >= 3 and status != 'active' --> status = 'active'
    v
[processStreakExpiry scheduled function -- runs every 30 minutes]
    |
    | 1. Query: streaks where status in ['building','active','warning']
    |    AND expiresAt < now
    | 2. For expired streaks: reset count=0, status='inactive'
    |
    | 3. Query: streaks where status='active'
    |    AND expiresAt < now + 4 hours
    | 4. For about-to-expire: status='warning', send push notification
    v
[Client: useStreaks hook]
    |
    | 1. Subscribe to streaks/{A_B} document
    | 2. Derive UI state: fire emoji + count, hourglass warning, or nothing
    | 3. Countdown timer for warning state
```

### Reaction Flow

```
[User long-presses message bubble]
    |
    v
[ReactionPicker overlay appears]
    |
    | 1. User taps emoji (heart, fire, laugh, thumbs-up, sad, wow)
    v
[messageService.sendReaction(conversationId, targetMessageId, emoji)]
    |
    | 2. Create new message: { type: 'reaction', reactionEmoji, targetMessageId }
    v
[onNewMessage Cloud Function]
    |
    | 3. Detect type='reaction'
    | 4. Update lastMessage preview: "Reacted [emoji] to a message"
    | 5. Send push notification to recipient
    v
[Real-time: both users see reaction appear]
    |
    | 6. useConversation hook groups reactions with their target messages
    | 7. MessageBubble renders reaction badges below the target message
```

### Read Receipt Flow

```
[User opens ConversationScreen]
    |
    v
[useConversation: markConversationRead]
    |
    | 1. Update conversations/{id}.unreadCount.{userId} = 0  (existing)
    | 2. Update conversations/{id}.readReceipts.{userId} = serverTimestamp()  (NEW)
    v
[Other user's ConversationScreen]
    |
    | 1. Real-time subscription on conversation document picks up readReceipts change
    | 2. Compare readReceipts.{friendId} with each message's createdAt
    | 3. Show "Read" indicator below the last message the friend has read
```

### Quote Reply Flow

```
[User swipes right on a message (or taps reply button)]
    |
    v
[DMInput shows ReplyPreview banner above text input]
    |
    | 1. replyTo state set: { messageId, senderId, preview, type }
    v
[User types reply text and sends]
    |
    v
[messageService.sendMessage extended]
    |
    | 2. Create message with replyTo field populated
    v
[Real-time: MessageBubble renders with quoted message preview above]
```

### Screenshot Detection Flow

```
[SnapViewer component mounts]
    |
    v
[expo-screen-capture: preventScreenCaptureAsync('snap-viewer')]
[expo-screen-capture: addScreenshotListener(callback)]
    |
    | On screenshot detected:
    | 1. Update message: screenshotted = true
    | 2. Show toast to screenshotter: "Screenshot captured"
    v
[Cloud Function or client-side]
    |
    | 3. Send notification to sender: "[Name] took a screenshot of your snap"
    | 4. Sender's conversation shows "Screenshotted" label on that snap
    v
[SnapViewer unmounts]
    |
    | cleanup: allowScreenCaptureAsync('snap-viewer')
    | cleanup: removeScreenshotListener
```

### Tagged Photo to DM Flow

```
[DarkroomScreen: User tags friends on photo during triage]
    |
    | (existing tagging flow -- writes taggedUserIds to photo document)
    v
[onPhotoTagged Cloud Function -- extend existing tag notification trigger]
    |
    | 1. For each tagged user: check if conversation exists
    | 2. Create auto-message in conversation:
    |    { type: 'tagged_photo', photoId, senderId, text: null }
    v
[Recipient sees tagged photo message in DM thread]
    |
    | Message renders as photo card with "Tagged you in a photo" label
    | Tap opens PhotoDetail modal
    |
    | "Add to feed" button on the tagged photo message
    v
[addTaggedPhotoToFeed service function]
    |
    | 1. Create new photo document for recipient with:
    |    - attribution: { originalPhotoId, photographerId, photographerName }
    |    - status: 'revealed' (skip darkroom)
    |    - photoState: 'journal'
    | 2. Copy image to recipient's Storage path (or reference original)
    | 3. Message updates to show "Added to feed" state
```

## Architectural Patterns

### Pattern 1: Message Type Polymorphism

**What:** All message types (text, gif, snap, reaction, reply, tagged_photo) share the same messages subcollection with a `type` discriminator field. Each type has its own optional fields.

**When to use:** When adding any new message type to the DM system.

**Trade-offs:**

- Pro: Single subscription handles all message types. No N+1 queries for mixed-type conversations.
- Pro: Existing pagination, ordering, and soft-delete filtering work unchanged.
- Con: Message documents have nullable fields that only apply to certain types. Schema is implicit, not enforced by Firestore.

**Example:**

```javascript
// In messageService.js -- sending any message type
export const sendSnapMessage = async (conversationId, senderId, snapURL, caption) => {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messageData = {
      senderId,
      type: 'snap',
      snapURL,
      caption: caption || null,
      viewedAt: null,
      screenshotted: false,
      text: null,
      gifUrl: null,
      createdAt: serverTimestamp(),
    };
    const messageDoc = await addDoc(messagesRef, messageData);
    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Pattern 2: Cloud Function Orchestration for Cross-Concern Updates

**What:** When a single user action (sending a snap) needs to update multiple documents (message, conversation metadata, streak), the onNewMessage Cloud Function orchestrates all updates atomically using the admin SDK.

**When to use:** Any time a message creation triggers side effects across multiple collections (streaks, notifications, metadata).

**Trade-offs:**

- Pro: Client only writes one document. All side effects are server-side, consistent, and atomic.
- Pro: Matches existing pattern (onNewMessage already updates lastMessage + unreadCount).
- Con: Adds latency to side effects (streak update happens after message write, not simultaneously). This is acceptable because streaks are not time-critical to the millisecond.

**Example:**

```javascript
// In Cloud Function: onNewMessage (extended)
if (message.type === 'snap') {
  // 1. Update conversation metadata
  await convRef.update({
    lastMessage: { text: 'Sent a snap', senderId, timestamp: message.createdAt, type: 'snap' },
    updatedAt: message.createdAt,
    [`unreadCount.${recipientId}`]: admin.firestore.FieldValue.increment(1),
  });

  // 2. Update streak tracking
  const streakRef = db.doc(`streaks/${conversationId}`);
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  await updateStreakOnSnap(streakRef, senderId, recipientId, today);

  // 3. Send notification
  await sendPushNotification(fcmToken, senderName, 'Sent you a snap', { ... });
}
```

### Pattern 3: Ephemeral Content Lifecycle (Upload -> View -> Cleanup)

**What:** Snap photos follow a three-phase lifecycle: upload to Storage on send, serve to recipient on view, delete from Storage after viewing. The TTL-like cleanup is handled by a scheduled Cloud Function rather than Firestore TTL policies because the photo blob lives in Storage (not Firestore) and TTL policies cannot delete Storage files.

**When to use:** Any ephemeral media content that should not persist indefinitely.

**Trade-offs:**

- Pro: Storage costs stay bounded. Privacy expectation (ephemeral) is enforced server-side.
- Con: Scheduled cleanup means snaps persist for up to 24 hours after viewing (cleanup runs periodically, not instantly). This is acceptable for the use case.
- Note: Firestore TTL policies could auto-delete the message _document_ (set `expiresAt` field as TTL), but the Storage blob still needs a Cloud Function to delete. Use both: TTL for the document, Cloud Function for Storage cleanup.

### Pattern 4: Reaction Aggregation on Render

**What:** Rather than maintaining a reaction count map on each message (which requires making messages mutable), reactions are stored as separate message documents. The client-side hook aggregates them during rendering.

**When to use:** When the target entity is immutable and you need to attach metadata to it.

**Trade-offs:**

- Pro: Messages stay immutable (no security rule changes for message updates beyond snap viewing).
- Pro: Reactions have their own timestamps, appear in the conversation timeline naturally.
- Con: Client must group reactions with their target messages. This is a `useMemo` computation, not expensive.
- Con: If a message has many reactions (10+), they are 10+ documents. Acceptable for 1-on-1 DMs where reaction volume is low.

**Example:**

```javascript
// In useConversation hook -- aggregate reactions with target messages
const messagesWithReactions = useMemo(() => {
  const reactionsByTarget = new Map();
  const regularMessages = [];

  messages.forEach(msg => {
    if (msg.type === 'reaction') {
      const existing = reactionsByTarget.get(msg.targetMessageId) || [];
      existing.push(msg);
      reactionsByTarget.set(msg.targetMessageId, existing);
    } else {
      regularMessages.push(msg);
    }
  });

  return regularMessages.map(msg => ({
    ...msg,
    reactions: reactionsByTarget.get(msg.id) || [],
  }));
}, [messages]);
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Snap Photos in the Same Path as Feed Photos

**What people do:** Reuse the `photos/{userId}/` Storage path for snap images.
**Why it's wrong:** Feed photos have strict Storage rules (only owner can read directly; others use signed URLs via Cloud Function). Snaps need the recipient to read directly. Mixing them means either loosening feed photo security or adding complex conditional rules.
**Do this instead:** Use a separate `snap-photos/{userId}/` path with simpler read rules. Snap photos are ephemeral and low-stakes; feed photos are permanent and valuable.

### Anti-Pattern 2: Client-Side Streak Calculation

**What people do:** Calculate streak counts and expiry on the client, then write the result to Firestore.
**Why it's wrong:** Two clients (sender and recipient) might race to update the streak. Client clocks can be inaccurate. Users could manipulate streak counts by modifying client code.
**Do this instead:** Only the Cloud Function (onNewMessage) updates streak state. Clients read streak state but never write count/status directly. The only client-writable field is `lastSnapBy.{userId}` (which the Cloud Function also sets, but client write is a fallback).

### Anti-Pattern 3: Making All Messages Mutable for Reactions

**What people do:** Change Firestore rules to allow message updates so reactions can be stored as a map on each message document.
**Why it's wrong:** The current immutability rule (`allow update, delete: if false` for non-snap messages) is a strong security guarantee. Making messages mutable opens the door to message tampering, retroactive edits, and complex rule validation.
**Do this instead:** Store reactions as separate `type: 'reaction'` message documents. The only messages that need mutability are snaps (for `viewedAt` and `screenshotted`), and that update is tightly scoped to recipient-only, snap-type-only, specific-fields-only.

### Anti-Pattern 4: Polling for Read Receipts

**What people do:** Periodically fetch the conversation document to check if the friend has read messages.
**Why it's wrong:** Firestore charges per read. The existing real-time subscription on the conversation document already delivers updates instantly.
**Do this instead:** Leverage the existing `subscribeToConversations` listener. The `readReceipts` field is on the conversation document, so updates are delivered through the existing subscription at zero additional cost.

### Anti-Pattern 5: Using Firestore TTL as the Only Snap Cleanup

**What people do:** Set a TTL policy on the messages collection and assume snap cleanup is handled.
**Why it's wrong:** Firestore TTL only deletes the Firestore _document_. The actual photo blob in Firebase Storage is unaffected. You end up with orphaned Storage files costing money indefinitely.
**Do this instead:** Use Firestore TTL for the message document cleanup _and_ a scheduled Cloud Function that queries for viewed snaps and deletes their Storage blobs before the TTL removes the document reference.

## Recommended Project Structure (New Files)

```
src/
  services/
    firebase/
      snapService.js          # Snap upload, send, view, screenshot tracking
      streakService.js         # Streak reads/subscriptions, expiry checks
      messageService.js        # EXTEND: new message types, read receipts, reactions, replies, deletion
  hooks/
    useSnapCamera.js           # Snap capture + send flow state
    useStreaks.js               # Real-time streak subscription for a user pair
    useConversation.js         # EXTEND: reaction aggregation, reply state, read receipt derivation
    useMessages.js             # EXTEND: streak indicators in conversation list
  components/
    SnapViewer.js              # Full-screen snap viewer with timer + screenshot detection
    SnapBubble.js              # "Tap to view" message bubble for unviewed snaps
    ReactionPicker.js          # Emoji picker overlay for message reactions
    ReactionBadges.js          # Reaction emoji row below a message
    ReplyPreview.js            # Quoted message preview above DMInput
    StreakIndicator.js         # Fire/hourglass emoji + day count badge
    MessageBubble.js           # EXTEND: render snap, reaction, reply, tagged_photo types
    DMInput.js                 # EXTEND: add camera button for snaps, reply-to state
    ConversationHeader.js      # EXTEND: streak indicator next to friend name
  screens/
    ConversationScreen.js      # EXTEND: snap viewing, reaction overlay, reply flow
    CameraScreen.js            # EXTEND: snap mode toggle (camera for snap vs. darkroom photo)

functions/
  index.js                     # EXTEND: onNewMessage handles snap/reaction/reply types
  streaks.js                   # NEW: processStreakExpiry scheduled function
  snapCleanup.js               # NEW: cleanupViewedSnaps scheduled function
```

### Structure Rationale

- **Services stay in `services/firebase/`:** Every new service follows the existing pattern of exporting async functions that return `{ success, error }`. No architectural change needed.
- **Hooks extend, not replace:** `useConversation` and `useMessages` gain new responsibilities but their existing API surface stays backward-compatible. New hooks (`useStreaks`, `useSnapCamera`) are created only for genuinely new domains.
- **Components are small and focused:** `SnapViewer`, `ReactionPicker`, `StreakIndicator` are each a single responsibility. They compose into existing screens rather than requiring new screens.
- **Cloud Functions split into modules:** `streaks.js` and `snapCleanup.js` are separate files (like existing `notifications/` folder) to keep `index.js` from growing further.

## Scaling Considerations

| Scale          | Architecture Adjustments                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0-1k users     | Current architecture handles this comfortably. Scheduled functions run every 30 minutes. Snap cleanup runs daily. Storage costs negligible.                                                                                                                                                                              |
| 1k-10k users   | Streak expiry query may need composite index (status + expiresAt). Snap cleanup should batch-delete in chunks of 500 to avoid function timeouts. Storage costs for un-cleaned snaps become noticeable -- ensure cleanup runs reliably.                                                                                   |
| 10k-100k users | Consider moving streak processing to Cloud Tasks (per-streak task queued on snap send) instead of scheduled scan-all-streaks function. Snap photo compression should be aggressive (720p max). Reaction documents per conversation could grow large -- consider reaction TTL (auto-delete reactions older than 30 days). |

### First Bottleneck: Streak Query Scan

At scale, the scheduled `processStreakExpiry` function scans all active/warning streaks. With 100k users and an average of 10 streak relationships each, that's up to 500k documents to scan. **Mitigation:** Use a composite index on `(status, expiresAt)` so only streaks near expiry are scanned. At 10k users this is fine; at 100k, switch to per-streak Cloud Tasks triggered when a streak is created/updated.

### Second Bottleneck: Snap Storage Cleanup

If cleanup falls behind, orphaned snap photos accumulate in Storage. **Mitigation:** Track cleanup state (mark snaps as "cleanup_pending" after viewing, then delete). Run cleanup more frequently (every 6 hours instead of daily) as user count grows.

## Integration Points

### External Services

| Service               | Integration Pattern                                                                                                                | Notes                                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-screen-capture` | Hook-based (`usePreventScreenCapture`, `addScreenshotListener`)                                                                    | Already compatible with Expo SDK 54. Does NOT require a new native build -- it's a JS-only API on existing expo-screen-capture module. Verify it's in the project dependencies; if not, add it (it IS a native module, requires rebuild). |
| Firebase Storage      | `putFile` for snap upload, `delete` for cleanup                                                                                    | Same pattern as existing `storageService.js`. New path: `snap-photos/`.                                                                                                                                                                   |
| Firestore TTL         | Set `expiresAt` field on snap messages; enable TTL policy on `conversations/*/messages` collection group for the `expiresAt` field | TTL deletion happens within ~24 hours of expiry. Not instant. Use as backup cleanup, not primary.                                                                                                                                         |
| Cloud Scheduler       | Scheduled functions for streak expiry and snap cleanup                                                                             | Already used by `processDarkroomReveals` (runs every 2 minutes). New functions run less frequently (30 min, daily).                                                                                                                       |

### Internal Boundaries

| Boundary                          | Communication                                                                                                                                          | Notes                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| snapService <-> messageService    | snapService calls messageService.sendMessage (extended) with type='snap'                                                                               | One service calls another; snap-specific logic stays in snapService, generic message writing stays in messageService.                |
| streakService <-> Cloud Functions | streakService reads streak state (client). Cloud Functions write streak state (server).                                                                | Strict read/write separation. Client never writes streak count.                                                                      |
| useConversation <-> SnapViewer    | useConversation passes snap message to SnapViewer component via props. SnapViewer calls snapService.markSnapViewed on close.                           | Component boundary: SnapViewer is a self-contained viewer, not aware of conversation context.                                        |
| CameraScreen <-> useSnapCamera    | CameraScreen uses useSnapCamera for snap-specific state. Shared camera utilities (permissions, flash) come from existing useCamera or a shared module. | Hook boundary: useSnapCamera handles snap-specific concerns (friend selection, caption), delegates camera hardware to existing code. |
| onNewMessage <-> streaks.js       | onNewMessage calls streak update logic imported from streaks.js                                                                                        | Module boundary within Cloud Functions. Streak logic is extracted to keep onNewMessage focused.                                      |

## Build Order (Dependencies)

The features have clear dependency ordering:

```
Phase 1: Foundation
  Message type polymorphism (extend message schema)
  Read receipts (extend conversation document + markConversationRead)
  Message deletion (unsend own messages)
  --> These are schema/service changes that all other features depend on

Phase 2: Reactions + Replies
  Reaction messages (type: 'reaction' + ReactionPicker + aggregation)
  Quote replies (replyTo field + ReplyPreview + DMInput extension)
  --> These depend on Phase 1's message type polymorphism

Phase 3: Snaps
  Snap service (upload, send, view)
  SnapViewer component (full-screen viewer with timer)
  Screenshot detection (expo-screen-capture)
  Snap cleanup Cloud Function
  --> Most complex feature. Depends on Phase 1 for message type support.
  --> Independent of Phase 2 (reactions/replies).

Phase 4: Streaks
  Streak service + Cloud Function
  StreakIndicator component
  Streak expiry scheduled function
  --> Depends on Phase 3 (snaps). Streaks are tracked via snap sends.

Phase 5: Photo Tag Integration
  Tagged photo -> DM auto-message
  "Add to feed" reshare flow
  --> Depends on Phase 1 (message type polymorphism).
  --> Can be built in parallel with Phases 3-4.
```

**Rationale:** Phase 1 establishes the extended message schema that every other feature builds on. Read receipts and message deletion are low-complexity additions that exercise the schema extension pattern. Phases 2 and 3 can be built in parallel by different developers since they don't depend on each other. Phase 4 strictly depends on Phase 3 because streaks are counted by snap exchanges. Phase 5 depends only on Phase 1 and can be slotted anywhere after it.

## Sources

- [Expo ScreenCapture API](https://docs.expo.dev/versions/latest/sdk/screen-capture/) -- MEDIUM confidence (official docs verified via WebFetch)
- [Firestore TTL policies](https://firebase.google.com/docs/firestore/ttl) -- HIGH confidence (official Firebase documentation)
- [Firestore data structure best practices](https://firebase.google.com/docs/firestore/manage-data/structure-data) -- HIGH confidence (official Firebase documentation)
- [Firebase scheduled functions](https://firebase.google.com/docs/functions/schedule-functions) -- HIGH confidence (official Firebase documentation)
- [Snapchat streak mechanics](https://help.snapchat.com/hc/en-us/articles/7012394193684-How-do-Streaks-work-and-when-do-they-expire) -- HIGH confidence (official Snapchat support)
- [Firestore chat data modeling](https://medium.com/@henryifebunandu/cloud-firestore-db-structure-for-your-chat-application-64ec77a9f9c0) -- LOW confidence (single community source, but aligns with official Firestore guidance)
- Existing codebase analysis: `messageService.js`, `useConversation.js`, `useMessages.js`, `ConversationScreen.js`, `MessageBubble.js`, `DMInput.js`, `firestore.rules`, `storage.rules`, `functions/index.js` -- HIGH confidence (primary source)

---

_Architecture research for: Flick Messaging Upgrade_
_Researched: 2026-02-23_
