# Phase 9: Pinned Snaps iOS - Research

**Researched:** 2026-02-25
**Domain:** iOS Live Activities (ActivityKit), Expo native modules, App Groups, SwiftUI widgets
**Confidence:** MEDIUM

## Summary

Phase 9 adds a "pin to screen" toggle when sending snaps. When enabled, the recipient sees a Live Activity on their iOS lock screen showing a photo thumbnail, sender name, and optional caption. Tapping opens the conversation. The Live Activity dismisses on snap view or auto-expires after 48 hours.

The core challenge is that iOS Live Activities have a strict 4KB data limit for ActivityKit payloads, which precludes embedding images directly. The standard workaround is App Groups: the main app writes a compressed thumbnail to a shared file container, and the SwiftUI widget extension reads it. This requires native Swift code for the widget UI (ActivityKit mandates SwiftUI), a custom Expo native module to bridge JS to ActivityKit, and Expo config plugin changes to add the widget extension target.

The user's branded pixel-art layout requirement (custom fonts, dark background, CRT accents) rules out `expo-live-activity`'s fixed template UI. The recommended approach is a **custom Expo native module** paired with **@bacons/apple-targets** (or Voltra as fallback) for the widget extension, giving full SwiftUI control over the Live Activity appearance.

**Primary recommendation:** Build a custom Expo native module (`live-activity-manager`) with a SwiftUI widget extension using `@bacons/apple-targets` for the widget target. Use App Groups to share thumbnail images between the main app and the widget extension. This is an iOS-only feature; Android pinned snaps are Phase 10 (separate approach).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Pin toggle placement:** Appears on the send confirmation screen (SnapPreviewScreen), after capturing but before sending. Pixel-art pin icon with toggle switch.
- **Default state:** Off, but sticky per friend (remembers last choice per conversation).
- **First-time tooltip:** Brief one-time tooltip explaining "Pin this snap to their lock screen" -- then never shown again.
- **Live Activity layout:** Small square photo thumbnail left-aligned, sender name and caption text to the right (notification-row style). Pixel-art branded styling with app's pixel font, dark background, CRT-style accents.
- **Compact view only:** No expanded state on long-press. Tapping opens the app.
- **Multiple active pins:** Each pinned snap = separate Live Activity. Global cap of 5 per recipient. Oldest dismissed for new. Silent fallback when cap reached. Pin toggle only in 1-on-1 conversations.
- **Caption behavior:** Reuses snap's message text. Truncated ~40 chars with ellipsis. Hidden if no text. Emoji-only displays normally.

### Claude's Discretion
- SwiftUI layout specifics for the Live Activity widget
- App Groups configuration for sharing thumbnail between main app and widget extension
- Push notification payload structure for triggering Live Activity updates
- How to track/persist the per-friend sticky toggle preference
- Exact tooltip implementation and dismissal logic

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PINI-01 | Sender can toggle "pin to screen" when sending a snap | SnapPreviewScreen already has the send UI; add toggle with AsyncStorage sticky preference per friend |
| PINI-02 | Recipient sees Live Activity on lock screen with photo thumbnail, sender name, optional caption | Custom SwiftUI widget extension with App Groups for image sharing; ActivityKit Live Activity |
| PINI-03 | Tapping Live Activity opens conversation (same deeplink as push notification) | ActivityKit `deepLinkUrl` config; existing `navigateToNotification` pattern in App.js handles conversation routing |
| PINI-04 | Live Activity disappears after recipient views the snap | Cloud Function `onSnapViewed` trigger; update/end Live Activity via push token or app-side `Activity.end()` |
| PINI-05 | Live Activity auto-expires after 48 hours if never viewed | ActivityKit `staleDate` + `dismissalPolicy: .after()` set at creation time; aligns with existing snap `expiresAt` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@bacons/apple-targets` | latest | Expo config plugin to add widget extension target | Standard way to add Apple targets (widgets, Live Activities) in Expo managed workflow. Generates native targets outside /ios |
| Custom Expo Module (local) | -- | Bridge JS to ActivityKit (start/end/update) | Required because ActivityKit is Swift-only; no JS equivalent. `npx create-expo-module@latest --local` |
| SwiftUI + ActivityKit | iOS 16.2+ | Native Live Activity widget UI | Apple's required framework for Live Activity rendering |
| AsyncStorage | 2.2.0 (installed) | Per-friend sticky toggle preference | Already used in project for persistent local storage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-image-manipulator` | ~14.0.8 (installed) | Compress thumbnail for App Groups | Already used in snapService for snap compression |
| `expo-file-system` | ~19.0.21 (installed) | Write thumbnail to App Groups shared container | Already installed; needed to write files to shared directory |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @bacons/apple-targets + custom module | expo-live-activity (Software Mansion) | Fixed template UI -- cannot achieve branded pixel-art layout. Only supports title/subtitle/progress bar pattern. |
| @bacons/apple-targets + custom module | Voltra (Callstack) | Write Live Activity in JSX instead of SwiftUI. More ergonomic but less mature (v1.2.0). Limited style subset. Unclear App Groups image support. MEDIUM confidence as fallback if custom module approach proves too complex. |
| @bacons/apple-targets + custom module | react-native-widget-extension (bndkt) | Similar approach to custom module but with helper APIs. Less documented for Expo managed workflow than @bacons/apple-targets. |
| @bacons/apple-targets + custom module | expo-widgets (Expo SDK 55) | Alpha-only, requires SDK 55 (project is on SDK 54). Not viable. |

**Installation:**
```bash
npm install @bacons/apple-targets
npx create-expo-module@latest --local --name live-activity-manager
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── firebase/
│   │   ├── snapService.js        # Modified: add pinned flag to snap message
│   │   └── messageService.js     # Unchanged
│   └── liveActivityService.js    # NEW: JS bridge to native module (Platform.OS guard)
├── screens/
│   └── SnapPreviewScreen.js      # Modified: add pin toggle UI
├── hooks/
│   └── usePinPreference.js       # NEW: AsyncStorage per-friend sticky toggle
├── components/
│   └── PinToggle.js              # NEW: pixel-art pin icon + toggle switch
│   └── PinTooltip.js             # NEW: one-time tooltip overlay
modules/
└── live-activity-manager/        # NEW: local Expo module (created by create-expo-module)
    ├── index.ts                  # TS exports: startActivity, endActivity, endAllActivities
    ├── src/
    │   └── LiveActivityManagerModule.swift  # Swift bridge to ActivityKit
    └── expo-module.config.json
targets/
└── FlickLiveActivity/            # NEW: widget extension target (via @bacons/apple-targets)
    ├── index.swift               # Widget entry point
    ├── FlickLiveActivityWidget.swift  # SwiftUI Live Activity layout
    ├── PinnedSnapAttributes.swift     # ActivityAttributes shared definition
    ├── expo-target.config.js     # Target config (type: widget, frameworks: SwiftUI, ActivityKit)
    ├── Info.plist                # NSSupportsLiveActivities: true
    └── Assets.xcassets/          # Pixel-art assets for the Live Activity (under 4KB each)
functions/
└── index.js                      # Modified: onSnapViewed triggers Live Activity end via push
```

### Pattern 1: App Groups Image Sharing
**What:** Main app compresses snap thumbnail and writes it to App Groups shared container. Widget extension reads from same path.
**When to use:** Any time a Live Activity needs to display an image (4KB ActivityKit data limit prevents inline images).
**Example:**
```javascript
// Main app side (liveActivityService.js)
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const APP_GROUP_ID = 'group.com.spoodsjs.flick';

export const saveThumbnailForLiveActivity = async (photoUri, activityId) => {
  // Compress to tiny thumbnail (~100x100, quality 0.5)
  const result = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 100 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Write to App Groups shared container
  // Path accessed by widget: FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)
  const sharedDir = `${FileSystem.documentDirectory}../../shared/AppGroup/${APP_GROUP_ID}/`;
  const thumbPath = `${sharedDir}${activityId}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: thumbPath });

  return activityId; // Widget uses this to locate the file
};
```

```swift
// Widget side (FlickLiveActivityWidget.swift)
let containerURL = FileManager.default.containerURL(
    forSecurityApplicationGroupIdentifier: "group.com.spoodsjs.flick"
)
let imageURL = containerURL?.appendingPathComponent("\(context.attributes.activityId).jpg")
if let imageURL, let data = try? Data(contentsOf: imageURL),
   let uiImage = UIImage(data: data) {
    Image(uiImage: uiImage)
        .resizable()
        .aspectRatio(contentMode: .fill)
        .frame(width: 48, height: 48)
        .clipShape(RoundedRectangle(cornerRadius: 4))
}
```

### Pattern 2: Custom Expo Native Module for ActivityKit
**What:** Local Expo module that exposes `startPinnedSnapActivity()`, `endPinnedSnapActivity()`, `endAllActivities()` to JS.
**When to use:** Required to bridge React Native to iOS ActivityKit.
**Example:**
```swift
// LiveActivityManagerModule.swift
import ExpoModulesCore
import ActivityKit

public class LiveActivityManagerModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LiveActivityManager")

        AsyncFunction("startActivity") { (activityId: String, senderName: String, caption: String?, deepLinkUrl: String) -> String? in
            guard #available(iOS 16.2, *) else { return nil }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }

            let attributes = PinnedSnapAttributes(
                activityId: activityId,
                senderName: senderName,
                caption: caption,
                deepLinkUrl: deepLinkUrl
            )
            let state = PinnedSnapAttributes.ContentState()
            let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(48 * 60 * 60))

            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
            return activity.id
        }

        AsyncFunction("endActivity") { (activityId: String) in
            guard #available(iOS 16.2, *) else { return }
            for activity in Activity<PinnedSnapAttributes>.activities {
                if activity.attributes.activityId == activityId {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }

        AsyncFunction("getActiveCount") { () -> Int in
            guard #available(iOS 16.2, *) else { return 0 }
            return Activity<PinnedSnapAttributes>.activities.count
        }
    }
}
```

### Pattern 3: Snap Message Document Extension
**What:** Add `pinned: true` field to snap message document. Cloud Function reads this to determine whether to trigger Live Activity end on view.
**When to use:** When sending a pinned snap.
**Example:**
```javascript
// snapService.js modification
const messageData = {
  senderId,
  type: 'snap',
  snapStoragePath,
  caption: truncatedCaption,
  viewedAt: null,
  expiresAt,
  pinned: pinToScreen || false,      // NEW: pin flag
  pinnedActivityId: activityId,       // NEW: for Live Activity tracking
  createdAt: serverTimestamp(),
};
```

### Pattern 4: Per-Friend Sticky Preference
**What:** AsyncStorage key `pin_pref_{friendId}` stores boolean. Read on mount, write on toggle.
**When to use:** SnapPreviewScreen pin toggle default state.
**Example:**
```javascript
// usePinPreference.js
const PIN_KEY_PREFIX = 'pin_pref_';

export const usePinPreference = (friendId) => {
  const [pinEnabled, setPinEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`${PIN_KEY_PREFIX}${friendId}`).then(val => {
      setPinEnabled(val === 'true');
      setLoaded(true);
    });
  }, [friendId]);

  const togglePin = useCallback(async (value) => {
    setPinEnabled(value);
    await AsyncStorage.setItem(`${PIN_KEY_PREFIX}${friendId}`, value.toString());
  }, [friendId]);

  return { pinEnabled, togglePin, loaded };
};
```

### Anti-Patterns to Avoid
- **Embedding image data in ActivityKit payload:** The 4KB limit makes this impossible for photos. Always use App Groups file sharing.
- **Using expo-live-activity for custom layouts:** Its fixed template (title/subtitle/progress bar) cannot achieve branded pixel-art styling. Use a custom SwiftUI widget instead.
- **Updating Live Activities from JS without Platform guards:** Live Activities are iOS-only. Every call to the native module must be wrapped in `Platform.OS === 'ios'` checks or the app will crash on Android.
- **Storing pin preference in Firestore:** This is a local UI preference (sender-side only). AsyncStorage is sufficient and avoids unnecessary Firestore reads.
- **Trying to load remote images from the widget:** Live Activity widgets cannot make network requests. Images must be pre-loaded to the shared App Groups container.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Widget extension target generation | Manual Xcode target configuration | `@bacons/apple-targets` Expo plugin | Handles Podfile modifications, signing, target linking automatically during `expo prebuild` |
| Image compression for thumbnail | Custom resize logic | `expo-image-manipulator` (already installed) | Battle-tested, handles EXIF orientation, already used in snapService |
| Deep link URL scheme | Custom URL parsing | Existing `linking` config in AppNavigator + `navigateToNotification` in App.js | Conversation deep linking already works for push notifications |
| Expo native module boilerplate | Manual Swift/Xcode module setup | `npx create-expo-module@latest --local` | Generates correct module structure, config, and build integration |

**Key insight:** The heaviest lift is the SwiftUI widget code and App Groups plumbing. Everything else (toggle UI, preference storage, deep linking, snap message modification) leverages existing patterns in the codebase.

## Common Pitfalls

### Pitfall 1: ActivityAttributes Must Be Identical in Both Targets
**What goes wrong:** The Swift `ActivityAttributes` struct must be defined identically in both the widget extension target AND the native module. If they differ by even one field, ActivityKit silently fails to match activities.
**Why it happens:** Apple uses the struct type identity to match activities. There's no easy way to share Swift files between an Expo module and a widget target.
**How to avoid:** Define `PinnedSnapAttributes.swift` once and copy it to both `targets/FlickLiveActivity/` and `modules/live-activity-manager/src/`. Add a comment in both files referencing the other copy.
**Warning signs:** `Activity.request()` succeeds but no Live Activity appears on the lock screen.

### Pitfall 2: App Groups Container Path Differences
**What goes wrong:** React Native's `FileSystem.documentDirectory` and iOS's `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` point to different locations. Writing a file from RN doesn't automatically make it visible to the widget.
**Why it happens:** The App Groups shared container is a separate sandboxed directory from the app's documents directory.
**How to avoid:** The native module must handle file writing to the App Groups container, OR use `expo-file-system` with the correct container path. The safest approach is to have the native module accept raw image data (base64) and write to the container itself.
**Warning signs:** Widget shows placeholder/empty image despite file appearing to save successfully from JS.

### Pitfall 3: Live Activity 8-Hour Auto-Expiry
**What goes wrong:** iOS automatically expires Live Activities after 8 hours, but the requirement is 48 hours.
**Why it happens:** ActivityKit enforces an 8-hour maximum active duration. After that, the activity enters a "stale" state and remains on the lock screen for up to 4 more hours (12 hours total) before system removal.
**How to avoid:** Set `staleDate` to 48 hours in the future. When stale, the widget can show a custom "expired" state. However, iOS may still remove it after 12 hours regardless. To achieve true 48-hour persistence, use ActivityKit push notifications to periodically "wake" the activity with content updates (even if the content hasn't changed). This resets the staleness timer.
**Warning signs:** Live Activity disappears from lock screen after ~8-12 hours instead of 48.

### Pitfall 4: EAS Build Signing for Widget Extension
**What goes wrong:** The widget extension needs its own provisioning profile and bundle identifier (e.g., `com.spoodsjs.flick.FlickLiveActivity`). EAS may not automatically provision this.
**Why it happens:** Apple requires separate signing for each target in an app. Widget extensions are separate targets.
**How to avoid:** Configure `@bacons/apple-targets` with the correct bundle identifier pattern. May need to manually create a provisioning profile in the Apple Developer portal for the extension target, or configure EAS credentials to handle it.
**Warning signs:** EAS build fails with signing errors referencing the widget extension target.

### Pitfall 5: Cap Enforcement Race Condition
**What goes wrong:** Two senders pin snaps to the same recipient simultaneously, both check the count as 4, both proceed, resulting in 6 active Live Activities.
**Why it happens:** The Live Activity start happens on the sender's device (JS call to native module) but the cap is enforced on the recipient's device.
**How to avoid:** Cap enforcement happens entirely on the recipient device. When a new pinned snap notification arrives and the recipient's app processes it (foreground or background), it checks `Activity<PinnedSnapAttributes>.activities.count`. If >= 5, it ends the oldest before starting the new one. The sender never needs to know the count.
**Warning signs:** More than 5 Live Activities appearing on a recipient's lock screen.

### Pitfall 6: NSSupportsLiveActivities Missing
**What goes wrong:** Live Activities silently don't appear. `areActivitiesEnabled` returns false.
**Why it happens:** `NSSupportsLiveActivities` must be set to `true` in the app's `Info.plist`, AND the widget extension's `Info.plist`.
**How to avoid:** Add to `app.json` `ios.infoPlist`: `"NSSupportsLiveActivities": true`. Ensure `targets/FlickLiveActivity/Info.plist` also has it. The `@bacons/apple-targets` plugin should handle the widget side.
**Warning signs:** `ActivityAuthorizationInfo().areActivitiesEnabled` returns false on a device running iOS 16.2+.

## Code Examples

### Live Activity Service (JS Bridge)
```javascript
// src/services/liveActivityService.js
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

import logger from '../utils/logger';

// Lazy-load native module to avoid crash on Android
let LiveActivityManager = null;
if (Platform.OS === 'ios') {
  try {
    LiveActivityManager = require('../../modules/live-activity-manager').default;
  } catch (e) {
    logger.warn('liveActivityService: Native module not available', { error: e.message });
  }
}

export const startPinnedSnapActivity = async ({
  activityId,
  senderName,
  caption,
  conversationId,
  friendId,
  photoUri,
}) => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }

  try {
    // Compress thumbnail for App Groups
    const thumb = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 100 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Deep link URL matching existing conversation navigation pattern
    const deepLinkUrl = `lapse://messages/${conversationId}`;

    const nativeActivityId = await LiveActivityManager.startActivity(
      activityId,
      senderName,
      caption || null,
      deepLinkUrl,
      thumb.uri
    );

    logger.info('liveActivityService: Activity started', { activityId, nativeActivityId });
    return { success: true, nativeActivityId };
  } catch (error) {
    logger.error('liveActivityService: Failed to start activity', { error: error.message });
    return { success: false, error: error.message };
  }
};

export const endPinnedSnapActivity = async (activityId) => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) return;
  try {
    await LiveActivityManager.endActivity(activityId);
    logger.info('liveActivityService: Activity ended', { activityId });
  } catch (error) {
    logger.error('liveActivityService: Failed to end activity', { error: error.message });
  }
};
```

### SnapPreviewScreen Pin Toggle Integration
```javascript
// In SnapPreviewScreen.js - add to existing screen
import PinToggle from '../components/PinToggle';
import { usePinPreference } from '../hooks/usePinPreference';

// Inside component:
const { pinEnabled, togglePin, loaded } = usePinPreference(friendId);

// In JSX, between Polaroid frame and Send button:
{loaded && (
  <PinToggle
    enabled={pinEnabled}
    onToggle={togglePin}
    friendId={friendId}
  />
)}
```

### Recipient-Side Live Activity Trigger
```javascript
// In App.js notification handler or useConversation hook
// When receiving a snap notification with pinned: true
if (notifData.type === 'snap' && notifData.pinned && Platform.OS === 'ios') {
  const { startPinnedSnapActivity } = require('./src/services/liveActivityService');
  await startPinnedSnapActivity({
    activityId: notifData.messageId,
    senderName: notifData.senderName,
    caption: notifData.caption || null,
    conversationId: notifData.conversationId,
    friendId: notifData.senderId,
    photoUri: notifData.thumbnailUri, // Pre-signed short-lived URL or App Groups path
  });
}
```

### Recipient-Side Live Activity Dismissal on Snap View
```javascript
// In SnapViewer.js or useConversation.js
// After markSnapViewed succeeds:
if (snapMessage.pinned && Platform.OS === 'ios') {
  const { endPinnedSnapActivity } = require('./src/services/liveActivityService');
  await endPinnedSnapActivity(snapMessage.id);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No Live Activity support in Expo | @bacons/apple-targets + custom module | 2024 | Enables widget extensions in Expo managed workflow |
| expo-live-activity fixed template | Voltra (JSX-to-SwiftUI) or custom SwiftUI | 2025-2026 | Custom branded layouts now feasible without ejecting |
| Push-to-start (server-triggered) | App-side Activity.request() with push updates | iOS 17.2+ for push-to-start | Simpler to start locally; push-to-start deferred to v2 (PINI-06) |
| expo-widgets (SDK 55 alpha) | @bacons/apple-targets (SDK 54 compatible) | 2025 | expo-widgets not available on SDK 54; apple-targets is the stable option |

**Deprecated/outdated:**
- `expo-live-activity` for custom layouts: Its fixed template cannot achieve branded designs. Use for simple use cases only.
- `expo-widgets` on SDK 54: Requires SDK 55, which the project isn't on yet. Revisit after SDK upgrade.

## Open Questions

1. **App Groups file path from React Native**
   - What we know: iOS widget extensions access shared containers via `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`. React Native's `expo-file-system` may not directly expose this path.
   - What's unclear: Whether `expo-file-system` can write to App Groups container directly, or if the native module must handle all file I/O to the shared container.
   - Recommendation: Have the native module accept a local file URI and internally copy it to the App Groups container. This is the safest approach and avoids cross-platform path issues. LOW confidence that `expo-file-system` paths align with App Groups paths.

2. **48-Hour Live Activity Persistence**
   - What we know: iOS enforces an 8-hour active duration, then 4 hours stale (12 hours total). ActivityKit push notifications can refresh activities.
   - What's unclear: Whether periodic push updates truly reset the staleness timer for the full 48 hours, or if iOS enforces a hard maximum regardless.
   - Recommendation: Set staleDate to 48h at creation. If testing shows iOS removes it after 12h, implement a Cloud Function that sends periodic ActivityKit push updates to keep it alive. MEDIUM confidence.

3. **EAS Build Widget Extension Signing**
   - What we know: @bacons/apple-targets handles most Xcode configuration. EAS builds sign the main app automatically.
   - What's unclear: Whether EAS automatically provisions the widget extension's separate bundle identifier, or if manual Apple Developer portal configuration is needed.
   - Recommendation: Test with a dev build first. Be prepared to manually create a provisioning profile for `com.spoodsjs.flick.FlickLiveActivity` if EAS doesn't auto-provision it. MEDIUM confidence.

4. **Thumbnail Delivery to Recipient**
   - What we know: The sender compresses a thumbnail and writes it to their local App Groups container for the Live Activity. But the *recipient* needs the thumbnail on *their* device.
   - What's unclear: The thumbnail must travel from sender to recipient. Options: (a) Include a tiny base64 thumbnail in the push notification payload (limited to ~4KB total), (b) Upload thumbnail to Firebase Storage alongside the snap and include a short-lived signed URL in the notification, (c) Have the recipient download it upon notification receipt.
   - Recommendation: Upload a very small thumbnail (~5-10KB JPEG, 100x100) to Firebase Storage at `snap-thumbnails/{messageId}.jpg` during snap send. Include the download URL in the push notification data. Recipient's notification handler downloads and saves to App Groups before starting the Live Activity. This is the most reliable approach. HIGH confidence this pattern works.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="pinned\|liveActivity\|snapService\|usePinPreference" --no-coverage` |
| Full suite command | `npm test` |
| Estimated runtime | ~5 seconds (targeted), ~30 seconds (full) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PINI-01 | Pin toggle appears, sticky preference per friend | unit | `npx jest __tests__/hooks/usePinPreference.test.js -x` | No -- Wave 0 gap |
| PINI-02 | Live Activity started with correct params (sender name, caption, thumbnail) | unit | `npx jest __tests__/services/liveActivityService.test.js -x` | No -- Wave 0 gap |
| PINI-03 | Deep link URL matches conversation routing pattern | unit | `npx jest __tests__/services/liveActivityService.test.js -x` | No -- Wave 0 gap |
| PINI-04 | Live Activity ended when snap is viewed | unit | `npx jest __tests__/services/snapService.test.js -x` (extend existing) | Yes (snapService) |
| PINI-05 | Snap message includes pinned flag and activityId | unit | `npx jest __tests__/services/snapService.test.js -x` (extend existing) | Yes (snapService) |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run quick targeted tests
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work`
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `__tests__/hooks/usePinPreference.test.js` -- covers PINI-01 (sticky per-friend toggle)
- [ ] `__tests__/services/liveActivityService.test.js` -- covers PINI-02, PINI-03 (activity start/end, deep link URL)
- [ ] Extend `__tests__/services/snapService.test.js` -- covers PINI-04, PINI-05 (pinned flag in message data, end on view)

**Note:** Native Swift code (ActivityKit, SwiftUI widget) cannot be tested with Jest. Those must be verified manually on a physical iOS device (iOS 16.2+). Jest tests cover the JS service layer, preference storage, and message document structure only.

## Sources

### Primary (HIGH confidence)
- [Apple ActivityKit Documentation](https://developer.apple.com/documentation/activitykit) - Official API reference for Live Activities
- [Apple Activity.end() Documentation](https://developer.apple.com/documentation/activitykit/activity/end(using:dismissalpolicy:)) - Dismissal policies
- [Apple staleDate Documentation](https://developer.apple.com/documentation/activitykit/activitycontent/staledate) - Auto-expiry configuration
- Codebase analysis: `src/services/firebase/snapService.js`, `src/screens/SnapPreviewScreen.js`, `src/services/firebase/notificationService.js`, `App.js`

### Secondary (MEDIUM confidence)
- [expo-live-activity GitHub (Software Mansion Labs)](https://github.com/software-mansion-labs/expo-live-activity) - Fixed template API, version 0.4.2+
- [Voltra GitHub (Callstack)](https://github.com/callstackincubator/voltra) - JSX-to-SwiftUI Live Activity alternative, v1.2.0
- [react-native-widget-extension GitHub](https://github.com/bndkt/react-native-widget-extension) - Widget extension with Live Activity helper APIs
- [Kutay: iOS Live Activities with Expo & React Native](https://kutay.boo/blog/expo-live-activity/) - Dec 2025, full tutorial with both approaches
- [Christopher Engineering: Live Activity with React Native](https://christopher.engineering/en/blog/live-activity-with-react-native/) - Custom module + @bacons/apple-targets approach
- [Apple Developer Forums: Images in Live Activities](https://developer.apple.com/forums/thread/716902) - App Groups image workaround confirmed by Apple

### Tertiary (LOW confidence)
- [Inkitt Tech: Images in Live Activities (RN)](https://medium.com/inkitt-tech/how-to-use-images-inside-ios-live-activities-in-a-react-native-app-ead8f28a71b9) - Jan 2026, detailed image sharing guide (paywall prevented full verification)
- expo-widgets SDK 55 alpha - Not applicable to SDK 54 but tracked for future

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - @bacons/apple-targets is documented and used in production Expo apps, but the combined setup (custom module + widget target + App Groups + image sharing) has many moving parts. No single authoritative guide covers the exact combination needed.
- Architecture: MEDIUM - The patterns (native module bridge, App Groups file sharing, ActivityKit API) are well-documented individually. The integration of all pieces in an Expo SDK 54 managed workflow is less documented.
- Pitfalls: HIGH - ActivityKit limitations (8h expiry, 4KB limit, signing requirements) are well-documented by Apple and confirmed by community sources.

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days - Live Activities ecosystem is still evolving but core ActivityKit APIs are stable)
