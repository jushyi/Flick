---
status: complete
phase: 10-pinned-snaps-android
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-03-18T18:10:00Z
updated: 2026-03-19T11:30:00Z
---

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Expo dev server and app. Restart the app from scratch. The app boots without errors, navigates to the main feed, and loads data normally.
result: PASS

### 2. Receive Pinned Snap Notification on Android
expected: Send a pinned snap from another account (toggle pin ON before sending). On the Android recipient device, a push notification appears with a rich image preview (BigPictureStyle showing the snap thumbnail) and title "Pinned snap from [sender name]". The notification should appear in the "Pinned Snaps" channel (HIGH importance).
result: PASS — Root cause of initial failure: FCM v1 credentials not uploaded to Expo push service. Fixed by uploading Google Service Account key via `eas credentials -p android`.

### 3. Tap Pinned Snap Notification
expected: Tap the pinned snap notification. The app opens directly to the Conversation screen with the sender, and the snap viewer auto-opens showing the pinned snap.
result: PASS — Fixed: autoOpenSnapId wasn't reaching ConversationScreen due to nested navigator param issue. Also handles edge case where conversation is already open (uses setParams instead of re-navigating).

### 4. Notification Auto-Dismisses on Snap View
expected: Receive a pinned snap notification on Android. Open the app manually (don't tap the notification). Navigate to the conversation with the sender, open the snap viewer and view the pinned snap. After closing the snap viewer, the pinned snap notification in the notification tray should be automatically dismissed.
result: PASS — Fixed: Android FCM "foreign notifications" don't expose data payload. Added fallback to match by foreign notification identifier prefix when data fields are unavailable.

### 5. Pin Toggle on Android Snap Preview
expected: Open the camera, take a snap to send to a friend. On the snap preview screen, the pin toggle button is visible and functional. Toggling pin ON shows visual feedback (filled icon or highlight). Sending the snap with pin ON includes the isPinned field.
result: PASS

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

### GAP-01: Notification not dismissed when viewing pinned snap — FIXED
- **Fix:** Rewrote `dismissPinnedNotif` to scan notification tray via `getPresentedNotificationsAsync()`. Added Android-specific fallback for "foreign notifications" (FCM notifications received while backgrounded) whose data payload is inaccessible — matches by identifier prefix instead.
- **Commit:** 3a7fad1d + UAT fix commit

### GAP-02: Snap viewer doesn't auto-open from pinned snap notification tap — FIXED
- **Fix:** Two issues: (1) autoOpenSnapId wasn't reaching ConversationScreen — App.js Conversation navigation now detects if already on the conversation and uses `setParams` to inject autoOpenSnapId. (2) Added polling + direct Firestore fetch fallback for messages not yet loaded. Changed `autoOpenSnapHandled` from boolean to snap ID tracking for re-triggering.
- **Files:** App.js, ConversationScreen.js

### GAP-03: Pinned snaps have no visual distinction in chat — FIXED
- **Fix:** Added "Pinned" label above pinned snap bubbles in SnapBubble.js, aligned to same side as bubble.
- **Files:** SnapBubble.js
