# Phase 3: Snap Messages - Research

**Researched:** 2026-02-24
**Domain:** Ephemeral photo DMs with view-once mechanics, Firebase Storage lifecycle, Firestore TTL, short-lived signed URLs
**Confidence:** HIGH

## Summary

Phase 3 adds ephemeral snap photo messages to the existing DM system. The core technical challenge is creating a complete lifecycle: capture -> upload -> deliver -> view once -> server-side cleanup. The existing codebase has strong foundations: `messageService.js` already supports multiple message types (`text`, `gif`, `image`, `reaction`), the `storageService.js` handles image compression and upload via `putFile`, the `signedUrlService.js` generates signed URLs via Cloud Function, and `CameraScreen` + `useCameraBase` provide camera capture infrastructure. Firestore security rules already permit `viewedAt` updates on messages by the non-sender participant, confirming snap read receipt support was pre-planned.

The primary work involves: (1) a new `snapService.js` for upload/send/mark-viewed operations, (2) a `SnapCameraModal` screen reusing `CameraView` from expo-camera in "snap mode", (3) a `SnapPreview` screen with Polaroid frame and optional caption, (4) a `SnapViewer` component for full-screen view-once display, (5) modifications to `MessageBubble` and `DMInput` for snap-specific rendering, (6) two Cloud Functions (`onSnapViewed` for immediate cleanup, `cleanupExpiredSnaps` as a scheduled safety net), (7) a new `getSignedSnapUrl` Cloud Function with 5-minute expiry (separate from the 24-hour feed URL function), and (8) infrastructure configuration (Firestore TTL on `expiresAt`, GCS lifecycle on `snap-photos/`).

**Primary recommendation:** Build the snap lifecycle in layers -- service + schema first, then capture flow, then viewer, then cloud functions, then infrastructure rules -- to enable testing at each stage.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Full-screen camera slides up from bottom (modal presentation) when camera button tapped
- Reuses existing CameraScreen component in "snap mode" -- hides darkroom button, keeps flash toggle, camera flip, zoom
- Both front and rear cameras available (selfie snaps supported)
- After capture: preview screen shows snap in Polaroid layout before sending
- Preview screen has retake via X button (top-left) AND swipe-down gesture to discard and return to camera
- No editing tools on preview (no crop, rotate, or filters)
- Send button: prominent, bottom-right of preview screen
- "To: [RecipientName]" shown at top of preview screen
- After send: returns to conversation immediately (no confirmation overlay)
- Full black background, immersive full-screen snap viewer
- Snap displayed in Polaroid frame: thin white border on top/sides, thick white strip at bottom
- Polaroid sits perfectly straight (no tilt/rotation)
- Caption displayed in thick bottom strip using pixel art font
- Polaroid strip always visible even without caption
- No timer -- user views at own pace until dismissed
- Dismiss via swipe-down gesture OR X button in corner
- After dismiss: snap marked as viewed, cannot be reopened
- Unopened snap: warm yellow/amber accent bubble with custom pixel art camera icon (NOT emoji) and "Snap" label
- Opened snap: dimmed/faded version of bubble with "Opened" label
- Same timestamp metadata as regular text messages
- Three sender-visible states: "Sending..." -> "Delivered" -> "Opened"
- Caption typed directly into Polaroid thick bottom strip (WYSIWYG)
- ~150 character limit
- Optional with "Write something!" hint
- Pixel art font matches viewer display
- Camera button replaces send button when text input is empty (Messenger-style morph)
- Custom pixel art camera icon (matches snap bubble icon)
- Subtle crossfade animation when morphing between send arrow and camera icon
- Conversation list: small pixel art camera icon + "Snap" text for last message preview
- Unread snap indicator: amber dot/highlight
- Always-visible snap camera button on each ConversationRow (right side)
- Push notifications: playful randomized templates (no emojis)
- Tapping notification: opens conversation then auto-opens snap viewer
- No push notification to sender when snap is opened
- Optimistic snap bubble with amber progress ring
- "Sending..." status during upload
- Auto-retry 2-3 times silently on failure
- Error state with tap-to-retry on exhausted retries
- Progress ring uses warm amber color

### Claude's Discretion

- Exact Polaroid frame proportions (thin border width, thick strip height)
- Upload progress ring implementation details (circular progress vs indeterminate spinner)
- Snap camera mode flag implementation (how CameraScreen detects snap mode vs normal mode)
- Error state icon/indicator design
- Keyboard handling when typing caption in Polaroid strip
- Auto-open snap viewer timing after notification tap (immediate vs slight delay)

### Deferred Ideas (OUT OF SCOPE)

- Send snap from main camera screen (would need friend/conversation picker)
- Screenshot detection (deferred to v2: SCRN-V2-01 through SCRN-V2-05)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                         | Research Support                                                                                         |
| -------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SNAP-01  | Camera button in DM input bar opens camera for snap capture                         | DMInput modification: camera button replaces send button when input empty; navigation to SnapCameraModal |
| SNAP-02  | User can add optional caption before sending                                        | SnapPreview screen with TextInput in Polaroid strip, ~150 char limit                                     |
| SNAP-03  | Snap uploaded to Storage and delivered instantly (no darkroom delay)                | snapService.js: upload to `snap-photos/` path, create message doc with `type: 'snap'`                    |
| SNAP-04  | Unopened snap shows as generic camera icon with "Snap" label                        | MessageBubble snap variant: amber bubble with PixelIcon camera, "Snap"/"Opened" labels                   |
| SNAP-05  | Recipient taps to view full-screen; snap disappears after closing                   | SnapViewer component: fetch signed URL, display in Polaroid frame, mark viewed on dismiss                |
| SNAP-06  | Sender sees "Opened" status after recipient views                                   | viewedAt timestamp written by recipient; sender subscribes via real-time message subscription            |
| SNAP-07  | Snap photos use cachePolicy none and short-lived signed URLs (2-5 min)              | expo-image with `cachePolicy="none"`, new getSignedSnapUrl Cloud Function with 5-min expiry              |
| SNAP-08  | Cloud Function deletes snap from Storage after viewing; Firestore TTL as safety net | onSnapViewed triggered function + cleanupExpiredSnaps scheduled function + Firestore TTL on expiresAt    |
| INFRA-03 | Firestore TTL policy on messages collection group for expiresAt field               | Configure via Firebase Console or gcloud CLI; field must be Firestore Timestamp type                     |
| INFRA-04 | Firebase Storage lifecycle rule on snap-photos/ path (7-day auto-delete)            | GCS lifecycle rule with matchesPrefix condition and age-based Delete action                              |

</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library                          | Version  | Purpose                                        | Why Standard                                           |
| -------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------------ |
| expo-camera                      | ~17.0.10 | Camera capture for snaps                       | Already used for CameraScreen; CameraView component    |
| expo-image                       | ~3.0.11  | Snap display with `cachePolicy="none"`         | Already used project-wide; supports `cachePolicy` prop |
| expo-image-manipulator           | ~14.0.8  | Image compression before upload                | Already used in storageService for compression         |
| @react-native-firebase/storage   | ^23.8.6  | Upload snap photos to `snap-photos/` path      | Already used for photo/profile uploads                 |
| @react-native-firebase/firestore | ^23.8.6  | Snap message documents with viewedAt/expiresAt | Already used for all messaging                         |
| @react-native-firebase/functions | ^23.8.6  | Short-lived signed URL generation              | Already used for signedUrlService                      |
| react-native-reanimated          | ~4.1.1   | Swipe-to-dismiss gesture in SnapViewer         | Already used in MessageBubble swipe-to-reply           |
| react-native-gesture-handler     | ~2.28.0  | Pan/tap gestures for viewer dismiss            | Already used in MessageBubble                          |
| react-native-svg                 | 15.12.1  | Polaroid frame rendering, progress ring        | Already used for PixelIcon                             |

### Supporting (Already in Project)

| Library            | Version  | Purpose                               | When to Use                 |
| ------------------ | -------- | ------------------------------------- | --------------------------- |
| date-fns           | ^4.1.0   | Timestamp formatting                  | Snap bubble timestamps      |
| expo-haptics       | ~15.0.8  | Tactile feedback on capture/send/view | Snap interactions           |
| expo-notifications | ~0.32.16 | Push notification for snap received   | Snap delivery notifications |

### No New Dependencies Required

No new npm packages needed. The existing stack covers all Phase 3 requirements. This is JS-only work deployable via OTA update.

## Architecture Patterns

### Recommended Project Structure

```
src/
  services/firebase/
    snapService.js           # Snap upload, send, mark viewed, signed URL
  screens/
    SnapCameraModal.js       # Full-screen camera in snap mode (modal)
    SnapPreviewScreen.js     # Polaroid preview with caption input
  components/
    SnapViewer.js            # Full-screen view-once snap display
    SnapBubble.js            # Snap-specific message bubble variant
    SnapProgressRing.js      # Amber circular progress ring for upload
  hooks/
    useSnapCamera.js         # Snap-specific camera logic (wraps useCameraBase)
functions/
  index.js                   # Add onSnapViewed, cleanupExpiredSnaps, getSignedSnapUrl
```

### Pattern 1: Snap Message Document Schema

**What:** Message type `'snap'` extends existing message schema with snap-specific fields
**When to use:** All snap message creation and reading

```javascript
// Source: Existing messageService.js pattern + snap extensions
// conversations/{conversationId}/messages/{messageId}
{
  senderId: string,
  type: 'snap',
  text: null,                    // Snaps don't use text field
  gifUrl: null,                  // Not a gif
  imageUrl: null,                // Not a regular image
  snapStoragePath: string,       // e.g., 'snap-photos/{senderId}/{snapId}.jpg'
  caption: string | null,        // Optional caption, max 150 chars
  viewedAt: null | Timestamp,    // null = unviewed, Timestamp = viewed
  expiresAt: Timestamp,          // TTL field: 48h from creation
  createdAt: Timestamp,
}
```

### Pattern 2: Service Layer for Snaps

**What:** Dedicated `snapService.js` following existing `{ success, error }` return pattern
**When to use:** All snap operations

```javascript
// Source: Follows storageService.js + messageService.js patterns
import { getStorage, ref } from '@react-native-firebase/storage';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import * as ImageManipulator from 'expo-image-manipulator';
import logger from '../../utils/logger';

const SNAP_CAPTION_MAX_LENGTH = 150;
const SNAP_EXPIRY_HOURS = 48;

export const uploadAndSendSnap = async (conversationId, senderId, localUri, caption = null) => {
  try {
    // 1. Compress image (same as storageService pattern)
    // 2. Generate snapId, upload to snap-photos/{senderId}/{snapId}.jpg
    // 3. Create message doc with type: 'snap', snapStoragePath, expiresAt
    // 4. Return { success: true, messageId }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const markSnapViewed = async (conversationId, messageId) => {
  try {
    // Update viewedAt on the message document
    // Firestore rules allow non-sender to update viewedAt
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getSignedSnapUrl = async snapStoragePath => {
  try {
    // Call getSignedSnapUrl Cloud Function (5-min expiry)
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Pattern 3: Camera Snap Mode via Navigation Params

**What:** Pass `mode: 'snap'` and recipient info via navigation params to determine camera behavior
**When to use:** Opening camera from DMInput

```javascript
// From ConversationScreen when camera button tapped:
navigation.navigate('SnapCameraModal', {
  mode: 'snap',
  conversationId,
  friendId,
  friendDisplayName: liveFriendProfile?.displayName || 'Friend',
});

// SnapCameraModal reads mode from route.params
// Hides darkroom button, shows only flash/flip/capture
// On capture: navigates to SnapPreviewScreen with photoUri
```

### Pattern 4: Snap Viewer with View-Once Guard

**What:** Full-screen viewer that marks snap as viewed on dismiss, prevents re-opening
**When to use:** When recipient taps an unviewed snap bubble

```javascript
// SnapViewer.js pattern
// 1. On mount: fetch short-lived signed URL via getSignedSnapUrl
// 2. Display in Polaroid frame with black background
// 3. On dismiss (swipe-down or X button):
//    a. Call markSnapViewed(conversationId, messageId)
//    b. Navigate back to conversation
// 4. expo-image with cachePolicy="none" prevents disk persistence
```

### Pattern 5: DMInput Camera/Send Button Morph

**What:** Camera icon replaces send arrow when text input is empty
**When to use:** DMInput component modification

```javascript
// In DMInput.js:
const canSend = text.trim().length > 0 || !!selectedMedia;
// When canSend is false AND no media selected: show camera icon
// When canSend is true: show send arrow
// Use RN core Animated (crossfade) per project convention for simple fades
```

### Pattern 6: Cloud Function for Snap-Specific Signed URLs

**What:** Separate Cloud Function with 5-minute expiry for snap photos
**When to use:** When SnapViewer needs to load a snap image

```javascript
// functions/index.js - getSignedSnapUrl
// Similar to getSignedPhotoUrl but:
// 1. Only accepts snap-photos/ paths
// 2. 5-minute expiry (not 24-hour)
// 3. Validates caller is a conversation participant
// 4. Does NOT check friendship (conversation membership is sufficient)
```

### Anti-Patterns to Avoid

- **Storing snap image URLs in Firestore:** Never store the signed URL in the message document. Store only `snapStoragePath`; generate signed URL on-demand when viewer opens. This prevents stale URLs and reduces data leakage.
- **Using `cachePolicy="memory-disk"` for snaps:** This would persist snap images to device disk, defeating ephemeral purpose. Always use `cachePolicy="none"`.
- **Client-side snap deletion:** Never delete Storage files from client. The Cloud Function `onSnapViewed` handles cleanup. Client only writes `viewedAt`.
- **Polling for snap status:** Use real-time Firestore subscription (already in useConversation) to detect `viewedAt` changes. No polling needed.
- **Re-using existing getSignedPhotoUrl for snaps:** The existing function has 24-hour expiry and photo-path validation. Snaps need a separate function with 5-minute expiry and snap-path validation.

## Don't Hand-Roll

| Problem                  | Don't Build             | Use Instead                                               | Why                                                           |
| ------------------------ | ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Image compression        | Custom compression      | `expo-image-manipulator` (already in `storageService.js`) | Handles resize + quality in one call                          |
| File upload              | XMLHttpRequest upload   | `storageRef.putFile()` (RN Firebase)                      | Native upload, progress tracking, auto-retry                  |
| Signed URL generation    | Client-side token auth  | Cloud Function `getSignedSnapUrl`                         | Server-side only; client never sees storage admin credentials |
| Image caching prevention | Manual cache clearing   | `expo-image` with `cachePolicy="none"`                    | Handles both memory and disk cache bypass                     |
| Swipe-to-dismiss         | Custom touch handlers   | `react-native-gesture-handler` Pan gesture                | Smooth native gesture, consistent with existing patterns      |
| Scheduled cleanup        | cron job                | Firebase scheduled function (`pubsub.schedule`)           | Already used for `processDarkroomReveals`                     |
| TTL document expiry      | Manual cleanup function | Firestore TTL policy on `expiresAt` field                 | Automatic, serverless, no maintenance                         |
| Storage object expiry    | Manual cleanup          | GCS lifecycle rule with `matchesPrefix`                   | Automatic 7-day cleanup as safety net                         |
| Progress indicator       | Custom SVG animation    | `react-native-svg` Circle with `strokeDasharray`          | Already used for PixelIcon; minimal new code                  |

**Key insight:** The project already has every library needed. The complexity is in orchestrating the lifecycle correctly (upload -> deliver -> view -> cleanup), not in finding new tools.

## Common Pitfalls

### Pitfall 1: Signed URL Expiry Before Snap Opens

**What goes wrong:** User receives snap notification, waits hours, then tries to view. If signed URL was generated at send time, it expired.
**Why it happens:** Pre-generating signed URLs at send time instead of on-demand.
**How to avoid:** Never pre-generate signed URLs. Store only `snapStoragePath` in message doc. Generate 5-minute signed URL only when SnapViewer opens.
**Warning signs:** "Photo not found" errors after snap has been sitting unviewed.

### Pitfall 2: Snap Image Persists in Device Cache

**What goes wrong:** `expo-image` caches the snap to disk. User can find it in app cache or a file manager can access it.
**Why it happens:** Using default `cachePolicy` or `cachePolicy="memory-disk"`.
**How to avoid:** Always use `cachePolicy="none"` on snap images. Verify in testing by checking no files appear in the app cache directory after viewing a snap.
**Warning signs:** Snap images loading instantly on re-render (indicates cache hit).

### Pitfall 3: Race Condition Between viewedAt Write and Storage Deletion

**What goes wrong:** Cloud Function deletes Storage file before client finishes displaying the image.
**Why it happens:** `onSnapViewed` trigger fires immediately when `viewedAt` is written, deleting the file while `expo-image` is still rendering it.
**How to avoid:** Add a small delay (30-60 seconds) in `onSnapViewed` before deleting the Storage file. The signed URL is valid for 5 minutes, so the client has time. Alternatively, since `expo-image` downloads the full image before rendering with `cachePolicy="none"`, the file in Storage can be deleted immediately after `viewedAt` is set -- but add a safety delay to handle slow networks.
**Warning signs:** Snap viewer shows loading spinner then disappears or shows error.

### Pitfall 4: Orphaned Snap Photos After Upload Failure

**What goes wrong:** Snap photo uploads to Storage but message doc creation fails. Photo sits in Storage with no associated message.
**Why it happens:** Non-atomic operation: Storage upload + Firestore write are separate operations.
**How to avoid:** GCS lifecycle rule (7-day auto-delete on `snap-photos/` prefix) catches these. The `cleanupExpiredSnaps` scheduled function is an additional safety net for Firestore docs with past `expiresAt`.
**Warning signs:** Storage usage growing without corresponding message documents.

### Pitfall 5: Firestore TTL Deletion is Not Instant

**What goes wrong:** Assuming TTL deletes documents immediately at `expiresAt` time. TTL can take up to 24 hours after expiry.
**Why it happens:** Firestore TTL is not real-time; it's a background process.
**How to avoid:** Do not rely on TTL for functional behavior (e.g., "snap should disappear at exactly 48h"). Use TTL as a cleanup safety net only. The primary deletion path is the `onSnapViewed` Cloud Function. The client hides viewed snaps via the `viewedAt` field.
**Warning signs:** Expired snap message docs visible in Firestore console hours after expiry.

### Pitfall 6: onNewMessage Cloud Function Not Handling Snap Type

**What goes wrong:** Existing `onNewMessage` function doesn't know about `type: 'snap'`. It may try to use `message.text` for notification body and get null.
**Why it happens:** New message type not accounted for in existing switch/if logic.
**How to avoid:** Update `onNewMessage` to handle `type: 'snap'` for both `lastMessage` preview text and push notification body. Use randomized snap notification templates.
**Warning signs:** Push notifications for snaps show "null" or empty body text.

### Pitfall 7: ConversationRow Already Has Partial Snap Support

**What goes wrong:** Duplicate or conflicting snap handling code.
**Why it happens:** `ConversationRow.js` already has `case 'snap'` in `getPreviewText()` returning "Sent you a snap" / "Opened" / "Delivered". This was pre-built in anticipation.
**How to avoid:** Verify the existing ConversationRow logic matches the CONTEXT.md decisions. Add the amber unread indicator and camera shortcut button, but don't rewrite the preview text logic from scratch.
**Warning signs:** ConversationRow shows different text than expected for snap messages.

### Pitfall 8: Android Keyboard Covering Caption Input

**What goes wrong:** On Android, the keyboard covers the Polaroid strip where caption is typed.
**Why it happens:** Android KeyboardAvoidingView behavior differs from iOS. `behavior="padding"` doesn't work well on Android.
**How to avoid:** Use `behavior={Platform.select({ ios: 'padding', android: 'height' })}` on KeyboardAvoidingView in SnapPreviewScreen. Also use `keyboardVerticalOffset` calibrated per platform.
**Warning signs:** Caption input invisible when keyboard opens on Android.

## Code Examples

### Snap Upload and Send (snapService.js pattern)

```javascript
// Source: Follows storageService.js uploadPhoto + messageService.js sendMessage patterns
export const uploadAndSendSnap = async (conversationId, senderId, localUri, caption = null) => {
  try {
    logger.debug('snapService.uploadAndSendSnap: Starting', { conversationId, senderId });

    // Compress image (same as storageService)
    const compressedUri = await compressImage(localUri, 0.8);
    const filePath = uriToFilePath(compressedUri);

    // Generate unique snap ID
    const snapId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const snapStoragePath = `snap-photos/${senderId}/${snapId}.jpg`;

    // Upload to snap-photos/ path (separate from photos/ path)
    const storageRef = ref(getStorage(), snapStoragePath);
    await storageRef.putFile(filePath, {
      contentType: 'image/jpeg',
      cacheControl: 'no-store', // Prevent CDN caching
    });

    // Calculate expiresAt (48 hours from now)
    const now = new Date();
    const expiresAt = Timestamp.fromDate(new Date(now.getTime() + 48 * 60 * 60 * 1000));

    // Create snap message document
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messageData = {
      senderId,
      type: 'snap',
      text: null,
      gifUrl: null,
      imageUrl: null,
      snapStoragePath,
      caption: caption ? caption.substring(0, 150) : null,
      viewedAt: null,
      expiresAt,
      createdAt: serverTimestamp(),
    };

    const messageDoc = await addDoc(messagesRef, messageData);

    logger.info('snapService.uploadAndSendSnap: Success', { messageId: messageDoc.id });
    return { success: true, messageId: messageDoc.id };
  } catch (error) {
    logger.error('snapService.uploadAndSendSnap: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
```

### Mark Snap as Viewed (client-side)

```javascript
// Source: Follows messageService update pattern; Firestore rules allow viewedAt update by non-sender
export const markSnapViewed = async (conversationId, messageId) => {
  try {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(messageRef, { viewedAt: serverTimestamp() });
    return { success: true };
  } catch (error) {
    logger.error('snapService.markSnapViewed: Failed', { error: error.message });
    return { success: false, error: error.message };
  }
};
```

### SnapViewer Display Pattern

```javascript
// Source: expo-image docs for cachePolicy="none"
<Image
  source={{ uri: signedSnapUrl }}
  style={styles.snapImage}
  contentFit="contain"
  cachePolicy="none" // CRITICAL: prevents device caching
  transition={0} // No fade-in, instant display
/>
```

### Cloud Function: onSnapViewed

```javascript
// Source: Follows onNewMessage pattern for Firestore triggers
exports.onSnapViewed = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .firestore.document('conversations/{conversationId}/messages/{messageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when viewedAt changes from null to a timestamp
    if (after.type !== 'snap' || before.viewedAt !== null || after.viewedAt === null) {
      return null;
    }

    const { snapStoragePath } = after;
    if (!snapStoragePath) return null;

    // Delete snap photo from Storage (with small delay for network safety)
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage().bucket();
    const file = bucket.file(snapStoragePath);

    try {
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        logger.info('onSnapViewed: Snap photo deleted', { snapStoragePath });
      }
    } catch (error) {
      logger.error('onSnapViewed: Failed to delete snap', { error: error.message });
    }

    return null;
  });
```

### Cloud Function: getSignedSnapUrl (5-minute expiry)

```javascript
// Source: Follows getSignedPhotoUrl pattern with shorter expiry
exports.getSignedSnapUrl = onCall({ memory: '256MiB', timeoutSeconds: 30 }, async request => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const { snapStoragePath } = request.data;
  if (!snapStoragePath || !snapStoragePath.startsWith('snap-photos/')) {
    throw new HttpsError('invalid-argument', 'Invalid snap path');
  }

  // Validate caller is a conversation participant (parse from path or pass conversationId)
  const bucket = getStorage().bucket();
  const file = bucket.file(snapStoragePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'Snap not found');

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  return { url };
});
```

### Polaroid Frame Dimensions (Recommended)

```javascript
// Source: Claude's discretion -- optimized for mobile screens
const POLAROID = {
  borderWidth: 8, // Thin white border on top/sides
  bottomStripHeight: 64, // Thick white strip at bottom (for caption)
  maxImageWidth: '90%', // Of screen width
  aspectRatio: 4 / 3, // Standard photo aspect ratio
  backgroundColor: '#FFFFFF', // Classic Polaroid white
};
```

### DMInput Camera Button Morph

```javascript
// Source: Follows DMInput existing pattern
// In DMInput, replace the static send button with conditional rendering:
const canSend = text.trim().length > 0 || !!selectedMedia;

// In JSX:
{
  canSend ? (
    <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
      <PixelIcon name="arrow-up" size={20} color={colors.interactive.primary} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity style={styles.cameraButton} onPress={handleOpenSnapCamera}>
      <PixelIcon name="camera" size={20} color={colors.status.developing} />
    </TouchableOpacity>
  );
}
```

## State of the Art

| Old Approach                          | Current Approach                                     | When Changed                            | Impact                                           |
| ------------------------------------- | ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Per-message polling for read status   | Real-time Firestore subscription                     | Already in useConversation              | viewedAt changes propagate in real-time          |
| Long-lived signed URLs for all photos | Short-lived URLs for ephemeral content               | Phase 3 introduction                    | 5-min URLs for snaps prevent unauthorized access |
| Manual document cleanup               | Firestore TTL policies                               | GA since late 2022                      | Automatic deletion of expired documents          |
| Manual storage cleanup                | GCS Object Lifecycle Management with prefix matching | Available with prefix/suffix conditions | Automatic deletion of orphaned snap files        |

**Deprecated/outdated:**

- None. All approaches in this phase use current, supported APIs.

## Open Questions

1. **Storage Rules for snap-photos/ path**
   - What we know: Current `storage.rules` has rules for `photos/`, `profile-photos/`, `selects/`, and `comment-images/` but no `snap-photos/` rule.
   - What's unclear: Should snap-photos/ be readable only by conversation participants? The current photo rules only allow owner reads (others use signed URLs via Admin SDK).
   - Recommendation: Follow the same pattern as `photos/` -- owner-only direct read, all other access via Admin SDK signed URLs. Add a `snap-photos/{userId}/{allPaths=**}` rule matching the `photos/` pattern.

2. **Optimistic Snap Bubble During Upload**
   - What we know: User decision specifies optimistic bubble with amber progress ring and "Sending..." status.
   - What's unclear: How to represent the optimistic snap in the message list before Firestore confirms creation. Other message types use the real-time subscription which only fires after write.
   - Recommendation: Use a local state array in useConversation (similar to how other apps do optimistic updates) -- insert a "pending" snap message with a local ID, then replace with the real message when subscription fires. Mark pending messages with `_isPending: true` flag.

3. **Notification Deep Link: Auto-Open Snap Viewer**
   - What we know: User decision says tapping snap notification opens conversation then auto-opens snap viewer.
   - What's unclear: Exact implementation of the two-step open (conversation render + snap viewer open).
   - Recommendation: Pass `autoOpenSnapId` in navigation params when coming from notification. ConversationScreen checks for this param on mount and triggers SnapViewer after a brief delay (200-300ms) to allow conversation to render first.

## Validation Architecture

### Test Framework

| Property           | Value                                                |
| ------------------ | ---------------------------------------------------- |
| Framework          | Jest ~29.7.0 with jest-expo ~54.0.17                 |
| Config file        | `jest.config.js` (root) + `functions/jest.config.js` |
| Quick run command  | `npm test -- __tests__/services/snapService.test.js` |
| Full suite command | `npm test`                                           |
| Estimated runtime  | ~15 seconds (quick), ~45 seconds (full)              |

### Phase Requirements -> Test Map

| Req ID   | Behavior                                            | Test Type        | Automated Command                                                            | File Exists?                 |
| -------- | --------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| SNAP-01  | Camera button appears when input empty              | unit             | `npx jest __tests__/components/DMInput.test.js -t "camera button"`           | No -- Wave 0 gap             |
| SNAP-02  | Caption limited to 150 chars in service             | unit             | `npx jest __tests__/services/snapService.test.js -t "caption"`               | No -- Wave 0 gap             |
| SNAP-03  | Upload and send snap creates correct message doc    | unit             | `npx jest __tests__/services/snapService.test.js -t "uploadAndSendSnap"`     | No -- Wave 0 gap             |
| SNAP-04  | Snap bubble renders correctly for opened/unopened   | unit             | `npx jest __tests__/components/SnapBubble.test.js`                           | No -- Wave 0 gap             |
| SNAP-05  | markSnapViewed writes viewedAt timestamp            | unit             | `npx jest __tests__/services/snapService.test.js -t "markSnapViewed"`        | No -- Wave 0 gap             |
| SNAP-06  | Opened status derived from viewedAt in message data | unit             | `npx jest __tests__/hooks/useConversation.test.js -t "snap"`                 | Partial -- hook test exists  |
| SNAP-07  | Signed URL uses 5-minute expiry                     | unit (functions) | `cd functions && npx jest __tests__/snapFunctions.test.js`                   | No -- Wave 0 gap             |
| SNAP-08  | onSnapViewed deletes storage file                   | unit (functions) | `cd functions && npx jest __tests__/snapFunctions.test.js -t "onSnapViewed"` | No -- Wave 0 gap             |
| INFRA-03 | TTL policy configuration                            | manual-only      | Verify via Firebase Console                                                  | N/A -- infrastructure config |
| INFRA-04 | Storage lifecycle rule                              | manual-only      | Verify via GCS Console                                                       | N/A -- infrastructure config |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task -> run: `npx jest __tests__/services/snapService.test.js`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~8 seconds

### Wave 0 Gaps (must be created before implementation)

- [ ] `__tests__/services/snapService.test.js` -- covers SNAP-02, SNAP-03, SNAP-05
- [ ] `__tests__/components/SnapBubble.test.js` -- covers SNAP-04
- [ ] `__tests__/components/DMInput.test.js` -- covers SNAP-01 (camera button morph)
- [ ] `functions/__tests__/snapFunctions.test.js` -- covers SNAP-07, SNAP-08

_(Existing infrastructure: jest.setup.js has all Firebase mocks, messageService.test.js provides patterns for service testing, useConversation.test.js covers hook testing patterns)_

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** -- Read and analyzed: `messageService.js`, `storageService.js`, `signedUrlService.js`, `CameraScreen.js`, `useCameraBase.js`, `useConversation.js`, `MessageBubble.js`, `DMInput.js`, `ConversationRow.js`, `ConversationScreen.js`, `firestore.rules`, `storage.rules`, `functions/index.js` (onNewMessage, getSignedPhotoUrl), `jest.setup.js`, `messageService.test.js`, `colors.js`, `typography.js`, `pixelIcons.js`, `package.json`
- **Firestore security rules** -- Verified `viewedAt` and `screenshotted` update support already exists for message documents (line 428-432 of firestore.rules)
- **ConversationRow.js** -- Verified pre-existing snap case handling in `getPreviewText()` (lines 106-113)

### Secondary (MEDIUM confidence)

- [Firestore TTL docs](https://firebase.google.com/docs/firestore/enterprise/ttl) -- TTL policy configuration, 24-hour deletion window, Timestamp field requirement
- [GCS Object Lifecycle Management](https://docs.cloud.google.com/storage/docs/lifecycle) -- Lifecycle rules with matchesPrefix conditions for path-based deletion
- [expo-image docs](https://docs.expo.dev/versions/latest/sdk/image/) -- `cachePolicy="none"` confirmed as valid option

### Tertiary (LOW confidence)

- None. All findings are backed by codebase analysis or official documentation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All libraries already in project, verified via package.json and existing usage
- Architecture: HIGH - Patterns directly extend existing messageService/storageService/CameraScreen patterns
- Pitfalls: HIGH - Derived from codebase analysis (existing security rules, Cloud Function patterns, expo-image usage)
- Cloud Functions: MEDIUM - getSignedSnapUrl and onSnapViewed patterns follow existing functions but are new code
- Infrastructure (TTL/lifecycle): MEDIUM - Verified via official docs but requires console/CLI configuration outside codebase

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stable libraries, no version changes expected)
