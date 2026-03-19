---
phase: 09-pinned-snaps-ios
plan: 16
subsystem: notifications
tags: [live-activity, push-to-start, activitykit, fcm, apns, ios17]

requires:
  - phase: 09-pinned-snaps-ios
    provides: Live Activity native module and widget extension (plans 01-15)
provides:
  - Push-to-start token observation via ActivityKit (iOS 17.2+)
  - FCM registration token retrieval and Firestore storage
  - Cloud Function push-to-start delivery via admin.messaging().send()
  - Hybrid fallback: push-to-start + regular notification sent together
affects: [09-pinned-snaps-ios, push-notifications, live-activities]

tech-stack:
  added: [@react-native-firebase/messaging]
  patterns: [push-to-start-live-activity, dual-notification-delivery]

key-files:
  created:
    - functions/notifications/liveActivitySender.js
  modified:
    - modules/live-activity-manager/src/LiveActivityManagerModule.swift
    - src/services/liveActivityService.js
    - App.js
    - functions/index.js

key-decisions:
  - "Installed @react-native-firebase/messaging for FCM token retrieval (requires native build)"
  - "Push-to-start and regular notification always sent together for NSE thumbnail download"
  - "Recipient data variable is 'recipient' in onNewMessage handler, not 'recipientData'"

patterns-established:
  - "Dual notification delivery: push-to-start for Live Activity + regular for NSE/banner"
  - "FCM registration token stored alongside Expo push token in user document"

requirements-completed: [PINI-02, PINI-04]

duration: 3min
completed: 2026-03-19
---

# Phase 09 Plan 16: Push-to-Start Live Activities Summary

**Push-to-start Live Activity pipeline: native token observation via ActivityKit, FCM token storage in Firestore, and Cloud Function delivery via admin.messaging().send() with live_activity_token**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T20:44:37Z
- **Completed:** 2026-03-19T20:47:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Native module observes push-to-start tokens on iOS 17.2+ via ActivityKit async sequence
- JS bridge registers both pushToStartToken and fcmRegistrationToken in Firestore user document
- Cloud Function sends push-to-start payload via Firebase Admin SDK when both tokens present
- Regular notification always sent alongside for NSE thumbnail download and notification banner
- Graceful fallback when push-to-start tokens unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Native push-to-start token observation and FCM token retrieval** - `772429df` (feat)
2. **Task 2: Cloud Function push-to-start delivery with hybrid fallback** - `e845c1e3` (feat)

## Files Created/Modified
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` - Added observePushToStartToken, Events, pushToStartObservationTask
- `src/services/liveActivityService.js` - Added getFCMRegistrationToken, registerPushToStartToken
- `App.js` - Added registerPushToStartToken call on authenticated startup
- `functions/notifications/liveActivitySender.js` - New file: push-to-start delivery via admin.messaging().send()
- `functions/index.js` - Integrated push-to-start attempt into onNewMessage pinned snap branch
- `package.json` - Added @react-native-firebase/messaging dependency

## Decisions Made
- Installed @react-native-firebase/messaging (native module, requires new native build for activation)
- Push-to-start and regular notification sent together: push-to-start creates Live Activity, regular triggers NSE thumbnail download
- Used 'recipient' variable (not 'recipientData') matching existing onNewMessage handler convention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm peer dependency conflict for @react-native-firebase/messaging**
- **Found during:** Task 1 (FCM token retrieval)
- **Issue:** `npm install` failed with peer dependency conflict
- **Fix:** Used `--legacy-peer-deps` flag (consistent with project's existing dependency resolution)
- **Files modified:** package.json, package-lock.json
- **Verification:** Package installed successfully, module loads
- **Committed in:** 772429df (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard npm resolution, no scope creep.

## Issues Encountered
None

## User Setup Required
**Note:** Adding @react-native-firebase/messaging is a native module change. A new EAS native build is required before the FCM token retrieval will work on device. OTA update alone is insufficient.

## Next Phase Readiness
- Push-to-start pipeline complete, ready for end-to-end testing on iOS 17.2+ device
- Requires new native build (EAS) to activate @react-native-firebase/messaging
- Plan 17 (stacking) and Plan 18 (Firebase migration) can proceed independently

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-19*
