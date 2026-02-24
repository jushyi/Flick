# Phase 5: Photo Tag Integration - Research

**Researched:** 2026-02-24
**Domain:** Firestore document triggers, DM message types, photo lifecycle, push notifications
**Confidence:** HIGH

## Summary

This phase connects the existing photo tagging system to DMs. The codebase already has a complete tagging infrastructure: `TagFriendsModal` for friend selection, `updatePhotoTags()` in photoService for writing `taggedUserIds` to photo documents, `batchTriagePhotos()` that writes tags during darkroom triage, and `sendTaggedPhotoNotification` Cloud Function that fires on photo updates. The work is primarily: (1) modifying the Cloud Function to create DM messages instead of activity notifications, (2) adding a `tagged_photo` message type with a new `TaggedPhotoBubble` component, (3) creating an "Add to feed" action that copies photos with attribution, and (4) a reshare notification.

The architecture follows established patterns from Phases 1-4. Message types are rendered by delegation from `MessageBubble` (snap messages delegate to `SnapBubble` -- tagged photo messages will delegate to a new `TaggedPhotoBubble`). The `onNewMessage` Cloud Function already handles conversation metadata updates and push notifications for all message types. The `ConversationRow` already has a `tagged_photo` case for preview text. The signed URL service handles photo URL expiry.

**Primary recommendation:** Modify the existing `sendTaggedPhotoNotification` Cloud Function to create `type: 'tagged_photo'` messages in DM conversations (using existing `getOrCreateConversation` pattern server-side), render them as large photo cards with an inline "Add to feed" button, and create a new `addTaggedPhotoToFeed` callable Cloud Function for the reshare+attribution+notification flow.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tagged Photo Message Card:**

- Large photo card in the DM conversation (generous photo display, like iMessage photo messages)
- Header text above the photo: "[Name] tagged you in a photo"
- Distinct visual styling to differentiate from snaps and regular messages (different border/background)
- Caption not shown on the card -- only visible when opening PhotoDetail
- Sender sees the same large photo card in their view (no compact version)
- ConversationRow preview: icon + "Tagged you in a photo" text (no thumbnail)
- Tapping the card opens the full PhotoDetail modal (with reactions, comments, Add to feed)

**Add-to-Feed Button:**

- Inline "Add to feed" button visible directly on the message card AND inside PhotoDetail
- One-tap instant add -- no confirmation dialog, no undo toast
- After adding, button becomes greyed-out "Added to feed" (disabled state)
- Reshared photo appears immediately on recipient's feed -- skips darkroom developing
- No limit on how many friends can be tagged in a single photo

**Attribution Display:**

- "Photo by @username" text positioned below display name/timestamp and above the caption
- Tapping attribution navigates to the photographer's profile
- Attribution is permanent -- recipient cannot remove it
- Attribution visible in both the feed card and the PhotoDetail modal

**Tag Migration (Activity Feed to DMs):**

- New tags only create DM messages -- no new activity feed notifications for tags
- Existing tag notifications in the activity feed are left as-is (no cleanup)

**Notification & Delivery:**

- Tagged friend receives a push notification: "[Name] tagged you in a photo"
- Tapping the push notification navigates to the DM conversation (not directly to PhotoDetail)
- When a tagged friend reshares the photo to their feed, photographer gets push: "[Name] added your photo to their feed" (specific text, not randomized templates)
- Each tagged friend gets an individual push notification (no batching for multi-tag)
- Only the photographer is notified of reshares (other tagged friends are not notified)

### Claude's Discretion

- Re-addability: Whether a recipient can re-add a photo after removing it from their feed
- Exact card border/background styling for tagged photo messages
- Error handling for edge cases (blocked users, deleted conversations, deleted photos)
- Tag picker UI implementation details

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                       | Research Support                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TAG-01 | When a user tags a friend in a photo, that photo auto-sends as a message in their DM conversation | Cloud Function modification of `sendTaggedPhotoNotification` to create messages via existing `getOrCreateConversation` pattern; Architecture Pattern 1 (Server-Side Tag-to-DM Pipeline) |
| TAG-02 | Tagged photo message renders as a photo card with "tagged you in a photo" context                 | New `TaggedPhotoBubble` component following `SnapBubble` delegation pattern; Architecture Pattern 2 (Tagged Photo Message Rendering)                                                    |
| TAG-03 | Recipient can tap "Add to feed" on a tagged photo message to add it to their own feed             | New `addTaggedPhotoToFeed` callable Cloud Function; Architecture Pattern 3 (Add-to-Feed Flow)                                                                                           |
| TAG-04 | Reshared photo shows "Photo by @username" attribution on the recipient's feed                     | Attribution fields on photo document; FeedPhotoCard and PhotoDetailScreen modifications; Architecture Pattern 4 (Attribution Display)                                                   |

</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library                            | Version | Purpose                                                 | Why Standard                 |
| ---------------------------------- | ------- | ------------------------------------------------------- | ---------------------------- |
| `@react-native-firebase/firestore` | SDK 54  | Photo documents, conversation messages, triggers        | Already handles all data ops |
| `@react-native-firebase/functions` | SDK 54  | `httpsCallable` for reshare action, `onUpdate` triggers | Server-authoritative pattern |
| `@react-native-firebase/storage`   | SDK 54  | Photo URLs and signed URL generation                    | Already manages photo assets |
| `expo-image`                       | Expo 54 | Photo rendering in tagged photo card                    | Used throughout for caching  |
| `expo-notifications`               | Expo 54 | Push notifications for tags and reshares                | Project notification system  |
| `react-native-reanimated`          | 3.x     | Gesture handling on tagged photo cards                  | Existing gesture patterns    |

### Supporting (Already in Project)

| Library                    | Version | Purpose                                | When to Use              |
| -------------------------- | ------- | -------------------------------------- | ------------------------ |
| `expo-haptics`             | Expo 54 | Tactile feedback on "Add to feed" tap  | UI interaction feedback  |
| `date-fns`                 | Latest  | Timestamp formatting in bubbles        | Message timestamps       |
| `@react-navigation/native` | 7.x     | Navigation to PhotoDetail and profiles | Photo/profile navigation |

### Alternatives Considered

| Instead of                          | Could Use                         | Tradeoff                                                                        |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Callable Cloud Function for reshare | Client-side Firestore write       | Server-side is required for attribution integrity and photographer notification |
| New TaggedPhotoBubble component     | Inline rendering in MessageBubble | Dedicated component follows SnapBubble pattern, keeps MessageBubble clean       |

**Installation:**

```bash
# No new dependencies needed -- all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── TaggedPhotoBubble.js    # New: tagged photo message rendering in conversation
├── services/firebase/
│   └── photoTagService.js      # New: addTaggedPhotoToFeed callable, tag-related client operations
├── styles/
│   └── TaggedPhotoBubble.styles.js  # New: styles for tagged photo card
functions/
├── index.js                    # Modified: sendTaggedPhotoNotification creates DM messages
│                               # Modified: onNewMessage handles type:'tagged_photo'
│                               # New: addTaggedPhotoToFeed callable
```

### Pattern 1: Server-Side Tag-to-DM Pipeline (TAG-01)

**What:** When `taggedUserIds` is written to a photo document, the existing `sendTaggedPhotoNotification` Cloud Function creates `type: 'tagged_photo'` messages in each tagged friend's DM conversation.
**When to use:** Every time a photo is tagged (during darkroom triage or from PhotoDetail).
**How it works:**

1. `sendTaggedPhotoNotification` already triggers on photo `onUpdate` and detects newly tagged users
2. Modify it to: for each newly tagged user, call `getOrCreateConversation(taggerId, taggedUserId)` server-side, then create a message document in that conversation
3. Stop writing to `notifications` collection for tags (migration decision)
4. The existing `onNewMessage` trigger fires automatically when the message is created, handling conversation metadata (lastMessage, unreadCount) and push notification

**Message document structure:**

```javascript
// conversations/{conversationId}/messages/{auto-id}
{
  senderId: taggerId,          // The person who tagged
  type: 'tagged_photo',
  text: null,
  gifUrl: null,
  imageUrl: null,
  photoId: photoId,            // Reference to original photo document
  photoURL: photoImageURL,     // Denormalized for instant rendering (avoid extra read)
  photoOwnerId: taggerId,     // Photo owner (same as senderId for direct tags)
  createdAt: serverTimestamp(),
}
```

**Server-side getOrCreateConversation pattern (Admin SDK):**

```javascript
// Source: existing messageService pattern adapted for Admin SDK
async function getOrCreateConversationServer(userId1, userId2) {
  const [lower, higher] = [userId1, userId2].sort();
  const conversationId = `${lower}_${higher}`;
  const convRef = db.doc(`conversations/${conversationId}`);
  const convSnap = await convRef.get();

  if (!convSnap.exists) {
    await convRef.set({
      participants: [lower, higher],
      lastMessage: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedAt: { [userId1]: null, [userId2]: null },
      unreadCount: { [userId1]: 0, [userId2]: 0 },
    });
  }

  return conversationId;
}
```

### Pattern 2: Tagged Photo Message Rendering (TAG-02)

**What:** New `TaggedPhotoBubble` component delegates rendering from `MessageBubble`, similar to how `SnapBubble` handles snap messages.
**When to use:** When `message.type === 'tagged_photo'` in the conversation thread.

**Delegation in MessageBubble:**

```javascript
// In MessageBubble.js, after the isSnap delegation block:
const isTaggedPhoto = message.type === 'tagged_photo';

// After all hooks (Rules of Hooks compliance)
if (isTaggedPhoto) {
  return (
    <TaggedPhotoBubble
      message={message}
      isCurrentUser={isCurrentUser}
      showTimestamp={showTimestamp}
      onPress={onPress}
      reactions={reactions}
      onReactionPress={onReactionPress}
      currentUserId={currentUserId}
    />
  );
}
```

**TaggedPhotoBubble renders:**

- Full-width-ish card (similar to image messages but larger)
- Header: "[Name] tagged you in a photo" (or "You tagged [Name]" for sender)
- Large photo image with distinct border/background styling
- "Add to feed" / "Added to feed" button inline on the card (recipient only)

### Pattern 3: Add-to-Feed Flow (TAG-03)

**What:** Callable Cloud Function `addTaggedPhotoToFeed` creates a new photo document for the recipient with attribution fields. Client calls via `httpsCallable`.
**When to use:** When recipient taps "Add to feed" on a tagged photo message.

**Why server-side:** The reshare must (1) copy photo data atomically, (2) set permanent attribution, (3) skip darkroom, (4) notify the photographer. Client-side writes cannot be trusted for attribution integrity.

**New photo document for recipient:**

```javascript
// Created by addTaggedPhotoToFeed Cloud Function
{
  userId: recipientId,           // NEW owner
  imageURL: originalPhoto.imageURL,
  storagePath: originalPhoto.storagePath, // Same storage file, no copy needed
  capturedAt: originalPhoto.capturedAt,
  status: 'triaged',            // Skip darkroom
  photoState: 'journal',        // Immediately on feed
  visibility: 'friends-only',
  month: getCurrentMonth(),
  reactions: {},
  reactionCount: 0,
  triagedAt: serverTimestamp(),  // Feed visibility window starts now
  // Attribution fields (permanent)
  attribution: {
    originalPhotoId: originalPhotoId,
    photographerId: originalPhoto.userId,
    photographerUsername: photographerUsername,
    photographerDisplayName: photographerDisplayName,
  },
  // Copy relevant metadata
  caption: originalPhoto.caption || null,
  taggedUserIds: originalPhoto.taggedUserIds || [],
}
```

**Client-side call pattern:**

```javascript
// Source: existing snapService.js httpsCallable pattern
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

export const addTaggedPhotoToFeed = async (photoId, conversationId, messageId) => {
  try {
    const functions = getFunctions();
    const addToFeed = httpsCallable(functions, 'addTaggedPhotoToFeed');
    const result = await addToFeed({ photoId, conversationId, messageId });
    return { success: true, newPhotoId: result.data.newPhotoId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

**Tracking added-to-feed state on the message:**
The Cloud Function writes `addedToFeedBy` map field on the tagged_photo message document:

```javascript
// After creating the reshared photo:
await messageRef.update({
  [`addedToFeedBy.${recipientId}`]: {
    newPhotoId: newPhotoDoc.id,
    addedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
});
```

This allows the client to show "Added to feed" (disabled) when `message.addedToFeedBy?.[currentUserId]` exists.

### Pattern 4: Attribution Display (TAG-04)

**What:** "Photo by @username" rendered in FeedPhotoCard and PhotoDetailScreen when `photo.attribution` exists.
**When to use:** Any photo with an `attribution` field.

**FeedPhotoCard placement:** Below display name/timestamp row, above caption text:

```jsx
{
  /* Attribution line (for reshared photos) */
}
{
  photo.attribution && (
    <TouchableOpacity
      onPress={() =>
        onAvatarPress(photo.attribution.photographerId, photo.attribution.photographerDisplayName)
      }
      activeOpacity={0.7}
    >
      <Text style={styles.attributionText}>Photo by @{photo.attribution.photographerUsername}</Text>
    </TouchableOpacity>
  );
}

{
  /* Caption (if present) */
}
{
  photo.caption ? (
    <Text style={styles.captionText} numberOfLines={3}>
      {photo.caption}
    </Text>
  ) : null;
}
```

### Anti-Patterns to Avoid

- **Client-side photo document creation for reshares:** Attribution must be server-authoritative. Never let the client write `attribution` fields -- use a callable Cloud Function.
- **Copying Storage files for reshared photos:** The reshared photo should reference the same `storagePath` and `imageURL` as the original. No storage duplication needed -- the photo lives in the original uploader's Storage path and the signed URL service handles access.
- **Incrementing unread count in sendTaggedPhotoNotification:** Do NOT manually update conversation metadata. The message creation triggers `onNewMessage` which handles lastMessage, unreadCount, and push notification atomically. Double-writing causes race conditions.
- **Blocking on all tag messages before returning:** Process tagged users concurrently with `Promise.allSettled` (not sequentially) so one blocked user or failed conversation doesn't prevent others from receiving their tag.

## Don't Hand-Roll

| Problem                               | Don't Build                                            | Use Instead                                                         | Why                                                                      |
| ------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Conversation creation for tagged user | Custom conversation creation logic                     | Existing `getOrCreateConversation` pattern (server-side equivalent) | Deterministic ID generation already handles dedup                        |
| Conversation metadata updates         | Manual lastMessage/unreadCount updates in tag function | Existing `onNewMessage` Cloud Function trigger                      | Fires automatically on message creation, handles all metadata atomically |
| Push notification for tags in DMs     | Separate notification sending in tag function          | `onNewMessage` trigger's notification logic                         | Already handles FCM token lookup, preferences check, notification data   |
| Photo URL resolution                  | Inline URL fetching                                    | Denormalize `photoURL` into the message document                    | Avoids N+1 reads when rendering conversation                             |
| Signed URL refresh                    | Custom refresh logic for tagged photos                 | Existing `signedUrlService`                                         | Already handles 7-day expiry and refresh                                 |

**Key insight:** The biggest architectural win is leveraging `onNewMessage` -- by creating a properly-typed message document, the existing trigger handles conversation metadata, unread counts, and push notifications automatically. The `sendTaggedPhotoNotification` function only needs to create messages, not duplicate the entire notification pipeline.

## Common Pitfalls

### Pitfall 1: Double Notification from Tag Function + onNewMessage

**What goes wrong:** `sendTaggedPhotoNotification` sends its own push notification AND the `onNewMessage` trigger sends another when the message is created.
**Why it happens:** The existing tag function sends push + writes to notifications collection. If we add message creation without removing the old notification logic, users get duplicate notifications.
**How to avoid:** Remove the push notification sending AND `notifications` collection write from `sendTaggedPhotoNotification`. Let `onNewMessage` handle it. Add `tagged_photo` handling to `onNewMessage`'s notification body builder.
**Warning signs:** Users report receiving two notifications per tag.

### Pitfall 2: onNewMessage Not Handling tagged_photo Type

**What goes wrong:** `onNewMessage` doesn't know about `tagged_photo` type, so `lastMessage` preview text is wrong, notification body is generic.
**Why it happens:** `onNewMessage` has a switch on message type for preview text and notification body. A new type needs explicit handling.
**How to avoid:** Add `tagged_photo` case to both the `lastMessagePreview` builder and the notification body builder in `onNewMessage`.
**Warning signs:** Conversation list shows raw null text instead of "Tagged you in a photo".

### Pitfall 3: Signed URL Expiry on Denormalized photoURL

**What goes wrong:** The `photoURL` stored in the tagged_photo message document is a signed URL that expires after 7 days. Old tagged photo messages show broken images.
**Why it happens:** Signed URLs have a finite lifetime. Denormalized URLs go stale.
**How to avoid:** Store `photoId` on the message. The `TaggedPhotoBubble` component fetches the photo document (which has `imageURL` that gets refreshed by `signedUrlService`). The denormalized `photoURL` serves as initial fast render; fall back to fetching from photoId if it fails.
**Warning signs:** Tagged photo cards show broken images after 7+ days.

### Pitfall 4: Race Condition Between Tag Write and Photo Triage

**What goes wrong:** `batchTriagePhotos` writes `taggedUserIds` to the photo, then immediately triages it. The Cloud Function triggers on the tag write but the photo may not have `status: 'triaged'` yet when the function reads it.
**Why it happens:** Firestore `onUpdate` triggers once per update. The tag write and triage are separate `updateDoc` calls in sequence.
**How to avoid:** The existing code already handles this -- `batchTriagePhotos` writes tags first, then triages. The `sendTaggedPhotoNotification` function checks for `taggedUserIds` changes regardless of status. However, ensure the function doesn't require `status === 'triaged'` as a gate.
**Warning signs:** Tags written during triage don't create DM messages.

### Pitfall 5: Blocking User Edge Case

**What goes wrong:** User A tags User B who has blocked User A. The Cloud Function creates a conversation and message anyway.
**Why it happens:** The tag function doesn't check block status.
**How to avoid:** In `sendTaggedPhotoNotification`, check the `blocks` collection before creating a conversation. Skip users who have blocked the tagger. This is Claude's discretion per CONTEXT.md.
**Warning signs:** Blocked users receive messages from their blocker.

### Pitfall 6: Add-to-Feed Allows Multiple Adds

**What goes wrong:** User taps "Add to feed" rapidly and creates duplicate photo documents.
**Why it happens:** No idempotency guard on the callable function.
**How to avoid:** The callable function should check `addedToFeedBy.{recipientId}` on the message document before creating a new photo. If already added, return the existing `newPhotoId` without creating a duplicate. The client should also disable the button optimistically on first tap.
**Warning signs:** Duplicate photos appear on recipient's feed.

### Pitfall 7: MessageBubble Hook Order Violation

**What goes wrong:** Adding `isTaggedPhoto` check before hooks causes "Rendered more hooks than during the previous render" error.
**Why it happens:** React Rules of Hooks require hooks to be called in the same order every render. Early returns before hooks break this.
**How to avoid:** Place the `isTaggedPhoto` delegation AFTER all hooks, exactly like the existing `isSnap` delegation pattern in MessageBubble.
**Warning signs:** App crashes when tagged photo messages appear in conversation.

## Code Examples

Verified patterns from the existing codebase:

### onNewMessage lastMessage Preview (to extend)

```javascript
// Source: functions/index.js lines 2970-2988
// Add tagged_photo case:
const lastMessagePreview =
  messageType === 'snap'
    ? null
    : messageType === 'tagged_photo'
      ? 'Tagged you in a photo'
      : messageType === 'gif'
        ? 'Sent a GIF'
        : messageType === 'image'
          ? 'Sent a photo'
          : messageType === 'reaction'
            ? 'Reacted'
            : message.text || '';
```

### onNewMessage Notification Body (to extend)

```javascript
// Source: functions/index.js lines 3058-3080
// Add tagged_photo case:
let body;
if (messageType === 'snap') {
  body = getRandomTemplate(SNAP_BODY_TEMPLATES);
} else if (messageType === 'tagged_photo') {
  body = 'Tagged you in a photo';
} else if (messageType === 'reaction' && message.emoji) {
  // ... existing reaction handling
}
```

### SnapBubble Delegation Pattern (to follow for TaggedPhotoBubble)

```javascript
// Source: src/components/MessageBubble.js lines 179-196
// Existing snap delegation:
if (isSnap) {
  return (
    <SnapBubble
      message={message}
      isCurrentUser={isCurrentUser}
      showTimestamp={showTimestamp}
      onPress={onPress}
      isPending={message._isPending}
      hasError={message._hasError}
      onRetry={message._onRetry}
      reactions={reactions}
      onReactionPress={onReactionPress}
      currentUserId={currentUserId}
    />
  );
}
```

### ConversationRow Preview (already has tagged_photo handling)

```javascript
// Source: src/components/ConversationRow.js line 130, 147-148
// Already implemented:
case 'tagged_photo':
  return isFriendRead ? 'Seen' : 'Sent';
// ...
case 'tagged_photo':
  return 'Tagged you in a photo';
```

### Notification Navigation (to add tagged_photo case)

```javascript
// Source: src/services/firebase/notificationService.js lines 424-440
// Reuse the direct_message pattern but with tagged_photo type:
case 'tagged_photo':
  return {
    success: true,
    data: {
      type: 'tagged_photo',
      screen: 'Conversation',
      params: {
        conversationId: conversationId,
        friendId: senderId,
        friendProfile: {
          uid: senderId,
          displayName: senderName || 'Unknown',
          photoURL: senderProfilePhotoURL || null,
        },
      },
    },
  };
```

### Callable Cloud Function Pattern

```javascript
// Source: existing Cloud Functions patterns in functions/index.js
exports.addTaggedPhotoToFeed = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { photoId, messageId, conversationId } = data;
    const recipientId = context.auth.uid;

    // Validate inputs with Zod (existing pattern)
    // ... validation ...

    // Idempotency: check if already added
    // ... check addedToFeedBy ...

    // Create new photo document with attribution
    // ... create photo ...

    // Update message with addedToFeedBy
    // ... update message ...

    // Notify photographer
    // ... send notification ...

    return { success: true, newPhotoId: newPhotoRef.id };
  });
```

## State of the Art

| Old Approach                            | Current Approach                     | When Changed | Impact                                              |
| --------------------------------------- | ------------------------------------ | ------------ | --------------------------------------------------- |
| Tags create activity feed notifications | Tags create DM messages (this phase) | Phase 5      | Tags become conversational, not just notifications  |
| Activity feed for tag navigation        | DM conversation for tag navigation   | Phase 5      | Push notification navigates to DM, not Activity tab |
| No reshare capability                   | Add-to-feed with attribution         | Phase 5      | Photos can be shared across feeds with credit       |

**Deprecated/outdated (after this phase):**

- `sendTaggedPhotoNotification` writing to `notifications` collection for tags: Will be removed (replaced by DM message creation)
- Tag push notification navigating to Activity screen: Will navigate to Conversation screen instead
- `notificationService.handleNotificationTapped` `case 'tagged'` routing to Activity: Will route to Conversation

## Open Questions

1. **Re-addability after removing from feed**
   - What we know: User decision deferred to Claude's discretion
   - What's unclear: Should the "Add to feed" button re-enable if the user later deletes the reshared photo?
   - Recommendation: Allow re-add. Track via `addedToFeedBy` map on the message. When the reshared photo is deleted, remove the entry from the map. The Cloud Function should check both the map AND whether a non-deleted reshared photo exists. This is a low-complexity addition.

2. **Shared Storage path for reshared photos**
   - What we know: Reshared photos reference the original's `storagePath` and `imageURL`
   - What's unclear: If the original photographer deletes their photo, the Storage file is deleted, breaking all reshared copies
   - Recommendation: This is acceptable for v1 -- reshared photos break if the original is deleted. Document this as a known limitation. V2 could copy the file to the resharer's Storage path.

3. **Photo access for non-friends viewing reshared content**
   - What we know: Feed queries filter by `userId in [friend IDs]`. Reshared photos have `userId` set to the resharer.
   - What's unclear: Whether the existing feed query correctly shows reshared photos to the resharer's friends
   - Recommendation: Since `userId` on the reshared photo is set to the recipient, it will appear in their friends' feeds naturally. No query changes needed.

## Validation Architecture

### Test Framework

| Property           | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | Jest with jest-expo preset                                             |
| Config file        | `package.json` jest section + `__tests__/setup/jest.setup.js`          |
| Quick run command  | `npm test -- --testPathPattern="tagged\|photoTag\|TaggedPhoto" --bail` |
| Full suite command | `npm test`                                                             |
| Estimated runtime  | ~15 seconds (quick), ~45 seconds (full)                                |

### Phase Requirements -> Test Map

| Req ID | Behavior                                                     | Test Type | Automated Command                                                                                            | File Exists?                                 |
| ------ | ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| TAG-01 | Tag creates DM message via Cloud Function                    | unit      | `cd functions && npx jest __tests__/triggers/notifications.test.js -t "sendTaggedPhotoNotification" --bail`  | Partially (existing tests need modification) |
| TAG-01 | onNewMessage handles tagged_photo type                       | unit      | `cd functions && npx jest __tests__/triggers/notifications.test.js -t "onNewMessage.*tagged" --bail`         | No (Wave 0 gap)                              |
| TAG-02 | TaggedPhotoBubble renders photo card with header             | unit      | `npm test -- __tests__/components/TaggedPhotoBubble.test.js --bail`                                          | No (Wave 0 gap)                              |
| TAG-02 | MessageBubble delegates to TaggedPhotoBubble                 | unit      | `npm test -- __tests__/components/MessageBubble.test.js -t "tagged" --bail`                                  | No (Wave 0 gap -- extend existing)           |
| TAG-03 | addTaggedPhotoToFeed callable creates photo with attribution | unit      | `cd functions && npx jest __tests__/callable/functions.test.js -t "addTaggedPhotoToFeed" --bail`             | No (Wave 0 gap)                              |
| TAG-03 | addTaggedPhotoToFeed idempotency check                       | unit      | `cd functions && npx jest __tests__/callable/functions.test.js -t "addTaggedPhotoToFeed.*idempotent" --bail` | No (Wave 0 gap)                              |
| TAG-04 | FeedPhotoCard renders attribution text                       | unit      | `npm test -- __tests__/components/FeedPhotoCard.test.js -t "attribution" --bail`                             | No (Wave 0 gap)                              |
| TAG-04 | Attribution tappable navigates to profile                    | unit      | `npm test -- __tests__/components/FeedPhotoCard.test.js -t "attribution.*navigate" --bail`                   | No (Wave 0 gap)                              |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task -> run: `npm test -- --testPathPattern="tagged\|photoTag\|TaggedPhoto\|FeedPhotoCard" --bail`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `__tests__/components/TaggedPhotoBubble.test.js` -- covers TAG-02 (new component rendering)
- [ ] `__tests__/services/photoTagService.test.js` -- covers TAG-03 (client-side addTaggedPhotoToFeed callable)
- [ ] `functions/__tests__/triggers/notifications.test.js` -- extend existing with onNewMessage tagged_photo tests (TAG-01)
- [ ] `functions/__tests__/callable/functions.test.js` -- extend existing with addTaggedPhotoToFeed tests (TAG-03)
- [ ] `__tests__/components/FeedPhotoCard.test.js` -- new test file for attribution rendering (TAG-04)

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** -- `functions/index.js` lines 955-1098: existing `sendTaggedPhotoNotification` function
- **Codebase inspection** -- `functions/index.js` lines 2923-3113: existing `onNewMessage` function
- **Codebase inspection** -- `src/services/firebase/messageService.js`: message types, `getOrCreateConversation`
- **Codebase inspection** -- `src/services/firebase/photoService.js`: `updatePhotoTags`, `batchTriagePhotos`, `createPhoto`
- **Codebase inspection** -- `src/components/MessageBubble.js`: snap delegation pattern at lines 179-196
- **Codebase inspection** -- `src/components/SnapBubble.js`: complete component pattern for new message type
- **Codebase inspection** -- `src/components/ConversationRow.js`: already has `tagged_photo` cases
- **Codebase inspection** -- `src/components/FeedPhotoCard.js`: card layout with attribution insertion point
- **Codebase inspection** -- `src/services/firebase/notificationService.js`: notification navigation handler
- **Codebase inspection** -- `src/components/TagFriendsModal.js`: existing tag friend picker UI

### Secondary (MEDIUM confidence)

- **Project CLAUDE.md** -- Service layer pattern (`{ success, error }` returns), logging conventions, import organization

### Tertiary (LOW confidence)

- None -- all findings verified from codebase inspection

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- patterns directly follow existing SnapBubble/onNewMessage patterns
- Pitfalls: HIGH -- identified from actual code paths and existing edge case handling
- Validation: MEDIUM -- test structure follows existing patterns but new test files needed

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable -- all patterns based on existing codebase)
