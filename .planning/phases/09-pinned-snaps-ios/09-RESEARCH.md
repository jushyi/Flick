# Phase 9: Pinned Snaps iOS - Research

**Researched:** 2026-02-25 (original), 2026-03-05 (updated for NSE blocker)
**Domain:** iOS Live Activities (ActivityKit), Expo native modules, App Groups, SwiftUI widgets, NSE plist generation
**Confidence:** MEDIUM (original stack), HIGH (blocker diagnosis and fix)

## Summary

Phase 9 adds a "pin to screen" toggle when sending snaps. When enabled, the recipient sees a Live Activity on their iOS lock screen showing a photo thumbnail, sender name, and optional caption. Tapping opens the conversation. The Live Activity dismisses on snap view or auto-expires after 48 hours.

Plans 01-04 and 06 are complete. The implementation is blocked by `Activity.request()` failing in the Notification Service Extension (NSE) with "Target does not include NSSupportsLiveActivities plist key." Root cause analysis of `@bacons/apple-targets` v4.0.6 source code reveals the exact mechanism: the plugin unconditionally sets `GENERATE_INFOPLIST_FILE=YES` in all target build configurations (line 19 of `configuration-list.js`), and the `notification-service` type uses `createDefaultConfigurationList` which includes this setting. When `GENERATE_INFOPLIST_FILE=YES`, Xcode generates the final Info.plist by merging the source `INFOPLIST_FILE` with `INFOPLIST_KEY_*` build settings. The custom `NSSupportsLiveActivities` key in `targets/FlickNotificationService/Info.plist` IS included in the merge, BUT Xcode's plist generation only recognizes well-known `INFOPLIST_KEY_*` prefixes and certain keys from the source file. The `NSSupportsLiveActivities` key, being a newer key added for ActivityKit, may not be recognized by Xcode's merger for extension targets.

The existing `withNSELiveActivities.js` plugin attempted to fix this by setting `GENERATE_INFOPLIST_FILE=NO` and `INFOPLIST_KEY_NSSupportsLiveActivities=YES`, but this approach has a fatal flaw: it uses the `xcode` npm package (v3.0.1) to parse and rewrite the pbxproj file, while `@bacons/apple-targets` uses `@bacons/xcode` (v1.0.0-alpha.32). These are incompatible pbxproj serializers. The `xcode` npm package writes pbxproj in a format that `@bacons/xcode` cannot reliably round-trip, and vice versa. Additionally, setting `GENERATE_INFOPLIST_FILE=NO` may break other auto-generated plist entries that the NSE target needs.

**Primary recommendation:** Rewrite `withNSELiveActivities.js` to use `@bacons/apple-targets`' own `withXcodeProjectBeta` mod API instead of the incompatible `xcode` npm package. The fix should add `INFOPLIST_KEY_NSSupportsLiveActivities = YES` as a build setting while keeping `GENERATE_INFOPLIST_FILE=YES`. This is the most reliable fix because it uses the same xcode project parser/serializer that `@bacons/apple-targets` uses, ensuring build settings are preserved correctly through the build pipeline.

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
| PINI-01 | Sender can toggle "pin to screen" when sending a snap | COMPLETE: SnapPreviewScreen already has the send UI; toggle with AsyncStorage sticky preference per friend implemented |
| PINI-02 | Recipient sees Live Activity on lock screen with photo thumbnail, sender name, optional caption | BLOCKED: NSE code is written but Activity.request() fails due to plist key issue. Fix approach documented below. |
| PINI-03 | Tapping Live Activity opens conversation (same deeplink as push notification) | COMPLETE: ActivityKit deepLinkUrl config and existing navigateToNotification pattern wired |
| PINI-04 | Live Activity disappears after recipient views the snap | BLOCKED: Depends on Activity.request() working. Code for endActivity is written and ready. |
| PINI-05 | Live Activity auto-expires after 48 hours if never viewed | BLOCKED: staleDate set at creation time in NSE code, but Activity.request() fails. |
</phase_requirements>

## NSE Plist Fix

### Root Cause Analysis (HIGH confidence)

The failure chain has been traced through `@bacons/apple-targets` v4.0.6 source code:

1. **`configuration-list.js` line 19:** `createDefaultConfigurationList()` unconditionally sets `GENERATE_INFOPLIST_FILE: "YES"` for all target types including `notification-service`.

2. **`configuration-list.js` line 672-705:** The `getConfigurationListBuildSettingsForType()` switch falls through from `notification-service` to the default `createDefaultConfigurationList()` function.

3. **`with-widget.js` line 169:** During `withDangerousMod`, the plugin generates `Info.plist` from `getTargetInfoPlistForType('notification-service')` which returns only `NSExtension` keys -- NOT `NSSupportsLiveActivities`.

4. **`with-widget.js` lines 184-189:** The generated Info.plist is only written if the file does not already exist (`!fs.existsSync(filePath)`). Since `targets/FlickNotificationService/Info.plist` exists with `NSSupportsLiveActivities`, the existing file is preserved.

5. **At build time:** Xcode sees `GENERATE_INFOPLIST_FILE=YES` and `INFOPLIST_FILE=../targets/FlickNotificationService/Info.plist`. It merges the source file with `INFOPLIST_KEY_*` build settings. The `NSSupportsLiveActivities` key IS in the source file, and Xcode SHOULD include it in the generated plist.

6. **The actual failure:** The `withNSELiveActivities.js` plugin uses a different pbxproj parser (`xcode` v3.0.1) than `@bacons/apple-targets` uses (`@bacons/xcode` v1.0.0-alpha.32). When `withNSELiveActivities` rewrites the pbxproj, it corrupts/conflicts with the format `@bacons/apple-targets` wrote, potentially invalidating the build settings for the NSE target entirely.

### Fix Approach 1: Use @bacons/apple-targets API (RECOMMENDED)

**Confidence: HIGH**

Rewrite `plugins/withNSELiveActivities.js` to use `@bacons/apple-targets`' own `withXcodeProjectBeta` mod instead of the incompatible `xcode` npm package. This ensures build settings are modified using the same parser/serializer.

```javascript
// plugins/withNSELiveActivities.js (rewritten)
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

module.exports = function withNSELiveActivities(config) {
  return withXcodeProjectBeta(config, async (config) => {
    const project = config.modResults;
    const targets = project.rootObject.props.targets;

    for (const target of targets) {
      // Find the FlickNotificationService target
      if (target.getDisplayName() === 'FlickNotificationService' ||
          target.props.productName === 'FlickNotificationService') {
        // Add NSSupportsLiveActivities to ALL build configurations
        target.setBuildSetting(
          'INFOPLIST_KEY_NSSupportsLiveActivities',
          'YES'
        );
        break;
      }
    }

    return config;
  });
};
```

**Why this works:**
- Uses the same `@bacons/xcode` parser that `@bacons/apple-targets` uses internally
- Modifies the in-memory xcode project BEFORE it is serialized to disk (both modifications go through the same write path)
- Keeps `GENERATE_INFOPLIST_FILE=YES` (no breakage of other auto-generated plist entries)
- `INFOPLIST_KEY_NSSupportsLiveActivities=YES` tells Xcode to add `NSSupportsLiveActivities=true` to the generated plist
- The source `Info.plist` still contains the key as well (belt-and-suspenders)

**Critical detail on plugin ordering:** The plugin must be registered AFTER `@bacons/apple-targets` in `app.json` plugins array. Both use `withXcodeProjectBeta`, and mods of the same type execute in registration order. This is already the case in the current `app.json` (line 107-108).

### Fix Approach 2: Patch @bacons/apple-targets directly (FALLBACK)

**Confidence: MEDIUM**

If Approach 1 fails, modify the `notification-service` case in `@bacons/apple-targets` to include `NSSupportsLiveActivities`:

```javascript
// In target.js, getTargetInfoPlistForType(), notification-service case:
case "notification-service":
    return {
        NSSupportsLiveActivities: true,  // ADD THIS
        NSExtension: {
            NSExtensionAttributes: {
                NSExtensionActivationRule: "TRUEPREDICATE",
            },
            NSExtensionPrincipalClass: "$(PRODUCT_MODULE_NAME).NotificationService",
            NSExtensionPointIdentifier,
        },
    };
```

Apply via `patch-package`:
```bash
npx patch-package @bacons/apple-targets
```

**Why this is the fallback:** Patching node_modules is fragile and must be maintained across version updates. The project already uses `patch-package` (postinstall script), so the infrastructure exists.

### Fix Approach 3: Post-build plist injection (LAST RESORT)

**Confidence: LOW**

Add a custom EAS build hook that modifies the compiled Info.plist inside the build artifact after Xcode finishes:

```bash
# eas-build-post-install.sh
/usr/libexec/PlistBuddy -c "Add :NSSupportsLiveActivities bool true" \
  "build/FlickNotificationService.appex/Info.plist"
```

**Why this is last resort:** EAS build hooks are harder to debug, run in a different environment, and may not have access to the correct paths. The timing relative to code signing is also uncertain.

## Alternative Approaches

### Alternative 1: Bypass NSE Entirely with Push-to-Start (iOS 17.2+)

**Confidence: MEDIUM**

Instead of starting Live Activities from the NSE, use Apple's push-to-start mechanism (iOS 17.2+) to start them directly from the server via APNs.

**How it works:**
1. App registers for `pushToStartTokenUpdates` on launch and sends the token to the Cloud Function backend
2. When a pinned snap is sent, the Cloud Function sends an APNs push with `event: "start"`, `attributes-type: "PinnedSnapAttributes"`, and the activity data
3. iOS starts the Live Activity directly -- no NSE involvement needed

**APNs payload format:**
```json
{
  "aps": {
    "timestamp": 1709654400,
    "event": "start",
    "attributes-type": "PinnedSnapAttributes",
    "attributes": {
      "activityId": "snap_123",
      "senderName": "Alice",
      "caption": "Check this out!",
      "deepLinkUrl": "lapse://messages/conv_456"
    },
    "content-state": {},
    "alert": {
      "title": "Alice pinned a snap",
      "body": "Check this out!"
    }
  }
}
```

**Required headers:**
- `apns-push-type: liveactivity`
- `apns-topic: com.spoodsjs.flick.push-type.liveactivity`
- `apns-priority: 10`

**Pros:**
- Completely bypasses the NSE plist issue
- Server-controlled -- no app code needs to run
- Cleaner architecture (server decides, device renders)

**Cons:**
- Requires iOS 17.2+ (iOS 16.2-17.1 users cannot receive pinned snaps)
- Push-to-start token reliability issues on iOS 17 (fixed in iOS 18)
- Requires APNs token-based auth (not certificate-based) from the Cloud Function
- Cannot download and save thumbnail to App Groups before the Live Activity starts (the widget would need to load from a URL, but widgets cannot make network requests)
- Thumbnail delivery becomes a problem -- the image must somehow be in App Groups before the widget renders

**Thumbnail workaround for push-to-start:**
The widget extension cannot make network requests. Options:
1. Encode a very tiny thumbnail (< 1KB) as base64 in the push payload attributes -- but ActivityKit has a 4KB total payload limit
2. Use a two-step process: push-to-start creates the activity, then the app downloads the thumbnail when it wakes up and updates the activity -- but this adds latency to the image appearing
3. Show a placeholder icon instead of the actual photo thumbnail -- degrades the user experience

**Verdict:** Push-to-start is viable as a v2 enhancement (PINI-06 in REQUIREMENTS.md) but NOT recommended as the primary fix for this blocker because: (a) it drops iOS 16.2-17.1 support, (b) the thumbnail delivery problem degrades UX, and (c) the NSE plist fix is a simpler, lower-risk solution.

### Alternative 2: Start Live Activity from App Foreground/Background

**Confidence: HIGH**

Instead of the NSE, start the Live Activity from the main app's notification listener when the app is in the foreground or background.

**How it works:**
- In `App.js`, the existing notification received listener already handles pinned snap data
- When the app receives a pinned snap notification while in foreground or background, it starts the Live Activity using the existing native module

**Limitation:** This only works when the app is running (foreground or background). If the app is killed/suspended, the notification arrives but no Live Activity starts. The NSE approach was specifically chosen to handle ALL app states including killed.

**Verdict:** This is the current fallback already implemented in the codebase. It works for foreground/background but misses the killed-app case. The NSE fix is still needed for full coverage.

### Alternative 3: Hybrid Approach (NSE fix + push-to-start for iOS 17.2+)

**Confidence: MEDIUM**

Fix the NSE plist issue (Approach 1 above) for iOS 16.2+ support, and also implement push-to-start as a future enhancement for iOS 17.2+ users.

**Verdict:** This is the ideal long-term solution but overkill for unblocking the current phase. Fix the NSE first, defer push-to-start to PINI-06 (v2).

## Push-to-Start Analysis

### Feasibility

Push-to-start Live Activities became available in iOS 17.2 (December 2023). The mechanism requires:

1. **App-side token registration:** The app must call `Activity<PinnedSnapAttributes>.pushToStartTokenUpdates` on launch to obtain a push-to-start token, then send it to the server.

2. **Server-side APNs integration:** The Cloud Function must send APNs requests with `apns-push-type: liveactivity` using token-based authentication (p8 key, not p12 certificate).

3. **Widget extension:** Still required for rendering the UI -- push-to-start only handles lifecycle, not rendering.

### iOS Version Impact

Based on TelemetryDeck data (February 2026):
- iOS 26 (19): ~76% of devices
- iOS 18: ~19% of devices
- iOS 17 and earlier: ~5% of devices
- iOS 16: < 2% of devices (not individually tracked)

**Impact of requiring iOS 17.2+:** Would exclude < 5% of all iOS users (those on iOS 16.x and iOS 17.0-17.1). This is acceptable for a non-critical feature like pinned snaps, but the NSE approach (iOS 16.2+) has even broader coverage.

### Token Reliability

iOS 17 had issues with `pushToStartTokenUpdates` -- the token was reportedly obtainable only once per app install, requiring app deletion and reinstall to get a new token. This was fixed in iOS 18.

### Recommendation

Push-to-start is deferred to PINI-06 (v2). The NSE approach is the correct solution for v1.1 because:
1. Broader iOS version support (16.2+)
2. No server-side APNs complexity
3. Thumbnail can be downloaded by the NSE before starting the activity
4. The infrastructure is already built (Plan 06 is complete minus the plist fix)

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@bacons/apple-targets` | 4.0.6 | Expo config plugin to add widget extension target | Standard way to add Apple targets (widgets, Live Activities) in Expo managed workflow. Generates native targets outside /ios |
| Custom Expo Module (local) | -- | Bridge JS to ActivityKit (start/end/update) | Required because ActivityKit is Swift-only; no JS equivalent. `npx create-expo-module@latest --local` |
| SwiftUI + ActivityKit | iOS 16.2+ | Native Live Activity widget UI | Apple's required framework for Live Activity rendering |
| AsyncStorage | 2.2.0 (installed) | Per-friend sticky toggle preference | Already used in project for persistent local storage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-image-manipulator` | ~14.0.8 (installed) | Compress thumbnail for App Groups | Already used in snapService for snap compression |
| `expo-file-system` | ~19.0.21 (installed) | Write thumbnail to App Groups shared container | Already installed; needed to write files to shared directory |
| `@bacons/xcode` | 1.0.0-alpha.32 | Xcode project parser used by apple-targets | Required for config plugin that modifies NSE build settings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @bacons/apple-targets + custom module | expo-live-activity (Software Mansion) | Fixed template UI -- cannot achieve branded pixel-art layout. Only supports title/subtitle/progress bar pattern. |
| @bacons/apple-targets + custom module | Voltra (Callstack) | Write Live Activity in JSX instead of SwiftUI. More ergonomic but less mature (v1.2.0). Limited style subset. Unclear App Groups image support. MEDIUM confidence as fallback if custom module approach proves too complex. |
| `xcode` npm package (in config plugins) | `@bacons/xcode` via `withXcodeProjectBeta` | MUST use `@bacons/xcode` -- the `xcode` npm package is INCOMPATIBLE with `@bacons/apple-targets` pbxproj format. This was the root cause of the blocker. |

**Installation:**
```bash
# Already installed -- no new packages needed for the fix
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
├── FlickLiveActivity/            # Widget extension target (via @bacons/apple-targets)
│   ├── index.swift               # Widget entry point
│   ├── FlickLiveActivityWidget.swift  # SwiftUI Live Activity layout
│   ├── PinnedSnapAttributes.swift     # ActivityAttributes shared definition
│   ├── expo-target.config.js     # Target config (type: widget, frameworks: SwiftUI, ActivityKit)
│   ├── Info.plist                # NSSupportsLiveActivities: true
│   └── Assets.xcassets/
└── FlickNotificationService/     # Notification Service Extension
    ├── NotificationService.swift # NSE code for background Live Activity start
    ├── PinnedSnapAttributes.swift # Copy of ActivityAttributes (must match widget)
    ├── expo-target.config.js     # Target config (type: notification-service)
    └── Info.plist                # NSSupportsLiveActivities: true (SOURCE file)
plugins/
├── withFirebaseFix.js            # iOS-only: Podfile fix for RN Firebase + Expo 54
└── withNSELiveActivities.js      # REWRITE: inject NSSupportsLiveActivities build setting
functions/
└── index.js                      # Modified: onSnapViewed triggers Live Activity end via push
```

### Pattern: Config Plugin Using @bacons/xcode API
**What:** When modifying Xcode project build settings for targets created by `@bacons/apple-targets`, always use the `withXcodeProjectBeta` mod from `@bacons/apple-targets` instead of the `xcode` npm package.
**When to use:** Any config plugin that needs to modify build settings, Info.plist keys, or other Xcode project properties for targets managed by `@bacons/apple-targets`.
**Example:**
```javascript
// Source: @bacons/apple-targets source code analysis
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

module.exports = function withCustomBuildSettings(config) {
  return withXcodeProjectBeta(config, async (config) => {
    const project = config.modResults;
    const targets = project.rootObject.props.targets;

    for (const target of targets) {
      if (target.getDisplayName() === 'MyTarget') {
        target.setBuildSetting('MY_CUSTOM_KEY', 'VALUE');
      }
    }
    return config;
  });
};
```

### Anti-Patterns to Avoid
- **Using `xcode` npm package with `@bacons/apple-targets`:** The `xcode` npm package (v3.0.1) and `@bacons/xcode` (v1.0.0-alpha.32) have incompatible pbxproj serialization formats. Using both causes build settings corruption. ALWAYS use `@bacons/xcode` via `withXcodeProjectBeta` when modifying targets managed by `@bacons/apple-targets`.
- **Setting `GENERATE_INFOPLIST_FILE=NO`:** This breaks Xcode's auto-generation of standard plist entries (like `NSExtensionPointIdentifier`, `CFBundleDisplayName`, etc.) that `@bacons/apple-targets` relies on. Keep it `YES` and use `INFOPLIST_KEY_*` build settings to inject custom keys.
- **Embedding image data in ActivityKit payload:** The 4KB limit makes this impossible for photos. Always use App Groups file sharing.
- **Starting Live Activities from widget extensions:** Widget extensions render UI only. They cannot call `Activity.request()`. Only the main app or NSE can start activities.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Widget extension target generation | Manual Xcode target configuration | `@bacons/apple-targets` Expo plugin | Handles Podfile modifications, signing, target linking automatically during `expo prebuild` |
| Image compression for thumbnail | Custom resize logic | `expo-image-manipulator` (already installed) | Battle-tested, handles EXIF orientation, already used in snapService |
| Deep link URL scheme | Custom URL parsing | Existing `linking` config in AppNavigator + `navigateToNotification` in App.js | Conversation deep linking already works for push notifications |
| Expo native module boilerplate | Manual Swift/Xcode module setup | `npx create-expo-module@latest --local` | Generates correct module structure, config, and build integration |
| pbxproj modification | `xcode` npm package | `@bacons/xcode` via `withXcodeProjectBeta` | Must use same serializer as `@bacons/apple-targets` to avoid corruption |

## Common Pitfalls

### Pitfall 1: Incompatible pbxproj Serializers (ROOT CAUSE OF BLOCKER)
**What goes wrong:** Config plugin uses the `xcode` npm package to modify build settings, but `@bacons/apple-targets` uses `@bacons/xcode`. The two packages serialize pbxproj files differently, causing modifications from one to be lost or corrupted when the other writes.
**Why it happens:** `xcode` (v3.x) and `@bacons/xcode` (v1.0.0-alpha.32) are completely different packages with different internal representations and serialization logic.
**How to avoid:** Always use `withXcodeProjectBeta` from `@bacons/apple-targets/build/with-bacons-xcode` for any config plugin that modifies targets managed by `@bacons/apple-targets`. Never mix pbxproj parsers.
**Warning signs:** Build settings appear correct in the plugin's console.log output but don't take effect in the compiled binary.

### Pitfall 2: ActivityAttributes Must Be Identical in All Targets
**What goes wrong:** The Swift `ActivityAttributes` struct must be defined identically in the widget extension, the native module, AND the NSE. If they differ by even one field, ActivityKit silently fails to match activities.
**Why it happens:** Apple uses the struct type identity to match activities. There's no easy way to share Swift files between Expo module and widget/NSE targets.
**How to avoid:** `PinnedSnapAttributes.swift` is already copied to all three locations. Each copy has a comment referencing the other copies. Any change MUST be mirrored to all three.
**Warning signs:** `Activity.request()` succeeds but no Live Activity appears on the lock screen.

### Pitfall 3: App Groups Container Path Differences
**What goes wrong:** React Native's `FileSystem.documentDirectory` and iOS's `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` point to different locations.
**Why it happens:** The App Groups shared container is a separate sandboxed directory.
**How to avoid:** The NSE writes thumbnails to App Groups via `FileManager.containerURL()`. The widget reads from the same path. This is already correctly implemented.
**Warning signs:** Widget shows placeholder/empty image.

### Pitfall 4: Live Activity 8-Hour Auto-Expiry
**What goes wrong:** iOS automatically expires Live Activities after 8 hours.
**Why it happens:** ActivityKit enforces an 8-hour maximum active duration, then 4 hours stale (12 hours total).
**How to avoid:** Set `staleDate` to 48 hours (already done). For true 48-hour persistence, use ActivityKit push to periodically refresh. For v1.1, accept that activities may disappear after ~12 hours -- most snaps are viewed much sooner.
**Warning signs:** Live Activity disappears from lock screen after ~8-12 hours.

### Pitfall 5: NSE Cannot Make Network Requests Reliably
**What goes wrong:** NSE has a ~30 second time limit and limited memory. Network requests may fail or time out.
**Why it happens:** NSE runs in a separate process with constrained resources.
**How to avoid:** Keep thumbnail downloads small (~5-10KB). Use `URLSession.shared.data(from:)` (already implemented). Fall back gracefully if download fails (activity starts without thumbnail).
**Warning signs:** Intermittent failures in thumbnail display.

### Pitfall 6: NSSupportsLiveActivities Missing (THE CURRENT BLOCKER)
**What goes wrong:** `Activity.request()` fails with "Target does not include NSSupportsLiveActivities plist key."
**Why it happens:** `@bacons/apple-targets` sets `GENERATE_INFOPLIST_FILE=YES`, and the `INFOPLIST_KEY_NSSupportsLiveActivities` build setting is not set. The source Info.plist has the key but Xcode's generated plist may not include it for extension targets.
**How to avoid:** Add `INFOPLIST_KEY_NSSupportsLiveActivities=YES` as a build setting using `withXcodeProjectBeta` (NOT `xcode` npm package). See NSE Plist Fix section.
**Warning signs:** `ActivityAuthorizationInfo().areActivitiesEnabled` returns false in the NSE.

## Code Examples

### NSE Plist Fix Plugin (REWRITTEN)
```javascript
// plugins/withNSELiveActivities.js
// Uses @bacons/apple-targets' own Xcode project API to ensure compatibility
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

module.exports = function withNSELiveActivities(config) {
  return withXcodeProjectBeta(config, async (config) => {
    const project = config.modResults;
    const targets = project.rootObject.props.targets;

    for (const target of targets) {
      const name = target.getDisplayName?.() || target.props?.productName;
      if (name === 'FlickNotificationService') {
        // Add NSSupportsLiveActivities to all build configurations
        // This sets INFOPLIST_KEY_NSSupportsLiveActivities in the build settings
        // which Xcode merges into the generated Info.plist at build time
        target.setBuildSetting('INFOPLIST_KEY_NSSupportsLiveActivities', 'YES');
        console.log('[withNSELiveActivities] Set INFOPLIST_KEY_NSSupportsLiveActivities=YES for', name);
        break;
      }
    }

    return config;
  });
};
```

### Live Activity Service (JS Bridge) - Already Implemented
```javascript
// src/services/liveActivityService.js (existing, no changes needed)
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import logger from '../utils/logger';

let LiveActivityManager = null;
if (Platform.OS === 'ios') {
  try {
    LiveActivityManager = require('../../modules/live-activity-manager').default;
  } catch (e) {
    logger.warn('liveActivityService: Native module not available', { error: e.message });
  }
}

export const startPinnedSnapActivity = async ({
  activityId, senderName, caption, conversationId, friendId, photoUri,
}) => {
  if (Platform.OS !== 'ios' || !LiveActivityManager) {
    return { success: false, error: 'Not supported' };
  }
  // ... existing implementation
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No Live Activity support in Expo | @bacons/apple-targets + custom module | 2024 | Enables widget extensions in Expo managed workflow |
| `xcode` npm package for pbxproj mods | `@bacons/xcode` via `withXcodeProjectBeta` | 2025 | Required for compatibility with @bacons/apple-targets v4.x |
| PR #136 (infoPlist config property) | Not merged in v4.0.6 | -- | Must use build settings approach instead of direct plist config |
| Push-to-start (server-triggered) | App-side Activity.request() with NSE | iOS 17.2+ for push-to-start | NSE approach supports iOS 16.2+; push-to-start deferred to PINI-06 |
| expo-widgets (SDK 55 alpha) | @bacons/apple-targets (SDK 54 compatible) | 2025 | expo-widgets not available on SDK 54; apple-targets is the stable option |

**Deprecated/outdated:**
- **`xcode` npm package for modifying @bacons/apple-targets targets:** Causes pbxproj serialization conflicts. Use `withXcodeProjectBeta` instead.
- **`GENERATE_INFOPLIST_FILE=NO` approach:** Breaks standard plist key generation. Keep it `YES` and use `INFOPLIST_KEY_*` build settings.
- `expo-live-activity` for custom layouts: Its fixed template cannot achieve branded designs.
- `expo-widgets` on SDK 54: Requires SDK 55.

## Open Questions

1. **`target.setBuildSetting()` API availability**
   - What we know: `@bacons/xcode` PBXNativeTarget has `setBuildSetting()` method used extensively in `with-xcode-changes.js` (confirmed in source code lines 54, 97-101, etc.)
   - What's unclear: Whether `getDisplayName()` returns the user-visible name or the internal product name for NSE targets
   - Recommendation: Try both `getDisplayName()` and `props.productName` to match the target. Add fallback matching.

2. **48-Hour Live Activity Persistence**
   - What we know: iOS enforces an 8-hour active duration, then 4 hours stale (12 hours total).
   - What's unclear: Whether periodic push updates truly reset the staleness timer.
   - Recommendation: Accept 12-hour practical limit for v1.1. Most snaps are viewed within minutes. Defer 48-hour persistence to v2.

3. **EAS Build Widget Extension Signing**
   - What we know: @bacons/apple-targets handles most Xcode configuration. EAS builds sign the main app automatically.
   - What's unclear: Whether EAS automatically provisions the NSE and widget extension bundle identifiers.
   - Recommendation: Test with a dev build first. If signing fails, manually create provisioning profiles.

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

**Note:** Native Swift code (ActivityKit, SwiftUI widget, NSE) cannot be tested with Jest. The config plugin fix (`withNSELiveActivities.js`) and native NSE behavior must be verified manually via EAS dev build on a physical iOS device (iOS 16.2+). Jest tests cover the JS service layer, preference storage, and message document structure only.

### NSE Fix Verification Procedure
Since the plist fix cannot be tested with Jest, verification requires:
1. Run `npx expo prebuild -p ios --clean` locally
2. Inspect `ios/<ProjectName>.xcodeproj/project.pbxproj` for `INFOPLIST_KEY_NSSupportsLiveActivities = YES` in the FlickNotificationService build configurations
3. Run `eas build --platform ios --profile development` (requires native build)
4. Test on physical device: send a pinned snap, verify Live Activity appears on lock screen

## Sources

### Primary (HIGH confidence)
- `@bacons/apple-targets` v4.0.6 source code analysis: `configuration-list.js`, `with-widget.js`, `with-xcode-changes.js`, `with-bacons-xcode.js`, `target.js` -- direct inspection of how plist generation and build settings work
- [Apple Build Settings Reference](https://developer.apple.com/documentation/xcode/build-settings-reference) -- GENERATE_INFOPLIST_FILE and INFOPLIST_KEY_ documentation
- [Apple ActivityKit Documentation](https://developer.apple.com/documentation/activitykit) -- Official API reference for Live Activities
- [Apple: Starting Live Activities with Push Notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications) -- Push-to-start requirements (iOS 17.2+)
- Codebase analysis: `plugins/withNSELiveActivities.js`, `targets/FlickNotificationService/`, `app.json` plugin ordering

### Secondary (MEDIUM confidence)
- [GitHub: expo-apple-targets PR #136](https://github.com/EvanBacon/expo-apple-targets/pull/136) -- infoPlist config property (NOT merged in v4.0.6)
- [GitHub: expo-apple-targets](https://github.com/EvanBacon/expo-apple-targets) -- README confirms "root Info.plist is not managed" but build settings override at build time
- [Christian Selig: Server-Side Live Activities](https://christianselig.com/2024/09/server-side-live-activities/) -- Push-to-start implementation details and iOS 17 reliability issues
- [APNsPush: Start and Update Live Activities](https://apnspush.com/how-to-start-and-update-live-activities-with-push-notifications) -- APNs payload format for push-to-start
- [TelemetryDeck: iOS Version Market Share](https://telemetrydeck.com/survey/apple/iOS/majorSystemVersions/) -- iOS 16/17/18 adoption data (Feb 2026)
- [Apple Developer Forums: GENERATE_INFOPLIST_FILE](https://developer.apple.com/forums/thread/726709) -- Behavior of GENERATE_INFOPLIST_FILE with INFOPLIST_FILE

### Tertiary (LOW confidence)
- [Apple Developer Forums: NSE and Live Activities](https://developer.apple.com/forums/thread/740332) -- Community discussion on NSE limitations with ActivityKit
- [Apple Discussions: NSSupportsLiveActivities error](https://discussions.apple.com/thread/255760447) -- Same error reported by other developers

## Metadata

**Confidence breakdown:**
- NSE plist fix (Approach 1): HIGH - Based on direct source code analysis of `@bacons/apple-targets` and understanding of Xcode build settings. The `withXcodeProjectBeta` + `setBuildSetting` API is used extensively in the plugin's own code.
- Push-to-start alternative: MEDIUM - Well-documented by Apple but thumbnail delivery problem makes it unsuitable as primary approach for this use case.
- Root cause diagnosis: HIGH - Traced through source code of both `@bacons/apple-targets` and the existing `withNSELiveActivities.js` plugin. The incompatible pbxproj serializers are the definitive cause.
- Architecture (existing implementation): MEDIUM - Plans 01-06 are implemented and patterns are validated except for the blocked NSE path.
- Pitfalls: HIGH - ActivityKit limitations, App Groups paths, and NSE constraints are well-documented.

**Research date:** 2026-03-05 (update)
**Valid until:** 2026-04-05 (30 days - core fix is based on stable source code analysis, not evolving APIs)
