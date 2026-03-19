---
status: testing
phase: 10-pinned-snaps-android
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-03-18T18:10:00Z
updated: 2026-03-18T18:10:00Z
---

## Current Test

number: 5
name: Pin Toggle on Android Snap Preview
expected: |
  Open the camera, take a snap to send to a friend. On the snap preview screen, the pin toggle button is visible and functional. Toggling pin ON shows visual feedback (filled icon or highlight). Sending the snap with pin ON includes the isPinned field.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Expo dev server and app. Restart the app from scratch. The app boots without errors, navigates to the main feed, and loads data normally.
result: PASS

### 2. Receive Pinned Snap Notification on Android
expected: Send a pinned snap from another account (toggle pin ON before sending). On the Android recipient device, a push notification appears with a rich image preview (BigPictureStyle showing the snap thumbnail) and title "Pinned snap from [sender name]". The notification should appear in the "Pinned Snaps" channel (HIGH importance).
result: PASS — Rich notification with image preview received. Root cause of initial failure: FCM v1 credentials not uploaded to Expo push service. Fixed by uploading Google Service Account key via `eas credentials -p android`.

### 3. Tap Pinned Snap Notification
expected: Tap the pinned snap notification. The app opens directly to the Conversation screen with the sender, and the snap viewer auto-opens showing the pinned snap.
result: PARTIAL — Navigation to Conversation works correctly. Snap viewer does NOT auto-open (likely timing issue — messages not loaded when autoOpenSnapId effect runs). Also: user requests "Pinned" label above pinned snap bubbles in chat.

### 4. Notification Auto-Dismisses on Snap View
expected: Receive a pinned snap notification on Android. Open the app manually (don't tap the notification). Navigate to the conversation with the sender, open the snap viewer and view the pinned snap. After closing the snap viewer, the pinned snap notification in the notification tray should be automatically dismissed.
result: FAIL — Notification not dismissed. Root cause: storePinnedNotifId only runs inside addNotificationReceivedListener (foreground only). When notification arrives while app is backgrounded/killed, the ID is never stored, so dismissPinnedNotif has nothing to dismiss.

### 5. Pin Toggle on Android Snap Preview
expected: Open the camera, take a snap to send to a friend. On the snap preview screen, the pin toggle button is visible and functional. Toggling pin ON shows visual feedback (filled icon or highlight). Sending the snap with pin ON includes the isPinned field.
result: PASS

## Summary

total: 5
passed: 3
partial: 1
issues: 1
pending: 0
skipped: 0

## Gaps

### GAP-01: Notification not dismissed when viewing pinned snap
- **Severity:** medium
- **Root cause:** `storePinnedNotifId` only runs inside `addNotificationReceivedListener` (foreground-only). When the notification arrives while app is backgrounded/killed, the notification ID is never stored. `dismissPinnedNotif` then finds nothing to dismiss.
- **Fix:** Instead of storing the notification ID on receive, use `Notifications.getPresentedNotificationsAsync()` when dismissing — scan for a notification with `data.type === 'pinned_snap'` and matching `senderId`, then dismiss it directly. This eliminates the AsyncStorage store/lookup entirely and works regardless of app state when the notification arrived.
- **Files:** [notificationService.js:748-761](src/services/firebase/notificationService.js#L748-L761)

### GAP-02: Snap viewer doesn't auto-open from pinned snap notification tap
- **Severity:** medium
- **Root cause:** Timing — `autoOpenSnapId` effect in ConversationScreen runs before messages are loaded from Firestore subscription. The `messages.find()` returns nothing because the list is empty.
- **Fix:** The effect already watches `messages` array, but may need a longer retry window or explicit "wait for messages loaded" gate before checking.
- **Files:** [ConversationScreen.js:195-208](src/screens/ConversationScreen.js#L195-L208)

### GAP-03: Pinned snaps have no visual distinction in chat
- **Severity:** low (UI enhancement)
- **Description:** User requests a small "Pinned" label above pinned snap bubbles in the conversation thread to distinguish them from regular snaps.
- **Files:** [SnapBubble.js](src/components/SnapBubble.js) — add `message.pinned` check and render label
