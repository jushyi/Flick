---
status: complete
phase: 03-snap-messages
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md
started: 2026-02-24T20:00:00Z
updated: 2026-02-24T20:21:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Open Snap Camera from Conversation

expected: In a DM conversation, tap the camera button (amber icon) in the input bar. CameraScreen should open in full-screen snap mode: no darkroom button, no photo stack, no zoom controls. Flash, flip, and capture buttons should be visible. An X close button should appear to dismiss back to conversation. Layout should match the main Camera tab.
result: issue
reported: "issue here with height of buttons. on ios its a couple pixels too short and on android its a couple too tall. camera screen looks good though. i want to add a little header to this screen that says who you are sending to. the recipient of the photo you are about to take"
severity: minor

### 2. Capture and Preview a Snap

expected: Take a photo in snap camera mode. SnapPreviewScreen should show the photo in a Polaroid frame (white border, thick bottom strip with caption area). Caption text input available (150 char max). Amber Send button and Retake button visible. Swipe down on the preview to dismiss back to camera.
result: issue
reported: "good, the frame can be a bit thicker though. everything else looks good"
severity: cosmetic

### 3. Send a Snap to a Friend

expected: On SnapPreviewScreen, optionally type a caption, then tap Send. Should navigate back to the conversation. A snap message should appear in the thread showing a sending state (progress ring + "Sending..."), then transition to delivered state (amber camera icon + "Snap" or "Delivered").
result: issue
reported: "for captions, the keyboard avoiding view doesnt work properly on both platforms. doesnt go high enough. can still send though. everything else looks fine and works"
severity: minor

### 4. View a Received Snap (View-Once)

expected: In conversation, tap an unopened snap bubble (amber camera icon). Full-screen SnapViewer opens with Polaroid frame showing the snap photo and caption (if any). Swipe down to dismiss. After dismissing, the bubble should change to "Opened" state (dimmed appearance). Tapping again should NOT re-open the photo (view-once).
result: issue
reported: "loading is slow, can defer to future milestone. fullscreen view looks bare. maybe we make it transparent so we can see the convo behind it. and maybe add a reaction bar under the polaroid view the receiver can tap to react to that specific snap. for photos taken with ios there are black bars on the side when viewing in android"
severity: major

### 5. DMInput Camera/Send Button Morph

expected: When the text input is empty, an amber camera button is visible. Start typing text — the camera button should crossfade into a send arrow button. Delete all text — send arrow should morph back to camera button.
result: pass

### 6. Conversation List Snap Indicators

expected: In the Messages list, a conversation with an unread snap should show an amber-colored unread badge. A snap camera shortcut button should be visible on each conversation row for quick snap access.
result: issue
reported: "unread badges look weird because they push the shortcut button up maybe we move the unread somewhere else"
severity: minor

### 7. Snap Notification Deep Link

expected: Have a friend send you a snap. Tap the push notification. Should navigate to the conversation and auto-open the SnapViewer showing that snap (with ~300ms delay for the conversation to render first).
result: pass
note: "pass but other issue found — photo orientation differs between sender preview and recipient viewer, black bars appear when orientation is different"

## Summary

total: 7
passed: 2
issues: 5
pending: 0
skipped: 0

## Gaps

- truth: "Snap camera buttons are correctly sized on both platforms. Camera screen layout is complete with all relevant context for the user."
  status: failed
  reason: "User reported: issue here with height of buttons. on ios its a couple pixels too short and on android its a couple too tall. camera screen looks good though. i want to add a little header to this screen that says who you are sending to. the recipient of the photo you are about to take"
  severity: minor
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "SnapPreviewScreen Polaroid frame has appropriate border thickness"
  status: failed
  reason: "User reported: good, the frame can be a bit thicker though. everything else looks good"
  severity: cosmetic
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "SnapPreviewScreen caption input is fully visible when keyboard is open on both platforms"
  status: failed
  reason: "User reported: for captions, the keyboard avoiding view doesnt work properly on both platforms. doesnt go high enough. can still send though. everything else looks fine and works"
  severity: minor
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "SnapViewer opens quickly with polished full-screen view, correct photo aspect ratio cross-platform"
  status: failed
  reason: "User reported: loading is slow, can defer to future milestone. fullscreen view looks bare. maybe we make it transparent so we can see the convo behind it. and maybe add a reaction bar under the polaroid view the receiver can tap to react to that specific snap. for photos taken with ios there are black bars on the side when viewing in android"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Conversation row unread badge does not displace other UI elements"
  status: failed
  reason: "User reported: unread badges look weird because they push the shortcut button up maybe we move the unread somewhere else"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Snap photo orientation is consistent between sender preview and recipient viewer"
  status: failed
  reason: "User reported: when the orientation of the photo is different, black bars appear. what it looked like when it was sent is different from when its viewed from the recipient"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
