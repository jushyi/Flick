---
status: testing
phase: 10-pinned-snaps-android
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-03-18T18:10:00Z
updated: 2026-03-18T18:10:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running Expo dev server and app. Restart the app from scratch (npx expo start, then open on device/emulator). The app boots without errors, navigates to the main feed, and loads data normally.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Expo dev server and app. Restart the app from scratch. The app boots without errors, navigates to the main feed, and loads data normally.
result: [pending]

### 2. Receive Pinned Snap Notification on Android
expected: Send a pinned snap from another account (toggle pin ON before sending). On the Android recipient device, a push notification appears with a rich image preview (BigPictureStyle showing the snap thumbnail) and title "Pinned snap from [sender name]". The notification should appear in the "Pinned Snaps" channel (HIGH importance).
result: [pending]

### 3. Tap Pinned Snap Notification
expected: Tap the pinned snap notification. The app opens directly to the Conversation screen with the sender, and the snap viewer auto-opens showing the pinned snap.
result: [pending]

### 4. Notification Auto-Dismisses on Snap View
expected: Receive a pinned snap notification on Android. Open the app manually (don't tap the notification). Navigate to the conversation with the sender, open the snap viewer and view the pinned snap. After closing the snap viewer, the pinned snap notification in the notification tray should be automatically dismissed.
result: [pending]

### 5. Pin Toggle on Android Snap Preview
expected: Open the camera, take a snap to send to a friend. On the snap preview screen, the pin toggle button is visible and functional. Toggling pin ON shows visual feedback (filled icon or highlight). Sending the snap with pin ON includes the isPinned field.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
