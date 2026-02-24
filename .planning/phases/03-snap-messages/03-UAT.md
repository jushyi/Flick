---
status: diagnosed
phase: 03-snap-messages
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md
started: 2026-02-24T20:00:00Z
updated: 2026-02-24T20:30:00Z
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
  root_cause: "footerControlsSnap uses hardcoded paddingBottom:20 instead of safe area inset. iOS home indicator is ~34px (under-compensated), Android gesture nav varies 0-24px (over-compensated). Also friendDisplayName is available in route params but never rendered."
  artifacts:
  - path: "src/styles/CameraScreen.styles.js"
    issue: "footerControlsSnap.paddingBottom hardcoded at 20px instead of using useSafeAreaInsets()"
  - path: "src/screens/CameraScreen.js"
    issue: "friendDisplayName destructured from route.params but never rendered in snap mode header"
    missing:
  - "Replace hardcoded paddingBottom with dynamic safe area inset"
  - "Add recipient name header in snap mode using friendDisplayName from route params"
    debug_session: ""
- truth: "SnapPreviewScreen Polaroid frame has appropriate border thickness"
  status: failed
  reason: "User reported: good, the frame can be a bit thicker though. everything else looks good"
  severity: cosmetic
  test: 2
  root_cause: "POLAROID_BORDER constant is 8px — too thin for a convincing Polaroid frame. Controls padding on polaroidFrame (line 297) and captionStrip paddingHorizontal (line 321)."
  artifacts:
  - path: "src/screens/SnapPreviewScreen.js"
    issue: "POLAROID_BORDER = 8 on line 53 is too small for realistic Polaroid look"
    missing:
  - "Increase POLAROID_BORDER from 8 to ~16 for thicker frame"
    debug_session: ""
- truth: "SnapPreviewScreen caption input is fully visible when keyboard is open on both platforms"
  status: failed
  reason: "User reported: for captions, the keyboard avoiding view doesnt work properly on both platforms. doesnt go high enough. can still send though. everything else looks fine and works"
  severity: minor
  test: 3
  root_cause: "KeyboardAvoidingView has no keyboardVerticalOffset. Footer (send/retake buttons, ~88-106px) sits outside and below the KAV as a sibling. KAV under-compensates by the footer height because it doesn't account for it. Android uses behavior='height' which is unreliable."
  artifacts:
  - path: "src/screens/SnapPreviewScreen.js"
    issue: "KAV missing keyboardVerticalOffset (lines 193-196); footer (lines 232-248) is outside KAV"
    missing:
  - "Move footer inside KAV so its bottom edge aligns with screen bottom, OR add keyboardVerticalOffset equal to footer height"
  - "Consider switching Android behavior from 'height' to 'padding'"
    debug_session: ".planning/debug/snap-preview-keyboard-lift.md"
- truth: "SnapViewer opens quickly with polished full-screen view, correct photo aspect ratio cross-platform"
  status: failed
  reason: "User reported: loading is slow, can defer to future milestone. fullscreen view looks bare. maybe we make it transparent so we can see the convo behind it. and maybe add a reaction bar under the polaroid view the receiver can tap to react to that specific snap. for photos taken with ios there are black bars on the side when viewing in android"
  severity: major
  test: 4
  root_cause: "Multiple issues: (1) overlay background is solid #000000, hiding conversation behind. (2) No reaction UI exists. (3) Both preview and viewer hardcode 4:3 aspect ratio but camera output varies by device. (4) Sender uses contentFit='cover' (cropped) while recipient uses contentFit='contain' (letterboxed) — this is the primary black bars cause. (5) Back camera snaps skip EXIF normalization."
  artifacts:
  - path: "src/components/SnapViewer.js"
    issue: "overlay backgroundColor #000000 (line 272); contentFit='contain' (line 242); hardcoded 4:3 aspect ratio; no reaction bar"
  - path: "src/screens/SnapPreviewScreen.js"
    issue: "contentFit='cover' (line 204); hardcoded 4:3 aspect ratio"
  - path: "src/services/firebase/snapService.js"
    issue: "compressSnapImage (lines 66-79) does not normalize EXIF for back camera photos"
    missing:
  - "Change overlay to semi-transparent background (e.g. rgba(0,0,0,0.6))"
  - "Unify contentFit between sender preview and recipient viewer (both 'cover')"
  - "Add snap reaction bar below Polaroid frame in SnapViewer"
  - "Add EXIF normalization in compressSnapImage (empty manipulateAsync actions before resize)"
  - "Loading speed deferred to future milestone per user"
    debug_session: ".planning/debug/snapviewer-bare-orientation.md"
- truth: "Conversation row unread badge does not displace other UI elements"
  status: failed
  reason: "User reported: unread badges look weird because they push the shortcut button up maybe we move the unread somewhere else"
  severity: minor
  test: 6
  root_cause: "UnreadBadge is a flow-layout sibling of rightTopRow inside rightColumn (flexDirection: column). When badge renders it adds 22px height (18px badge + 4px marginTop). Outer row uses alignItems:'center', so taller rightColumn re-centers vertically, pushing rightTopRow upward by ~11px."
  artifacts:
  - path: "src/components/ConversationRow.js"
    issue: "UnreadBadge (line 196) is flex sibling causing height change; rightColumn (line 243-246) has no fixed height; outer row (line 203-210) uses alignItems:'center'"
    missing:
  - "Use absolute positioning for the badge so it overlays rather than participating in flow layout"
    debug_session: ".planning/debug/unread-badge-pushes-snap-button.md"
- truth: "Snap photo orientation is consistent between sender preview and recipient viewer"
  status: failed
  reason: "User reported: when the orientation of the photo is different, black bars appear. what it looked like when it was sent is different from when its viewed from the recipient"
  severity: major
  test: 7
  root_cause: "Same root cause as Test 4: contentFit mismatch (cover vs contain) between SnapPreviewScreen and SnapViewer, plus missing EXIF normalization for back camera snaps in compressSnapImage."
  artifacts:
  - path: "src/screens/SnapPreviewScreen.js"
    issue: "contentFit='cover' — sender sees cropped photo"
  - path: "src/components/SnapViewer.js"
    issue: "contentFit='contain' — recipient sees letterboxed photo with black bars"
  - path: "src/services/firebase/snapService.js"
    issue: "No EXIF normalization for back camera photos"
    missing:
  - "Unify contentFit to 'cover' in both views"
  - "Add EXIF normalization in compressSnapImage"
    debug_session: ".planning/debug/snapviewer-bare-orientation.md"
