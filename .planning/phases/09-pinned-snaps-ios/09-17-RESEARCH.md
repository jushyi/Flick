# Phase 09, Plan 17: Stacked Pinned Snaps Live Activity - Research

**Researched:** 2026-03-19
**Domain:** ActivityKit ContentState updates, stacked Live Activity patterns, SwiftUI widget layout, expo-modules-core bridging
**Confidence:** HIGH

## Summary

This plan converts the current model of one-Live-Activity-per-pinned-snap into a single stacked Live Activity that accumulates multiple pinned snaps. The core mechanism is `activity.update(ActivityContent(state:staleDate:))` which replaces the existing empty ContentState with a populated one containing a `stack: [StackEntry]` array. The approach is well-supported by ActivityKit -- ContentState can contain arrays of Codable structs, and updates trigger automatic SwiftUI transitions (fade in/out for added/removed views, blur transitions for text changes).

The critical constraint is the **4KB ContentState payload limit**. Each StackEntry contains a snapActivityId, senderName, optional caption, and conversationId -- roughly 150-250 bytes per entry. A conservative cap of 10 entries (2.5KB worst case) stays well within limits while providing ample room.

**Primary recommendation:** Use a single Live Activity with an array-based ContentState. Update via `activity.update()` from the main app process. For push-delivered snaps when the app is killed, use APNS push updates (event: "update") sent to the activity's push token to add entries to the stack server-side. The NSE should only download thumbnails, not attempt activity updates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pin toggle on send confirmation screen, pixel-art pin icon with toggle switch
- Default off, sticky per friend (remembers last choice per conversation)
- Large photo thumbnail with Polaroid-style white frame
- Caption to the right if present; centered Polaroid only if no caption
- Flick dark background (#0A0A1A), monospaced font for text
- Each pinned snap currently creates its own Live Activity, cap of 5
- Live Activity persists until snap viewed, re-creates on swipe-away
- 48-hour auto-expiry via staleDate
- Viewing snap in SnapViewer calls endActivity

### Claude's Discretion
- Exact Polaroid frame dimensions within 160pt constraint
- Whether to fix mutableContent via Expo Push or switch to direct FCM for pinned snaps
- Exact implementation of foreground-resume fallback
- Thumbnail download retry/error handling details
- NSE diagnostic logging granularity
- How to deterministically derive tilt angle from activityId

### Deferred Ideas (OUT OF SCOPE)
- Custom notification sound for pinned snaps
- Dynamic Island expanded view (currently minimal/empty)
- Custom pixel font (Silkscreen) in widget
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ActivityKit | iOS 16.2+ (system) | Live Activity creation, update, end | Apple's only API for Live Activities |
| WidgetKit | iOS 16+ (system) | Widget rendering for lock screen | Required for Live Activity UI |
| SwiftUI | iOS 16+ (system) | Declarative widget layout | Only option for WidgetKit views |
| expo-modules-core | Project version | JS-to-Swift bridge | Already used for LiveActivityManagerModule |
| @bacons/apple-targets | Project version | Widget extension build target | Already configured for FlickLiveActivity target |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Foundation (Codable) | System | JSON encode/decode for ContentState | Auto-serialization of StackEntry arrays |
| FileManager | System | App Groups shared container I/O | Thumbnail storage/cleanup for multiple entries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single stacked activity | Multiple separate activities (current) | Separate activities hit the 5-activity cap fast; stacked is cleaner UX |
| In-app activity.update() | APNS push updates only | Push updates work for killed-app but in-app is faster and more reliable for foreground/background |
| Array in ContentState | UserDefaults in App Groups | ContentState is the canonical mechanism; UserDefaults adds a second source of truth |

## Architecture Patterns

### Recommended Data Model

```swift
// PinnedSnapAttributes.swift (must stay in sync across 3 copies)
struct PinnedSnapAttributes: ActivityAttributes {
    let activityId: String      // Stack ID (first snap's ID, or a fixed "pinned-stack")
    let deepLinkUrl: String     // Deep link to messages list

    struct ContentState: Codable, Hashable {
        var stack: [StackEntry]

        struct StackEntry: Codable, Hashable {
            let snapActivityId: String
            let senderName: String
            let caption: String?
            let conversationId: String
        }
    }

    // Backward compat: keep for single-snap rendering
    let senderName: String
    let caption: String?
}
```

**Key design choice:** Keep `senderName` and `caption` on the attributes for backward compatibility and for the initial creation case. The widget checks `context.state.stack.count` to decide between single and stacked layout.

### Update Flow Pattern

```swift
// Finding and updating the existing activity
func addToStack(newEntry: StackEntry) async throws {
    let activities = Activity<PinnedSnapAttributes>.activities

    if let existing = activities.first {
        // Append to existing stack
        var updatedStack = existing.content.state.stack
        updatedStack.insert(newEntry, at: 0)  // Newest first

        let newState = PinnedSnapAttributes.ContentState(stack: updatedStack)
        let content = ActivityContent(
            state: newState,
            staleDate: Date().addingTimeInterval(48 * 60 * 60)
        )
        await existing.update(content)
    } else {
        // Create new activity with single-entry stack
        let state = PinnedSnapAttributes.ContentState(stack: [newEntry])
        // ... Activity.request(attributes:content:pushType:)
    }
}
```

### Stacked Widget Layout Pattern

```swift
// ZStack with offset for overlapping Polaroids
ZStack {
    ForEach(Array(visibleEntries.enumerated().reversed()), id: \.element.snapActivityId) { index, entry in
        polaroidFrame(activityId: entry.snapActivityId)
            .rotationEffect(.degrees(tiltDegrees(for: entry.snapActivityId)))
            .offset(x: CGFloat(index) * 4, y: CGFloat(index) * 3)
    }
}
```

### Anti-Patterns to Avoid
- **Creating multiple activities when stacking is possible:** Wastes the 5-activity system cap and clutters the lock screen.
- **Storing stack state only in JS memory:** The native Swift side must be the source of truth since the NSE and push updates also modify the stack.
- **Attempting Activity.request() or activity.update() from the NSE:** Activity.request() is confirmed to fail in NSE. activity.update() is equally restricted -- use APNS push updates for killed-app scenarios instead.
- **Using large thumbnails in ContentState:** Never put image data in ContentState. Always use App Groups file paths. The widget loads images from disk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ContentState serialization | Manual JSON encoding | Swift Codable conformance | Auto-handles arrays, nested structs, optionals |
| Widget update animation | Custom animation code | System's built-in transitions | Apple ignores custom animations in widgets; system does fade/blur automatically |
| Stack state synchronization | Custom sync protocol | ActivityKit's content.state as source of truth | The activity's current ContentState is always readable via activity.content.state |
| Push updates to activity | Custom socket/polling | APNS push with event: "update" | Apple's canonical mechanism, works when app is killed |
| Complex parameter passing JS->Swift | Manual JSON string parsing | expo-modules-core Record types | Auto-validates and converts JS objects to Swift structs |

## Common Pitfalls

### Pitfall 1: ContentState 4KB Limit
**What goes wrong:** Adding too many entries or including too much data per entry causes updates to silently fail.
**Why it happens:** Apple enforces a hard 4KB limit on ContentState payload. No error is thrown -- the update just doesn't apply.
**How to avoid:** Cap stack at 10 entries. Keep StackEntry fields minimal (IDs and short strings). Never include image data, base64 strings, or long URLs in ContentState.
**Warning signs:** Stack updates stop appearing on the lock screen despite no errors in logs.

### Pitfall 2: Three PinnedSnapAttributes Copies
**What goes wrong:** Changing the struct in one location but not the other two causes build failures or runtime decode errors.
**Why it happens:** The project has PinnedSnapAttributes in three places: widget target, NSE target, and native module. They must be byte-identical.
**How to avoid:** After any change, copy the file to all three locations. Consider a build script or symlink (though @bacons/apple-targets may not support symlinks).
**Warning signs:** "Failed to decode ContentState" errors, widget showing stale data.

### Pitfall 3: Race Between Update and End
**What goes wrong:** If a user views a snap (triggering removeFromStack/end) at the same moment a new pinned snap arrives (triggering addToStack/update), the operations can race.
**Why it happens:** Both operations read the current stack, modify it, then write back. No built-in mutex in ActivityKit.
**How to avoid:** Serialize all stack mutations through a single async actor or dispatch queue in the native module. Never allow concurrent reads followed by writes.
**Warning signs:** Entries appearing/disappearing incorrectly, phantom entries in the stack.

### Pitfall 4: Widget Not Re-Reading Thumbnails After Update
**What goes wrong:** A new thumbnail is saved to App Groups, ContentState is updated, but the widget still shows the fallback "F" placeholder.
**Why it happens:** The widget re-renders on ContentState change, but if the thumbnail file write hasn't completed by the time the widget reads it, the file won't be found.
**How to avoid:** Always write the thumbnail to App Groups BEFORE calling activity.update(). The widget's `loadThumbnail()` reads synchronously from disk on each render, so the file must exist when the render happens.
**Warning signs:** New stack entries show "F" placeholder instead of photo.

### Pitfall 5: Push-to-Start Token Cannot Update Existing Activities
**What goes wrong:** Trying to send an APNS "update" event to the push-to-start token fails.
**Why it happens:** Push-to-start tokens are exclusively for starting new activities. Only per-activity push tokens (obtained after creation) can receive update/end events.
**How to avoid:** After creating an activity (whether locally or via push-to-start), observe `activity.pushTokenUpdates` and store the per-activity push token on the server. Use that token for subsequent APNS updates.
**Warning signs:** Push updates silently fail, activity never changes after initial creation.

### Pitfall 6: NSE Cannot Call activity.update()
**What goes wrong:** Attempting to call `Activity.update()` from the Notification Service Extension fails silently or crashes.
**Why it happens:** NSE runs in a separate extension process with limited API access. Both `Activity.request()` and `activity.update()` are restricted to the main app process.
**How to avoid:** The NSE should ONLY download thumbnails to App Groups. For updating the stack when the app is killed, use APNS push updates sent directly from the server to the activity's push token.
**Warning signs:** NSE diagnostic logs show update attempts with no effect.

## Code Examples

### Updating an Existing Activity's ContentState (Swift)

```swift
// Source: Apple ActivityKit documentation - activity.update(_:)
// The update replaces the entire ContentState atomically
let updatedState = PinnedSnapAttributes.ContentState(
    stack: [newEntry] + existingStack
)
let content = ActivityContent(
    state: updatedState,
    staleDate: Date().addingTimeInterval(48 * 60 * 60)
)
await activity.update(content)
```

### expo-modules-core Record for Stack Entry (Swift)

```swift
// Source: Expo Modules API docs - Record type
struct StackEntryRecord: Record {
    @Field var snapActivityId: String = ""
    @Field var senderName: String = ""
    @Field var caption: String? = nil
    @Field var conversationId: String = ""
}

// In module definition:
AsyncFunction("updateStack") { (stack: [StackEntryRecord]) in
    // Each JS object in the array is auto-converted to StackEntryRecord
    let entries = stack.map { record in
        PinnedSnapAttributes.ContentState.StackEntry(
            snapActivityId: record.snapActivityId,
            senderName: record.senderName,
            caption: record.caption,
            conversationId: record.conversationId
        )
    }
    // ... find activity and update
}
```

### APNS Push Update Payload for Stack

```json
{
    "aps": {
        "timestamp": 1710849600,
        "event": "update",
        "content-state": {
            "stack": [
                {
                    "snapActivityId": "snap-new-123",
                    "senderName": "Alice",
                    "caption": "Look at this!",
                    "conversationId": "conv-456"
                },
                {
                    "snapActivityId": "snap-old-789",
                    "senderName": "Bob",
                    "caption": null,
                    "conversationId": "conv-012"
                }
            ]
        }
    }
}
```

**APNS headers required:**
- `apns-push-type: liveactivity`
- `apns-topic: com.spoodsjs.flick.push-type.liveactivity`
- Target: per-activity push token (NOT push-to-start token)

### ZStack Stacked Polaroids (SwiftUI)

```swift
// Lock screen widget - stacked mode
let visibleEntries = Array(context.state.stack.prefix(3))

ZStack(alignment: .topLeading) {
    // Render back-to-front: last visible entry is on top
    ForEach(Array(visibleEntries.enumerated().reversed()), id: \.offset) { index, entry in
        polaroidFrame(activityId: entry.snapActivityId)
            .rotationEffect(.degrees(Self.tiltDegrees(for: entry.snapActivityId)))
            .offset(x: CGFloat(index) * 4, y: CGFloat(index) * 3)
    }
}

// Count badge if more than 3
if context.state.stack.count > 3 {
    Text("+\(context.state.stack.count - 3)")
        .font(.system(size: 10, weight: .bold, design: .monospaced))
        .foregroundColor(.white)
        .padding(.horizontal, 4)
        .padding(.vertical, 2)
        .background(Color.red.opacity(0.8))
        .clipShape(Capsule())
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One activity per event | Single stacked activity with array ContentState | ActivityKit pattern since iOS 16.2 | Avoids 5-activity cap, cleaner UX |
| Main app only updates | APNS push updates (event: "update") | iOS 16.1+ | Updates work when app is killed |
| Push-to-start only starts | Push-to-start + per-activity push token for updates | iOS 17.2+ | Full lifecycle management via push |
| NSE starts activities | NSE downloads thumbnails only; push-to-start handles creation | iOS 17.2+ / project learning | NSE cannot reliably call Activity.request() |

## Open Questions

1. **Per-Activity Push Token Storage**
   - What we know: After an activity is created (locally or via push-to-start), you observe `activity.pushTokenUpdates` to get a per-activity push token. This token is needed for server-sent APNS update/end events.
   - What's unclear: Where to store this token (user document? subcollection?). The token changes over the activity's lifetime and must be synced to the server.
   - Recommendation: Store in `users/{uid}/liveActivityPushToken` field. Re-sync on every token update. 09-16 (push-to-start) should set up the observation pattern; 09-17 reuses it.

2. **Server-Side Stack Management for Push Updates**
   - What we know: When sending a push update, the server must include the FULL current stack in content-state (not just the new entry). ActivityKit replaces the entire ContentState atomically.
   - What's unclear: Does the server need to track the current stack state? Or can it read from a Firestore document?
   - Recommendation: Maintain a `liveActivityStack` array in Firestore under `users/{recipientUid}`. Cloud Functions update this array when pinned snaps are sent/viewed, and include the full array in APNS push payloads.

3. **Persistence Re-creation with Stack**
   - What we know: Current implementation re-creates activities on swipe-away using `observeActivityState`. With stacking, re-creation must preserve the full stack.
   - What's unclear: Does the observation loop need to store the latest ContentState, or can it read from the existing activity before it's fully dismissed?
   - Recommendation: Store the latest stack state in the `persistentActivities` dictionary (change type from `[String: PinnedSnapAttributes]` to include both attributes and last-known state).

4. **Animation When Stack Grows/Shrinks**
   - What we know: SwiftUI automatically fades in new views and fades out removed views in Live Activities. Text uses blur transitions.
   - What's unclear: Exact visual effect when a Polaroid is added to or removed from the ZStack. Cannot test without a device build.
   - Recommendation: Implement with default transitions first. Add `.transition(.opacity)` or `.transition(.scale)` modifiers if the default behavior is too abrupt. Test on device.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | package.json (jest section) |
| Quick run command | `npm test -- __tests__/services/liveActivityService.test.js` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STACK-01 | Stack array in ContentState encodes/decodes correctly | unit | `npm test -- __tests__/services/liveActivityService.test.js` | Needs update |
| STACK-02 | startPinnedSnapActivity checks for existing activity and updates | unit | `npm test -- __tests__/services/liveActivityService.test.js` | Needs update |
| STACK-03 | removePinnedSnap removes entry and ends if empty | unit | `npm test -- __tests__/services/liveActivityService.test.js` | Needs update |
| STACK-04 | Widget renders stacked Polaroids for stack.count > 1 | manual-only | Device build + visual inspection | N/A |
| STACK-05 | Push update adds to stack when app is killed | manual-only | Device build + kill app + send pin | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- __tests__/services/liveActivityService.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + device visual test

### Wave 0 Gaps
- [ ] Update `__tests__/services/liveActivityService.test.js` to cover new `updateStack` and `removePinnedSnap` methods
- [ ] Add mock for `getActiveActivityIds` returning stack info

## Sources

### Primary (HIGH confidence)
- [Apple ActivityKit documentation](https://developer.apple.com/documentation/activitykit) - Activity.update(), ContentState, concurrent limits
- [Apple "Starting and updating Live Activities with ActivityKit push notifications"](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications) - Push update payload format, push-to-start vs activity tokens
- [Expo Modules API Reference](https://docs.expo.dev/modules/module-api/) - Record types, AsyncFunction parameter types, array passing
- [APNsPush guide](https://apnspush.com/how-to-start-and-update-live-activities-with-push-notifications) - Verified APNS payload format, headers, token types

### Secondary (MEDIUM confidence)
- [Pushwoosh iOS 18 Live Activities guide](https://www.pushwoosh.com/blog/ios-live-activities/) - Confirmed 5-activity concurrent limit per app
- [Apple WWDC23 "Update Live Activities with push notifications"](https://developer.apple.com/videos/play/wwdc2023/10185/) - Push update event types, content-state format
- [Apple WWDC23 "Meet ActivityKit"](https://developer.apple.com/videos/play/wwdc2023/10184/) - ContentState design, update patterns

### Tertiary (LOW confidence)
- NSE restriction on activity.update() - Inferred from confirmed Activity.request() failure in NSE (project diagnostic evidence) + Apple's general extension process restrictions. Not explicitly documented by Apple for update() specifically.
- Widget re-reading files on ContentState change - Inferred from SwiftUI rendering model (views rebuild on state change, loadThumbnail() is called each render). Not explicitly documented.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies + system frameworks
- Architecture (ContentState arrays): HIGH - Codable arrays are well-documented, 4KB limit confirmed by multiple sources
- Architecture (push updates): HIGH - APNS update payload format verified from Apple docs and third-party guides
- Pitfalls (NSE restrictions): MEDIUM - Activity.request() failure confirmed by project diagnostics; activity.update() restriction inferred
- Widget layout (ZStack stacking): MEDIUM - Standard SwiftUI pattern, but visual result in 160pt Live Activity constraint needs device testing
- expo-modules-core Records: HIGH - Documentation confirms array-of-Record parameter support

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable APIs, no expected changes)
