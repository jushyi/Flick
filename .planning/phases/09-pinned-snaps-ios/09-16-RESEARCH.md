# Phase 09 Plan 16: Push-to-Start Live Activities - Research

**Researched:** 2026-03-19
**Domain:** iOS ActivityKit push-to-start tokens, APNS HTTP/2 payload delivery, Firebase Admin SDK live activity support, expo-modules-core native module events
**Confidence:** MEDIUM-HIGH

## Summary

Push-to-start Live Activities (iOS 17.2+) enable the server to start a Live Activity on a device even when the app is killed, by sending a special APNS payload to a push-to-start token. This solves the confirmed issue where `Activity.request()` fails in the NSE process (09-ISSUES-R2.md Issue 2).

The implementation has two viable server-side delivery paths, each with significant tradeoffs:

**Option A: Firebase Admin SDK (recommended).** Upgrade `firebase-admin` from ^12 to ^13.5+ and `firebase-functions` from ^4 to ^7+ to get native `live_activity_token` support in `admin.messaging().send()`. This approach also requires adding `@react-native-firebase/messaging` to the React Native app to obtain the FCM registration token (currently the app only stores Expo push tokens). The advantage is staying within the Firebase ecosystem with no additional credentials to manage.

**Option B: Direct APNS via HTTP/2.** Use a library like `apns2` or Node.js native `http2` module to send directly to Apple's APNS servers. This avoids the firebase-admin upgrade but requires obtaining and securely storing an APNs Auth Key (.p8 file), and adds a separate notification delivery path to maintain alongside the existing Expo Push pipeline.

**Primary recommendation:** Use Option A (Firebase Admin SDK upgrade) because it keeps the notification infrastructure unified, avoids managing a separate APNS auth key, and the upgrade path is well-documented. The FCM registration token can be obtained via `@react-native-firebase/messaging` which is compatible with the existing `@react-native-firebase/*` packages already in use. However, this is a significant dependency upgrade that should be tested carefully.

## Standard Stack

### Core (Needs Installation/Upgrade)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | ^13.5.0+ | Server-side push-to-start via `admin.messaging().send()` with `apns.live_activity_token` | Only version with Live Activity token support; v13.5.0 added the field (May 2025) |
| `firebase-functions` | ^7.0.0+ | Cloud Functions runtime; peer dependency of firebase-admin v13 | firebase-functions v4/v6 has peer dep on firebase-admin ^11/^12 only; v7+ supports v13 |
| `@react-native-firebase/messaging` | ^23.8.6 | Get FCM registration token on client; required by Firebase Admin's `token` field | Must match existing @react-native-firebase/* version; provides `messaging().getToken()` |

### Alternative: Direct APNS (if Firebase upgrade is blocked)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `apns2` | latest | Node.js HTTP/2 client for direct APNS delivery | If firebase-admin v13 upgrade proves too risky |
| Node.js `http2` (built-in) | N/A | Zero-dependency direct APNS | If no external APNS library desired; more boilerplate |

### Already Installed (No Changes)
| Library | Version | Purpose |
|---------|---------|---------|
| `expo-modules-core` | (bundled with Expo 54) | Native module API for Swift-to-JS bridge (push-to-start token observation) |
| `expo-server-sdk` | ^5.0.0 | Regular push notifications (unchanged; still used for non-pinned notifications) |

### Version Verification
```
firebase-admin latest: 13.7.0 (live_activity_token added in 13.5.0)
firebase-functions latest: 7.2.2 (supports firebase-admin v13)
@react-native-firebase/messaging: 23.8.6 (matches existing RNFirebase packages)
apns2 latest: 12.2.0
```

**Installation (Option A):**
```bash
# Cloud Functions
cd functions && npm install firebase-admin@^13.5.0 firebase-functions@^7.0.0

# React Native app
npm install @react-native-firebase/messaging@^23.8.6
```

**CRITICAL NOTE:** Upgrading firebase-admin from v12 to v13 and firebase-functions from v4 to v7 are **major version bumps** with potential breaking changes. The firebase-admin v13 upgrade requires Node.js 18+ (project uses Node 20, so OK). The firebase-functions v7 upgrade may require changes to function definitions. Test all existing Cloud Functions after upgrade.

## Architecture Patterns

### Push-to-Start Flow (iOS 17.2+)

```
App Launch (iOS)
    |
    v
LiveActivityManager.observePushToStartToken()
    |  (Swift: Activity<PinnedSnapAttributes>.pushToStartTokenUpdates)
    v
Emit "onPushToStartToken" event to JS
    |
    v
liveActivityService.js receives token
    |
    v
Store in Firestore: users/{uid}/pushToStartToken + users/{uid}/fcmToken
    |
    v
--- When pinned snap is sent ---
    |
    v
Cloud Function (onNewMessage)
    |
    +-- Has pushToStartToken + fcmToken?
    |       |
    |       v
    |   admin.messaging().send({
    |     token: fcmToken,
    |     apns: {
    |       live_activity_token: pushToStartToken,
    |       headers: { "apns-priority": "10" },
    |       payload: { aps: { event: "start", ... } }
    |     }
    |   })
    |       |
    |       v
    |   Apple starts Live Activity automatically (even app killed)
    |
    +-- No pushToStartToken? (iOS < 17.2 or token unavailable)
            |
            v
        Existing Expo Push + NSE path (thumbnail download only)
        + Resume fallback on foreground (plan 09-14)
```

### Pattern 1: Push-to-Start Token Observation via Expo Module

**What:** The LiveActivityManagerModule observes `Activity<PinnedSnapAttributes>.pushToStartTokenUpdates` (an AsyncSequence) and emits events to JavaScript when a token is received or updated.

**When to use:** On app startup for authenticated iOS 17.2+ users.

**Example (Swift side):**
```swift
// In LiveActivityManagerModule.swift definition()
Events("onPushToStartToken")

AsyncFunction("observePushToStartToken") { [weak self] in
    guard let self = self else { return }
    #if canImport(ActivityKit)
    guard #available(iOS 17.2, *) else { return }

    Task {
        for await tokenData in Activity<PinnedSnapAttributes>.pushToStartTokenUpdates {
            let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
            self.sendEvent("onPushToStartToken", [
                "token": tokenString
            ])
        }
    }
    #endif
}
```

**Example (JS side):**
```javascript
// In liveActivityService.js
import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

const emitter = new EventEmitter(NativeModulesProxy.LiveActivityManager);

export const observePushToStartToken = (callback) => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) return null;

  try {
    LiveActivityManager.observePushToStartToken();
  } catch (e) {
    // iOS < 17.2, silently ignore
    return null;
  }

  const subscription = emitter.addListener('onPushToStartToken', (event) => {
    callback(event.token);
  });

  return subscription;
};
```

**Confidence:** MEDIUM -- The pattern of observing an AsyncSequence and emitting events via expo-modules-core Events is well-established (used by expo-notifications internally), but the specific interaction with `pushToStartTokenUpdates` has not been verified in an Expo module context. The async sequence observation pattern should work, but needs device testing.

### Pattern 2: Firebase Admin SDK Push-to-Start Delivery

**What:** Cloud Function sends a push-to-start payload via `admin.messaging().send()` with both the FCM registration token and the Live Activity push-to-start token.

**When to use:** When recipient has both `fcmToken` and `pushToStartToken` stored in their user document.

**Example:**
```javascript
// functions/notifications/liveActivitySender.js
const admin = require('firebase-admin');

async function sendPushToStartLiveActivity({
  fcmToken,
  pushToStartToken,
  activityId,
  senderName,
  caption,
  conversationId,
  thumbnailUrl,
}) {
  const message = {
    token: fcmToken,  // FCM registration token (required by Firebase)
    apns: {
      live_activity_token: pushToStartToken,  // Push-to-start token from ActivityKit
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          timestamp: Math.floor(Date.now() / 1000),
          event: 'start',
          'content-state': {},  // Empty -- matches PinnedSnapAttributes.ContentState
          'attributes-type': 'PinnedSnapAttributes',
          attributes: {
            activityId,
            senderName,
            caption: caption || '',
            deepLinkUrl: `lapse://messages/${conversationId}`,
          },
          alert: {
            title: `${senderName} pinned a snap`,
            body: caption || 'Tap to view',
          },
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Confidence:** MEDIUM -- Firebase docs show this exact payload structure. However, the `live_activity_token` field was only added in firebase-admin v13.5.0 and the TypeScript types were missing until that fix (PR #2891). Runtime behavior confirmed by Firebase docs but not yet tested in this project.

### Pattern 3: Hybrid Delivery with Graceful Fallback

**What:** The Cloud Function checks whether the recipient has a push-to-start token. If yes, send via Firebase Admin push-to-start. If no, fall back to existing Expo Push path with NSE thumbnail download + foreground resume fallback.

**When to use:** Every pinned snap notification.

**Example:**
```javascript
// In onNewMessage handler
if (message.pinned === true) {
  const recipientDoc = await getDoc(doc(db, 'users', recipientId));
  const { pushToStartToken, fcmToken } = recipientDoc.data();

  if (pushToStartToken && fcmToken) {
    // iOS 17.2+: Push-to-start (starts Live Activity even when killed)
    const result = await sendPushToStartLiveActivity({
      fcmToken,
      pushToStartToken,
      activityId: message.pinnedActivityId,
      senderName: senderProfile.displayName,
      caption: message.caption,
      conversationId,
      thumbnailUrl: message.pinnedThumbnailUrl,
    });

    if (result.success) {
      // Also send regular notification for the notification banner
      // (push-to-start creates Live Activity but may not show a banner)
      await sendPushNotification(recipientToken, title, body, data, recipientId, {
        mutableContent: true,  // NSE still downloads thumbnail to App Groups
      });
      return;
    }
    // Fall through to regular path on failure
  }

  // Fallback: Expo Push + NSE + foreground resume
  await sendPushNotification(recipientToken, title, body, data, recipientId, {
    mutableContent: true,
  });
}
```

### Anti-Patterns to Avoid

- **Attempting Activity.request() in NSE:** Confirmed broken. The NSE runs in a separate extension process where ActivityKit's `Activity.request()` is not supported. This was the root cause of Issue 2. Push-to-start is the correct solution.
- **Sending push-to-start without FCM token:** Firebase Admin SDK requires BOTH the FCM registration token (`message.token`) and the push-to-start token (`apns.live_activity_token`). Omitting either causes the send to fail.
- **Using `%x` instead of `%02x` for token hex encoding:** The Christian Selig guide shows `"%x"` but the correct format is `"%02x"` to ensure zero-padding. Without it, byte `0x0A` becomes `"a"` instead of `"0a"`, producing an invalid token.
- **Assuming push-to-start replaces regular notifications:** Push-to-start creates a Live Activity but may not show a notification banner. Send BOTH the push-to-start payload and a regular notification if you want both the Live Activity and a banner/sound.
- **Starting token observation without checking iOS version:** `pushToStartTokenUpdates` only exists on iOS 17.2+. Calling it on older versions will fail. Always gate with `#available(iOS 17.2, *)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| APNS token-based JWT auth | Custom JWT signing for APNS | `firebase-admin` v13+ `messaging().send()` with `live_activity_token` | Firebase handles APNS auth, token refresh, HTTP/2 connection pooling |
| Push-to-start token hex encoding | Manual byte-to-string conversion | `tokenData.map { String(format: "%02x", $0) }.joined()` | Standard Swift pattern; easy to get wrong with `%x` vs `%02x` |
| Token refresh lifecycle | Custom token change detection | ActivityKit's `pushToStartTokenUpdates` AsyncSequence | Apple manages when tokens change; the async sequence emits updates automatically |
| iOS version detection server-side | Custom version parsing from user-agent or stored field | Token presence check (has pushToStartToken = iOS 17.2+) | If the token exists, the device supports push-to-start; no version string needed |

## Common Pitfalls

### Pitfall 1: firebase-admin v12 Does NOT Support live_activity_token
**What goes wrong:** `admin.messaging().send()` with a `live_activity_token` field either throws an "invalid-argument" error or silently ignores the field.
**Why it happens:** The `live_activity_token` field on `ApnsConfig` was only added in firebase-admin v13.5.0 (May 2025). The project currently uses ^12.0.0.
**How to avoid:** Upgrade to firebase-admin ^13.5.0+ AND firebase-functions ^7.0.0+ (required peer dependency).
**Warning signs:** "messaging/invalid-argument" errors when sending push-to-start payloads.

### Pitfall 2: Missing FCM Registration Token
**What goes wrong:** Firebase Admin `messaging().send()` requires a `token` field with the FCM registration token. The project currently only stores Expo push tokens (format: `ExponentPushToken[...]`), which are NOT FCM tokens.
**Why it happens:** The app uses `expo-notifications` `getExpoPushTokenAsync()` which returns an Expo-format token, not a raw FCM/APNS token. Firebase Admin cannot send to Expo tokens.
**How to avoid:** Install `@react-native-firebase/messaging` and call `messaging().getToken()` to get the FCM registration token. Store it alongside the Expo push token in the user document. The FCM token is a different token from the push-to-start token -- you need BOTH.
**Warning signs:** "messaging/registration-token-not-registered" or "messaging/invalid-registration-token" errors.

### Pitfall 3: Push-to-Start Token Only Generated on First Install After Reboot
**What goes wrong:** The `pushToStartTokenUpdates` async sequence never emits a token, even on iOS 17.2+.
**Why it happens:** Per Christian Selig's guide and Apple Developer Forums, iOS only generates push-to-start tokens during the first app install after a device restart. This is a known iOS 17.x bug that may be fixed in later versions.
**How to avoid:** Call `observePushToStartToken` as early as possible in app lifecycle (ideally in `didFinishLaunchingWithOptions` or equivalent). Accept that some users may not get a token until they reinstall or reboot. The foreground-resume fallback (plan 09-14) covers these cases.
**Warning signs:** Token is null/empty for users who updated the app rather than fresh-installed.

### Pitfall 4: attributes-type Must Match Exactly
**What goes wrong:** Push-to-start payload is sent successfully (no error from APNS) but the Live Activity never appears on the device.
**Why it happens:** The `attributes-type` string in the APNS payload must exactly match the Swift struct name that conforms to `ActivityAttributes`. If the struct is `PinnedSnapAttributes`, the string must be `"PinnedSnapAttributes"` -- not a module-qualified name, not camelCase.
**How to avoid:** Hardcode the string to match the Swift struct name exactly. Verify by checking the struct declaration in `PinnedSnapAttributes.swift`.
**Warning signs:** Silent failure -- no error from APNS, but no Live Activity created.

### Pitfall 5: NSE Still Fires for Regular Push (But NOT for Push-to-Start)
**What goes wrong:** Confusion about whether the NSE intercepts push-to-start payloads.
**Why it happens:** Push-to-start uses `apns-push-type: liveactivity`, not `alert`. The NSE only intercepts `alert`-type pushes with `mutable-content: 1`. Push-to-start payloads go directly to ActivityKit, bypassing the NSE entirely.
**How to avoid:** If the widget needs the thumbnail image, the thumbnail must be included in the `attributes` of the push-to-start payload (as a URL that the widget fetches), OR you must also send a separate regular push notification with `mutable-content: 1` so the NSE can download the thumbnail to App Groups. The hybrid approach (Pattern 3) sends both.
**Warning signs:** Live Activity appears but shows the "F" placeholder instead of the photo thumbnail.

### Pitfall 6: firebase-functions v4 to v7 Breaking Changes
**What goes wrong:** Existing Cloud Functions break after upgrading firebase-functions.
**Why it happens:** firebase-functions v7 is a major version bump. Function definition syntax, trigger types, or deployment behavior may have changed.
**How to avoid:** Read the firebase-functions v7 changelog before upgrading. Test all existing functions locally with `firebase emulators:start` before deploying. Consider doing the upgrade in a separate plan/commit before adding push-to-start logic.
**Warning signs:** Deploy failures, runtime errors in existing functions, or functions not triggering.

## Code Examples

### Push-to-Start Token Observation (Swift Native Module)
```swift
// Source: Apple ActivityKit docs + expo-modules-core Events API
// In LiveActivityManagerModule.swift

Events("onPushToStartToken")

AsyncFunction("observePushToStartToken") { [weak self] in
    guard let self = self else { return }
    #if canImport(ActivityKit)
    guard #available(iOS 17.2, *) else { return }

    // Cancel any existing observation
    self.pushToStartObservationTask?.cancel()

    self.pushToStartObservationTask = Task {
        for await tokenData in Activity<PinnedSnapAttributes>.pushToStartTokenUpdates {
            let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
            self.sendEvent("onPushToStartToken", [
                "token": tokenString
            ])
        }
    }
    #endif
}
```

### FCM Token Retrieval (requires @react-native-firebase/messaging)
```javascript
// Source: React Native Firebase docs (rnfirebase.io/messaging/usage)
import messaging from '@react-native-firebase/messaging';

export const getFCMRegistrationToken = async () => {
  if (Platform.OS !== 'ios') return null;

  try {
    // Request permission first (may already be granted)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) return null;

    // Get FCM registration token (different from Expo push token)
    const fcmToken = await messaging().getToken();
    return fcmToken;
  } catch (error) {
    logger.warn('Failed to get FCM token', { error: error.message });
    return null;
  }
};
```

### Token Hex Encoding (Swift)
```swift
// Source: Apple Developer Documentation + Christian Selig's guide
// CORRECT: zero-padded hex
let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()

// WRONG: non-zero-padded (will produce invalid tokens)
let tokenString = tokenData.map { String(format: "%x", $0) }.joined()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Activity.request() in NSE | Push-to-start via APNS | iOS 17.2 (Dec 2023) | Reliable background Live Activity creation without app running |
| Certificate-based APNS auth | Token-based auth (p8 key) | Required for Live Activities | Cannot use old cert-based auth for Live Activity pushes |
| firebase-admin v12 (no LA support) | firebase-admin v13.5+ with live_activity_token | May 2025 | Native Firebase support for push-to-start payloads |
| Expo Push tokens only | FCM token + Expo token + push-to-start token | New for this feature | Three token types needed for full iOS push coverage |

## Open Questions

1. **firebase-functions v4 to v7 migration risk**
   - What we know: v7 exists, supports firebase-admin v13, and is the current template default
   - What's unclear: Whether the v4-to-v7 upgrade has breaking changes that affect existing onNewMessage, processDarkroomReveals, or other Cloud Functions in functions/index.js (~2700 lines)
   - Recommendation: Test upgrade in isolation. Run all existing functions through the emulator before deploying. Consider splitting the upgrade into its own plan step.

2. **Thumbnail display without NSE for push-to-start path**
   - What we know: Push-to-start bypasses the NSE (different apns-push-type). The widget currently reads thumbnails from App Groups, written by either the NSE or the main app's foreground handler.
   - What's unclear: When push-to-start creates the Live Activity with the app killed, the thumbnail won't be in App Groups yet because no code ran to download it. The widget will show the "F" placeholder.
   - Recommendation: Two options: (a) Send both push-to-start AND a regular mutable-content push. The NSE intercepts the regular push and downloads the thumbnail. (b) Have the widget download the thumbnail itself using the URL from attributes. Option (a) is simpler and leverages existing NSE code. Option (b) is more reliable but adds URL handling to the widget.

3. **Dual push delivery (push-to-start + regular notification)**
   - What we know: Push-to-start creates the Live Activity but may not show a standard notification banner. Users may want both.
   - What's unclear: Whether iOS shows both a Live Activity AND a notification banner when both arrive, or if one suppresses the other.
   - Recommendation: Test on device. If both show, the NSE should suppress the banner (deliver empty content) as it does now, since the Live Activity is the primary indicator.

4. **Token storage schema**
   - What we know: User doc already has `fcmToken` (currently stores Expo push token). Need to store pushToStartToken too.
   - What's unclear: Whether to rename the existing field or add new ones.
   - Recommendation: Add new fields: `fcmRegistrationToken` (FCM token from @react-native-firebase/messaging) and `pushToStartToken`. Keep existing `fcmToken` field as-is (it stores the Expo push token and is used throughout the codebase). Rename would require changing all existing notification send code.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="liveActivity" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A (gap closure) | Push-to-start token observation emits event | manual-only | Physical device (requires iOS 17.2+) | N/A |
| N/A (gap closure) | Cloud Function sends push-to-start payload | unit | `cd functions && npx jest --testPathPattern="liveActivity" -x` | No -- Wave 0 gap |
| N/A (gap closure) | Fallback to Expo Push when no push-to-start token | unit | `cd functions && npx jest --testPathPattern="sender" -x` | Partial -- existing sender tests |
| N/A (gap closure) | Live Activity appears when app killed (iOS 17.2+) | manual-only | Physical device test | N/A |
| N/A (gap closure) | Thumbnail shows in Live Activity via push-to-start | manual-only | Physical device test | N/A |

### Wave 0 Gaps
- [ ] Cloud Function unit test for push-to-start payload construction
- [ ] Integration test: mock admin.messaging().send() with live_activity_token
- [ ] Verify firebase-admin v13 + firebase-functions v7 work with existing functions via emulator

## Sources

### Primary (HIGH confidence)
- [Firebase Cloud Messaging Live Activity Docs](https://firebase.google.com/docs/cloud-messaging/customize-messages/live-activity) -- Exact payload format, FCM + live_activity_token requirement, REST examples
- [Apple pushToStartTokenUpdates Documentation](https://developer.apple.com/documentation/activitykit/activity/pushtostarttokenupdates) -- API available iOS 17.2+, async sequence for token observation
- [Firebase Admin Node.js SDK Issue #2875](https://github.com/firebase/firebase-admin-node/issues/2875) -- Confirmed live_activity_token support added in v13.5.0 via PR #2891

### Secondary (MEDIUM confidence)
- [Christian Selig: Server-side Live Activities Guide](https://christianselig.com/2024/09/server-side-live-activities/) -- APNS headers (apns-push-type: liveactivity, apns-topic: bundleId.push-type.liveactivity), token lifecycle gotchas, alert field requirement
- [APNsPush: Start and Update Live Activities](https://apnspush.com/how-to-start-and-update-live-activities-with-push-notifications) -- Complete APNS payload format, headers reference, push-to-start token format
- [Expo Module API Reference](https://docs.expo.dev/modules/module-api/) -- Events definition, sendEvent, AsyncFunction patterns
- [Expo: Send notifications with FCM and APNs](https://docs.expo.dev/push-notifications/sending-notifications-custom/) -- getDevicePushTokenAsync for raw APNS token

### Tertiary (LOW confidence)
- [Firebase Admin v13 + firebase-functions peer dependency issue](https://github.com/firebase/firebase-admin-node/issues/2772) -- Resolved by firebase-functions v7, but migration risk not fully documented
- NSE behavior with push-to-start: No authoritative source confirms whether NSE fires or not for `apns-push-type: liveactivity`. Inference based on NSE only intercepting `mutable-content: 1` alert-type pushes.

## Metadata

**Confidence breakdown:**
- Push-to-start payload format: HIGH -- Firebase docs + Apple docs agree on structure
- Firebase Admin SDK upgrade path: MEDIUM -- Version requirements confirmed but migration risk of v4->v7 firebase-functions unknown
- Token observation via expo-modules-core: MEDIUM -- Pattern is standard but specific pushToStartTokenUpdates usage not verified in Expo context
- NSE interaction with push-to-start: MEDIUM -- Logical inference (different push type = NSE bypass) but no authoritative confirmation
- Thumbnail pipeline for push-to-start: LOW -- Open question about how widget gets thumbnail when NSE doesn't run

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- Apple APIs stable, Firebase SDK versions may evolve)
