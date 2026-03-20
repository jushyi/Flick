---
phase: 09-pinned-snaps-ios
verified: 2026-03-20T18:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Push-to-start payload content-state now matches PinnedSnapAttributes.ContentState struct (stack array with StackEntry)"
    - "removeFromStack exported from TypeScript bridge — 'removeFromStack is not a function' crash fixed"
    - "NSE suppression hardened: explicit sound=nil, badge=0, empty title/body/subtitle"
    - "ConversationScreen derives friendId from conversationId when deep-linked — 'Unknown User' display fixed"
    - "Stacked Live Activity layout stripped to only overlapping Polaroid photos, no count badge or sender summary text"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Pin toggle appears and persists across app restarts"
    expected: "Toggling pin on the SnapPreviewScreen before sending a snap to a friend persists preference; next snap to same friend remembers the setting"
    why_human: "usePinPreference hook uses AsyncStorage — preference persistence requires real device or E2E test"
  - test: "Recipient sees Live Activity on iOS lock screen with thumbnail, sender name, and caption"
    expected: "After sender sends a pinned snap, recipient's lock screen shows a Polaroid-style Live Activity with the photo thumbnail, sender display name, and optional caption text within a few seconds"
    why_human: "Live Activity creation requires ActivityKit on a physical iOS 16.2+ device; cannot be verified in simulator"
  - test: "Tapping the Live Activity opens the conversation with correct friend info"
    expected: "Tapping the lock screen Live Activity navigates directly to the correct Conversation screen; friend name and profile photo display correctly (not 'Unknown User')"
    why_human: "Deep link behavior and friendId derivation require physical device and app launch flow. The derivation logic is code-verified but runtime behavior needs device confirmation."
  - test: "Tapping stacked Live Activity opens messages list"
    expected: "When 2+ snaps are stacked, tapping the Live Activity navigates to the messages list (MessagesList screen), not a specific conversation"
    why_human: "widgetURL(URL(string: 'lapse://messages')) behavior requires physical device — widgetURL in widget may still be overridden by attributes.deepLinkUrl in edge cases"
  - test: "Live Activity disappears after recipient views the snap"
    expected: "When the recipient opens the snap in SnapViewer, the Live Activity is removed from the lock screen (removePinnedSnap calls removeFromStack via the now-exported TypeScript bridge)"
    why_human: "Requires physical device with a real pinned snap to observe Live Activity dismissal behavior end-to-end"
  - test: "Push-to-start creates Live Activity on killed app (iOS 17.2+)"
    expected: "On a device running iOS 17.2+ with app killed, receiving a pinned snap creates the Live Activity directly from push payload (fixed content-state with stack array)"
    why_human: "Requires iOS 17.2+ device, pushToStartToken in Firestore, and new native build. Content-state fix is code-verified but runtime acceptance by iOS cannot be confirmed without device."
  - test: "Live Activity auto-expires after 48 hours if never viewed"
    expected: "Unviewed pinned snaps trigger server-side expiry via expirePinnedSnapNotifications scheduled function AND native staleDate expires the Live Activity UI"
    why_human: "Time-based behavior cannot be fast-forwarded programmatically"
---

# Phase 9: Pinned Snaps iOS Verification Report

**Phase Goal:** Deliver the complete pinned snaps feature for iOS — pin toggle on send, persistent lock-screen Live Activity, deep link to conversation on tap, dismiss on snap view.
**Verified:** 2026-03-20T18:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure plans 09-19 and 09-20

## Re-Verification Summary

Plans 09-19 and 09-20 shipped three commits (`5dd3cf24`, `8dbc7f8a`, `f2cff384`) addressing all five UAT issues identified during testing. All five gap items are closed at the code level. The status remains `human_needed` because the feature is fundamentally a native iOS capability (ActivityKit, push-to-start, Live Activities) that cannot be verified without a physical iOS device.

### Gaps Closed

| UAT Issue | Severity | Fix | Commit |
|-----------|----------|-----|--------|
| Empty content-state in push-to-start payload | Blocker | Added `stack: [{ snapActivityId, senderName, caption, conversationId }]` to `liveActivitySender.js` | `5dd3cf24` |
| `removeFromStack is not a function` crash | Blocker | Added `removeFromStack`, `getActiveActivityIds`, `observePushToStartToken` to `modules/live-activity-manager/index.ts` interface and exports | `5dd3cf24` |
| NSE banner not suppressed when Live Activity works | Major | Explicit `sound = nil`, `badge = 0`, empty title/body/subtitle in `NotificationService.swift` | `8dbc7f8a` |
| Deep link shows "Unknown User" | Major | `ConversationScreen.js` derives `friendId` from `conversationId.split('_')` when param missing | `5dd3cf24` |
| Stacked layout shows count badge and sender text | Cosmetic | Replaced stacked layout VStack with centered Polaroid ZStack only in `FlickLiveActivityWidget.swift` | `f2cff384` |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When composing a snap, the sender can toggle a "pin to screen" option | VERIFIED | `PinToggle` component in `SnapPreviewScreen.js:282`; `usePinPreference` hook persists via AsyncStorage; `pinToScreen` flag passed to `snapService.sendSnap` |
| 2 | Recipient sees Live Activity with thumbnail, sender name, optional caption | VERIFIED | `FlickLiveActivityWidget.swift` implements `singleSnapLayout` and `stackedLayout` with Polaroid frame; thumbnail loaded from App Groups container; NSE fallback in `NotificationService.swift`; push-to-start payload corrected in `liveActivitySender.js` |
| 3 | Tapping the Live Activity opens the app to the conversation (with correct user info) | VERIFIED | Single snap: `widgetURL(URL(string: "lapse://messages/\(entry?.conversationId ?? "")"))` at line 102; stacked: `lapse://messages` at line 142; `ConversationScreen.js:63-70` derives `friendId` from `conversationId.split('_')` when missing |
| 4 | After recipient views the snap, the Live Activity disappears | VERIFIED | `SnapViewer.js:223` calls `removePinnedSnap(snapMessage.id)`; `liveActivityService.js:113` calls `LiveActivityManager.removeFromStack(snapActivityId)`; `removeFromStack` now exported from `index.ts:126-129` |
| 5 | Live Activity auto-expires after 48 hours if never viewed | VERIFIED | `staleDate = expiryInterval` on all `Activity.request()` calls; `expirePinnedSnapNotifications` server function; `expiryInterval = 48 * 60 * 60` in `NotificationService.swift:32` |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `modules/live-activity-manager/index.ts` | TypeScript bridge with all native exports | VERIFIED | 149 lines; `removeFromStack`, `getActiveActivityIds`, `observePushToStartToken` now exported alongside existing functions |
| `modules/live-activity-manager/src/LiveActivityManagerModule.swift` | ActivityKit bridge with start/end/stack ops | VERIFIED | `removeFromStack` AsyncFunction defined at native level |
| `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` | SwiftUI Live Activity layout | VERIFIED | 231 lines; `singleSnapLayout` with Polaroid + caption; `stackedLayout` with centered Polaroids only (text removed); correct `widgetURL` per layout |
| `targets/FlickLiveActivity/PinnedSnapAttributes.swift` | ActivityAttributes struct | VERIFIED | ContentState.stack array with StackEntry struct |
| `targets/FlickNotificationService/NotificationService.swift` | NSE with Live Activity creation and hardened suppression | VERIFIED | `sound = nil`, `badge = 0`, empty title/body/subtitle in suppression block (lines 283-290) |
| `functions/notifications/liveActivitySender.js` | Push-to-start with correct content-state | VERIFIED | Lines 44-53: `content-state: { stack: [{ snapActivityId, senderName, caption, conversationId }] }` — matches `PinnedSnapAttributes.ContentState` |
| `src/services/liveActivityService.js` | JS bridge for all Live Activity operations | VERIFIED | `removePinnedSnap` at line 107 calls `LiveActivityManager.removeFromStack` |
| `src/components/PinToggle.js` | Pin toggle UI component | VERIFIED | Imported and rendered in `SnapPreviewScreen` |
| `src/hooks/usePinPreference.js` | Hook managing pin preference per friend | VERIFIED | Used in `SnapPreviewScreen` |
| `src/services/firebase/snapService.js` | Sends snap with pinned flag | VERIFIED | `pinToScreen` flag propagated; `pinnedActivityId` and `pinnedThumbnailUrl` set in message data |
| `src/components/SnapViewer.js` | Calls removePinnedSnap when snap is viewed | VERIFIED | Line 51: import; line 223: `await removePinnedSnap(snapMessage.id \|\| snapMessage.pinnedActivityId)` |
| `src/screens/ConversationScreen.js` | Derives friendId from conversationId for deep links | VERIFIED | Lines 62-70: `paramFriendId`, `derivedFriendId` with `conversationId.split('_')` logic; `const friendId = derivedFriendId` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SnapPreviewScreen.js` | `snapService.sendSnap()` | `pinToScreen: pinEnabled && isOneOnOne` | WIRED | `pinToScreen` flag passed; snapService sets `pinned: true` in message data |
| `liveActivitySender.js` | APNS push-to-start | `content-state: { stack: [StackEntry] }` | WIRED | Lines 44-53: stack array with all four StackEntry fields matching Swift Codable struct |
| `modules/live-activity-manager/index.ts` | `LiveActivityManagerModule.swift` | `removeFromStack` TypeScript export | WIRED | Interface at line 20; exported function at lines 126-129 |
| `liveActivityService.js` | `modules/live-activity-manager/index.ts` | `LiveActivityManager.removeFromStack(snapActivityId)` | WIRED | Line 113 in `removePinnedSnap` function |
| `SnapViewer.js` | `liveActivityService.removePinnedSnap` | Import at line 51, call at line 223 | WIRED | Correct function used (not deprecated `endPinnedSnapActivity`) |
| `FlickLiveActivityWidget.swift` | App Groups shared container | `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` | WIRED | `loadThumbnail()` reads `group.com.spoodsjs.flick/thumbnails/{activityId}.jpg` |
| `FlickLiveActivityWidget.swift` singleSnapLayout | `lapse://messages/{conversationId}` | `widgetURL(URL(string: "lapse://messages/\(entry?.conversationId ?? "")"))` | WIRED | Line 102 |
| `FlickLiveActivityWidget.swift` stackedLayout | `lapse://messages` | `widgetURL(URL(string: "lapse://messages"))` | WIRED | Line 142; no VStack or text present — clean Polaroid ZStack only |
| `ConversationScreen.js` | Firestore users collection | `friendId` derived from `conversationId.split('_')` then fetched via `getDoc` | WIRED | Lines 63-80; `useEffect` at line 74 fetches profile when `friendId` is resolved |
| `App.js` | `liveActivityService.registerPushToStartToken` | Import at line 48, call at line 327 | WIRED | iOS-guarded; called once per auth session |
| `NotificationService.swift` suppression | Silent notification | `silentContent.sound = nil; silentContent.badge = 0; silentContent.title = ""` | WIRED | Lines 283-290; explicit on all five UNMutableNotificationContent fields |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| PINI-01 | 09-02, 09-03, 09-17, 09-20 | Sender can toggle "pin to screen" when sending a snap | SATISFIED | `PinToggle` + `usePinPreference` in `SnapPreviewScreen`; `pinToScreen` flag to `snapService` |
| PINI-02 | 09-01, 09-04, 09-16, 09-17, 09-18, 09-19 | Recipient sees Live Activity with thumbnail, sender name, optional caption | SATISFIED | `FlickLiveActivityWidget.swift` Polaroid layout; App Groups thumbnail sharing; push-to-start payload fixed (stack array in content-state); NSE fallback with hardened suppression |
| PINI-03 | 09-03, 09-04, 09-17, 09-20 | Tapping the Live Activity opens the conversation | SATISFIED | `widgetURL` in widget; `ConversationScreen` derives `friendId` from `conversationId` when deep-linked; `AppNavigator.js` line 305 maps `messages/:conversationId` |
| PINI-04 | 09-04, 09-16, 09-17, 09-19 | Live Activity disappears after recipient views the snap | SATISFIED | `SnapViewer.js:223` calls `removePinnedSnap`; `liveActivityService.js:113` calls `LiveActivityManager.removeFromStack`; `removeFromStack` now exported from TypeScript bridge (fixes previous crash) |
| PINI-05 | 09-01, 09-13, 09-17 | Live Activity auto-expires after 48 hours if snap is never viewed | SATISFIED | `staleDate` = 48h on all `Activity.request()` calls; `expirePinnedSnapNotifications` server function |

All 5 required requirements (PINI-01 through PINI-05) are covered. PINI-06 (push-to-start as v2 requirement) and PINI-07 (Darkroom countdown Live Activity) are defined as v2 stretch goals in REQUIREMENTS.md and are out of scope for Phase 9.

No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/liveActivityService.js` | 50-54 | `'liveActivityService: DEBUG module check'` — verbose info log enumerating module keys on every `startPinnedSnapActivity` call | Info | Production logging noise; non-blocking; pre-existing from initial implementation |

No new anti-patterns introduced in plans 09-19 or 09-20. No blockers found.

---

### Human Verification Required

#### 1. Pin Toggle Persists Per Friend

**Test:** Open the app, navigate to send a snap to friend A, toggle the pin option ON, send the snap. Exit to home, return to send another snap to friend A, then send a snap to friend B.
**Expected:** The pin toggle is still ON for friend A. Friend B starts with the default (off). Toggle state is independent per friend.
**Why human:** `usePinPreference` persists via AsyncStorage — requires real device across multiple send flows.

#### 2. Live Activity Appears on Recipient Lock Screen

**Test:** Send a pinned snap from Device A (iOS 16.2+) to Device B (iOS 16.2+). Lock Device B's screen.
**Expected:** Within a few seconds, a Polaroid-style Live Activity appears on Device B's lock screen showing the snap thumbnail, sender's display name, and caption (if any) on a dark (#0A0A1A) background.
**Why human:** ActivityKit and Live Activities require a physical iOS device.

#### 3. Tap Single Snap Live Activity Opens Conversation with Correct User Info

**Test:** On Device B's lock screen, tap the single-snap Live Activity.
**Expected:** The app opens directly to the Conversation screen. The friend's display name and profile photo appear correctly — not "Unknown User" or a blank avatar.
**Why human:** Deep link navigation plus `friendId` derivation from `conversationId.split('_')` requires physical device app launch. The derivation logic is code-verified but runtime correctness depends on conversation ID format in production data.

#### 4. Tap Stacked Live Activity Opens Messages List

**Test:** Receive 2+ pinned snaps from different friends. Tap the stacked Live Activity (overlapping Polaroids with no text).
**Expected:** The app opens to the messages list (all conversations), not a specific conversation.
**Why human:** `widgetURL(URL(string: "lapse://messages"))` is code-verified; runtime routing requires device.

#### 5. Snap Viewing Dismisses Live Activity

**Test:** On Device B, open a conversation with a pinned snap and view the snap.
**Expected:** After viewing the snap, the Live Activity disappears from the lock screen immediately (the previously-crashing `removeFromStack` export is now present).
**Why human:** Requires end-to-end flow on device: snap viewing → `removePinnedSnap` → `LiveActivityManager.removeFromStack` → ActivityKit dismissal.

#### 6. Push-to-Start Creates Live Activity on Killed App (iOS 17.2+)

**Test:** On Device B running iOS 17.2+, verify `pushToStartToken` field is present in the user's Firestore document. Force-quit the app. From Device A, send a pinned snap.
**Expected:** The Live Activity appears on Device B's lock screen without the recipient ever launching the app. Check Cloud Function logs for successful `sendPushToStartLiveActivity` call.
**Why human:** Requires iOS 17.2+ device, Firestore token verification, Cloud Function deployment of updated `liveActivitySender.js`, and new native build. Content-state payload fix is code-verified but iOS acceptance requires runtime observation.

#### 7. 48-Hour Auto-Expiry

**Test:** Send a pinned snap, do not view it on the recipient device for 48 hours.
**Expected:** The Live Activity disappears from lock screen automatically after 48 hours. Firestore shows the snap as expired.
**Why human:** Time-based behavior requiring 48-hour wait or time manipulation.

---

### Deployment Checklist

The following deployment steps are required before human verification can be completed:

| Step | Type | Action |
|------|------|--------|
| Deploy Cloud Functions | Server | `firebase deploy --only functions` — picks up `liveActivitySender.js` push-to-start fix |
| Native build | iOS | New EAS production build required — `index.ts`, `NotificationService.swift`, and `FlickLiveActivityWidget.swift` contain native changes not deployable via OTA |
| OTA update | iOS | `eas update --branch production --platform ios` — picks up `ConversationScreen.js` and `liveActivityService.js` changes |

---

*Verified: 2026-03-20T18:00:00Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification: Yes — after gap closure plans 09-19 and 09-20*
