# Phase 8: Screenshot Detection - Research

**Researched:** 2026-02-25
**Domain:** Screenshot detection, real-time messaging events, push notifications
**Confidence:** HIGH

## Summary

Screenshot detection for snap messages requires three interconnected layers: (1) client-side detection using `expo-screen-capture`'s `addScreenshotListener`, (2) a Firestore write path that creates a system message in the conversation and sets `screenshottedAt` on the snap message document, and (3) a Cloud Function that sends a push notification to the snap sender. The user has explicitly decided against a visual indicator on the snap bubble -- instead, a system message in the conversation thread (styled like date separators) is the only in-chat visual.

The existing codebase has all the plumbing needed: `messageService.js` handles message creation, `onNewMessage` Cloud Function handles push notifications for new messages, `notificationService.js` handles deep linking from notifications to conversations, and `SnapViewer.js` is the exact component where detection should be active. The primary new dependency is `expo-screen-capture` (v8.0.x for SDK 54), which is a native module and therefore **requires a new EAS build** -- it cannot be deployed via OTA update alone.

**Primary recommendation:** Use `expo-screen-capture`'s `addScreenshotListener` inside SnapViewer, write `screenshottedAt` directly from the client via Firestore `updateDoc`, create a system message document in the messages subcollection, and let the existing `onNewMessage` Cloud Function handle push notification delivery for the new `screenshot` message type.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Detection triggers only while the recipient is actively viewing a snap in the full-screen snap viewer
- Screen recording also triggers detection (same as screenshot)
- If the platform API is unavailable (some Android devices), fail silently -- no error shown, some screenshots may go undetected
- Detection only -- do not block/prevent screenshots
- Self-screenshots are ignored (sender screenshotting their own snap does nothing)
- Both users see a system message in the conversation when a screenshot is detected
- System message names the screenshotter: "Alex screenshotted a snap"
- Message does not identify which specific snap -- just that a screenshot happened
- No persistent badge/icon on the snap bubble itself -- system message is the only visual
- Only the snap sender receives a push notification (not the screenshotter)
- Neutral/factual tone: "Alex screenshotted your snap"
- Tapping the notification deep-links to the conversation
- Respects existing notification mute settings -- if conversation is muted, screenshot notifications are also muted
- Screenshot events do NOT appear in the Activity screen -- conversation + push only
- Small centered gray text, same style as date separators in the conversation
- Standard UI font (not pixel art font)
- No inline timestamp -- the message's position in the conversation provides timing context
- Only the first screenshot of a given snap triggers detection, notification, and system message -- subsequent screenshots of the same snap are ignored
- `screenshottedAt` timestamp is set once on the snap message document and not updated on repeat screenshots
- If the device is offline when a screenshot is detected, queue the event locally and sync when back online (retry until successful)
- Only active snaps trigger detection -- expired or deleted snaps are ignored even if still rendered on screen

### Claude's Discretion
- Notification batching strategy for rapid multiple-snap screenshots
- Exact implementation of offline queue/retry mechanism
- Screen recording detection API choice per platform
- System message Firestore document structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRN-01 | Sender receives push notification when recipient screenshots their snap | `expo-screen-capture` `addScreenshotListener` triggers detection; system message with `type: 'system_screenshot'` written to conversation; `onNewMessage` Cloud Function sends push notification to sender |
| SCRN-02 | Screenshotted snaps display a visual indicator on the snap bubble in conversation | **USER OVERRIDE**: No visual indicator on snap bubble. Instead, a system message (styled like TimeDivider) appears in the conversation thread. The `screenshottedAt` field on the snap document still satisfies the data requirement. |
| SCRN-03 | Screenshot event is recorded on the snap message document (`screenshottedAt` field) | Client writes `screenshottedAt: serverTimestamp()` via `updateDoc` on the snap message document when screenshot is detected and snap has no existing `screenshottedAt` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-screen-capture | ~8.0.9 | Screenshot/screen recording detection | Official Expo SDK module; included in SDK 54; Android 14+ fix landed in SDK 54 (PR #31702) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-native-firebase/firestore | ^23.8.6 | Write screenshottedAt + system message | Already in project; used for all Firestore operations |
| @react-native-async-storage/async-storage | 2.2.0 | Offline queue persistence | Already in project; used by uploadQueueService for similar pattern |
| expo-notifications | ~0.32.16 | Push notification delivery (server-side via Cloud Function) | Already in project; notification pipeline fully built |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-screen-capture | react-native-capture-protection | More features (app switcher protection) but adds an external dependency outside Expo ecosystem; expo-screen-capture is simpler and sufficient for detection-only |
| expo-screen-capture | react-native-screenshot-aware | Newer, focused on Android 14+ API, but less battle-tested and not part of Expo SDK |

**Installation:**
```bash
npx expo install expo-screen-capture
```

**CRITICAL: This is a native module.** Adding `expo-screen-capture` requires a new EAS build for both platforms. OTA update alone is insufficient.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/firebase/
│   ├── screenshotService.js      # Screenshot event recording (Firestore writes)
│   └── messageService.js         # Existing — system message type support
├── hooks/
│   └── useScreenshotDetection.js # Hook wrapping expo-screen-capture listener
├── components/
│   ├── SnapViewer.js             # Existing — integrates screenshot detection hook
│   └── SystemMessage.js          # New — renders system messages in conversation
└── services/
    └── screenshotQueueService.js # Offline queue for screenshot events
```

### Pattern 1: Screenshot Detection Hook
**What:** Custom hook that activates `addScreenshotListener` only when a snap is being viewed by the recipient.
**When to use:** Inside SnapViewer component when `visible === true` and viewer is the recipient (not sender).
**Example:**
```javascript
// Source: expo-screen-capture docs + project patterns
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useRef } from 'react';

const useScreenshotDetection = ({ active, onScreenshot }) => {
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!active) {
      listenerRef.current?.remove();
      listenerRef.current = null;
      return;
    }

    listenerRef.current = ScreenCapture.addScreenshotListener(() => {
      onScreenshot();
    });

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [active, onScreenshot]);
};
```

### Pattern 2: System Message Document Structure
**What:** A new message type in the conversation messages subcollection that both users see.
**When to use:** When a screenshot event occurs, create this document alongside updating `screenshottedAt`.
**Example:**
```javascript
// System message document in conversations/{id}/messages/{auto-id}
{
  senderId: null,                    // System messages have no sender
  type: 'system_screenshot',         // New message type
  text: 'Alex screenshotted a snap', // Pre-rendered text
  screenshotterId: 'abc123',         // Who took the screenshot
  snapMessageId: 'xyz789',           // Which snap was screenshotted (for dedup)
  gifUrl: null,
  imageUrl: null,
  createdAt: serverTimestamp(),
}
```

### Pattern 3: Idempotent Screenshot Recording
**What:** Use Firestore transaction or check-then-write to ensure only first screenshot triggers the full flow.
**When to use:** Always -- prevents duplicate system messages if listener fires multiple times.
**Example:**
```javascript
// Check screenshottedAt before writing
const messageRef = doc(db, 'conversations', conversationId, 'messages', snapMessageId);
const snapDoc = await getDoc(messageRef);
const snapData = snapDoc.data();

// Only proceed if not already screenshotted
if (snapData?.screenshottedAt) {
  return { success: true, alreadyScreenshotted: true };
}

// Write screenshottedAt + create system message
await updateDoc(messageRef, { screenshottedAt: serverTimestamp() });
// Then create system message...
```

### Pattern 4: Offline Queue with AsyncStorage
**What:** Queue screenshot events locally when offline, process when connectivity returns.
**When to use:** When Firestore write fails due to network error.
**Example pattern:** Mirror `uploadQueueService.js` -- AsyncStorage key, sequential processing, exponential backoff retries.

### Anti-Patterns to Avoid
- **Writing from Cloud Function instead of client:** The client already has all the context (conversationId, snapMessageId, screenshotterId). A callable function adds latency. Write directly from client and let `onNewMessage` handle the notification.
- **Using `onUpdate` trigger for screenshottedAt:** The `onSnapViewed` pattern (triggering on `viewedAt` change) works because there is only one transition. For `screenshottedAt`, the client already knows this is a screenshot event, so creating a dedicated system message document is cleaner than intercepting a field change.
- **Blocking screenshots (usePreventScreenCapture):** User explicitly decided detection-only. Do NOT prevent.
- **Storing screenshot state in conversation document:** Keep it on the message document where it belongs. The system message provides the conversation-level visibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screenshot detection | FileSystem observer, MediaStore listener | `expo-screen-capture` `addScreenshotListener` | Cross-platform, handles Android 14 API, iOS native observer; hand-rolling requires deep native knowledge |
| Offline queue | Custom retry logic from scratch | AsyncStorage + pattern from `uploadQueueService.js` | Project already has this pattern; proven reliable |
| Push notifications | Custom FCM integration | Existing `onNewMessage` Cloud Function + `sendPushNotification` | Full pipeline already exists; just add handling for new message type |
| System message rendering | Complex custom component | Extend existing `TimeDivider` or create minimal `SystemMessage` with same styling | TimeDivider already has the exact visual style needed (centered gray text, standard font) |

**Key insight:** The codebase already has 90% of the infrastructure. The screenshot detection layer is a thin integration -- the real work is wiring it through the existing message/notification pipeline correctly.

## Common Pitfalls

### Pitfall 1: expo-screen-capture Requires Native Build
**What goes wrong:** Developer installs the package and tries to deploy via OTA update. The app crashes because the native module is not present in the existing build.
**Why it happens:** `expo-screen-capture` includes native code (Android Activity callback, iOS notification observer). OTA only delivers JS bundles.
**How to avoid:** Add `expo-screen-capture` to `app.json` plugins if needed, run `npx expo install expo-screen-capture`, then create a new EAS build for both platforms before deploying any JS changes.
**Warning signs:** `Invariant Violation: Native module ... not found` error at runtime.

### Pitfall 2: Android Permission for Screenshot Detection on API < 34
**What goes wrong:** `addScreenshotListener` silently fails on Android 13 and below because `READ_MEDIA_IMAGES` permission is not declared.
**Why it happens:** Android 14+ uses the native `registerScreenCaptureCallback` API (no permission needed). Android 13 and below uses a MediaStore observer that requires `READ_MEDIA_IMAGES`.
**How to avoid:** Per user decision, fail silently on devices where API is unavailable. Do NOT add `READ_MEDIA_IMAGES` permission -- it triggers a Google Play policy review and is overkill for screenshot detection. Accept that detection only works on Android 14+ and all iOS devices.
**Warning signs:** No screenshots detected on older Android devices in testing.

### Pitfall 3: Duplicate System Messages from Rapid Screenshots
**What goes wrong:** User takes multiple screenshots quickly, each triggering the listener. Multiple system messages appear in the conversation.
**Why it happens:** `addScreenshotListener` fires for every screenshot event. Without deduplication, each fire creates a new system message.
**How to avoid:** Check `screenshottedAt` on the snap document before creating a system message. Use a local ref to debounce within the hook (e.g., `alreadyDetectedRef`).
**Warning signs:** Multiple "Alex screenshotted a snap" messages appearing for the same snap.

### Pitfall 4: onNewMessage Skipping System Messages
**What goes wrong:** The `onNewMessage` Cloud Function doesn't recognize `type: 'system_screenshot'` and either errors out or skips notification delivery.
**Why it happens:** The function has explicit handling for `'text'`, `'gif'`, `'image'`, `'reaction'`, `'snap'`, `'tagged_photo'` but not system messages.
**How to avoid:** Add `'system_screenshot'` handling to `onNewMessage`: update conversation metadata (lastMessage preview), send push notification only to the snap sender (not both participants), and respect notification mute settings.
**Warning signs:** No push notification received when screenshot is taken.

### Pitfall 5: System Messages Breaking Conversation UI
**What goes wrong:** System messages render as regular `MessageBubble` components with missing sender info, causing layout issues or crashes.
**Why it happens:** `ConversationScreen.renderItem` and `MessageBubble` assume all non-divider items have a `senderId`.
**How to avoid:** Filter system messages in `messagesWithDividers` processing or add an `itemType: 'system'` check in `renderItem` that delegates to `SystemMessage` component instead of `MessageBubble`.
**Warning signs:** Crash on `isCurrentUser` check when `senderId` is null.

### Pitfall 6: SnapViewer Not Mounted During Screen Recording
**What goes wrong:** User starts screen recording before opening the snap, so `addScreenshotListener` is not active when the recording begins.
**Why it happens:** `addScreenshotListener` detects screenshots taken while the listener is active. It does not retroactively detect recordings started before the listener was added.
**How to avoid:** Accept this limitation. `expo-screen-capture` fires the listener when a screenshot/recording event occurs while the listener is active. Screen recording that was already in progress when SnapViewer opens may not trigger the callback on all platforms. This is an acceptable tradeoff per user's "fail silently" decision.
**Warning signs:** Screen recordings go undetected if started before snap viewer opens.

## Code Examples

Verified patterns from official sources and existing codebase:

### Adding Screenshot Listener (expo-screen-capture docs)
```javascript
// Source: https://docs.expo.dev/versions/latest/sdk/screen-capture/
import * as ScreenCapture from 'expo-screen-capture';

// Subscribe
const subscription = ScreenCapture.addScreenshotListener(() => {
  // Called when user takes a screenshot
});

// Cleanup
subscription.remove();
```

### Updating Snap Message Document (existing project pattern from snapService.js)
```javascript
// Source: src/services/firebase/snapService.js markSnapViewed pattern
import { doc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';

const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
await updateDoc(messageRef, {
  screenshottedAt: serverTimestamp(),
});
```

### Creating System Message (existing project pattern from messageService.js)
```javascript
// Source: messageService.js addDoc pattern for new message types
import { collection, addDoc, serverTimestamp } from '@react-native-firebase/firestore';

const messagesRef = collection(db, 'conversations', conversationId, 'messages');
const systemMessage = {
  senderId: null,
  type: 'system_screenshot',
  text: `${screenshotterName} screenshotted a snap`,
  screenshotterId: currentUserId,
  snapMessageId: snapMessageId,
  gifUrl: null,
  imageUrl: null,
  createdAt: serverTimestamp(),
};
await addDoc(messagesRef, systemMessage);
```

### Push Notification Deep Link (existing project pattern from notificationService.js)
```javascript
// Source: src/services/firebase/notificationService.js handleNotificationTapped
case 'screenshot':
  return {
    success: true,
    data: {
      type: 'screenshot',
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

### System Message Rendering (same style as TimeDivider)
```javascript
// Source: src/components/TimeDivider.js styles
const styles = StyleSheet.create({
  text: {
    fontSize: 10,
    color: colors.text.secondary,       // Gray text
    fontFamily: typography.fontFamily.body, // Standard UI font
    textAlign: 'center',                // Centered
    marginVertical: 16,
    paddingHorizontal: 16,
  },
});
```

### Offline Queue Pattern (existing project pattern)
```javascript
// Source: src/services/uploadQueueService.js pattern
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@screenshotQueue';

const queueScreenshotEvent = async (event) => {
  const existing = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
  existing.push(event);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
};

const processScreenshotQueue = async () => {
  const queue = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
  for (const event of queue) {
    // Try to write to Firestore, remove from queue on success
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Android MediaStore observer for screenshot detection | Android 14 `registerScreenCaptureCallback` API | Android 14 (2023) | No permission needed on API 34+; `expo-screen-capture` handles this transparently |
| expo-screen-capture broken on Android 14 | Fixed in SDK 54 (PR #31702) | SDK 54 (Sept 2025) | `addScreenshotListener` works on Android 14+ without calling `allowScreenCaptureAsync` first |
| READ_EXTERNAL_STORAGE for screenshot detection | READ_MEDIA_IMAGES on API 33, no permission on API 34+ | Android 13/14 | Simplified permission model; project targets API 34+ primarily |

**Deprecated/outdated:**
- `ScreenCapture.isAvailableAsync()` -- not needed in SDK 54; the listener API handles availability gracefully
- Manual `FileSystemObserver` for screenshot detection on Android -- replaced by native API

## Open Questions

1. **Screen recording detection on iOS**
   - What we know: `expo-screen-capture` docs say it detects screen recordings. `addScreenshotListener` fires for both screenshots and screen recordings on iOS.
   - What's unclear: Whether the listener fires at the START of recording or only when a screenshot is taken during recording. iOS `UIScreen.capturedDidChangeNotification` fires when recording starts/stops, but `addScreenshotListener` may only fire for screenshots.
   - Recommendation: Accept the listener's behavior as-is. If it fires for recordings, great. If not, this is an acceptable limitation. Do not add a separate recording detection layer. LOW confidence on exact recording detection behavior.

2. **Firestore security rules for screenshottedAt**
   - What we know: The client (recipient) needs to update the snap message document to set `screenshottedAt`. Current rules allow the non-sender to update `viewedAt`.
   - What's unclear: Whether the existing Firestore rules also allow setting `screenshottedAt`, or if a new rule is needed.
   - Recommendation: Plan should include verifying/updating Firestore rules to allow the non-sender participant to write `screenshottedAt` on snap message documents.

3. **onNewMessage behavior for system messages with null senderId**
   - What we know: `onNewMessage` parses `recipientId` from `conversationId.split('_')` using `senderId` to determine the other participant. System messages have `senderId: null`.
   - What's unclear: How `onNewMessage` will handle `null` senderId without crashing.
   - Recommendation: Either (a) set `senderId` on system messages to the screenshotter's ID and add special handling, or (b) skip the `onNewMessage` trigger entirely and use a dedicated Cloud Function (`onScreenshotMessage`) that triggers on message creation with `type === 'system_screenshot'`. Option (a) is simpler -- the Cloud Function already has the sender/recipient logic.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with jest-expo preset |
| Config file | `jest.config.js` (root) and `functions/jest.config.js` |
| Quick run command | `npx jest __tests__/services/screenshotService.test.js --verbose` |
| Full suite command | `npm test` |
| Estimated runtime | ~15 seconds (client tests); ~8 seconds (functions tests) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRN-01 | Push notification sent to sender on screenshot | unit (Cloud Function) | `cd functions && npx jest __tests__/triggers/screenshotNotification.test.js -x` | No -- Wave 0 gap |
| SCRN-02 | System message created in conversation (user override: no bubble indicator) | unit (service) | `npx jest __tests__/services/screenshotService.test.js -x` | No -- Wave 0 gap |
| SCRN-03 | screenshottedAt timestamp set on snap message document | unit (service) | `npx jest __tests__/services/screenshotService.test.js -x` | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npx jest __tests__/services/screenshotService.test.js --verbose`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~15 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `__tests__/services/screenshotService.test.js` -- covers SCRN-02, SCRN-03 (Firestore writes: screenshottedAt update, system message creation, idempotency, offline queue)
- [ ] `functions/__tests__/triggers/screenshotNotification.test.js` -- covers SCRN-01 (onNewMessage handling for system_screenshot type, push notification to sender only, notification preferences check)
- [ ] Mock for `expo-screen-capture` in `__tests__/setup/jest.setup.js` -- needed for any hook-level tests

## Sources

### Primary (HIGH confidence)
- [expo-screen-capture official docs](https://docs.expo.dev/versions/latest/sdk/screen-capture/) -- API signatures, permission requirements, platform behavior
- Codebase analysis: `src/services/firebase/messageService.js`, `src/services/firebase/snapService.js`, `src/components/SnapViewer.js`, `src/screens/ConversationScreen.js`, `functions/index.js`, `functions/notifications/sender.js`

### Secondary (MEDIUM confidence)
- [GitHub issue #31678](https://github.com/expo/expo/issues/31678) -- Android 14+ screenshot listener fix, confirmed resolved in SDK 54 via PR #31702
- [Android screenshot detection API docs](https://developer.android.com/about/versions/14/features/screenshot-detection) -- Android 14 native API reference

### Tertiary (LOW confidence)
- Screen recording detection exact behavior -- iOS fires `capturedDidChangeNotification` for recording state changes, but unclear if `addScreenshotListener` wraps this or only listens for screenshots

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `expo-screen-capture` is the obvious and only choice for Expo SDK 54; fix for Android 14 confirmed in SDK 54
- Architecture: HIGH -- codebase has clear patterns for message types, notification pipeline, offline queues; all pieces exist
- Pitfalls: HIGH -- major pitfalls documented from real GitHub issues and codebase analysis
- Screen recording detection: LOW -- exact behavior unverified from official source

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain, Expo SDK 54 is current)
