---
status: diagnosed
phase: 09-pinned-snaps-ios
source: 09-16-SUMMARY.md, 09-17-SUMMARY.md, 09-18-SUMMARY.md
started: 2026-03-20T12:00:00Z
updated: 2026-03-20T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill the app completely. Reopen it. App boots without errors, authenticates, and loads the feed normally.
result: pass

### 2. Push-to-Start Token Registration
expected: After launching the app while authenticated, the app silently registers push-to-start and FCM tokens in the background. No visible UI change — this is infrastructure. Check Firestore user document for `pushToStartToken` and `fcmRegistrationToken` fields if you want to verify.
result: pass

### 3. Pinned Snap Creates Live Activity (App Killed)
expected: Have a friend send you a pinned snap while your app is completely killed. A Live Activity should appear on your lock screen showing the Polaroid-framed photo thumbnail, even though the app wasn't running.
result: issue
reported: "no live activity"
severity: blocker

### 4. Multiple Pinned Snaps Stack Into One Live Activity
expected: Receive 2 or more pinned snaps (from same or different friends). Instead of separate Live Activities, they should stack into a single Live Activity showing overlapping Polaroids.
result: pass

### 5. Stacked Polaroid Widget Layout
expected: When multiple pinned snaps are stacked, the lock screen Live Activity shows up to 3 overlapping Polaroid thumbnails with slight rotation/offset.
result: pass

### 6. Individual Snap Removal from Stack
expected: Open and view one of the pinned snaps via the conversation. After viewing, that snap should be removed from the Live Activity stack. The remaining snaps stay visible. If it was the last snap, the Live Activity disappears entirely.
result: issue
reported: "ERROR liveActivityService: Failed to remove snap from stack {\"error\": \"LiveActivityManager.removeFromStack is not a function (it is undefined)\", \"snapActivityId\": \"LzZybJhrdz9fvJvjJ1lU\"}"
severity: blocker

### 7. Cloud Functions Still Work After v2 Migration
expected: Core cloud-triggered features still work: sending a snap triggers a push notification, friend requests create notifications, and any other notification-driven features behave normally. No regressions from the Firebase Functions v2 migration.
result: pass

## Summary

total: 7
passed: 5
issues: 7
pending: 0
skipped: 0

## Gaps

- truth: "Pinned snap creates Live Activity when app is killed via push-to-start"
  status: failed
  reason: "User reported: no live activity"
  severity: blocker
  test: 3
  needs_research: true
  research_notes: |
    ARCHITECTURE DECISION: Push-to-start is the PRIMARY path for ALL app states (foreground, background, killed).
    NSE is the FALLBACK for when push-to-start fails or device is iOS 16.2-17.1 (no push-to-start support).

    Push-to-start research:
    1. content-state payload is empty {} but ContentState expects { stack: [...] } — iOS may reject mismatched shape
    2. attributes-type "PinnedSnapAttributes" may need module namespace prefix
    3. Token may never have been stored in Firestore (check recipient user doc)
    4. Push-to-start tokens persist at OS level after app kill — likely NOT a staleness issue
    Investigate: Cloud Function logs for sendPushToStartLiveActivity errors, Firestore for token presence, APNS payload format requirements for push-to-start with custom ContentState.

    NSE fallback research:
    5. In previous versions, NSE calling Activity.request() did NOT work when app was killed — research why
    6. Possible iOS restriction: NSE runs in separate process, ActivityKit may require main app process context
    7. Research if there are entitlement or capability requirements for NSE to use ActivityKit
    8. If NSE can't create Live Activities when killed, document the limitation and rely solely on push-to-start
  root_cause: "Unknown — needs research. Suspected: push-to-start APNS payload has empty content-state {} which doesn't match PinnedSnapAttributes.ContentState struct (expects stack array). May also be token registration or attributes-type naming issue. NSE fallback also needs research — previously didn't work when app was killed."
  artifacts:
    - path: "functions/notifications/liveActivitySender.js"
      issue: "Line 44: content-state is empty {} but ContentState expects { stack: [...] }"
    - path: "functions/notifications/liveActivitySender.js"
      issue: "Line 45: attributes-type may need module namespace prefix"
    - path: "modules/live-activity-manager/src/LiveActivityManagerModule.swift"
      issue: "pushToStartObservationTask may not emit token before app is killed"
    - path: "targets/FlickNotificationService/NotificationService.swift"
      issue: "NSE Activity.request() didn't work when app was killed in previous versions — needs research"
  missing:
    - "Research correct push-to-start APNS payload format for stacked ContentState"
    - "Verify pushToStartToken exists in recipient Firestore user document"
    - "Check Cloud Function logs for sendPushToStartLiveActivity call/error"
    - "Research why NSE couldn't create Live Activities when app was killed (iOS restriction?)"
    - "Research NSE + ActivityKit entitlement/capability requirements"
  debug_session: ""

- truth: "Viewing a pinned snap removes it from the Live Activity stack"
  status: failed
  reason: "User reported: LiveActivityManager.removeFromStack is not a function (it is undefined)"
  severity: blocker
  test: 6
  root_cause: "removeFromStack is defined in Swift native module but NOT exported from the TypeScript bridge (modules/live-activity-manager/index.ts). Missing from interface and no exported wrapper function."
  artifacts:
    - path: "modules/live-activity-manager/index.ts"
      issue: "removeFromStack missing from LiveActivityManagerInterface and exports"
    - path: "modules/live-activity-manager/src/LiveActivityManagerModule.swift"
      issue: "removeFromStack correctly defined as AsyncFunction — no Swift fix needed"
  missing:
    - "Add removeFromStack to LiveActivityManagerInterface in index.ts"
    - "Add exported removeFromStack wrapper function in index.ts"
  debug_session: ""

- truth: "Stacked Live Activity should show only photos, no count badge or sender summary"
  status: cosmetic
  reason: "User reported: don't want count badge or sender summary, just the photos stacking"
  severity: cosmetic
  test: 4
  root_cause: "Stacked layout VStack contains 'X pinned snaps' header, sender name summary, and '+N more' count badge. User wants only the ZStack with stacked Polaroids."
  artifacts:
    - path: "targets/FlickLiveActivity/FlickLiveActivityWidget.swift"
      issue: "Lines 140-168: VStack with header text, sender names, and count badge should be removed"
  missing:
    - "Remove VStack text container (header, sender names, count badge) from stacked layout"
    - "Keep only ZStack with stacked Polaroid frames"
  debug_session: ""

- truth: "Live Activity starts when app is in background or killed (not just foreground)"
  status: failed
  reason: "User reported: app in background or killed doesn't start a live activity, only see push notification"
  severity: blocker
  test: 3
  needs_research: true
  research_notes: "Same root cause as gap 1 — see research notes there. Fix for gap 1 fixes this too."
  root_cause: "Same as gap 1 — push-to-start payload likely malformed (empty content-state). NSE fallback is secondary option if push-to-start can't be fixed."
  artifacts:
    - path: "functions/notifications/liveActivitySender.js"
      issue: "Same as gap 1 — content-state payload mismatch"
    - path: "targets/FlickNotificationService/NotificationService.swift"
      issue: "NSE could serve as fallback but was simplified in Plan 08"
  missing:
    - "Re-enable NSE Live Activity creation as fallback for background/killed app states"
  debug_session: ""

- truth: "Push notification should be suppressed when Live Activity handles the pinned snap"
  status: failed
  reason: "User reported: push notifications should be suppressed if live activity works, it's just a fallback. Foreground suppression works correctly."
  severity: major
  test: 3
  root_cause: "NSE suppression logic (lines 280-285) sends empty UNMutableNotificationContent when Live Activity starts, but may not fully silence (missing explicit sound=nil, badge=0). When Live Activity fails to start in background, notification isn't suppressed at all."
  artifacts:
    - path: "targets/FlickNotificationService/NotificationService.swift"
      issue: "Suppression may not be fully silent; fails when Live Activity doesn't start"
  missing:
    - "Ensure empty content has sound=nil and badge=0 explicitly"
    - "Suppression depends on fixing Live Activity creation in NSE first"
  debug_session: ""

- truth: "Single pinned snap deep link opens conversation with correct user info"
  status: failed
  reason: "User reported: tapping single pinned snap Live Activity opens conversation but shows user as 'unknown' with placeholder profile picture"
  severity: major
  test: 6
  root_cause: "Deep link lapse://messages/{conversationId} only passes conversationId. ConversationScreen requires friendId and friendProfile params to display user info. Without friendId, profile fetch is skipped and shows 'Unknown User'."
  artifacts:
    - path: "src/services/liveActivityService.js"
      issue: "Line 65: deep link missing friendId parameter"
    - path: "src/navigation/AppNavigator.js"
      issue: "Deep link config doesn't parse friendId from URL"
    - path: "src/screens/ConversationScreen.js"
      issue: "Needs fallback to fetch friend from conversation doc when friendId missing"
  missing:
    - "Either add friendId to deep link URL and update navigation config, or add fallback fetch in ConversationScreen"
  debug_session: ""

- truth: "Stacked pinned snaps deep link goes to messages list, not a specific conversation"
  status: failed
  reason: "User reported: when there are multiple stacked snaps, tapping should go to messages list (convo list view), not a specific conversation"
  severity: major
  test: 6
  root_cause: "Swift widget correctly uses lapse://messages for stacked layout (line 175), but the deep link stored in PinnedSnapAttributes from JS/NSE is conversation-specific. The widgetURL modifier should override, but may not be working correctly for stacked activities."
  artifacts:
    - path: "targets/FlickLiveActivity/FlickLiveActivityWidget.swift"
      issue: "widgetURL for stacked layout may not override attributes deep link"
  missing:
    - "Verify widgetURL override works for stacked layout; may need to set deepLinkUrl in attributes to messages list when stack count > 1"
  debug_session: ""
