# Phase 10: Pinned Snaps Android - Research

**Researched:** 2026-02-25
**Domain:** Android persistent notifications with image thumbnails via expo-notifications
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Notification appearance
- Use Android's built-in `BigPictureStyle` for the snap thumbnail -- native feel, no custom RemoteViews
- Title: "Pinned snap from [Name]", body: caption text (or "Tap to view" if no caption)
- Notification arrives as heads-up (high priority) then persists in the notification shade
- Sound + vibrate on arrival, matching existing snap notification channel behavior

#### Pin-to-screen UX
- Mirror the iOS "pin to screen" toggle exactly -- same position, same visual treatment
- If recipient has app notifications disabled, silently fall back to a regular snap -- sender is not informed
- Multiple pinned snaps from different senders stack as separate notifications (Android notification grouping)
- One active pinned snap per sender-recipient pair -- sending a new pin replaces the previous one

#### Deep link experience
- Tapping the notification opens the conversation screen with the sender
- On cold start: full app boot (auth, splash), then auto-navigate to the conversation
- If the snap has expired or already been viewed when tapped: open conversation anyway, no error shown
- Auto-open the snap viewer immediately upon landing (marks as viewed, which triggers notification dismissal)

#### Dismissal behavior
- Notification is swipeable -- user can dismiss it permanently (no re-posting)
- Notification cancels immediately when the snap is viewed (opened in snap viewer)
- 48-hour auto-expiry matching iOS, implemented via cloud function that sends a cancel-notification payload
- Cloud function approach ensures expiry works regardless of app state or battery optimization

### Claude's Discretion
- Notification channel configuration details
- FCM data message vs notification message structure
- How to download and attach the thumbnail to BigPictureStyle
- Navigation stack construction for deep link (ensuring back button works correctly)
- Cloud function scheduling mechanism for 48h expiry checks

### Deferred Ideas (OUT OF SCOPE)
- PINA-05: Rich snap notification with custom BigPictureStyle layout (sender avatar + styled text) -- already in backlog
- PINA-04: Android Live Updates (native progress notifications) when Android 16 adoption is sufficient -- already in backlog
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PINA-01 | Recipient sees a persistent ongoing notification with snap photo thumbnail for pinned snaps | expo-notifications `sticky` property + Expo Push API `richContent.image` for BigPictureStyle thumbnail; dedicated `pinned-snaps` notification channel |
| PINA-02 | Tapping the notification opens the conversation | Existing `handleNotificationTapped` + `navigateToNotification` pattern in App.js with new `pinned_snap` type; `autoOpenSnapId` param for auto-opening snap viewer |
| PINA-03 | Notification dismisses when recipient views the snap | `dismissNotificationAsync(identifier)` called from ConversationScreen/SnapViewer when snap is viewed; deterministic notification identifier from message ID |
</phase_requirements>

## Summary

Phase 10 implements the Android recipient experience for pinned snaps -- persistent notifications with photo thumbnails that open conversations and auto-dismiss on viewing. The architecture builds on three key findings:

1. **Expo Push API `richContent.image` provides native BigPictureStyle.** The Expo Push Service (used via expo-server-sdk in cloud functions) natively supports `richContent: { image: url }` which Android renders as a BigPictureStyle notification automatically. This is the simplest approach -- no custom native code, no image downloading on the client side. The cloud function generates a short-lived signed URL for the snap thumbnail and includes it in the push payload.

2. **expo-notifications `sticky` property maps to Android's `setOngoing()`.** However, `sticky` is only available for local notifications via `scheduleNotificationAsync`, NOT for remote push notifications. Since the user decision says the notification should be swipeable (user can dismiss permanently), we should NOT use `sticky: true` at all. Instead, the notification is a standard high-priority push notification that persists in the shade until dismissed or programmatically cancelled.

3. **Deterministic notification identifiers enable targeted dismissal.** When the app receives a pinned snap push notification, the `setNotificationHandler` can capture the notification identifier. Alternatively, the client stores a mapping of `senderId -> notificationIdentifier` so that when the snap is viewed, `dismissNotificationAsync(identifier)` cancels the specific notification.

The sender-side "pin to screen" toggle is implemented in Phase 9 (iOS) on the SnapPreviewScreen. Phase 10 reuses that toggle (it is cross-platform) and focuses solely on the Android recipient notification experience: cloud function changes to send BigPictureStyle push notifications, client-side notification handling, deep link navigation, and auto-dismissal.

**Primary recommendation:** Use Expo Push API's `richContent.image` for the BigPictureStyle thumbnail, a dedicated `pinned-snaps` notification channel for high-priority persistent display, and store notification identifiers on the client for programmatic dismissal when the snap is viewed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-notifications | ~0.32.16 | Local + push notification management | Already in project; provides channels, dismiss, identifiers |
| expo-server-sdk | ^5.0.0 | Push notification sending from cloud functions | Already in project; supports `richContent.image` for BigPictureStyle |
| @react-native-firebase/functions | ^23.8.6 | Cloud Functions for signed URL generation | Already in project; used for snap URL signing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-native-firebase/firestore | ^23.8.6 | Store pinned snap state + notification tracking | Track active pinned notifications per sender-recipient pair |
| @react-native-firebase/storage | ^23.8.6 | Snap photo storage | Generate signed URLs for notification thumbnails |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Expo Push richContent | Notifee library | Full BigPictureStyle control but adds native dependency; richContent is sufficient for current needs |
| Expo Push richContent | Local notification with downloaded image | More control but requires downloading image on client before showing notification; doesn't work in killed state |
| expo-notifications | @react-native-firebase/messaging | Direct FCM access but project already uses Expo push tokens; would require dual token management |

**Installation:**
No new packages needed. All dependencies already exist in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    firebase/
      notificationService.js     # Add pinned snap notification tracking + dismissal
      snapService.js              # Add isPinned flag to uploadAndSendSnap
  screens/
    SnapPreviewScreen.js          # Add pin toggle UI (shared with Phase 9)
    ConversationScreen.js         # Add pinned snap notification dismissal on snap view
functions/
  index.js                        # Modify onNewMessage for pinned snap push payload
  notifications/
    sender.js                     # Add richContent support to sendPushNotification
```

### Pattern 1: Pinned Snap Push Notification Flow
**What:** Cloud function sends a high-priority push notification with `richContent.image` when a pinned snap message is created
**When to use:** Every time a snap with `isPinned: true` is sent
**Example:**
```javascript
// In functions/notifications/sender.js - enhanced sendPushNotification
const message = {
  to: token,
  sound: 'default',
  title: `Pinned snap from ${senderName}`,
  body: caption || 'Tap to view',
  data: {
    type: 'pinned_snap',
    conversationId,
    senderId,
    senderName,
    senderProfilePhotoURL: senderPhotoURL || '',
    messageId,
    threadId: conversationId,
    channelId: 'pinned-snaps',
  },
  priority: 'high',
  channelId: 'pinned-snaps',
  richContent: {
    image: thumbnailSignedUrl, // Short-lived signed URL for snap thumbnail
  },
};
```

### Pattern 2: Notification Identifier Tracking for Dismissal
**What:** Client stores the notification identifier when a pinned snap notification arrives, enabling programmatic dismissal when the snap is viewed
**When to use:** On every pinned snap notification receipt
**Example:**
```javascript
// In notificationService.js - track pinned snap notifications
import AsyncStorage from '@react-native-async-storage/async-storage';

const PINNED_NOTIF_KEY = '@pinned_snap_notifs';

export const storePinnedNotifId = async (senderId, notificationId) => {
  const existing = JSON.parse(await AsyncStorage.getItem(PINNED_NOTIF_KEY) || '{}');
  existing[senderId] = notificationId;
  await AsyncStorage.setItem(PINNED_NOTIF_KEY, JSON.stringify(existing));
};

export const dismissPinnedNotif = async (senderId) => {
  const existing = JSON.parse(await AsyncStorage.getItem(PINNED_NOTIF_KEY) || '{}');
  const notifId = existing[senderId];
  if (notifId) {
    await Notifications.dismissNotificationAsync(notifId);
    delete existing[senderId];
    await AsyncStorage.setItem(PINNED_NOTIF_KEY, JSON.stringify(existing));
  }
};
```

### Pattern 3: Snap Message Document Extension
**What:** Add `isPinned` boolean to snap message documents for pinned snaps
**When to use:** When sender toggles pin on before sending
**Example:**
```javascript
// In snapService.js - uploadAndSendSnap with pin flag
const messageData = {
  senderId,
  type: 'snap',
  text: null,
  gifUrl: null,
  imageUrl: null,
  snapStoragePath,
  caption: truncatedCaption,
  isPinned: isPinned || false,  // New field
  viewedAt: null,
  expiresAt,
  createdAt: serverTimestamp(),
};
```

### Pattern 4: Dedicated Notification Channel
**What:** Create a `pinned-snaps` Android notification channel with high importance for heads-up display
**When to use:** On app initialization (initializeNotifications)
**Example:**
```javascript
// In notificationService.js - initializeNotifications
if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('pinned-snaps', {
    name: 'Pinned Snaps',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#000000',
    description: 'Notifications for pinned snap messages',
    sound: 'default',
  });
}
```

### Anti-Patterns to Avoid
- **Using `sticky: true` for pinned snap notifications:** The user decision says notifications should be swipeable for dismissal. `sticky: true` prevents swipe dismissal. Do NOT use it.
- **Downloading image on client to create local notification:** This only works when the app is foregrounded. Push notifications with `richContent.image` work regardless of app state.
- **Using a single notification ID for all pinned snaps:** Each sender should create a separate notification. Use a deterministic ID pattern like `pinned-snap-${senderId}` to enable per-sender replacement.
- **Sending richContent as a single message object:** The Expo Push API requires messages to be sent as an array for `richContent` to be processed. Always use `sendPushNotificationsAsync([message])` (array syntax).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BigPictureStyle notification | Custom native module for BigPictureStyle | Expo Push API `richContent.image` | Expo automatically renders BigPictureStyle for Android; zero native code |
| Notification channel management | Manual Android channel creation | `Notifications.setNotificationChannelAsync()` | Handles API level differences, importance mapping |
| Notification dismissal tracking | Custom Firestore-based notification tracking | AsyncStorage + `dismissNotificationAsync()` | Lightweight, local-only tracking is sufficient since notifications are device-local |
| 48-hour expiry | Client-side timers / AlarmManager | Cloud function scheduled check | Cloud function works regardless of app state, battery optimization, or device being off |
| Signed URL for thumbnail | Custom image proxy | `getSignedSnapUrl` cloud function | Already exists; 5-minute expiry is fine since the URL only needs to be valid when the push is sent |

**Key insight:** The Expo Push API + expo-notifications combo handles almost everything natively. The cloud function generates the signed URL and sends it via `richContent.image`. Android renders BigPictureStyle automatically. No native code needed.

## Common Pitfalls

### Pitfall 1: Signed URL Expiry Before Image Download
**What goes wrong:** If the signed URL expires before Android downloads the image for the notification, the thumbnail will be missing.
**Why it happens:** The current `getSignedSnapUrl` generates 5-minute URLs. FCM delivery can be delayed.
**How to avoid:** Generate a longer-lived URL (30 minutes) specifically for notification thumbnails, or use a separate thumbnail-specific Cloud Function that generates a URL optimized for this use case.
**Warning signs:** Notifications arrive without thumbnails on slow connections.

### Pitfall 2: richContent Not Processed for Single Message Objects
**What goes wrong:** Sending a single push message object (not wrapped in array) causes the Expo Push API to ignore the `richContent` field.
**Why it happens:** Known behavior in Expo's push service -- array format is required for richContent processing.
**How to avoid:** Always pass messages as an array to `sendPushNotificationsAsync()`, even for single messages: `await expo.sendPushNotificationsAsync([message])`.
**Warning signs:** Notifications arrive with title/body but no image.

### Pitfall 3: Notification Identifier Lost on App Kill
**What goes wrong:** If the app is killed between receiving a pinned snap notification and the user viewing the snap, the in-memory notification identifier is lost and `dismissNotificationAsync` cannot target it.
**Why it happens:** Notification identifiers are ephemeral if not persisted.
**How to avoid:** Persist the mapping of `senderId -> notificationIdentifier` in AsyncStorage immediately when the notification is received. Read it back when dismissing.
**Warning signs:** Pinned snap notifications persist after viewing the snap when app was killed in between.

### Pitfall 4: Foreground Notification Suppression
**What goes wrong:** The existing `setNotificationHandler` returns `shouldShowAlert: false`, which suppresses ALL foreground notifications including pinned snap notifications.
**Why it happens:** The app uses custom `InAppNotificationBanner` for foreground notifications.
**How to avoid:** In the `handleNotification` callback, check if the notification type is `pinned_snap`. If the user is NOT currently viewing that conversation, show the in-app banner AND let the system notification through (return `shouldShowAlert: true` for pinned snaps).
**Warning signs:** Pinned snap notifications never show when app is in foreground.

### Pitfall 5: Back Button Navigation After Deep Link
**What goes wrong:** User taps notification, opens conversation, then presses back -- expects to go to Messages list but goes to an unexpected screen.
**Why it happens:** Deep link navigation bypasses normal stack construction.
**How to avoid:** The existing `navigateToNotification` pattern navigates through `MainTabs > Messages > Conversation`, which already constructs the correct back stack. The existing pattern handles this correctly for snap notifications.
**Warning signs:** Unexpected back navigation behavior after tapping pinned snap notification.

### Pitfall 6: Notification Channel Must Exist Before Push Arrives
**What goes wrong:** If the `pinned-snaps` channel is created after a push notification targeting it arrives, Android drops the notification silently.
**Why it happens:** Android requires channels to exist before notifications reference them.
**How to avoid:** Create the `pinned-snaps` channel in `initializeNotifications()` which runs at app startup. For users who haven't updated, the push should fall back to `channelId: 'default'` (which already exists).
**Warning signs:** First pinned snap notification after install never appears.

## Code Examples

Verified patterns from the existing codebase:

### Existing Snap Notification Handler (notificationService.js)
```javascript
// Source: src/services/firebase/notificationService.js line 410-427
case 'snap':
  return {
    success: true,
    data: {
      type: 'snap',
      screen: 'Conversation',
      params: {
        conversationId: conversationId,
        friendId: senderId,
        friendProfile: {
          uid: senderId,
          displayName: senderName || 'Unknown',
          photoURL: senderProfilePhotoURL || null,
        },
        autoOpenSnapId: messageId || null,
      },
    },
  };
```

### Pinned Snap Notification Handler (new case to add)
```javascript
// New case in handleNotificationTapped switch statement
case 'pinned_snap':
  return {
    success: true,
    data: {
      type: 'pinned_snap',
      screen: 'Conversation',
      params: {
        conversationId: conversationId,
        friendId: senderId,
        friendProfile: {
          uid: senderId,
          displayName: senderName || 'Unknown',
          photoURL: senderProfilePhotoURL || null,
        },
        autoOpenSnapId: messageId || null,
      },
    },
  };
```

### Cloud Function: Pinned Snap Branch in onNewMessage
```javascript
// In functions/index.js onNewMessage handler, after line 3110
// Build pinned snap notification with thumbnail
if (message.isPinned) {
  // Generate a signed URL for the snap thumbnail (longer-lived for notification delivery)
  const file = bucket.file(message.snapStoragePath);
  const [thumbnailUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 30 * 60 * 1000, // 30 minutes
  });

  const pinnedNotificationData = {
    type: 'pinned_snap',
    conversationId,
    senderId,
    senderName,
    senderProfilePhotoURL: senderPhotoURL || '',
    messageId: context.params.messageId,
    threadId: conversationId,
    channelId: 'pinned-snaps',
  };

  await sendPushNotification(
    fcmToken,
    `Pinned snap from ${senderName}`,
    message.caption || 'Tap to view',
    pinnedNotificationData,
    recipientId,
    { image: thumbnailUrl } // richContent
  );
} else {
  // Existing snap notification logic
  await sendPushNotification(fcmToken, senderName, body, notificationData, recipientId);
}
```

### Notification Dismissal on Snap View
```javascript
// In ConversationScreen.js - when snap is viewed
import { dismissPinnedNotif } from '../services/firebase/notificationService';

// After markSnapViewed succeeds:
const handleSnapViewed = async (conversationId, messageId, senderId) => {
  const result = await markSnapViewed(conversationId, messageId);
  if (result.success) {
    // Dismiss any pinned notification from this sender
    await dismissPinnedNotif(senderId);
  }
};
```

### Notification Channel Setup
```javascript
// In notificationService.js initializeNotifications()
if (Platform.OS === 'android') {
  // Existing default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#000000',
  });

  // New: Pinned snaps channel
  await Notifications.setNotificationChannelAsync('pinned-snaps', {
    name: 'Pinned Snaps',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#000000',
    description: 'Photo snaps pinned to your notification shade',
    sound: 'default',
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No image support in Expo Push | `richContent.image` for Android BigPictureStyle | 2024-2025 | Eliminates need for native code or Notifee |
| Manual FCM data messages | Expo Push API handles both data and notification payloads | Stable since SDK 48+ | Unified push API across platforms |
| Custom notification IDs impossible | `scheduleNotificationAsync` accepts `identifier` param | expo-notifications ~0.28+ | Enables deterministic IDs for replacement/dismissal |

**Deprecated/outdated:**
- Using `react-native-firebase/messaging` for push handling alongside expo-notifications: Causes conflicts. Project correctly uses Expo-only push tokens.
- `autoDismiss` property: Only controls tap-to-dismiss behavior, NOT swipe dismissal. Not the right tool for pinned snap persistence.

## Open Questions

1. **richContent.image with expo-server-sdk array format**
   - What we know: Expo Push API requires array format for richContent processing. The current `sendPushNotification` in `sender.js` already uses `sendPushNotificationsAsync([message])` (array syntax).
   - What's unclear: Whether expo-server-sdk v5 TypeScript types include the `richContent` field, or if it needs to be passed as an untyped field.
   - Recommendation: Test with a simple push first. If types don't include it, pass it alongside the standard message properties -- the Expo Push API accepts arbitrary fields.

2. **Notification identifier capture for push notifications**
   - What we know: `scheduleNotificationAsync` returns an identifier. Push notifications received via Expo Push Service also have identifiers accessible in notification listeners.
   - What's unclear: Whether the push notification identifier can be reliably captured in all app states (foreground, background, killed).
   - Recommendation: Use `addNotificationReceivedListener` to capture the identifier when in foreground. For background/killed state, rely on `getLastNotificationResponseAsync` on app open. Store identifiers in AsyncStorage for persistence.

3. **48-hour auto-expiry cloud function mechanism**
   - What we know: User decision specifies cloud function approach for reliability. The project already uses scheduled cloud functions (`cleanupExpiredSnaps` runs every 2 hours).
   - What's unclear: How the cloud function would dismiss a device notification. It cannot directly call `dismissNotificationAsync` -- it would need to send a "cancel" push notification.
   - Recommendation: Cloud function sends a data-only push with `type: 'cancel_pinned_snap'` and `senderId`. Client's notification listener handles dismissal via `dismissNotificationAsync`. If the app is killed, the notification stays until the user manually dismisses or opens the app.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `jest.config.js` (root) + `functions/jest.config.js` |
| Quick run command | `npx jest __tests__/services/notificationService.test.js --no-coverage` |
| Full suite command | `npm test` |
| Estimated runtime | ~15 seconds (client) + ~10 seconds (functions) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PINA-01 | Pinned snap push notification with thumbnail sent correctly | unit | `cd functions && npx jest snapFunctions.test.js -t "pinned snap"` | No - Wave 0 gap |
| PINA-01 | Pinned snaps notification channel created on init | unit | `npx jest __tests__/services/notificationService.test.js -t "pinned-snaps channel"` | No - Wave 0 gap |
| PINA-02 | handleNotificationTapped routes pinned_snap type to Conversation | unit | `npx jest __tests__/services/notificationService.test.js -t "pinned_snap"` | No - Wave 0 gap |
| PINA-03 | dismissPinnedNotif calls dismissNotificationAsync with stored ID | unit | `npx jest __tests__/services/notificationService.test.js -t "dismissPinnedNotif"` | No - Wave 0 gap |
| PINA-03 | markSnapViewed triggers pinned notification dismissal | integration | manual-only (requires real device notification) | N/A |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run: `npx jest __tests__/services/notificationService.test.js __tests__/services/snapService.test.js --no-coverage`
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~8 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `__tests__/services/notificationService.test.js` -- add test cases for pinned_snap notification type handler, channel creation, and dismissal helpers (extend existing file)
- [ ] `__tests__/services/snapService.test.js` -- add test cases for `isPinned` flag in `uploadAndSendSnap` (extend existing file)
- [ ] `functions/__tests__/triggers/onNewMessage.pinned.test.js` -- test pinned snap branch in onNewMessage (new file or extend existing snapFunctions tests)

## Sources

### Primary (HIGH confidence)
- Expo Notifications SDK docs (https://docs.expo.dev/versions/latest/sdk/notifications/) - `sticky` property, `scheduleNotificationAsync` identifier, `dismissNotificationAsync`, channel APIs
- Expo Push Sending docs (https://docs.expo.dev/push-notifications/sending-notifications/) - `richContent.image` field, `channelId`, priority levels
- Project codebase: `src/services/firebase/notificationService.js`, `functions/notifications/sender.js`, `App.js` - existing notification patterns

### Secondary (MEDIUM confidence)
- GitHub expo/expo Discussion #27980 (https://github.com/expo/expo/discussions/27980) - richContent.image works on Android, array format requirement
- expo-server-sdk GitHub (https://github.com/expo/expo-server-sdk-node) - SDK message format including richContent
- expo/expo PR #9351 (https://github.com/expo/expo/pull/9351) - sticky property implementation details (maps to Android setOngoing)

### Tertiary (LOW confidence)
- Community reports on richContent reliability - Some reports of intermittent image loading; needs real-device testing
- expo-server-sdk v5 TypeScript types for richContent - Unclear if fully typed; may need untyped field

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; no new dependencies
- Architecture: HIGH - Builds on verified existing patterns (notification handling, snap messaging, cloud functions)
- Pitfalls: HIGH - Well-documented expo-notifications behaviors verified against official docs
- richContent.image: MEDIUM - Verified in docs and community reports but needs real-device testing for reliability

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days - stable ecosystem, no expected breaking changes)
