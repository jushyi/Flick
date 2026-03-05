# Phase 9: Pinned Snaps iOS (PIVOT) - Research

**Researched:** 2026-03-05 (rewritten -- pivot from Live Activities to persistent notifications)
**Domain:** iOS rich push notifications, Notification Service Extension (thumbnail attachment), expo-notifications programmatic dismissal, Cloud Functions notification payload
**Confidence:** HIGH

## Summary

Phase 9 is pivoting from Live Activities to persistent rich notifications for pinned snaps. The sender-side code (PinToggle UI, usePinPreference hook, PinTooltip, snapService pinned flag, SnapPreviewScreen send flow, and Cloud Function notification payload) is already built and working. The pivot requires three categories of work:

1. **Remove Live Activity infrastructure:** Delete the FlickLiveActivity widget extension target, LiveActivityManager native module, liveActivityService.js, PinnedSnapAttributes.swift copies, NSE ActivityKit logic, Live Activity references in App.js and SnapViewer.js, diagnostic UI in SettingsScreen, and the withNSELiveActivities.js config plugin. Also remove `@bacons/apple-targets` from app.json plugins (no more extension targets needed).

2. **Simplify NSE for thumbnail attachment:** The FlickNotificationService NSE stays but is rewritten to only download the snap thumbnail and attach it as a `UNNotificationAttachment` to the notification. No ActivityKit imports, no App Groups, no Live Activity creation. The NSE downloads the image to a temporary file and creates an attachment -- this is standard iOS rich notification behavior.

3. **Add recipient-side dismissal logic:** When the recipient views a pinned snap in SnapViewer, dismiss the corresponding notification programmatically using `Notifications.dismissNotificationAsync()`. For re-delivery when swiped away, check on app foreground whether unviewed pinned snaps exist without a corresponding presented notification, and re-schedule a local notification. The Cloud Function already includes `pinnedActivityId` in the notification data, which serves as the lookup key.

**Primary recommendation:** Simplify aggressively. The persistent notification approach is dramatically simpler than Live Activities -- no widget extension, no native module, no ActivityKit, no App Groups, no SwiftUI. The NSE only needs to download an image and attach it. Dismissal uses the existing `expo-notifications` API pattern already used in `useConversation.js`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Pin toggle placement:** Appears on the send confirmation screen (SnapPreviewScreen), after capturing but before sending. Pixel-art pin icon with toggle switch. UNCHANGED -- already built.
- **Default state:** Off, but sticky per friend (remembers last choice per conversation). UNCHANGED -- already built.
- **First-time tooltip:** Brief one-time tooltip explaining "Pin this snap to their lock screen" -- then never shown again. UNCHANGED -- already built.
- **Notification appearance:** Photo thumbnail shown as image attachment (rich notification with image preview). Caption displayed next to/below the thumbnail if present. No extra descriptive text -- just the thumbnail and caption content. Sender name as notification title. Default notification sound. No action buttons -- just tap to open.
- **Persistence and dismissal:** Notification persists as long as the snap hasn't been viewed. If user swipes the notification away, it should be re-delivered (snap is still unviewed). Viewing the snap in SnapViewer is the only thing that dismisses the notification. No separate expiry timer -- tied purely to snap viewed state.
- **Multiple pinned snaps:** Each pinned snap creates its own notification -- they stack. No cap on number of active pinned notifications.
- **Caption behavior:** Reuses snap's message text. If no message text: just photo thumbnail + sender name. Emoji-only messages display normally as caption text. UNCHANGED -- already built.
- **Cleanup: Remove Live Activity code:** Remove FlickLiveActivity widget extension target, LiveActivityManager native module (modules/live-activity-manager/), PinnedSnapAttributes.swift copies, simplify NSE to only handle thumbnail attachment (no ActivityKit), remove liveActivityService.js, remove Live Activity imports/calls from App.js and SnapViewer.js, remove diagnose/NSE diagnostics from Settings screen, keep FlickNotificationService NSE target (repurpose for thumbnail attachment).

### Claude's Discretion
- NSE implementation for downloading and attaching thumbnail to notification
- Notification identifier scheme for programmatic dismissal
- How to re-deliver notification if swiped away (foreground check vs scheduled local notification)
- How to track/persist the per-friend sticky toggle preference (ALREADY BUILT -- usePinPreference hook uses AsyncStorage)
- Exact tooltip implementation and dismissal logic (ALREADY BUILT -- PinTooltip component)
- Cloud Function notification payload structure (ALREADY BUILT -- pinned fields in onNewMessage)

### Deferred Ideas (OUT OF SCOPE)
- Live Activities could be revisited as an enhancement in a future phase if persistent notifications feel insufficient
- Custom notification sound for pinned snaps -- potential future polish
</user_constraints>

<phase_requirements>
## Phase Requirements

Note: REQUIREMENTS.md still references "Live Activity" wording (PINI-02 through PINI-05). Per the CONTEXT.md pivot, these are now fulfilled via persistent notifications instead. The requirement INTENT is preserved -- only the mechanism changes.

| ID | Description (reinterpreted for pivot) | Research Support |
|----|-------------|-----------------|
| PINI-01 | Sender can toggle "pin to screen" when sending a snap | COMPLETE: Already built (PinToggle, usePinPreference, SnapPreviewScreen, snapService). No changes needed. |
| PINI-02 | Recipient sees a persistent notification with snap photo thumbnail, sender name, and optional caption | NSE thumbnail attachment pattern, Cloud Function richContent/mutableContent, notification body structure |
| PINI-03 | Tapping the notification opens the conversation (same deeplink as push notification) | COMPLETE: Already handled by existing notification tap handler in App.js (navigateToNotification). Data payload already contains conversationId. |
| PINI-04 | Notification disappears after recipient views the snap | Programmatic dismissal via Notifications.dismissNotificationAsync() in SnapViewer, identifier matching pattern |
| PINI-05 | (Originally: auto-expires after 48h) Now: notification re-delivers if swiped away before viewing | Re-delivery via foreground check + local notification scheduling pattern |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-notifications` | ~0.32.16 | Programmatic notification dismissal, local notification scheduling, presented notifications query | Already used throughout app for push notifications |
| `expo-server-sdk` | ^5.0.0 | Cloud Function push notification sending with mutableContent and richContent | Already used in functions/notifications/sender.js |
| `@react-native-firebase/firestore` | installed | Query unviewed pinned snaps for re-delivery check | Already used throughout app |

### NSE (Native Swift -- no npm packages)
| Component | Purpose | Notes |
|-----------|---------|-------|
| `UNNotificationServiceExtension` | Download thumbnail, attach to notification | Already exists as FlickNotificationService; rewrite to remove ActivityKit |
| `UNNotificationAttachment` | Rich notification image display | Standard iOS API since iOS 10 |
| `URLSession` | Download thumbnail from Firebase Storage URL | Already used in existing NSE code |

### Removed (This Pivot)
| Library/Component | Why Removed |
|-------------------|-------------|
| `@bacons/apple-targets` | No more widget extension targets needed. NSE target needs rebuild approach (see Architecture). |
| `modules/live-activity-manager/` | No more ActivityKit bridge needed |
| `liveActivityService.js` | No more Live Activity JS interface |
| `targets/FlickLiveActivity/` | No more widget extension |
| `plugins/withNSELiveActivities.js` | No more NSSupportsLiveActivities build setting |
| `ActivityKit` framework (in NSE) | No more Live Activities |

### Key Decision: NSE Target After Removing @bacons/apple-targets

**Problem:** The FlickNotificationService NSE target is currently managed by `@bacons/apple-targets`. Removing `@bacons/apple-targets` from app.json means the NSE target would no longer be generated during `expo prebuild`.

**Recommendation:** Keep `@bacons/apple-targets` in app.json BUT only for the NSE target. Remove the FlickLiveActivity widget extension directory. The NSE expo-target.config.js should be updated to remove the `ActivityKit` framework and `NSSupportsLiveActivities` plist key. The `withNSELiveActivities.js` plugin is no longer needed (it only added the NSSupportsLiveActivities build setting).

**Updated NSE expo-target.config.js:**
```javascript
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'notification-service',
  name: 'FlickNotificationService',
  bundleIdentifier: '.FlickNotificationService',
  deploymentTarget: '16.0',  // Lower from 16.2 -- no ActivityKit needed
};
```

No App Groups entitlement needed anymore (was only for sharing thumbnails with widget extension).

**Installation:**
```bash
# No new packages needed. Only deletions and modifications.
```

## Architecture Patterns

### Recommended Project Structure (After Pivot)
```
src/
  services/
    firebase/
      snapService.js         # UNCHANGED: pinned flag, thumbnail upload
    pinnedNotificationService.js  # NEW: dismiss + re-deliver notifications
  screens/
    SnapPreviewScreen.js     # UNCHANGED: pin toggle send flow
    SettingsScreen.js         # MODIFIED: remove NSE diagnostics long-press
  hooks/
    usePinPreference.js      # UNCHANGED: sticky per-friend toggle
    usePinnedSnaps.js         # NEW: foreground re-delivery check hook
  components/
    PinToggle.js             # UNCHANGED
    PinTooltip.js            # UNCHANGED
    SnapViewer.js            # MODIFIED: dismiss notification instead of Live Activity
targets/
  FlickNotificationService/  # MODIFIED: simplified NSE (no ActivityKit)
    NotificationService.swift
    expo-target.config.js
    Info.plist
plugins/
  withFirebaseFix.js         # UNCHANGED
functions/
  index.js                   # MINOR: update notification body text, add richContent
  notifications/sender.js    # MINOR: support richContent field in message
```

**Deleted:**
```
targets/FlickLiveActivity/           # ENTIRE directory removed
modules/live-activity-manager/       # ENTIRE directory removed
src/services/liveActivityService.js  # DELETED
plugins/withNSELiveActivities.js     # DELETED
```

### Pattern 1: NSE Rich Notification Thumbnail Attachment
**What:** The Notification Service Extension intercepts pinned snap push notifications (identified by `mutable-content: 1` and `pinned: true` in data), downloads the thumbnail image from the URL in the notification data, writes it to a temporary file, creates a `UNNotificationAttachment`, and attaches it to the notification content.
**When to use:** Any pinned snap notification that has a thumbnailUrl in its data payload.
**Example:**
```swift
// Source: Apple UNNotificationAttachment documentation + SwiftLee rich notifications guide
class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        // Extract data from Expo push notification body
        let bodyData = extractBodyData(from: bestAttemptContent.userInfo)

        // Only process pinned snap notifications
        guard isPinnedSnap(bodyData) else {
            contentHandler(bestAttemptContent)
            return
        }

        // Set thread identifier for notification grouping
        if let conversationId = bodyData["conversationId"] as? String {
            bestAttemptContent.threadIdentifier = "pinned-\(conversationId)"
        }

        // Download and attach thumbnail
        guard let thumbnailUrlString = bodyData["pinnedThumbnailUrl"] as? String,
              !thumbnailUrlString.isEmpty,
              let thumbnailUrl = URL(string: thumbnailUrlString) else {
            contentHandler(bestAttemptContent)
            return
        }

        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: thumbnailUrl)
                let tmpDir = FileManager.default.temporaryDirectory
                let fileUrl = tmpDir.appendingPathComponent(UUID().uuidString + ".jpg")
                try data.write(to: fileUrl)

                let attachment = try UNNotificationAttachment(
                    identifier: "thumbnail",
                    url: fileUrl,
                    options: [UNNotificationAttachmentOptionsTypeHintKey: "public.jpeg"]
                )
                bestAttemptContent.attachments = [attachment]
            } catch {
                // Fail gracefully -- notification still shows without image
            }
            contentHandler(bestAttemptContent)
        }
    }
}
```

### Pattern 2: Programmatic Notification Dismissal on Snap View
**What:** When the recipient views a pinned snap in SnapViewer, dismiss the corresponding notification from Notification Center. Uses the same pattern already in `useConversation.js` -- query presented notifications, filter by data match, dismiss by identifier.
**When to use:** In SnapViewer's `handleDismiss` callback, after successfully marking snap as viewed.
**Example:**
```javascript
// Source: Existing pattern in useConversation.js + expo-notifications docs
import * as Notifications from 'expo-notifications';

/**
 * Dismiss notification for a specific pinned snap.
 * Matches by pinnedActivityId in notification data payload.
 */
export const dismissPinnedSnapNotification = async (pinnedActivityId) => {
  if (Platform.OS !== 'ios' || !pinnedActivityId) return;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matching = presented.filter(
      n => n.request.content.data?.pinnedActivityId === pinnedActivityId
    );
    await Promise.all(
      matching.map(n => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch (err) {
    // Best-effort -- ignore errors
  }
};
```

### Pattern 3: Re-Delivery After Swipe-Away (Foreground Check)
**What:** When the app comes to the foreground, check whether any unviewed pinned snaps are missing from the notification tray. If a pinned snap is unviewed but its notification is no longer presented, schedule a local notification immediately to re-deliver it.
**When to use:** On app foreground (AppState 'active' transition) and on notification received events.
**Example:**
```javascript
// Foreground check: query Firestore for unviewed pinned snaps sent TO this user,
// then compare against getPresentedNotificationsAsync()
const checkAndRedeliverPinnedSnaps = async (userId) => {
  if (Platform.OS !== 'ios') return;

  try {
    // Get unviewed pinned snaps where this user is the recipient
    const unviewedSnaps = await getUnviewedPinnedSnapsForUser(userId);
    if (unviewedSnaps.length === 0) return;

    // Get currently presented notifications
    const presented = await Notifications.getPresentedNotificationsAsync();
    const presentedIds = new Set(
      presented
        .map(n => n.request.content.data?.pinnedActivityId)
        .filter(Boolean)
    );

    // Re-deliver any missing
    for (const snap of unviewedSnaps) {
      if (!presentedIds.has(snap.pinnedActivityId)) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: snap.senderName,
            body: snap.caption || '',
            data: {
              type: 'snap',
              conversationId: snap.conversationId,
              pinnedActivityId: snap.pinnedActivityId,
              pinned: 'true',
            },
          },
          trigger: null, // Deliver immediately
        });
      }
    }
  } catch (err) {
    // Best-effort
  }
};
```

### Anti-Patterns to Avoid
- **Using ActivityKit for something notifications handle natively:** Live Activities add widget extension target, native module, App Groups, SwiftUI, and three copies of ActivityAttributes.swift. A rich notification achieves the same "persistent presence on lock screen" with none of that complexity.
- **Trying to set the APNS notification identifier from Expo Push Service:** The Expo Push Service does not expose `apns-id` or `apns-collapse-id`. The notification identifier is assigned by the system. Use data payload matching (pinnedActivityId) instead.
- **Polling for notification dismissal:** Do not continuously check if notifications are still presented. Only check on app foreground events and after snap view events.
- **Making the re-delivery mechanism overly complex:** A simple foreground check with Firestore query is sufficient. Users open the app to see messages anyway -- that is when the re-delivery is needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rich notification image | Custom image rendering in notification | `UNNotificationAttachment` via NSE | Standard iOS API; handles image formats, sizing, and display automatically |
| Notification dismissal | Custom notification tracking system | `Notifications.getPresentedNotificationsAsync()` + `dismissNotificationAsync()` | Pattern already exists in codebase (useConversation.js); battle-tested |
| Notification identifier matching | Custom ID tracking across app/NSE | Data payload `pinnedActivityId` field | Already in the Cloud Function payload; carried through to presented notifications |
| Local notification re-scheduling | Background task / silent push | `Notifications.scheduleNotificationAsync()` with `trigger: null` | Instant delivery, works from foreground, no background mode needed |
| NSE target generation | Manual Xcode project modification | `@bacons/apple-targets` notification-service type | Already manages the NSE target; just remove ActivityKit framework from config |

**Key insight:** The persistent notification approach eliminates the entire native module + widget extension stack. Everything on the recipient side is achievable with standard iOS notification APIs and existing expo-notifications functions already used in the codebase.

## Common Pitfalls

### Pitfall 1: NSE Thumbnail Download Timeout
**What goes wrong:** The NSE has a ~30 second time budget. Large image downloads or slow network can exceed this limit, causing `serviceExtensionTimeWillExpire()` to fire and the notification to be delivered without the image.
**Why it happens:** NSE runs in a separate process with strict resource limits.
**How to avoid:** Thumbnails are already small (100x100, ~5-10KB via snapService compression). This should complete well within the time limit. Implement `serviceExtensionTimeWillExpire()` to deliver the notification without the image as a graceful fallback.
**Warning signs:** Notifications sometimes appear without images on slow connections.

### Pitfall 2: Notification Identifier Mismatch for Dismissal
**What goes wrong:** `dismissNotificationAsync()` requires the system-assigned notification identifier, not the pinnedActivityId. If you try to dismiss by pinnedActivityId directly, it fails silently.
**Why it happens:** Remote push notifications get system-assigned identifiers, not custom ones. Expo Push Service does not expose `apns-id` or `apns-collapse-id`.
**How to avoid:** Always use `getPresentedNotificationsAsync()` first, filter by `data.pinnedActivityId`, then use `request.identifier` to dismiss. This two-step pattern is already used in `useConversation.js`.
**Warning signs:** `dismissNotificationAsync()` resolves successfully but the notification stays.

### Pitfall 3: Re-Delivery Creating Duplicate Notifications
**What goes wrong:** Foreground check fires and re-schedules a local notification, but the original push notification is still in the tray (user didn't swipe it away -- it's just off screen or in a different group).
**Why it happens:** `getPresentedNotificationsAsync()` might miss notifications in certain states, or the check runs before the push notification arrives.
**How to avoid:** Always check presented notifications BEFORE re-delivering. Use `pinnedActivityId` in the data payload to deduplicate -- if a notification with that ID is already presented, skip re-delivery. Add a short delay (1-2 seconds) after app foreground before running the check.
**Warning signs:** Multiple identical notifications appearing for the same pinned snap.

### Pitfall 4: Expo Push Body Data Nesting in NSE
**What goes wrong:** Expo Push Service nests custom data under the `body` key in APNS userInfo as a JSON-encoded string. Parsing fails if you assume it is a dictionary.
**Why it happens:** Expo's push delivery format differs from raw APNS format.
**How to avoid:** The existing NSE code already handles this correctly with three fallback paths: direct dictionary, JSON string parse, and direct userInfo. Preserve this parsing logic in the simplified NSE.
**Warning signs:** NSE cannot find `pinned` or `pinnedThumbnailUrl` fields in the notification data.

### Pitfall 5: Local Notification Missing Image Attachment for Re-Delivery
**What goes wrong:** When re-delivering a dismissed pinned snap notification via `scheduleNotificationAsync`, the local notification does not have the thumbnail image because it is not going through the NSE.
**Why it happens:** The NSE only intercepts remote push notifications, not locally scheduled notifications. Local notifications do not trigger `didReceive` in the NSE.
**How to avoid:** For local re-delivery notifications, download the thumbnail image to a local file first, then use the `attachments` property of `NotificationContentInput` (iOS only) to attach it. Alternatively, accept that re-delivered notifications may not have the image (simpler, acceptable UX tradeoff since the user has already seen the notification at least once).
**Warning signs:** Re-delivered notifications show without the thumbnail image.

### Pitfall 6: Removing @bacons/apple-targets Breaks NSE Target
**What goes wrong:** If `@bacons/apple-targets` is removed from app.json plugins entirely, the FlickNotificationService NSE target is no longer generated during `expo prebuild`, breaking the NSE.
**Why it happens:** The NSE target is defined via `targets/FlickNotificationService/expo-target.config.js` which requires `@bacons/apple-targets` to process.
**How to avoid:** Keep `@bacons/apple-targets` in app.json. Only delete the `targets/FlickLiveActivity/` directory. The plugin will only generate targets for directories that exist under `targets/`.
**Warning signs:** EAS build fails with "FlickNotificationService target not found" or NSE stops intercepting notifications.

## Code Examples

### Simplified NSE (No ActivityKit)
```swift
// targets/FlickNotificationService/NotificationService.swift
// Source: Apple UNNotificationAttachment docs + SwiftLee rich notifications guide
import UserNotifications
import Foundation

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        // Parse notification data (handle Expo push nesting)
        let bodyData = extractBodyData(from: bestAttemptContent.userInfo)

        // Only enhance pinned snap notifications with thumbnail
        guard isPinned(bodyData),
              let thumbnailUrlString = bodyData["pinnedThumbnailUrl"] as? String,
              !thumbnailUrlString.isEmpty,
              let thumbnailUrl = URL(string: thumbnailUrlString) else {
            contentHandler(bestAttemptContent)
            return
        }

        // Download thumbnail and attach
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: thumbnailUrl)
                let tmpFile = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString + ".jpg")
                try data.write(to: tmpFile)

                let attachment = try UNNotificationAttachment(
                    identifier: "snap-thumbnail",
                    url: tmpFile,
                    options: [UNNotificationAttachmentOptionsTypeHintKey: "public.jpeg"]
                )
                bestAttemptContent.attachments = [attachment]
            } catch {
                // Graceful fallback -- notification displays without image
            }
            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        // Deliver whatever we have so far
        if let contentHandler = contentHandler,
           let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Private Helpers

    private func extractBodyData(from userInfo: [AnyHashable: Any]) -> [String: Any] {
        // Expo nests data under "body" as dict or JSON string
        if let bodyDict = userInfo["body"] as? [String: Any] {
            return bodyDict
        } else if let bodyString = userInfo["body"] as? String,
                  let jsonData = bodyString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            return parsed
        } else if userInfo["pinned"] != nil {
            return userInfo as? [String: Any] ?? [:]
        }
        return [:]
    }

    private func isPinned(_ bodyData: [String: Any]) -> Bool {
        if let pinnedStr = bodyData["pinned"] as? String { return pinnedStr == "true" }
        if let pinnedBool = bodyData["pinned"] as? Bool { return pinnedBool }
        return false
    }
}
```

### Notification Dismissal in SnapViewer (Replaces Live Activity End)
```javascript
// Source: Existing pattern in useConversation.js (dismissConversationNotifications)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import logger from '../utils/logger';

export const dismissPinnedSnapNotification = async (pinnedActivityId) => {
  if (Platform.OS !== 'ios' || !pinnedActivityId) return;

  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matching = presented.filter(
      n => n.request.content.data?.pinnedActivityId === pinnedActivityId
    );

    if (matching.length > 0) {
      await Promise.all(
        matching.map(n =>
          Notifications.dismissNotificationAsync(n.request.identifier)
        )
      );
      logger.info('pinnedNotificationService: Dismissed notification', {
        pinnedActivityId,
        count: matching.length,
      });
    }
  } catch (err) {
    logger.warn('pinnedNotificationService: Failed to dismiss', {
      pinnedActivityId,
      error: err.message,
    });
  }
};
```

### Cloud Function Notification Payload (Minor Update)
```javascript
// functions/index.js -- onNewMessage handler
// The mutableContent flag is already set. Add richContent for server-side image support
// (belt-and-suspenders with NSE attachment)
if (message.pinned === true) {
  notificationData.pinned = 'true';
  notificationData.pinnedActivityId = message.pinnedActivityId || '';
  notificationData.pinnedThumbnailUrl = message.pinnedThumbnailUrl || '';
  notificationData.caption = message.caption || '';
}

const pushOptions = {
  mutableContent: message.pinned === true,
};

// The notification body for pinned snaps
// CONTEXT.md: "No extra descriptive text -- just the thumbnail and caption content"
body = message.caption || '';  // Caption as body, or empty
```

## State of the Art

| Old Approach (This Phase v1) | New Approach (Pivot) | Why Changed | Impact |
|------------------------------|---------------------|-------------|--------|
| Live Activities (ActivityKit + widget extension + native module) | Persistent rich notification with thumbnail attachment | Massive complexity reduction; Live Activities require native EAS build for every change, three copies of ActivityAttributes, SwiftUI widget, App Groups, NSE ActivityKit logic | Eliminates ~15 files, 2 native targets, 1 native module. NSE becomes ~50 lines instead of ~300. |
| NSE starts Live Activity via `Activity.request()` | NSE downloads thumbnail and creates `UNNotificationAttachment` | Standard iOS API since iOS 10; no ActivityKit required; no App Groups needed | NSE works on iOS 10+, not just iOS 16.2+ |
| JS bridge via `liveActivityService.js` + native module | `expo-notifications` `dismissNotificationAsync()` | Already used in codebase for conversation notification dismissal | Zero new native code needed on JS side |
| Widget extension renders pixel-art SwiftUI layout | iOS system notification displays thumbnail image | Image attachment handled by iOS system; renders consistently | No custom UI to maintain |
| App Groups shared container for thumbnails | NSE temporary directory for attachment | Attachment is copied by iOS to its own storage; no shared container needed | Simpler file management |

**Deprecated/outdated (from Phase 9 v1):**
- `LiveActivityManager` native module: No longer needed
- `PinnedSnapAttributes.swift`: No longer needed (was for ActivityKit)
- `FlickLiveActivity` widget extension: No longer needed
- `liveActivityService.js`: No longer needed
- `withNSELiveActivities.js` plugin: No longer needed (was for NSSupportsLiveActivities)
- App Groups entitlement in NSE: No longer needed (was for sharing with widget)
- `ActivityKit` framework in NSE: No longer needed

## Open Questions

1. **Re-delivery image attachment for local notifications**
   - What we know: Local notifications scheduled via `scheduleNotificationAsync` do not go through the NSE. The `attachments` field on `NotificationContentInput` supports iOS attachments with a local file URL.
   - What's unclear: Whether expo-notifications' `attachments` field works reliably with file:// URIs for downloaded images. The docs mention it but practical examples are scarce.
   - Recommendation: For re-delivered local notifications, first try using the `attachments` field with a cached thumbnail file. If that proves unreliable, accept text-only re-delivery as a simpler fallback -- the user already saw the image on first delivery.

2. **Firestore query for unviewed pinned snaps (re-delivery check)**
   - What we know: Pinned snap messages have `pinned: true` and `viewedAt: null` in the messages subcollection. We need to query across all conversations for the current user.
   - What's unclear: Whether a cross-conversation query is practical or if we need a top-level collection/field to track active pinned snaps per user.
   - Recommendation: Use a simple approach -- store a local list of unviewed pinned snap IDs (AsyncStorage) that gets cleared when viewed. This avoids a Firestore query entirely and is more efficient. On foreground, check the local list against `getPresentedNotificationsAsync()`.

3. **Notification body content for pinned snaps**
   - What we know: CONTEXT.md says "No extra descriptive text -- just the thumbnail and caption content." Sender name as notification title.
   - What's unclear: What the notification body should be when there is no caption. An empty body may look odd.
   - Recommendation: Use caption as body if present. If no caption, use a minimal body like "Sent you a snap" or leave empty. The thumbnail image is the primary content.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with jest-expo preset |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="pinnedNotification\|snapService\|usePinPreference" --no-coverage` |
| Full suite command | `npm test` |
| Estimated runtime | ~5 seconds (targeted), ~30 seconds (full) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PINI-01 | Pin toggle appears, sticky preference per friend | unit | `npx jest __tests__/hooks/usePinPreference.test.js -x` | No -- but component is already built and working. Test is a Wave 0 gap from v1. |
| PINI-02 | Notification includes thumbnail attachment (NSE), correct title/body | manual-only | Physical device test (NSE is native Swift) | N/A -- cannot unit test NSE |
| PINI-03 | Tapping notification opens conversation | manual-only | Physical device test (system notification tap) | N/A |
| PINI-04 | Notification dismissed after snap viewed | unit | `npx jest __tests__/services/pinnedNotificationService.test.js -x` | No -- Wave 0 gap |
| PINI-05 | Re-delivery when swiped away | unit + manual | `npx jest __tests__/services/pinnedNotificationService.test.js -x` (logic); physical device (behavior) | No -- Wave 0 gap |

### Nyquist Sampling Rate
- **Minimum sample interval:** After every committed task -> run quick targeted tests
- **Full suite trigger:** Before merging final task of any plan wave
- **Phase-complete gate:** Full suite green before `/gsd:verify-work`
- **Estimated feedback latency per task:** ~5 seconds

### Wave 0 Gaps (must be created before implementation)
- [ ] `__tests__/services/pinnedNotificationService.test.js` -- covers PINI-04, PINI-05 (dismissal logic, re-delivery logic)
- [ ] Delete `__tests__/services/liveActivityService.test.js` -- no longer needed (Live Activity service is removed)
- [ ] Extend `__tests__/services/snapService.test.js` -- verify pinned snap message data unchanged after pivot (existing tests should still pass)

**Note:** The NSE (native Swift), notification display, tap-to-open behavior, and re-delivery on physical device are manual-only. These require an EAS native build on a physical iOS device. Jest tests cover the JS service layer (dismissal logic, re-delivery checking logic, data matching) only.

## Sources

### Primary (HIGH confidence)
- [Apple UNNotificationAttachment Documentation](https://developer.apple.com/documentation/usernotifications/unnotificationattachment) -- Standard iOS API for rich notification images
- [Apple UNNotificationServiceExtension Documentation](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension) -- NSE lifecycle and limitations
- [Expo Notifications SDK Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/) -- dismissNotificationAsync, getPresentedNotificationsAsync, scheduleNotificationAsync APIs
- [Expo Push Notification Sending Documentation](https://docs.expo.dev/push-notifications/sending-notifications/) -- mutableContent, richContent message fields
- Codebase analysis: `useConversation.js` (existing dismissal pattern), `NotificationService.swift` (existing NSE), `sender.js` (push payload), `snapService.js` (pinned data fields), `App.js` (notification handlers), `SnapViewer.js` (snap view lifecycle)

### Secondary (MEDIUM confidence)
- [SwiftLee: Rich Notifications Explained](https://www.avanderlee.com/swift/rich-notifications/) -- NSE image attachment implementation pattern
- [expo-server-sdk-node GitHub](https://github.com/expo/expo-server-sdk-node) -- richContent field support
- [Apple threadIdentifier Documentation](https://developer.apple.com/documentation/usernotifications/unnotificationcontent/threadidentifier) -- Notification grouping

### Tertiary (LOW confidence)
- [Expo Forum: Push notification collapse identifier](https://forums.expo.dev/t/push-notification-support-for-collapse-identifier/65271/2) -- Expo Push Service does not support apns-collapse-id (needs validation)

## Metadata

**Confidence breakdown:**
- NSE thumbnail attachment: HIGH - Standard iOS API since iOS 10, well-documented, simple implementation
- Programmatic dismissal: HIGH - Already used in codebase (useConversation.js), verified API exists
- Re-delivery mechanism: MEDIUM - Approach is sound but implementation details (local notification attachments, foreground timing) need validation on device
- Code removal scope: HIGH - All Live Activity references identified through thorough grep of codebase
- @bacons/apple-targets retention for NSE: HIGH - Plugin only generates targets for directories that exist

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (30 days -- standard iOS APIs are stable)
