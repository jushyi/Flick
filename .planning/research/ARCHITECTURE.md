# Architecture Research: v1.1 Pinned Snaps, Screenshot Detection, Darkroom Optimization

**Domain:** Social messaging -- Live Activity snap pinning, screenshot detection, darkroom optimization, tech debt
**Researched:** 2026-02-25
**Confidence:** MEDIUM (Live Activities in React Native is actively evolving; expo-screen-capture is stable and verified; darkroom optimization is straightforward refactoring)

## System Overview

v1.1 adds three new capability layers to the existing architecture: a native iOS widget extension for Live Activities, screenshot detection wiring into the snap viewing flow, and a restructured darkroom reveal check. All three integrate into existing layers without replacing them.

```
+------------------------------------------------------------------+
|                     SCREENS (UI Layer)                            |
|  ConversationScreen  DarkroomScreen  SettingsScreen              |
|  [extend snap view]  [optimize]      [screenshot settings]       |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                     HOOKS (Business Logic)                       |
|  useConversation  useDarkroom    useScreenshotDetection          |
|  [extend]         [restructure]  [NEW]                           |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                   SERVICES (Firebase Abstraction)                 |
|  snapService      darkroomService  liveActivityService           |
|  [extend]         [optimize]       [NEW]                         |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                NATIVE MODULE / EXPO PACKAGES                     |
|  expo-screen-capture    expo-live-activity (or expo-widgets*)    |
|  [NEW dependency]       [NEW dependency + Swift widget target]   |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                   CLOUD FUNCTIONS (Server-side)                   |
|  onSnapScreenshot   sendLiveActivityUpdate   (darkroom: no new)  |
|  [NEW callable]     [NEW callable]                               |
+--------+---------+--------+--------+--------+-------------------+
         |         |        |        |        |
+--------+---------+--------+--------+--------+-------------------+
|                   FIRESTORE + APNs                                |
|  conversations/messages/   users/    APNs liveactivity push      |
|  [add screenshotAt field]  [add LA token] [NEW push channel]     |
+------------------------------------------------------------------+
```

\*Note: `expo-widgets` is available in Expo SDK 55 (currently beta). Since the project is on SDK 54, the recommended approach for v1.1 is `expo-live-activity` from Software Mansion. See Stack Decision section for full rationale.

### Component Responsibilities

| Component                               | Status | Responsibility                                                                               | Communicates With                        |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `liveActivityService.js`                | NEW    | Start/update/stop Live Activities, manage push tokens, deep link configuration               | expo-live-activity, Cloud Functions      |
| `useScreenshotDetection` hook           | NEW    | Mount-scoped screenshot listener, prevention toggle, notification trigger                    | expo-screen-capture, snapService         |
| `SnapViewer` component                  | EXTEND | Add screenshot prevention on mount, screenshot listener callback                             | useScreenshotDetection, snapService      |
| `onSnapScreenshot` Cloud Function       | NEW    | Receive screenshot event, send push notification to snap sender                              | Firestore, FCM/Expo Push                 |
| `sendLiveActivityUpdate` Cloud Function | NEW    | Send APNs liveactivity push to update/end pinned snap Live Activity                          | APNs HTTP/2 (direct, not FCM), Firestore |
| `useDarkroom` hook                      | MODIFY | Replace 3-trigger reveal check with single optimized pattern                                 | darkroomService (simplified)             |
| `darkroomService.js`                    | MODIFY | Remove redundant `isDarkroomReadyToReveal` client calls, consolidate to server-authoritative | Firestore darkrooms collection           |
| Swift Widget Target                     | NEW    | SwiftUI Live Activity layout for pinned snaps (Polaroid mini frame)                          | ActivityKit, App Groups                  |

## Key Stack Decision: Live Activities Library

### Decision: Use `expo-live-activity` on SDK 54, plan migration to `expo-widgets` on SDK 55

**Rationale:**

| Factor                    | expo-live-activity                                  | expo-widgets                                     |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| SDK compatibility         | Works with SDK 54 (current)                         | Requires SDK 55 (beta, not production-ready)     |
| Maturity                  | Early but functional, published by Software Mansion | Alpha, subject to breaking changes               |
| Setup complexity          | Config plugin + custom Swift widget target          | Config plugin, no Swift code needed              |
| Push notification support | Supported with `enablePushNotifications: true`      | Supported with `enablePushNotifications: true`   |
| Dynamic Island support    | Yes (compact, expanded, minimal layouts)            | Yes (banner, compact, expanded, minimal layouts) |
| Deep linking              | Supported via config                                | Supported via config                             |
| Migration path            | Can migrate to expo-widgets when SDK 55 is stable   | N/A (target)                                     |

**Recommendation:** Ship v1.1 with `expo-live-activity` on SDK 54. When Expo SDK 55 reaches stable release (likely mid-2026), migrate to `expo-widgets` as part of a routine SDK upgrade. The Live Activity UI layout (SwiftUI in both cases) will need minimal changes.

**Confidence:** MEDIUM -- `expo-live-activity` is from Software Mansion Labs (experimental namespace), not a stable release. The core API (startActivity, updateActivity, stopActivity, push token management) is functional but breaking changes in minor versions are possible. Pin the version strictly.

### Android Strategy: Defer to Rich Notification

Android does not have an equivalent to iOS Live Activities until Android 16 (Live Updates). Android 16 adoption will be minimal in 2026. Samsung One UI 7 has "Now Bar" support but requires app whitelisting.

**Recommendation:** For v1.1, implement pinned snaps as iOS-only Live Activities. On Android, use an enhanced ongoing notification via `expo-notifications` with a custom notification channel (`priority: max`, `ongoing: true` if Notifee is added). This gives Android users a persistent lock-screen notification that opens the snap viewer on tap -- functionally equivalent, visually simpler.

**Confidence:** HIGH -- Android ongoing notifications are well-established. The gap is visual polish, not functionality.

## Feature Architecture: Pinned Snap Live Activities

### How Live Activities Work (iOS)

Live Activities are iOS widgets that display real-time information on the Lock Screen and in the Dynamic Island. They are powered by ActivityKit (native Swift framework) and can be:

1. **Started locally** from the app via `ActivityKit.startActivity()`
2. **Updated remotely** via APNs push notifications with `apns-push-type: liveactivity`
3. **Ended** either locally or remotely
4. **Auto-terminated** by iOS after 12 hours maximum

Each Live Activity has:

- A **push token** (unique per activity instance, can change over time)
- A **content-state** (the data displayed, updated via pushes)
- Layout sections: `compactLeading`, `compactTrailing` (Dynamic Island pills), `expanded` (full Dynamic Island), `banner` (Lock Screen)

### Pinned Snap Data Flow

```
[Sender sends snap in ConversationScreen]
    |
    | 1. snapService.uploadAndSendSnap() -- existing flow, unchanged
    v
[onNewMessage Cloud Function fires]
    |
    | 2. Detect type='snap'
    | 3. Check recipient's liveActivityToken in users/{recipientId} doc
    | 4. If token exists AND recipient has LA enabled:
    |    a. Send APNs liveactivity push with event:"start" to start Live Activity
    |    OR
    |    b. Send standard push notification (existing behavior) as fallback
    v
[Recipient's Lock Screen / Dynamic Island]
    |
    | 5. Live Activity appears: "New snap from [SenderName]" with Polaroid mini icon
    | 6. Timer shows time remaining before snap expires (48h from creation)
    | 7. Tap deep links to ConversationScreen with autoOpenSnapId param
    v
[Recipient opens snap via Live Activity tap or ConversationScreen]
    |
    | 8. SnapViewer opens (existing flow)
    | 9. On dismiss: markSnapViewed() -- existing flow
    | 10. Client calls liveActivityService.stopActivity(activityId)
    | 11. OR: Cloud Function sends APNs liveactivity push with event:"end"
    v
[Live Activity dismissed from Lock Screen]
```

### Push Token Management

Live Activity push tokens are different from regular FCM/APNs push tokens. Each Live Activity instance gets its own unique token that must be:

1. Captured on the client when the app starts or a Live Activity is created
2. Sent to the server (stored in Firestore `users/{userId}.liveActivityPushToken`)
3. Monitored for changes (tokens can rotate during an activity's lifetime)
4. Invalidated when the activity ends

```javascript
// In liveActivityService.js
import * as LiveActivity from 'expo-live-activity';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';

const db = getFirestore();

/**
 * Register for Live Activity push token updates.
 * Called once at app startup if user has LA enabled.
 * Stores the push-to-start token in Firestore for server-side activity starts.
 */
export const registerLiveActivityTokenListener = userId => {
  // Push-to-start token listener (for server-initiated activities)
  const startTokenSub = LiveActivity.addActivityPushToStartTokenListener(event => {
    const { activityPushToStartToken } = event;
    // Store in Firestore for Cloud Function to use
    updateDoc(doc(db, 'users', userId), {
      liveActivityPushToStartToken: activityPushToStartToken,
    });
  });

  // Per-activity token listener (for updates to running activities)
  const tokenSub = LiveActivity.addActivityTokenListener(event => {
    const { activityID, activityPushToken } = event;
    // Store mapping: activityId -> pushToken
    updateDoc(doc(db, 'users', userId), {
      [`liveActivityTokens.${activityID}`]: activityPushToken,
    });
  });

  return { startTokenSub, tokenSub };
};
```

### Cloud Function: APNs Live Activity Push

Firebase Cloud Messaging (FCM) now supports Live Activities through the HTTP v1 API. The payload structure differs from regular push notifications:

```javascript
// In Cloud Functions: sendLiveActivityUpdate
const { google } = require('googleapis');

/**
 * Send a Live Activity update via FCM HTTP v1 API.
 * FCM acts as the bridge to APNs for liveactivity push type.
 *
 * @param {string} fcmToken - Device FCM registration token
 * @param {string} liveActivityToken - Apple Live Activity push token
 * @param {string} event - 'start' | 'update' | 'end'
 * @param {object} contentState - Live Activity content state
 * @param {object} attributes - Only needed for 'start' event
 */
async function sendLiveActivityPush(fcmToken, liveActivityToken, event, contentState, attributes) {
  const projectId = process.env.GCLOUD_PROJECT;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // FCM handles OAuth2 authentication automatically with admin SDK
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const accessToken = await auth.getAccessToken();

  const payload = {
    message: {
      token: fcmToken,
      apns: {
        live_activity_token: liveActivityToken,
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            timestamp: Math.floor(Date.now() / 1000),
            event,
            'content-state': contentState,
            ...(event === 'start' && {
              'attributes-type': 'LiveActivityAttributes',
              attributes,
            }),
            ...(event === 'end' && {
              'dismissal-date': Math.floor(Date.now() / 1000) + 5, // dismiss 5s after end
            }),
          },
        },
      },
    },
  };

  // Send via FCM HTTP v1 API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response;
}
```

**Key constraint:** APNs Live Activity pushes require token-based authentication (not certificate-based). Firebase projects using FCM already have this configured. The `live_activity_token` field in the FCM payload bridges to Apple's `liveactivity` push type.

### Swift Widget Target (Xcode Side)

The Live Activity requires a Widget Extension target in the iOS project. With `expo-live-activity`, this is created via the config plugin, but the SwiftUI layout must be defined in Swift:

```swift
// In widget target: FlickLiveActivity.swift
import ActivityKit
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var subtitle: String
    }
    var senderName: String
    var deepLinkUrl: String
}

struct FlickLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LiveActivityAttributes.self) { context in
            // Lock Screen banner
            HStack {
                Image("polaroid_mini")
                    .resizable()
                    .frame(width: 40, height: 40)
                VStack(alignment: .leading) {
                    Text(context.state.title)
                        .font(.system(size: 14, weight: .bold))
                    Text(context.state.subtitle)
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image("polaroid_mini")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Tap to view")
                }
            } compactLeading: {
                Image("camera_icon")
            } compactTrailing: {
                Text(context.state.subtitle)
            } minimal: {
                Image("camera_icon")
            }
        }
    }
}
```

### EAS Build Configuration

Adding Live Activities requires changes to `app.json` and a new EAS build (not OTA-updatable):

```json
// In app.json ios section -- additions needed
{
  "ios": {
    "infoPlist": {
      "NSSupportsLiveActivities": true,
      "NSSupportsLiveActivitiesFrequentUpdates": true
    }
  },
  "plugins": [["expo-live-activity", { "enablePushNotifications": true }]]
}
```

**Critical:** This is a native code change. It requires a full EAS build (`eas build --platform ios`), not an OTA update via `eas update`.

## Feature Architecture: Screenshot Detection

### Integration with Existing SnapViewer

`expo-screen-capture` is fully compatible with Expo SDK 54. It provides two complementary capabilities:

1. **Prevention** -- `preventScreenCaptureAsync()` blocks iOS screenshots (iOS 13+) and screen recordings (iOS 11+). On Android, it sets `FLAG_SECURE` on the window.
2. **Detection** -- `addScreenshotListener()` fires a callback when a screenshot is taken despite prevention (some bypass methods exist, and Android 13- cannot fully prevent).

The integration point is the existing `SnapViewer` component, which already handles the full snap viewing lifecycle (load signed URL, display, dismiss, mark viewed).

### Screenshot Detection Flow

```
[SnapViewer mounts with visible=true]
    |
    | 1. useScreenshotDetection hook activates:
    |    a. preventScreenCaptureAsync('snap-viewer')
    |    b. addScreenshotListener(handleScreenshot)
    v
[User takes screenshot while SnapViewer is open]
    |
    | 2. handleScreenshot callback fires
    | 3. Write screenshotAt timestamp to snap message document:
    |    updateDoc(messageRef, { screenshotAt: serverTimestamp() })
    | 4. Call Cloud Function: onSnapScreenshot(conversationId, messageId)
    | 5. Show brief toast to screenshotter: "Screenshot detected"
    v
[onSnapScreenshot Cloud Function]
    |
    | 6. Look up snap sender's FCM token
    | 7. Send push notification: "[RecipientName] screenshotted your snap"
    | 8. Create notification document in notifications/ collection
    v
[SnapViewer unmounts or visible becomes false]
    |
    | 9. allowScreenCaptureAsync('snap-viewer')
    | 10. Listener subscription removed
```

### useScreenshotDetection Hook

```javascript
// src/hooks/useScreenshotDetection.js
import { useEffect, useRef } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

/**
 * Hook to prevent screen capture and detect screenshots.
 * Activates when `active` is true, deactivates on false or unmount.
 *
 * @param {boolean} active - Whether detection is active
 * @param {Function} onScreenshot - Callback when screenshot is detected
 * @param {string} key - Unique key for this prevention instance
 */
const useScreenshotDetection = (active, onScreenshot, key = 'snap-viewer') => {
  const listenerRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    // Prevent screen capture
    ScreenCapture.preventScreenCaptureAsync(key);

    // Listen for screenshots
    listenerRef.current = ScreenCapture.addScreenshotListener(() => {
      onScreenshot?.();
    });

    return () => {
      // Re-enable screen capture
      ScreenCapture.allowScreenCaptureAsync(key);
      // Remove listener
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
    };
  }, [active, onScreenshot, key]);
};

export default useScreenshotDetection;
```

### SnapViewer Integration Point

The existing `SnapViewer` component (lines 68-179 in current code) needs minimal changes:

```javascript
// In SnapViewer.js -- additions to existing component
import useScreenshotDetection from '../hooks/useScreenshotDetection';
import { getFirestore, doc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

// Inside SnapViewer component:
const handleScreenshot = useCallback(async () => {
  if (!conversationId || !snapMessage?.id) return;

  // 1. Write screenshotAt to message document
  const db = getFirestore();
  const messageRef = doc(db, 'conversations', conversationId, 'messages', snapMessage.id);
  await updateDoc(messageRef, { screenshotAt: serverTimestamp() });

  // 2. Notify sender via Cloud Function
  const functions = getFunctions();
  const notifyScreenshot = httpsCallable(functions, 'onSnapScreenshot');
  await notifyScreenshot({ conversationId, messageId: snapMessage.id });

  // 3. Show brief toast (optional -- could use a simple overlay text)
  logger.info('SnapViewer: Screenshot detected and reported', {
    conversationId,
    messageId: snapMessage.id,
  });
}, [conversationId, snapMessage?.id]);

// Hook activation: active when viewer is visible and not the sender
const isRecipient = snapMessage?.senderId !== currentUserId;
useScreenshotDetection(visible && isRecipient, handleScreenshot);
```

### Firestore Schema Extension

Add `screenshotAt` field to snap message documents:

```javascript
// Extended snap message schema
{
  // ... existing fields unchanged
  senderId: string,
  type: 'snap',
  snapStoragePath: string,
  caption: string | null,
  viewedAt: Timestamp | null,
  expiresAt: Timestamp,
  createdAt: Timestamp,

  // NEW field
  screenshotAt: Timestamp | null,  // Set when recipient screenshots the snap
}
```

### Firestore Security Rules Extension

The existing rules already allow recipient-only updates on snap messages for `viewedAt`. Extend to include `screenshotAt`:

```
// In firestore.rules -- update the snap message update rule
allow update: if isConversationMemberById(conversationId) &&
                 request.auth.uid != resource.data.senderId &&
                 resource.data.type == 'snap' &&
                 request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['viewedAt', 'screenshotAt']);
```

### Android Permissions Note

- **Android 14+**: No additional permissions needed for screenshot detection.
- **Android 13 and below**: Requires `READ_MEDIA_IMAGES` permission, which has Google Play policy restrictions. Since Flick targets modern devices and this is a detection feature (not blocking), the permission trade-off is acceptable.
- The `expo-screen-capture` config plugin handles the Android manifest entry automatically when installed.

### EAS Build Requirement

Adding `expo-screen-capture` is a **native module addition** (it links native code for both iOS and Android). This requires a new EAS build, not an OTA update. Plan this build alongside the Live Activity native changes to avoid two separate build cycles.

## Feature Architecture: Darkroom Reveal Optimization

### Current Problem

The darkroom reveal system has 3 independent triggers, each making a Firestore read to check `isDarkroomReadyToReveal`:

1. **App.js `AppState` listener** (line 370-401): On every foreground event, reads `darkrooms/{userId}` to check `nextRevealAt`. This fires on every app resume, even if the user is not going to the darkroom.

2. **`useDarkroom` hook `useFocusEffect`** (line 105-213): When DarkroomScreen gains focus, reads `isDarkroomReadyToReveal` AND then reads all developing photos. Both trigger 1 and trigger 2 may fire simultaneously if the user opens the app directly to the darkroom.

3. **`processDarkroomReveals` Cloud Function** (every 2 minutes): Server-side catch-all that queries ALL darkrooms where `nextRevealAt <= now`. This is the safety net.

**Issues:**

- Triggers 1 and 2 are redundant when both fire at the same time.
- Trigger 1 fires on EVERY foreground event, even for users with zero developing photos. This is a wasted Firestore read.
- The client-side reveal logic in `useDarkroom` (lines 111-213) duplicates what the Cloud Function does, including inline reveal logic (lines 182-213 in `darkroomService.ensureDarkroomInitialized`) that exists to avoid circular imports.

### Recommended Restructuring

**Goal:** Eliminate redundant Firestore reads while maintaining reliable reveal timing.

```
BEFORE (3 triggers, redundant reads):
  App.js foreground   --> isDarkroomReadyToReveal() --> Firestore read
  useDarkroom focus   --> isDarkroomReadyToReveal() --> Firestore read
  Cloud Function 2min --> query all darkrooms       --> Firestore reads

AFTER (2 triggers, no redundancy):
  App.js foreground   --> REMOVED (no longer checks darkroom on every foreground)
  useDarkroom focus   --> loadAndRevealIfReady()    --> Single Firestore read + conditional reveal
  Cloud Function 2min --> query all darkrooms       --> Firestore reads (unchanged, safety net)
```

### Changes Required

**1. Remove App.js foreground darkroom check:**

The App.js `AppState` listener (lines 370-401) should be removed entirely. The Cloud Function already runs every 2 minutes as a background catch-all. The `useDarkroom` hook handles checking when the user actually navigates to the darkroom. The App.js check only saves ~2 minutes of reveal latency in the worst case, at the cost of a Firestore read on every single app foreground event.

```javascript
// App.js -- REMOVE this entire useEffect block (lines 370-401)
// The processDarkroomReveals Cloud Function (every 2 min) serves as the
// background catch-all. useDarkroom checks on DarkroomScreen focus.
```

**2. Consolidate useDarkroom reveal logic:**

The current `loadDevelopingPhotos` function in `useDarkroom` (lines 111-213) has two reveal paths: a primary check and a catch-up mechanism. Consolidate into a single, clearer flow:

```javascript
// Simplified loadDevelopingPhotos in useDarkroom
const loadDevelopingPhotos = async () => {
  if (!user) return;
  setLoading(true);

  try {
    // Step 1: Check if reveal is ready AND get all photos in one pass
    const isReady = await isDarkroomReadyToReveal(user.uid);

    if (isReady) {
      // Reveal all developing photos
      await revealPhotos(user.uid);
      await scheduleNextReveal(user.uid);
    }

    // Step 2: Load current state (developing + revealed)
    const result = await getDevelopingPhotos(user.uid);

    if (result.success && result.photos) {
      // Only show revealed photos for triage
      const revealed = result.photos.filter(p => p.status === 'revealed');

      // If there are still developing photos alongside revealed ones,
      // auto-reveal them (catch-up for edge cases)
      const developing = result.photos.filter(p => p.status === 'developing');
      if (revealed.length > 0 && developing.length > 0) {
        await revealPhotos(user.uid);
        const updated = await getDevelopingPhotos(user.uid);
        setPhotos(updated.success ? updated.photos.filter(p => p.status === 'revealed') : revealed);
      } else {
        setPhotos(revealed);
      }
    } else {
      setPhotos([]);
    }

    // Reset all local state
    setHiddenPhotoIds(new Set());
    setUndoStack([]);
    setPhotoTags({});
    setPhotoCaptions({});
  } catch (error) {
    logger.error('useDarkroom: Error loading photos', error);
  } finally {
    setLoading(false);
  }
};
```

**3. Simplify `ensureDarkroomInitialized` in darkroomService:**

Remove the inline reveal logic (lines 182-213 in `darkroomService.js`) that was added to avoid circular imports. Instead, have `ensureDarkroomInitialized` only handle timing initialization, not reveal execution:

```javascript
// Simplified ensureDarkroomInitialized -- only manages timing, no reveals
export const ensureDarkroomInitialized = async userId => {
  const darkroomRef = doc(db, 'darkrooms', userId);
  const darkroomDoc = await getDoc(darkroomRef);

  if (!darkroomDoc.exists()) {
    const nextRevealAt = calculateNextRevealTime();
    await setDoc(darkroomRef, {
      userId,
      nextRevealAt,
      lastRevealedAt: null,
      createdAt: Timestamp.now(),
    });
    return { success: true, created: true };
  }

  // If nextRevealAt is stale, just reset the timer
  // Don't do reveals here -- that's the hook's or Cloud Function's job
  const { nextRevealAt } = darkroomDoc.data();
  if (!nextRevealAt || nextRevealAt.seconds < Timestamp.now().seconds) {
    const newNextRevealAt = calculateNextRevealTime();
    await updateDoc(darkroomRef, {
      nextRevealAt: newNextRevealAt,
    });
    return { success: true, refreshed: true };
  }

  return { success: true };
};
```

### Impact Assessment

| Metric                             | Before                                                    | After                            |
| ---------------------------------- | --------------------------------------------------------- | -------------------------------- |
| Firestore reads per app foreground | 1 (darkroom check)                                        | 0                                |
| Firestore reads per darkroom open  | 2-3 (check + photos + possible re-check)                  | 1-2 (check + photos)             |
| Worst-case reveal latency          | ~0s (instant on foreground)                               | ~2 min (Cloud Function interval) |
| Code complexity in darkroomService | High (inline reveal logic)                                | Low (timing only)                |
| Circular import risk               | Present (darkroomService imports photoService indirectly) | Eliminated                       |

The 2-minute worst-case latency is acceptable because:

- Users who open the darkroom directly still get instant reveals (useDarkroom checks on focus).
- The only scenario affected is: user has developing photos, brings app to foreground, does NOT open darkroom. In this case, they wait up to 2 minutes for the Cloud Function instead of getting an instant reveal. Since they are not looking at the darkroom, this delay is invisible.

## New Cloud Function Endpoints

### 1. `onSnapScreenshot` (callable)

Receives screenshot events from the client and sends push notifications to the snap sender.

```javascript
// In functions/index.js
exports.onSnapScreenshot = onCall({ memory: '256MiB', timeoutSeconds: 30 }, async request => {
  const { conversationId, messageId } = request.data;
  const callerId = request.auth?.uid;

  // Validate caller is a participant
  const parts = conversationId.split('_');
  if (!parts.includes(callerId)) {
    throw new HttpsError('permission-denied', 'Not a participant');
  }

  // Get snap message to find sender
  const messageDoc = await db
    .collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .doc(messageId)
    .get();

  if (!messageDoc.exists || messageDoc.data().type !== 'snap') {
    throw new HttpsError('not-found', 'Snap message not found');
  }

  const senderId = messageDoc.data().senderId;
  if (senderId === callerId) return { success: true }; // Sender screenshotting own snap, ignore

  // Get sender's FCM token and notification preferences
  const senderDoc = await db.collection('users').doc(senderId).get();
  if (!senderDoc.exists) return { success: true };

  const { fcmToken, notificationPreferences } = senderDoc.data();
  if (!fcmToken) return { success: true };

  // Check notification preferences
  const masterEnabled = notificationPreferences?.masterEnabled !== false;
  const dmEnabled = notificationPreferences?.directMessages !== false;
  if (!masterEnabled || !dmEnabled) return { success: true };

  // Get screenshotter's name
  const screenshotterDoc = await db.collection('users').doc(callerId).get();
  const screenshotterName = screenshotterDoc.data()?.displayName || 'Someone';

  // Send push notification
  const { sendPushNotification } = require('./notifications/sender');
  await sendPushNotification(
    fcmToken,
    screenshotterName,
    'screenshotted your snap',
    {
      type: 'snap_screenshot',
      conversationId,
      messageId,
    },
    senderId
  );

  return { success: true };
});
```

### 2. `sendLiveActivityUpdate` (callable, iOS only)

Handles starting, updating, and ending Live Activities for pinned snaps via FCM-to-APNs bridge. This is called by existing Cloud Functions (e.g., `onNewMessage` for snap sends, `onSnapViewed` for snap viewed) rather than directly by clients.

### 3. No new darkroom Cloud Functions needed

The existing `processDarkroomReveals` (every 2 minutes) remains unchanged as the server-side safety net. The optimization is entirely client-side (removing the App.js trigger and simplifying the hook).

## Firestore Schema Changes

### Extended: `users/{userId}`

```javascript
{
  // ... existing fields unchanged

  // NEW fields for Live Activities
  liveActivityEnabled: boolean,                    // User preference toggle
  liveActivityPushToStartToken: string | null,     // For server-started activities
  liveActivityTokens: {                            // Active activity tokens
    [activityId]: string,                          // Push token per activity
  } | null,
}
```

### Extended: `conversations/{conversationId}/messages/{messageId}` (snap type)

```javascript
{
  // ... existing snap fields unchanged
  screenshotAt: Timestamp | null,  // NEW: When recipient screenshotted
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Starting Live Activities from the Client on Snap Send

**What people do:** Have the sender's client start a Live Activity on the recipient's device.
**Why it's wrong:** The sender cannot start an activity on another user's device. Live Activities are started either locally on the same device or via server-side APNs push.
**Do this instead:** The sender's client sends the snap normally. The `onNewMessage` Cloud Function detects the snap and sends an APNs Live Activity push to the recipient's device using their stored push-to-start token.

### Anti-Pattern 2: Using FCM `data` Messages for Live Activity Updates

**What people do:** Send a regular FCM data message and have the client start/update the Live Activity.
**Why it's wrong:** FCM data messages are not guaranteed to be delivered immediately (especially in background/terminated state). Live Activities should appear immediately on the Lock Screen.
**Do this instead:** Use the FCM HTTP v1 API with the `live_activity_token` field, which maps directly to APNs `liveactivity` push type. These are delivered with high priority and processed by iOS even when the app is not running.

### Anti-Pattern 3: Polling `isDarkroomReadyToReveal` from Multiple Locations

**What people do:** Check darkroom status from App.js, DarkroomScreen, and any other entry point "just to be safe."
**Why it's wrong:** Each check is a Firestore read. With N users foregrounding the app M times per day, this adds N\*M unnecessary reads. The Cloud Function already guarantees reveals happen within 2 minutes.
**Do this instead:** Check darkroom status only when the user is actually viewing the DarkroomScreen (useDarkroom hook). Use the Cloud Function as the always-on safety net.

### Anti-Pattern 4: Storing Screenshot State as a Boolean

**What people do:** Use `screenshotted: boolean` on the snap message.
**Why it's wrong:** You lose when the screenshot happened. A timestamp (`screenshotAt`) gives you the boolean check (`screenshotAt !== null`) PLUS timing information for future features (e.g., "screenshotted 2 minutes ago").
**Do this instead:** Use `screenshotAt: Timestamp | null`. Check for null to determine if screenshotted.

## Build Order (Dependencies)

The v1.1 features have a clear dependency chain:

```
Phase 1: Tech Debt + Screenshot Detection (no native build needed yet)
  - Fix test gaps (useConversation hook tests, snapFunctions assertion)
  - Fix hoursSinceLastMutual naming
  - Add expo-screen-capture to project
  - Build useScreenshotDetection hook
  - Integrate into SnapViewer
  - Add onSnapScreenshot Cloud Function
  - Add screenshotAt field to snap messages + security rules update
  --> Requires EAS build (expo-screen-capture is a native module)

Phase 2: Darkroom Optimization (OTA-updatable after Phase 1 build)
  - Remove App.js foreground darkroom check
  - Simplify useDarkroom reveal logic
  - Simplify darkroomService.ensureDarkroomInitialized
  - Verify processDarkroomReveals Cloud Function covers all cases
  --> Pure JS refactoring, can be OTA updated

Phase 3: Live Activity Foundation (requires EAS build)
  - Add expo-live-activity package + config plugin
  - Create Swift widget target with FlickLiveActivity layout
  - Build liveActivityService.js (start, update, stop, token management)
  - Add Live Activity token fields to users/ collection
  - Update app.json with NSSupportsLiveActivities
  --> Requires EAS build (native Swift code + new plugin)
  --> COMBINE with Phase 1 EAS build if possible

Phase 4: Live Activity Server Integration
  - Add sendLiveActivityUpdate Cloud Function
  - Extend onNewMessage to trigger Live Activity start on snap sends
  - Extend onSnapViewed to trigger Live Activity end on snap view
  - Deep link wiring: Live Activity tap opens ConversationScreen
  - Android fallback: enhanced ongoing notification for snap alerts
  --> Cloud Function + JS changes, OTA-updatable after Phase 3 build

Phase 5: Infra Debt (independent, any time)
  - INFRA-03: Configure Firestore TTL policy for snap messages
  - INFRA-04: Configure Firebase Storage lifecycle rule for snap-photos/
  --> Firebase console configuration, no code changes
```

**Build optimization:** Combine Phase 1 and Phase 3 into a single EAS build to avoid two native build cycles. Both add native modules (`expo-screen-capture` and `expo-live-activity`). The JS work for each can be developed independently and merged before the combined build.

### Why this order:

1. **Tech debt first** -- Tests and naming fixes are quick wins that reduce risk for subsequent changes.
2. **Screenshot detection before Live Activities** -- Simpler feature, validates the native build pipeline, and is completely independent of Live Activities.
3. **Darkroom optimization is pure JS** -- Can be OTA-deployed immediately after the Phase 1 build, no native changes needed.
4. **Live Activity foundation before server integration** -- Must have the Swift widget target and client-side service working before the Cloud Functions can send pushes to it.
5. **Infra debt is independent** -- Firebase console configuration can happen any time without code deployment.

## Integration Points

### External Services

| Service               | Integration Pattern                                                                                                  | Notes                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `expo-screen-capture` | Hook-based (`useScreenshotDetection` wrapping `preventScreenCaptureAsync` + `addScreenshotListener`)                 | Compatible with SDK 54. Native module, requires EAS build. No additional iOS permissions. Android 14+ needs no permissions; Android 13- needs `READ_MEDIA_IMAGES`. |
| `expo-live-activity`  | Service-based (`liveActivityService.js` wrapping `startActivity`, `updateActivity`, `stopActivity`, token listeners) | iOS 16.2+ only. Push notifications require iOS 17.2+. NOT supported in Expo Go -- requires dev client. Early development stage, pin version strictly.              |
| FCM HTTP v1 API       | Cloud Function sends Live Activity pushes via `live_activity_token` field in FCM payload                             | Requires OAuth2 access token (handled by Admin SDK). Only works for APNs (iOS). Not available for Android.                                                         |
| APNs                  | Receives liveactivity push type from FCM bridge                                                                      | Token-based auth only (cert-based not supported for Live Activities). Push token is per-activity, not per-device.                                                  |

### Internal Boundaries

| Boundary                                  | Communication                                                                                      | Notes                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SnapViewer <-> useScreenshotDetection     | Hook provides prevention + detection; SnapViewer provides activation state and screenshot callback | Clean separation: hook manages expo-screen-capture lifecycle, component handles business logic (write to Firestore, call Cloud Function).                                     |
| liveActivityService <-> onNewMessage CF   | Cloud Function starts Live Activity via FCM push; client service manages local activity state      | Server starts activity remotely. Client tracks activity IDs for local updates/stops. Token sync via Firestore `users/` document.                                              |
| useDarkroom <-> processDarkroomReveals CF | Hook checks on screen focus. Cloud Function checks every 2 minutes. Both can trigger reveals.      | After optimization: hook is the primary trigger when user is in darkroom. Cloud Function is the catch-all for background reveals. No conflict because reveals are idempotent. |
| App.js <-> useDarkroom                    | After optimization: App.js no longer checks darkroom. All darkroom logic is in useDarkroom hook.   | Clean removal of responsibility from App.js. Reduces App.js complexity.                                                                                                       |

## Sources

- [Expo ScreenCapture API (SDK 54)](https://docs.expo.dev/versions/v54.0.0/sdk/screen-capture/) -- HIGH confidence (official Expo docs, verified via WebFetch)
- [expo-live-activity GitHub (Software Mansion Labs)](https://github.com/software-mansion-labs/expo-live-activity) -- MEDIUM confidence (official repo, but "early development stage" warning)
- [expo-widgets (SDK 55)](https://docs.expo.dev/versions/v55.0.0/sdk/widgets/) -- MEDIUM confidence (alpha, SDK 55 beta only)
- [Firebase Cloud Messaging Live Activity Support](https://firebase.google.com/docs/cloud-messaging/customize-messages/live-activity) -- HIGH confidence (official Firebase docs)
- [Apple ActivityKit Push Notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications) -- HIGH confidence (official Apple docs)
- [Android 16 Live Updates](https://www.androidauthority.com/android-16-live-notifications-3518375/) -- MEDIUM confidence (tech press, not yet released)
- [Expo SDK 55 Beta Changelog](https://expo.dev/changelog/sdk-55-beta) -- HIGH confidence (official Expo changelog)
- [Implementing Live Activities in React Native with Expo (Fizl)](https://fizl.io/blog/posts/live-activities) -- MEDIUM confidence (community implementation guide)
- [IOS Live Activities with Expo & React Native (Kutay, Dec 2025)](https://medium.com/@kutaui/ios-live-activities-with-expo-react-native-fa84c8e5a9b7) -- MEDIUM confidence (community guide)
- Existing codebase analysis: `snapService.js`, `darkroomService.js`, `useDarkroom.js`, `SnapViewer.js`, `App.js`, `functions/index.js`, `app.json`, `package.json` -- HIGH confidence (primary source)

---

_Architecture research for: Flick v1.1 Pinned Snaps, Screenshot Detection, Darkroom Optimization_
_Researched: 2026-02-25_
