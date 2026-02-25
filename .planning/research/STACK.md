# Stack Research: v1.1 Pinned Snaps & Polish

**Domain:** iOS Live Activities, Android persistent notifications, screenshot detection, darkroom optimization
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH (Live Activities libraries are rapidly evolving; screenshot detection is stable)

## Existing Stack (No Changes Needed)

These packages are already installed and cover the bulk of v1.1 work. Listed here to prevent redundant additions.

| Technology                                  | Version  | v1.1 Role                                                               |
| ------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `@react-native-firebase/firestore`          | ^23.8.6  | Darkroom optimization (cached `nextRevealAt`), screenshot event logging |
| `@react-native-firebase/functions`          | ^23.8.6  | Screenshot notification Cloud Function, pinned snap push updates        |
| `expo-notifications`                        | ~0.32.16 | Screenshot alert push notifications, pinned snap status notifications   |
| `react-native-reanimated`                   | ~4.1.1   | Pinned snap UI animations, darkroom transitions                         |
| `@react-native-async-storage/async-storage` | 2.2.0    | Client-side darkroom `nextRevealAt` cache                               |
| `date-fns`                                  | ^4.1.0   | Countdown timer formatting for pinned snap duration display             |
| `expo-haptics`                              | ~15.0.8  | Haptic feedback on pin/unpin actions                                    |

**Key insight:** v1.1 requires 2 new native dependencies (`expo-screen-capture` and a Live Activities library) and one darkroom optimization that uses only existing packages. Both new dependencies require a new EAS native build.

## New Dependencies Required

### 1. expo-screen-capture (Screenshot Detection)

| Field                     | Value                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| **Package**               | `expo-screen-capture`                                                                |
| **Install**               | `npx expo install expo-screen-capture` (auto-resolves SDK 54 compatible version)     |
| **Version**               | ~8.0.x (SDK 54 compatible; `npx expo install` selects correct version)               |
| **Purpose**               | Detect screenshots while viewing snaps; prevent screen recording during snap viewing |
| **Confidence**            | HIGH -- Official Expo SDK package, documented for SDK 54                             |
| **Requires Native Build** | YES -- Contains native iOS/Android modules                                           |
| **Config Plugin**         | NO -- Does not require a plugin entry in `app.json`                                  |

**Why this library:**

- Official Expo package -- guaranteed SDK 54 + RN 0.81.5 compatibility, maintained by Expo team
- Provides both detection (`useScreenshotListener` hook) AND prevention (`usePreventScreenCapture` hook)
- Already deferred from v1.0 specifically for this milestone (PROJECT.md line 60)
- The snap viewer needs both: block screen recording while viewing AND detect+notify on screenshot

**API usage for Flick:**

```javascript
import * as ScreenCapture from 'expo-screen-capture';

// In SnapViewer component:
// 1. Prevent screen recording while snap is visible
ScreenCapture.usePreventScreenCapture('snap-viewer');

// 2. Detect screenshots and notify sender
ScreenCapture.useScreenshotListener(() => {
  // Cloud Function sends push notification to snap sender
  screenshotService.reportScreenshot(conversationId, messageId, currentUserId);
});

// 3. App switcher privacy (blur on iOS, blank on Android)
ScreenCapture.enableAppSwitcherProtectionAsync(50); // blur intensity
```

**Platform behavior:**

| Platform             | Screenshot Detection         | Screen Recording Prevention | App Switcher Protection | Permissions       |
| -------------------- | ---------------------------- | --------------------------- | ----------------------- | ----------------- |
| iOS 13+              | Works                        | Works                       | Blur overlay            | None needed       |
| Android 14+          | Works                        | Works (FLAG_SECURE)         | Blank preview           | None needed       |
| Android 13 and below | Requires `READ_MEDIA_IMAGES` | Works (FLAG_SECURE)         | Blank preview           | Permission prompt |

**Known issue:** GitHub issue #31678 reported screenshot listener not firing on Android 14+ in some cases. Fix merged in PR #31702. Verify behavior in SDK 54 build during development. Workaround: call `allowScreenCaptureAsync()` before registering listener.

**Android permission addition needed:**

```json
// app.json - only needed if supporting Android 13 and below
"android": {
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_MEDIA_IMAGES"
  ]
}
```

**IMPORTANT:** Adding `READ_MEDIA_IMAGES` triggers Google Play's photo/video policy review. Since the app targets Android 14+ as the primary experience, consider skipping this permission and accepting that screenshot detection degrades gracefully on Android 13 and below.

---

### 2. expo-live-activity (iOS Live Activities)

| Field                     | Value                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Package**               | `expo-live-activity`                                                                                   |
| **Install**               | `npm install expo-live-activity`                                                                       |
| **Version**               | 0.4.x (latest on npm; early development stage)                                                         |
| **Purpose**               | Display pinned snap on iOS lock screen via ActivityKit Live Activity                                   |
| **Confidence**            | MEDIUM -- Library works but is in "early development" with breaking changes possible in minor versions |
| **Requires Native Build** | YES -- Creates a Swift widget extension target                                                         |
| **Config Plugin**         | YES -- Must add `"expo-live-activity"` to plugins array in `app.json`                                  |
| **iOS Only**              | YES -- No Android support (Android requires separate approach)                                         |
| **Min iOS**               | 16.2                                                                                                   |

**Why `expo-live-activity` over alternatives:**

| Library                                        | Approach                                        | Maturity        | Flick Fit                                                                              | Verdict                               |
| ---------------------------------------------- | ----------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| **expo-live-activity** (Software Mansion)      | Predefined layouts via config, simple JS API    | Early (0.4.x)   | Good -- simple API matches the limited UI needed (photo thumbnail + countdown + title) | **RECOMMENDED**                       |
| **Voltra** (Callstack)                         | JSX-to-SwiftUI renderer, write React components | Stable (v1.2.0) | Overkill -- Flick needs a simple pinned snap display, not custom SwiftUI layouts       | Too much complexity for this use case |
| **@kingstinct/react-native-activity-kit**      | Direct ActivityKit bindings via Nitro Modules   | Active          | Low-level -- requires writing your own SwiftUI widget target manually                  | Too much native Swift work            |
| **Custom Expo Module** (@bacons/apple-targets) | Manual Swift widget + Expo Module API bridge    | DIY             | Full control but requires Swift knowledge and maintenance                              | Only if library approach fails        |

**Rationale:** Flick's pinned snap Live Activity is simple -- show a photo thumbnail, the sender's name, a countdown timer, and a deep link back to the conversation. `expo-live-activity` provides exactly this through its predefined layout options (image, title, subtitle, progress/countdown timer). Voltra's JSX-to-SwiftUI approach is impressive but introduces unnecessary complexity for a UI that fits within preset templates.

**Risk mitigation:** `expo-live-activity` is in early development. If it breaks in a future Expo SDK upgrade or has missing features:

- Fallback to Voltra (v1.2.0, stable, production-ready) -- same config plugin pattern, just swap the library
- Fallback to custom Expo Module with @bacons/apple-targets -- more work but full control

**API usage for Flick:**

```javascript
import { startActivity, updateActivity, stopActivity } from 'expo-live-activity';

// When user pins a snap
const activityId = await startActivity(
  {
    title: `${senderName}'s Snap`,
    subtitle: 'Tap to view',
    imageName: 'snap_thumbnail', // Must be in widget assets
    progressBar: { type: 'countdown', endTime: expiresAt },
  },
  { deepLink: `lapse://messages/${conversationId}` }
);

// When snap is viewed or expires
await stopActivity(activityId, { title: 'Snap viewed' });
```

**Setup requirements:**

1. Add plugin to `app.json`:

   ```json
   "plugins": [
     "expo-live-activity",
     // ... existing plugins
   ]
   ```

2. Add snap thumbnail images to `assets/live-activity/` folder (must be < 4KB per iOS limit)

3. Run `npx expo prebuild --clean` to generate the Swift widget extension target

4. Create new EAS build (widget extension is native code)

5. Add `NSSupportsLiveActivities` to Info.plist (handled by config plugin)

**Deployment note:** Live Activity updates can be pushed via APNs push notifications from Cloud Functions. This is required because the app cannot update Live Activities when backgrounded/killed. The `startActivity` call returns a push token that must be stored server-side.

---

### 3. Android Equivalent: expo-notifications Ongoing Notification (NOT a new dependency)

| Field               | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| **Package**         | `expo-notifications` (ALREADY INSTALLED)                                        |
| **New Dependency?** | NO                                                                              |
| **Purpose**         | Display pinned snap as a persistent/ongoing notification on Android lock screen |
| **Confidence**      | HIGH -- Uses existing package with `sticky: true` and custom channel            |

**Why NOT add Notifee or a separate Android library:**

- `expo-notifications` already supports `sticky` (ongoing) notifications and custom notification channels
- Adding `@notifee/react-native` would create a second notification system alongside `expo-notifications`
- The pinned snap notification on Android is intentionally simpler than iOS Live Activities -- it is a persistent notification with a photo, sender name, and deep link
- Android does not have Live Activities (Android 14's "Live Updates" are just progress-style ongoing notifications)

**Implementation approach:**

```javascript
import * as Notifications from 'expo-notifications';

// Create a dedicated channel for pinned snaps
await Notifications.setNotificationChannelAsync('pinned-snaps', {
  name: 'Pinned Snaps',
  importance: Notifications.AndroidImportance.HIGH,
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
});

// Display ongoing notification (cannot be swiped away)
await Notifications.scheduleNotificationAsync({
  content: {
    title: `${senderName}'s Snap`,
    body: 'Tap to view',
    data: { conversationId, messageId, type: 'pinned_snap' },
    sticky: true, // Cannot be dismissed
    autoDismiss: false,
    categoryIdentifier: 'pinned-snap',
  },
  trigger: null, // Show immediately
});

// Dismiss when snap is viewed
await Notifications.dismissNotificationAsync(notificationId);
```

**Platform guard required:**

```javascript
if (Platform.OS === 'android') {
  // Show ongoing notification
} else if (Platform.OS === 'ios') {
  // Start Live Activity
}
```

---

## Darkroom Optimization (No New Dependencies)

The darkroom client-side reveal check optimization uses ONLY existing packages. No new dependencies needed.

**Current problem:** `isDarkroomReadyToReveal()` makes a Firestore `getDoc` call every time:

- App comes to foreground (App.js AppState listener)
- DarkroomScreen gains focus (useFocusEffect)
- This is 2+ Firestore reads per app open, even when `nextRevealAt` is minutes away

**Optimization approach:** Cache `nextRevealAt` in AsyncStorage after each read, compare against `Date.now()` client-side before making Firestore call.

```javascript
// darkroomService.js optimization
import AsyncStorage from '@react-native-async-storage/async-storage';

export const isDarkroomReadyToReveal = async userId => {
  // Check cached value first (avoid Firestore read)
  const cached = await AsyncStorage.getItem(`darkroom_nextRevealAt_${userId}`);
  if (cached) {
    const cachedTime = parseInt(cached, 10);
    const now = Date.now();
    if (cachedTime > now) {
      // Not ready yet, skip Firestore read
      return false;
    }
  }

  // Cache expired or missing -- check Firestore
  const result = await getDarkroom(userId);
  if (!result.success) return false;

  const { nextRevealAt } = result.darkroom;

  // Cache the value for future checks
  if (nextRevealAt) {
    await AsyncStorage.setItem(
      `darkroom_nextRevealAt_${userId}`,
      String(nextRevealAt.seconds * 1000)
    );
  }

  const now = Timestamp.now();
  return nextRevealAt && nextRevealAt.seconds <= now.seconds;
};
```

**Savings:** Eliminates ~80% of unnecessary Firestore reads for darkroom checks. The 0-5 minute reveal window means most foreground checks will hit the cache and short-circuit.

## What NOT to Install

| Library                                   | Why You Might Consider It                                         | Why NOT to Use It                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Voltra** (v1.2.0)                       | Full Live Activity + Widget support with JSX-to-SwiftUI rendering | Overkill for a simple pinned snap display. `expo-live-activity` covers the needed UI with less complexity. Voltra adds ~60% more build complexity (custom renderer, Brotli compression, 4KB payload management). Reconsider only if `expo-live-activity` proves insufficient. |
| **@kingstinct/react-native-activity-kit** | Direct ActivityKit bindings with Nitro Modules                    | Requires writing your own SwiftUI widget UI manually. More work than needed when `expo-live-activity` provides preset layouts.                                                                                                                                                |
| **@notifee/react-native**                 | Foreground service + ongoing notifications on Android             | Creates a duplicate notification system. `expo-notifications` already supports `sticky` (ongoing) notifications, custom channels, and notification dismissal. Adding Notifee would mean maintaining two notification stacks.                                                  |
| **react-native-capture-protection**       | More aggressive screenshot blocking (app switcher protection)     | `expo-screen-capture` already provides app switcher protection via `enableAppSwitcherProtectionAsync()`. The third-party lib adds no value over the official Expo package.                                                                                                    |
| **expo-widgets** (Expo official)          | Expo SDK 55+ widget system                                        | Only available in Expo SDK 55 beta, not SDK 54. The project is on SDK 54. `expo-live-activity` works on SDK 54.                                                                                                                                                               |

## Installation Commands

```bash
# New dependencies (both require native rebuild):
npx expo install expo-screen-capture
npm install expo-live-activity

# IMPORTANT: After installing, update app.json plugins, then:
npx expo prebuild --clean
# Then create new EAS builds:
eas build --platform ios --profile production
eas build --platform android --profile production
```

## app.json Changes Required

```json
{
  "expo": {
    "plugins": [
      "expo-live-activity"
      // ... all existing plugins unchanged
    ],
    "android": {
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_MEDIA_IMAGES"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSSupportsLiveActivities": true
      }
    }
  }
}
```

**Note:** `NSSupportsLiveActivities` may be handled automatically by the `expo-live-activity` config plugin. Verify during implementation and remove manual entry if redundant.

## Backend Dependencies (Cloud Functions)

No new npm packages needed in `functions/`. Existing packages cover all server-side needs:

| Existing Package            | v1.1 Role                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `firebase-admin` ^12.0.0    | Store Live Activity push tokens, write screenshot events to Firestore                  |
| `firebase-functions` ^4.5.0 | `onDocumentWritten` trigger for screenshot notifications, scheduled pinned snap expiry |
| `expo-server-sdk` ^5.0.0    | Push notifications for screenshot alerts ("X took a screenshot of your snap")          |

**New Cloud Function needed:** `onSnapScreenshot` -- triggered when client writes a screenshot event document. Sends push notification to snap sender with randomized message template (consistent with existing notification style).

**Live Activity push updates:** APNs push notifications to update/end Live Activities. Requires storing the activity push token (returned by `startActivity()`) in Firestore. The `firebase-admin` SDK can send APNs pushes directly, but the simpler approach is to use `expo-server-sdk` for the push and let the Live Activity end when the user taps into the app.

## Version Compatibility Matrix

| Package                                                | Version  | Expo SDK 54 | RN 0.81.5 | Native Build Required | Notes                                                                                       |
| ------------------------------------------------------ | -------- | ----------- | --------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `expo-screen-capture`                                  | ~8.0.x   | YES         | YES       | YES                   | Official Expo package, auto-versioned by `npx expo install`                                 |
| `expo-live-activity`                                   | 0.4.x    | LIKELY      | LIKELY    | YES                   | Software Mansion Labs; early development. Uses Expo Module API which is SDK-version-stable. |
| `expo-notifications` (existing)                        | ~0.32.16 | YES         | YES       | Already built         | Used for Android ongoing notification (no new install)                                      |
| `@react-native-async-storage/async-storage` (existing) | 2.2.0    | YES         | YES       | Already built         | Used for darkroom cache (no new install)                                                    |

## Confidence Assessment

| Recommendation                                        | Confidence | Basis                                                                                                                                     |
| ----------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-screen-capture` for screenshot detection        | HIGH       | Official Expo SDK package, documented for SDK 54, API verified in official docs                                                           |
| `expo-live-activity` for iOS Live Activities          | MEDIUM     | Library works and is from Software Mansion, but "early development" status means breaking changes possible. Fallback (Voltra) documented. |
| `expo-notifications` ongoing notification for Android | HIGH       | Uses existing package; `sticky` and custom channels are documented Expo features                                                          |
| AsyncStorage darkroom cache optimization              | HIGH       | Standard caching pattern; uses existing dependency; no risk                                                                               |
| Skip Notifee / Voltra                                 | HIGH       | Justified: Notifee duplicates existing notification stack; Voltra is overkill for simple pinned snap UI                                   |
| `expo-live-activity` SDK 54 compatibility             | MEDIUM     | Not explicitly documented but uses Expo Module API which is SDK-stable. Verify with `npx expo prebuild` during implementation.            |

## Sources

- [Expo ScreenCapture Documentation (SDK 54)](https://docs.expo.dev/versions/v54.0.0/sdk/screen-capture/) -- HIGH confidence, official docs
- [expo-live-activity GitHub (Software Mansion Labs)](https://github.com/software-mansion-labs/expo-live-activity) -- MEDIUM confidence, early development
- [Voltra GitHub (Callstack)](https://github.com/callstackincubator/voltra) -- HIGH confidence for evaluation, rejected for use
- [Voltra Blog Post (Callstack)](https://www.callstack.com/blog/live-activities-and-widgets-with-react-say-hello-to-voltra) -- HIGH confidence comparison
- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/) -- HIGH confidence, official docs
- [expo-live-activity Tutorial (kutay.boo)](https://kutay.boo/blog/expo-live-activity/) -- MEDIUM confidence, third-party tutorial
- [Live Activities Implementation Guide (fizl.io)](https://fizl.io/blog/posts/live-activities) -- MEDIUM confidence, third-party tutorial
- [Notifee Foreground Service Documentation](https://notifee.app/react-native/docs/android/foreground-service/) -- HIGH confidence, evaluated and rejected
- [expo-screen-capture Android 14+ Bug (GitHub #31678)](https://github.com/expo/expo/issues/31678) -- HIGH confidence, fix confirmed merged

---

_Stack research for: Flick v1.1 Pinned Snaps & Polish_
_Researched: 2026-02-25_
