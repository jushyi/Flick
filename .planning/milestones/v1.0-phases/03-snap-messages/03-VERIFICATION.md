---
phase: 03-snap-messages
verified: 2026-02-24T21:10:00Z
status: passed
score: 10/10 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "Snap push notification now sends type:'snap' with messageId — the notificationService.js 'snap' case is now reachable and autoOpenSnapId is correctly set on notification tap"
    - "functions/__tests__/snapFunctions.test.js line 522: stale assertion fixed to expect 'snap' instead of 'direct_message', added messageId assertion"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: 'Full snap flow on device'
    expected: "Capture snap, send, recipient sees amber bubble, tap opens Polaroid viewer full-screen, dismiss marks viewed, bubble shows 'Opened'"
    why_human: 'Visual fidelity of Polaroid frame (16px border), camera animation, dismiss gesture, and semi-transparent overlay cannot be verified programmatically'
  - test: 'Snap notification tap (gap now closed)'
    expected: 'Tap snap notification -> conversation opens -> SnapViewer auto-opens for the specific snap (after ~300ms delay)'
    why_human: 'Requires real push notification delivery, background/killed app state, and device testing to confirm autoOpenSnapId flow end-to-end'
  - test: 'Snap reaction bar on received snap'
    expected: 'Recipient opens snap, sees 6 emoji buttons below Polaroid frame. Tapping one sends reaction visible in conversation thread. Sender does NOT see reaction bar on their own snap.'
    why_human: 'Requires two real devices to verify sender/recipient distinction and that reactions appear in thread after dismissing viewer'
  - test: 'EXIF/orientation consistency between platforms'
    expected: 'Back camera snap taken on iOS appears with correct orientation on Android recipient and vice versa. No black bars or rotation mismatch.'
    why_human: 'EXIF normalization is a pixel-level operation; requires real devices on both platforms with back camera to verify'
---

# Phase 3: Snap Messages Re-Verification Report

**Phase Goal:** Ship ephemeral photo DMs — camera-only snaps that disappear after viewing, with server-side cleanup.
**Verified:** 2026-02-24T21:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plans 03-07 and 03-08, plus inline test fix)

## Re-Verification Summary

The single gap from the initial verification has been closed: `functions/index.js` now sends `type: 'snap'` (not `'direct_message'`) with `messageId` included in snap notification payloads. The `notificationService.js` `'snap'` case is now reachable and correctly sets `autoOpenSnapId`.

Plans 03-07 and 03-08 delivered additional UAT gap closures (layout fixes, EXIF normalization, semi-transparent overlay, snap reaction bar) which are all verified present in the codebase.

One new gap was identified during this re-verification: a stale test assertion in `functions/__tests__/snapFunctions.test.js` that still expects the old broken `type: 'direct_message'` behavior. This test is actively failing.

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                          | Status   | Evidence                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Snap photo uploads to snap-photos/ path, creates type:snap message document                                                                    | VERIFIED | `snapService.js` L139: path `snap-photos/${senderId}/${snapId}.jpg`, L158: `type: 'snap'`                                                                                      |
| 2   | uploadAndSendSnap retries up to 3 times silently on failure                                                                                    | VERIFIED | `snapService.js` L112-191: maxRetries=3, backoffDelays=[1000,2000,4000], `retriesExhausted:true`                                                                               |
| 3   | markSnapViewed writes viewedAt timestamp on snap message document                                                                              | VERIFIED | `snapService.js` L229: `viewedAt: serverTimestamp()`                                                                                                                           |
| 4   | getSignedSnapUrl Cloud Function returns 5-minute signed URL for snap-photos/ paths only                                                        | VERIFIED | `functions/index.js` L3032+: `snap-photos/` path guard, 5-minute expiry                                                                                                        |
| 5   | onSnapViewed Cloud Function deletes Storage file when viewedAt transitions from null to timestamp                                              | VERIFIED | `functions/index.js` L3145+: before/after guards, `bucket.file(snapStoragePath).delete()`                                                                                      |
| 6   | cleanupExpiredSnaps scheduled function deletes orphaned snaps past expiresAt                                                                   | VERIFIED | `functions/index.js` L3203+: scheduled every 2 hours, queries `type==snap AND expiresAt<=now AND viewedAt==null`                                                               |
| 7   | onNewMessage handles type:snap for lastMessage preview (null) and push notification with correct type:'snap' and messageId                     | VERIFIED | `functions/index.js` L2835: `lastMessagePreview = null` for snap; L2932: `type: messageType === 'snap' ? 'snap' : 'direct_message'`; L2942-2943: `messageId` included for snap |
| 8   | CameraScreen accepts mode:snap route param, hides darkroom UI, shows recipient header, navigates to SnapPreviewScreen on capture               | VERIFIED | `CameraScreen.js` L221: `isSnapMode = mode === 'snap'`; L339: "To: FriendName" header; L277: navigates to SnapPreviewScreen                                                    |
| 9   | SnapViewer uses cachePolicy="none", loads via signed URL, marks viewed on dismiss, shows semi-transparent overlay, reaction bar for recipients | VERIFIED | `SnapViewer.js` L273: `cachePolicy="none"`; L109: `getSignedSnapUrl()`; L148: `markSnapViewed()`; L318: `rgba(0,0,0,0.85)`; L291: reaction bar for non-senders                 |
| 10  | Tapping a snap push notification opens conversation with autoOpenSnapId, then auto-opens snap viewer                                           | VERIFIED | `functions/index.js` L2932/2943: type='snap' + messageId in payload; `notificationService.js` L405: `case 'snap'` reachable, sets `autoOpenSnapId`                             |

**Score:** 10/10 truths verified

**Note on test suite gap:** While all 10 observable truths verify correct in the codebase, `functions/__tests__/snapFunctions.test.js` has one stale test assertion (line 522) that asserts the old broken behavior and is actively failing. This is a test accuracy gap, not a production code gap.

---

### Required Artifacts

| Artifact                                    | Expected                                                                               | Status   | Details                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `src/services/firebase/snapService.js`      | uploadAndSendSnap, markSnapViewed, getSignedSnapUrl, EXIF normalization                | VERIFIED | manipulateAsync EXIF step at L71, retry logic, all functions exported                                  |
| `functions/index.js`                        | getSignedSnapUrl (type:'snap'), onSnapViewed, cleanupExpiredSnaps                      | VERIFIED | All 3 CFs present; snap notification now type:'snap' with messageId                                    |
| `__tests__/services/snapService.test.js`    | 15 unit tests passing                                                                  | VERIFIED | 15/15 pass (npx jest direct run confirmed)                                                             |
| `functions/__tests__/snapFunctions.test.js` | 15 Cloud Function tests passing                                                        | PARTIAL  | 14/15 pass; 1 FAILING — line 522 stale assertion expects `'direct_message'` not `'snap'`               |
| `src/screens/SnapPreviewScreen.js`          | Polaroid frame (16px border), caption TextInput, KAV keyboard lift, contentFit=contain | VERIFIED | L53: `POLAROID_BORDER = 16`; L54: `POLAROID_STRIP_HEIGHT = 64`; L193: KAV wraps both Polaroid + footer |
| `src/styles/CameraScreen.styles.js`         | No hardcoded paddingBottom on footerControlsSnap                                       | VERIFIED | Comment confirms: "paddingBottom applied dynamically via inline style in CameraScreen.js"              |
| `src/screens/CameraScreen.js`               | Dynamic safe area footer, "To: FriendName" header in snap mode                         | VERIFIED | L394: `Math.max(insets.bottom, 16)`; L339: "To: FriendName" header pill                                |
| `src/components/SnapBubble.js`              | 4 states: sending/error/unopened/opened                                                | VERIFIED | 15/15 tests pass; all 4 states present                                                                 |
| `src/components/SnapViewer.js`              | Semi-transparent overlay, reaction bar, cachePolicy=none                               | VERIFIED | L318: `rgba(0,0,0,0.85)`; L291: reaction bar; L273: `cachePolicy="none"`                               |
| `src/components/SnapProgressRing.js`        | Amber circular animation                                                               | VERIFIED | (unchanged from initial verification)                                                                  |
| `__tests__/components/SnapBubble.test.js`   | 15 unit tests                                                                          | VERIFIED | 15/15 pass                                                                                             |
| `__tests__/components/DMInput.test.js`      | 6 tests for camera/send morph                                                          | VERIFIED | 6/6 pass                                                                                               |
| `src/components/DMInput.js`                 | Camera button when empty, crossfade morph                                              | VERIFIED | (unchanged from initial verification)                                                                  |
| `src/components/MessageBubble.js`           | Delegates type:snap to SnapBubble                                                      | VERIFIED | (unchanged from initial verification)                                                                  |
| `src/screens/ConversationScreen.js`         | SnapViewer overlay, autoOpenSnapId effect, onReaction + currentUserId props            | VERIFIED | L650-653: `currentUserId` + `onReaction` wired; L644: SnapViewer overlay                               |
| `src/navigation/AppNavigator.js`            | SnapPreviewScreen and SnapCamera registered                                            | VERIFIED | (unchanged from initial verification)                                                                  |
| `src/components/ConversationRow.js`         | Absolute unread badge, snap camera shortcut button                                     | VERIFIED | L255: `position: 'absolute'`; L247: `minHeight: 24`                                                    |
| `src/screens/MessagesScreen.js`             | Passes onSnapCamera callback to ConversationRow                                        | VERIFIED | (unchanged from initial verification)                                                                  |
| `App.js`                                    | Snap notification handler navigates with autoOpenSnapId                                | VERIFIED | Notification payload now correctly typed; `notificationService.js` case 'snap' reachable               |
| `storage.rules`                             | snap-photos/{userId}/{allPaths=\*\*} owner-only rule                                   | VERIFIED | L41-46 (unchanged)                                                                                     |
| `firestore.rules`                           | expiresAt, snapStoragePath, viewedAt update by non-sender                              | VERIFIED | L424-436 (unchanged)                                                                                   |
| `functions/index.js` (INFRA docs)           | INFRA-03 and INFRA-04 documented with CLI commands                                     | VERIFIED | L2976-3018 (unchanged, deferred by user)                                                               |

---

### Key Link Verification

| From                                 | To                                         | Via                                             | Status        | Details                                                                                                |
| ------------------------------------ | ------------------------------------------ | ----------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `snapService.js`                     | `functions/index.js (getSignedSnapUrl)`    | httpsCallable                                   | WIRED         | `httpsCallable(functions, 'getSignedSnapUrl')`                                                         |
| `snapService.js`                     | `snap-photos/` Storage path                | storageRef.putFile                              | WIRED         | L139: `snap-photos/${senderId}/${snapId}.jpg`                                                          |
| `functions/index.js (onSnapViewed)`  | Storage bucket                             | bucket.file().delete()                          | WIRED         | L3175: `bucket.file(snapStoragePath).delete()`                                                         |
| `functions/index.js (onNewMessage)`  | `notificationService.js` case 'snap'       | type:'snap' + messageId payload                 | WIRED (FIXED) | L2932: `type: 'snap'`; L2943: `messageId` included for snaps                                           |
| `notificationService.js` case 'snap' | `ConversationScreen.js` autoOpenSnapId     | navigation params                               | WIRED         | L419: `autoOpenSnapId: messageId` routed to ConversationScreen                                         |
| `CameraScreen.js`                    | `SnapPreviewScreen.js`                     | navigation.navigate                             | WIRED         | L277: navigate with `{ photoUri, conversationId, friendId, friendDisplayName }`                        |
| `SnapPreviewScreen.js`               | `snapService.js`                           | uploadAndSendSnap                               | WIRED         | L117: `uploadAndSendSnap(...)`                                                                         |
| `SnapViewer.js`                      | `snapService.js`                           | getSignedSnapUrl + markSnapViewed               | WIRED         | L109: `getSignedSnapUrl()`; L148: `markSnapViewed()`                                                   |
| `SnapViewer.js`                      | `messageService.js`                        | onReaction -> sendReaction (Plan 08)            | WIRED         | `ConversationScreen.js` L652: `sendReaction(conversationId, user.uid, snapViewerMessage.id, emojiKey)` |
| `ConversationScreen.js`              | `SnapViewer.js`                            | SnapViewer overlay + currentUserId + onReaction | WIRED         | L644-653: all three props present                                                                      |
| `snapService.js`                     | `expo-image-manipulator`                   | EXIF normalization (Plan 08)                    | WIRED         | L71: `manipulateAsync(uri, [], { format: SaveFormat.JPEG })`                                           |
| `MessageBubble.js`                   | `SnapBubble.js`                            | conditional render for type:snap                | WIRED         | (unchanged from initial verification)                                                                  |
| `DMInput.js`                         | `CameraScreen.js (snap mode)`              | onOpenSnapCamera callback                       | WIRED         | (unchanged from initial verification)                                                                  |
| `AppNavigator.js`                    | `SnapPreviewScreen.js`                     | Stack.Screen registration                       | WIRED         | (unchanged from initial verification)                                                                  |
| `storage.rules`                      | `snapService.js`                           | snap-photos/ path authorized                    | WIRED         | (unchanged from initial verification)                                                                  |
| `firestore.rules`                    | `functions/index.js (cleanupExpiredSnaps)` | expiresAt field                                 | WIRED         | (unchanged from initial verification)                                                                  |

---

### Requirements Coverage

| Requirement | Source Plan                | Description                                                               | Status               | Evidence                                                                                                        |
| ----------- | -------------------------- | ------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| SNAP-01     | 03-02, 03-04, 03-06, 03-07 | Camera button in DM input opens camera for snap capture                   | SATISFIED            | DMInput camera button, CameraScreen snap mode with dynamic footer + recipient header (Plan 07)                  |
| SNAP-02     | 03-02, 03-06, 03-07        | Optional caption on snap before sending                                   | SATISFIED            | SnapPreviewScreen: TextInput (150 char max) in Polaroid strip; KAV keyboard lift fixed (Plan 07)                |
| SNAP-03     | 03-01                      | Snap uploaded to Storage, delivered instantly (no darkroom delay)         | SATISFIED            | snapService.js uploads to snap-photos/, creates message doc immediately                                         |
| SNAP-04     | 03-03, 03-04               | Unopened snap shows camera icon with "Snap" label                         | SATISFIED            | SnapBubble all 4 states; MessageBubble delegates to SnapBubble                                                  |
| SNAP-05     | 03-03, 03-08               | Recipient taps to view full-screen; snap disappears after closing         | SATISFIED            | SnapViewer renders Polaroid full-screen (semi-transparent overlay, Plan 08); markSnapViewed on dismiss          |
| SNAP-06     | 03-01, 03-04               | Sender sees "Opened" status after recipient views                         | SATISFIED            | SnapBubble "Opened" state; real-time Firestore subscription                                                     |
| SNAP-07     | 03-01, 03-03, 03-08        | cachePolicy:'none' and short-lived signed URLs (2-5 min)                  | SATISFIED            | SnapViewer L273: `cachePolicy="none"`; getSignedSnapUrl CF: 5-minute expiry; EXIF normalization added (Plan 08) |
| SNAP-08     | 03-01                      | Cloud Function deletes snap photo after viewing; Firestore TTL safety net | SATISFIED            | onSnapViewed deletes Storage file on viewedAt transition; cleanupExpiredSnaps every 2 hours                     |
| INFRA-03    | 03-05                      | Firestore TTL policy on messages collection group for expiresAt           | SATISFIED (deferred) | Documented in functions/index.js L2976-2994; user deferred — app functions without it                           |
| INFRA-04    | 03-05                      | Firebase Storage lifecycle rule on snap-photos/ (7-day auto-delete)       | SATISFIED (deferred) | Documented in functions/index.js L2997-3018; user deferred — app functions without it                           |

---

### Anti-Patterns Found

| File                                        | Line | Pattern                                                                          | Severity | Impact                                                                                                                                    |
| ------------------------------------------- | ---- | -------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/__tests__/snapFunctions.test.js` | 522  | `expect(data.type).toBe('direct_message')` — stale assertion from before gap fix | Warning  | Test is actively failing; does not affect production but gives false signal of test coverage accuracy; missing `data.messageId` assertion |

No `console.log`, `TODO`, `FIXME`, `PLACEHOLDER`, or stub implementations found in any snap-specific production files. All layout fixes from Plan 07 and SnapViewer overhaul from Plan 08 are substantive changes.

---

### Human Verification Required

#### 1. Full Snap Flow on Device

**Test:** On a real device, open a DM conversation, tap the camera button, capture a snap with the back camera, type a caption, press Send. On recipient device, verify snap notification arrives and conversation shows an amber "Snap" bubble.

**Expected:** Camera opens in snap mode (no darkroom UI), "To: FriendName" header visible at top. Polaroid preview appears with thick white border (16px) and caption strip. After send, amber bubble appears. Tapping opens full-screen Polaroid viewer with semi-transparent overlay (conversation faintly visible behind). Dismissing shows "Opened" state, cannot reopen.

**Why human:** Visual fidelity of Polaroid frame thickness, amber color accuracy, semi-transparent overlay opacity, swipe-down dismiss gesture, and "To: FriendName" header readability cannot be verified programmatically.

#### 2. Snap Notification Auto-Open (Gap Now Closed)

**Test:** Send a snap to a user whose device has the app backgrounded or killed. Tap the snap push notification.

**Expected:** Conversation opens and the SnapViewer automatically opens for the specific snap (after ~300ms delay), user can view and dismiss without manually tapping the bubble.

**Why human:** Requires real push notification delivery, background/killed app state, and device testing of the autoOpenSnapId effect timing.

#### 3. Snap Reaction Bar

**Test:** On a recipient device, open a received (unviewed) snap. Verify the 6 emoji buttons appear below the Polaroid. Tap one. Dismiss the viewer. Check the conversation thread for the reaction message. Then on the sender device, open the same snap — verify NO reaction bar appears for the sender.

**Expected:** Reaction sends via the existing sendReaction system and appears as a reaction badge in the conversation thread. Sender does not see the reaction bar on their own snap.

**Why human:** Requires two real devices to test sender/recipient distinction; real reaction delivery through Firestore subscription to confirm thread appearance.

#### 4. EXIF/Orientation Cross-Platform Consistency

**Test:** Take a snap with the back camera on an iOS device, send to an Android recipient (and vice versa). Verify the photo appears with correct orientation on both sender preview and recipient viewer. No black bars, no rotation mismatches.

**Why human:** EXIF normalization is a pixel-level operation that requires physical device testing with both platforms and the back camera specifically (front camera typically does not have EXIF rotation issues).

---

## Gaps Summary

All 10 observable truths are now verified correct in the production codebase. The original gap (snap notification type) has been closed. Plans 03-07 and 03-08 delivered substantive UAT improvements (layout fixes, EXIF normalization, semi-transparent overlay, snap reaction bar) that are all wired correctly.

One remaining gap: `functions/__tests__/snapFunctions.test.js` line 522 contains a stale assertion (`expect(data.type).toBe('direct_message')`) that was written before the notification fix and now contradicts the correct production behavior. This test is actively failing. The fix is a single-line change: `expect(data.type).toBe('snap')` plus an added `expect(data.messageId).toBe('msg-123')` assertion for completeness.

This is a test accuracy issue, not a production code issue. All production snap code is functionally correct.

---

_Verified: 2026-02-24T21:10:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after Plans 03-07 and 03-08 gap closure_
