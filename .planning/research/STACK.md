# Technology Stack: Messaging Upgrade

**Project:** Flick -- Messaging Upgrade (ephemeral snaps, streaks, reactions, read receipts, replies, screenshot detection, photo tag integration)
**Researched:** 2026-02-23

## Existing Stack (Already Installed -- No Changes Needed)

These are already in the project and fully sufficient for the messaging upgrade. No version bumps or replacements needed.

| Technology                                  | Version  | Role in Messaging Upgrade                                                                                              |
| ------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@react-native-firebase/firestore`          | ^23.8.6  | All message data: snap messages, reactions, read receipts, streaks, replies. Real-time subscriptions via `onSnapshot`. |
| `@react-native-firebase/storage`            | ^23.8.6  | Snap photo upload/download/deletion. Same patterns as existing `storageService.js` and `uploadQueueService.js`.        |
| `@react-native-firebase/functions`          | ^23.8.6  | Client-side callable functions for snap cleanup triggers, streak calculations, notification delivery.                  |
| `expo-camera`                               | ~17.0.10 | Snap photo capture. Reuse existing camera infrastructure from `useCamera()` hook.                                      |
| `expo-image`                                | ~3.0.11  | Snap photo rendering. Use `cachePolicy="none"` for ephemeral snaps (NOT the default `memory-disk`).                    |
| `expo-notifications`                        | ~0.32.16 | Push notifications for snap received, streak warnings, screenshot alerts. Existing patterns in Cloud Functions.        |
| `react-native-reanimated`                   | ~4.1.1   | Reaction picker animations, snap viewer transitions, swipe-to-reply gesture, message deletion animations.              |
| `react-native-gesture-handler`              | ~2.28.0  | Long-press for reaction picker, swipe-to-reply on message bubbles, double-tap reactions.                               |
| `rn-emoji-keyboard`                         | ^1.7.0   | Full emoji picker for reactions (already used in PhotoDetailModal for photo reactions). Reuse for message reactions.   |
| `expo-haptics`                              | ~15.0.8  | Haptic feedback on reaction selection, snap capture, streak milestone celebrations.                                    |
| `date-fns`                                  | ^4.1.0   | Streak day calculations, read receipt timestamps, snap expiry formatting.                                              |
| `@react-native-async-storage/async-storage` | 2.2.0    | Cache streak data locally, optimistic UI state for reactions, draft reply persistence.                                 |
| `expo-file-system`                          | ~19.0.21 | Temporary snap photo file management before upload.                                                                    |

**Key insight:** The existing stack covers ~90% of what the messaging upgrade needs. The project already has camera capture, image rendering, real-time Firestore subscriptions, push notifications, emoji picking, gesture handling, and animations. The upgrade is primarily a feature/architecture effort, not a technology acquisition effort.

## New Dependencies Required

### 1. expo-screen-capture (Screenshot Detection + Prevention)

| Field                     | Value                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Package**               | `expo-screen-capture`                                                                                                 |
| **Install Version**       | `~16.0.3` (use `npx expo install expo-screen-capture` to get SDK 54-compatible version)                               |
| **Purpose**               | Detect screenshots while viewing snaps; optionally prevent screen capture/recording during snap viewing               |
| **Confidence**            | HIGH -- Official Expo package, documented for SDK 54, included in Expo Go                                             |
| **Requires Native Build** | YES -- This is a native module. Requires a new EAS build for both iOS and Android. Cannot be delivered as OTA update. |

**Why this specific library:**

- Official Expo package -- guaranteed SDK 54 compatibility, maintained by Expo team, no risk of abandonment
- Provides both detection (`addScreenshotListener`) AND prevention (`preventScreenCaptureAsync` / `usePreventScreenCapture`)
- The snap viewer needs both: prevent screen recording while viewing, AND detect+notify on screenshot
- Works in Expo Go for development testing

**API surface used:**

```javascript
import * as ScreenCapture from 'expo-screen-capture';

// In SnapViewer component:
// 1. Prevent screen capture while viewing
ScreenCapture.usePreventScreenCapture('snap-viewer');

// 2. Detect screenshots and notify sender
const subscription = ScreenCapture.addScreenshotListener(() => {
  // Send system message: "[User] took a screenshot"
  snapService.reportScreenshot(conversationId, messageId, currentUserId);
});

// 3. Re-allow capture on unmount (hook handles this automatically)
```

**Platform considerations:**

- **iOS:** Works out of the box. No additional permissions needed. Screenshot detection is reliable.
- **Android 14+:** Fixed in PR #31702 (merged). Verify the fix is included in the Expo SDK 54 version. If not, workaround: call `ScreenCapture.allowScreenCaptureAsync()` before registering the listener.
- **Android 13 and below:** Requires `READ_MEDIA_IMAGES` permission in AndroidManifest.xml. Add via `app.json` plugins or `expo-build-properties`.
- **Prevention caveat:** `preventScreenCaptureAsync` uses Android's `FLAG_SECURE` which blocks standard screenshots but can be bypassed by ADB, screen mirroring, and external cameras. Frame this as "screenshot notification" not "screenshot protection."

**Source:** [Expo ScreenCapture Documentation](https://docs.expo.dev/versions/latest/sdk/screen-capture/) (HIGH confidence), [Android 14+ fix - GitHub Issue #31678](https://github.com/expo/expo/issues/31678) (HIGH confidence)

---

### That Is the Only New Dependency

No other new npm packages are needed. Everything else is built with what already exists.

## What NOT to Install (and Why)

| Library                                 | Why You Might Consider It                                       | Why NOT to Use It                                                                                                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-native-reactions` (Simform)      | Animated reaction picker component                              | **Incompatible.** Pins `react-native-reanimated@3.8.1` and `react-native-gesture-handler@2.16.2` as peer deps. Project uses reanimated ~4.1.1 and gesture-handler ~2.28.0. Would cause version conflicts. Only 172 GitHub stars, v1.0.0 with no updates.              |
| `react-native-capture-protection`       | More aggressive screenshot prevention (blocks app switcher too) | **Overkill and risky.** Requires custom dev client (no Expo Go). The Expo SDK package `expo-screen-capture` does everything needed. Adding a third-party native module for marginal benefit increases build complexity.                                               |
| `react-native-gifted-chat`              | Full chat UI framework                                          | **Wrong approach.** The app already has a custom MessageBubble, conversation list, and input components. Gifted Chat would fight the existing architecture and pixel-art aesthetic. Extend existing components instead.                                               |
| `stream-chat-react-native` / `sendbird` | Full messaging SDK                                              | **Massive overkill.** These replace your entire messaging backend. Flick already has Firestore-based messaging that works. These SDKs add $50-500/mo costs, vendor lock-in, and would require rewriting the entire messaging system.                                  |
| `react-native-emoji-popup`              | Native emoji picker popup                                       | **Redundant.** `rn-emoji-keyboard` is already installed and used. For tapback reactions, you only need 6 fixed emojis (heart, thumbs up, laugh, surprised, sad, angry) -- a custom component with reanimated is simpler and more performant than a full emoji picker. |
| `expo-crypto` / `crypto-js`             | End-to-end encryption for snaps                                 | **Out of scope.** PROJECT.md explicitly states E2E encryption is not needed for MVP. Adds massive complexity (key exchange, key storage, key rotation) for negligible user value at this stage.                                                                       |
| `@react-native-firebase/messaging`      | Push notification handling                                      | **Not needed.** The app uses `expo-notifications` for push handling and stores FCM tokens manually. Adding the Firebase messaging module would create a duplicate notification system.                                                                                |
| `react-native-context-menu-view`        | Native context menu on long press                               | **Platform inconsistent.** iOS context menus look different from Android. For consistent UX with the pixel art aesthetic, build a custom reaction overlay with reanimated.                                                                                            |

## Backend Dependencies (Cloud Functions)

No new npm packages needed in `functions/`. The existing stack handles everything:

| Existing Package             | Role in Messaging Upgrade                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `firebase-admin` ^12.0.0     | Firestore writes (streak updates, snap cleanup, reaction notifications), Storage file deletion (snap photo cleanup) |
| `firebase-functions` ^4.5.0  | `onDocumentWritten` triggers for snap messages, scheduled streak expiry checks, snap cleanup scheduler              |
| `expo-server-sdk` ^5.0.0     | Push notifications for screenshot alerts, streak warnings, snap received                                            |
| `@google-cloud/tasks` ^6.2.1 | Delayed tasks for snap expiry cleanup (alternative to scheduled functions for per-message timing)                   |
| `zod` ^4.3.6                 | Validate callable function inputs for snap sends, reaction updates, message deletion requests                       |

## Infrastructure Configuration (No Code Changes, Console/CLI Only)

### Firestore TTL Policy

Configure a TTL policy on the `messages` collection group for automatic cleanup of expired snap documents:

```bash
# Via Firebase CLI or Google Cloud Console
# Collection group: messages
# TTL field: expiresAt (Timestamp type)
```

**Important:** Firestore TTL deletion takes up to 24 hours. Use it as a safety net, NOT the primary deletion mechanism. Primary snap deletion should happen via Cloud Function triggered on snap view.

**Source:** [Firestore TTL Documentation](https://firebase.google.com/docs/firestore/ttl) (HIGH confidence)

### Google Cloud Storage Object Lifecycle (Optional)

Configure lifecycle rules on the Firebase Storage bucket to auto-delete files in the `snap-photos/` path after 7 days:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": {
          "age": 7,
          "matchesPrefix": ["snap-photos/"]
        }
      }
    ]
  }
}
```

This catches any orphaned snap photos not cleaned up by the primary Cloud Function (e.g., if the function fails or the user never opens the snap).

**Source:** [Cloud Storage Object Lifecycle Management](https://cloud.google.com/storage/docs/lifecycle) (HIGH confidence)

### Android Permission Addition

Add `READ_MEDIA_IMAGES` permission for screenshot detection on Android 13 and below:

```json
// In app.json android.permissions array:
"android": {
  "permissions": [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_MEDIA_IMAGES"
  ]
}
```

**Note:** This requires a new native build (which is already required for `expo-screen-capture`).

## Custom Components to Build (Not Libraries)

These are components/utilities built from scratch using the existing stack. Listed here because they might seem like they need a library but do not.

### 1. Reaction Picker (Custom Component)

**Build with:** `react-native-reanimated` + `react-native-gesture-handler` (both already installed)

**Why custom over a library:**

- Only 6 fixed emoji reactions needed (like iMessage tapback: heart, thumbs up, thumbs down, haha, !!, ?)
- `react-native-reactions` is incompatible with current reanimated/gesture-handler versions
- The pixel art aesthetic requires custom styling that no library supports
- Reanimated spring animations + gesture handler `LongPressGestureHandler` is 50-80 lines of code

**Implementation sketch:**

```javascript
// ReactionPicker.js -- custom component, not a library
// Triggered by LongPressGestureHandler on MessageBubble
// Animated.View with spring entrance, scale on hover
// 6 emoji buttons in a horizontal row
// Reanimated shared value for position/scale
```

### 2. Swipe-to-Reply Gesture (Custom Interaction)

**Build with:** `react-native-gesture-handler` `PanGestureHandler` + `react-native-reanimated` (both already installed)

**Why custom:** The swipe-to-reply gesture on a message bubble is 30-40 lines of gesture handler code. No library needed. The app already implements more complex gestures (tinder-style card swiping in `useSwipeableCard`).

### 3. Streak Tracker (Service Module)

**Build with:** `date-fns` (already installed) + Firestore (already installed)

**Why custom:** Streak logic is app-specific business logic (3-day threshold, mutual snaps, grace periods, warnings). No library exists for this. It's a service module (`streakService.js`) with ~200 lines of date math and Firestore queries.

## Installation Commands

```bash
# The only new dependency:
npx expo install expo-screen-capture

# IMPORTANT: This adds a native module.
# After installing, you MUST create a new native build:
# eas build --platform ios --profile production
# eas build --platform android --profile production
```

## Version Compatibility Matrix

| Package                                   | Required Version                              | Expo SDK 54 | React Native 0.81.5 | Notes                                        |
| ----------------------------------------- | --------------------------------------------- | ----------- | ------------------- | -------------------------------------------- |
| `expo-screen-capture`                     | ~16.0.x (auto-resolved by `npx expo install`) | YES         | YES                 | Official Expo package, version auto-selected |
| `rn-emoji-keyboard` (existing)            | ^1.7.0                                        | YES         | YES                 | Already working in project                   |
| `react-native-reanimated` (existing)      | ~4.1.1                                        | YES         | YES                 | Already working in project                   |
| `react-native-gesture-handler` (existing) | ~2.28.0                                       | YES         | YES                 | Already working in project                   |

## Confidence Assessment

| Recommendation                                | Confidence | Basis                                                                                                     |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `expo-screen-capture` as only new dependency  | HIGH       | Official Expo docs confirm SDK 54 compatibility; `npx expo install` ensures correct version; API verified |
| DO NOT use `react-native-reactions`           | HIGH       | Verified peer deps pin reanimated@3.8.1 which conflicts with project's ~4.1.1                             |
| Custom reaction picker over library           | HIGH       | No compatible library exists for current reanimated version; custom implementation is small               |
| Firestore TTL for snap cleanup backup         | HIGH       | Official Firebase docs confirm feature availability; 24-hour deletion window verified                     |
| Cloud Storage lifecycle for orphan cleanup    | HIGH       | Official GCS docs confirm feature; used widely in production                                              |
| No new Cloud Functions dependencies           | HIGH       | Existing `firebase-admin` + `firebase-functions` + `expo-server-sdk` covers all server-side needs         |
| `expo-screen-capture` requires native rebuild | HIGH       | It contains native iOS/Android code; confirmed it's not a JS-only package                                 |
| Android 14+ screenshot detection fix status   | MEDIUM     | Fix merged (PR #31702), but exact SDK 54 inclusion not confirmed. Workaround documented.                  |

## Sources

- [Expo ScreenCapture Documentation (SDK 54)](https://docs.expo.dev/versions/latest/sdk/screen-capture/) -- HIGH confidence, official docs
- [expo-screen-capture Android 14+ Bug Fix - GitHub Issue #31678](https://github.com/expo/expo/issues/31678) -- HIGH confidence, fix merged
- [react-native-reactions package.json](https://github.com/SimformSolutionsPvtLtd/react-native-reactions/blob/main/package.json) -- HIGH confidence, verified incompatible peer deps
- [Firestore TTL Policies](https://firebase.google.com/docs/firestore/ttl) -- HIGH confidence, official Firebase docs
- [Cloud Storage Object Lifecycle Management](https://cloud.google.com/storage/docs/lifecycle) -- HIGH confidence, official GCS docs
- [Firebase Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions) -- HIGH confidence, official docs
- [rn-emoji-keyboard Documentation](https://docs.thewidlarzgroup.com/rn-emoji-keyboard/docs/documentation/about) -- MEDIUM confidence
- [react-native-capture-protection GitHub](https://github.com/wn-na/react-native-capture-protection) -- MEDIUM confidence, evaluated and rejected

---

_Stack research: 2026-02-23_
