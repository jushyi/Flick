---
status: complete
phase: 08-screenshot-detection
source: 08-00-SUMMARY.md, 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-03-18T18:10:00Z
updated: 2026-03-18T18:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 6
name: Screenshotted State Priority Over Opened
expected: |
  If a snap was both opened (viewed) and screenshotted, the snap bubble should display the screenshotted state (magenta + eye icon), NOT the opened state (gray). The screenshotted state always takes priority.
awaiting: user response

## Tests

### 1. Screenshot Detection While Viewing Snap
expected: Open a conversation with a friend who sent you a snap. Tap the snap to view it. Take a screenshot while viewing. The app detects it silently. After closing the viewer, a system message appears in the conversation: "[Your name] screenshotted a snap". NOTE: Requires native EAS build.
result: PASS (after fixes)
notes: |
  - Detection worked immediately (expo-screen-capture fires correctly)
  - Firestore permission-denied on recordScreenshot — fixed by deploying updated firestore.rules
  - Duplicate key error (divider-2026-2-19) — fixed with Set-based dedup in ConversationScreen
  - Screenshotted SnapBubble colors changed from dimmed amber → magenta (#FF2D78) per user feedback

### 2. System Message Rendering in Conversation
expected: After a screenshot event occurs (or if a system_screenshot message already exists in Firestore), the conversation shows a small centered gray text message (matching the TimeDivider style) with the text "[Name] screenshotted a snap". It should NOT appear as a regular chat bubble.
result: PASS

### 3. Screenshot Push Notification
expected: When someone screenshots your snap, you receive a push notification saying "[Name] screenshotted your snap". The notification should arrive even if the app is backgrounded.
result: PASS (after fix)
notes: Notification body included sender name redundantly (already in title). Fixed to just "Screenshotted your snap".

### 4. Screenshot Notification Deep Link
expected: Tap a screenshot push notification. The app should navigate directly to the conversation with the person who screenshotted your snap.
result: PASS

### 5. Screenshotted Snap Bubble Visual State
expected: In a conversation, a snap that has been screenshotted shows a distinct visual state: magenta background/border, eye-outline icon, "Screenshotted" label. It should look clearly different from both the unopened amber and opened gray states.
result: PASS

### 6. Screenshotted State Priority Over Opened
expected: If a snap was both opened (viewed) and screenshotted, the snap bubble should display the screenshotted state (magenta + eye icon), NOT the opened state (gray). The screenshotted state always takes priority.
result: PASS

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
