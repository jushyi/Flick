---
phase: 08-screenshot-detection
plan: 01
subsystem: messaging
tags: [expo-screen-capture, firestore, cloud-functions, push-notifications, screenshot-detection, offline-queue]

# Dependency graph
requires:
  - "08-00: RED test scaffolds for screenshotService and screenshotNotification"
provides:
  - "screenshotService.js with idempotent recordScreenshot (screenshottedAt + system message)"
  - "screenshotQueueService.js with AsyncStorage offline retry queue"
  - "onNewMessage system_screenshot handling (lastMessage, push notification, no unread increment)"
  - "Firestore rules allowing screenshottedAt writes by non-sender participants"
  - "Notification deep-link for screenshot type -> Conversation screen"
  - "expo-screen-capture ~8.0.9 installed (native module)"
affects: [08-screenshot-detection]

# Tech tracking
tech-stack:
  added: [expo-screen-capture ~8.0.9]
  patterns:
    - "Idempotent check-then-write for screenshot events (getDoc -> check screenshottedAt -> updateDoc + addDoc)"
    - "System message type 'system_screenshot' with senderId = screenshotter for correct recipientId derivation"
    - "Offline queue pattern mirroring uploadQueueService (AsyncStorage + retry with MAX_RETRIES)"

key-files:
  created:
    - "src/services/firebase/screenshotService.js"
    - "src/services/screenshotQueueService.js"
  modified:
    - "package.json"
    - "app.json"
    - "firestore.rules"
    - "functions/index.js"
    - "src/services/firebase/notificationService.js"
    - "functions/__tests__/triggers/screenshotNotification.test.js"

key-decisions:
  - "screenshotService created in Task 1 (not Task 2) because screenshotQueueService imports recordScreenshot -- lint would block commit with unresolved import"
  - "senderId on system_screenshot message is screenshotter's ID (not null) so onNewMessage can derive recipientId correctly without crashing"
  - "system_screenshot does NOT increment unreadCount -- system events are informational, not actionable"
  - "lastMessage preview uses message.text verbatim for system_screenshot (e.g. 'Alex screenshotted a snap')"
  - "Notification body uses factual tone: '{name} screenshotted your snap' per user decision"

patterns-established:
  - "System message pattern: type='system_screenshot', senderId=actor, creates separate document in messages subcollection"
  - "Screenshot notification type='screenshot' in push data for client-side deep-link routing"

requirements-completed: [SCRN-01, SCRN-03]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 8 Plan 01: Screenshot Detection Service Layer Summary

**Idempotent screenshotService with Firestore writes, AsyncStorage offline queue, and Cloud Function push notification delivery for system_screenshot messages**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T17:07:02Z
- **Completed:** 2026-03-18T17:13:39Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- screenshotService.js with idempotent check-then-write: reads snap doc, checks screenshottedAt, writes timestamp + creates system_screenshot message
- screenshotQueueService.js with AsyncStorage offline persistence: queueScreenshotEvent, processScreenshotQueue, getQueueLength
- onNewMessage Cloud Function handles system_screenshot: updates conversation lastMessage with text preview, sends push notification to snap sender with type:'screenshot', does NOT increment unreadCount
- Firestore security rules updated to allow non-sender participants to write screenshottedAt on message documents
- Notification deep-link handler for screenshot type navigates to Conversation screen
- expo-screen-capture ~8.0.9 installed and registered in app.json plugins
- All 5 screenshotService tests GREEN, all 3 screenshotNotification tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-screen-capture, update Firestore rules, create services** - `a051f1e7` (feat)
2. **Task 2: Verify screenshotService tests GREEN** - `9f9a109a` (feat)
3. **Task 3: Extend onNewMessage for system_screenshot + notification deep-link** - `bca62245` (feat)

## Files Created/Modified
- `src/services/firebase/screenshotService.js` - Idempotent recordScreenshot: screenshottedAt write + system_screenshot message creation
- `src/services/screenshotQueueService.js` - AsyncStorage offline queue for failed screenshot writes with MAX_RETRIES=3
- `package.json` - Added expo-screen-capture ~8.0.9
- `app.json` - Added expo-screen-capture to plugins array
- `firestore.rules` - Added screenshottedAt to allowed update fields for message documents
- `functions/index.js` - system_screenshot handling: no unread increment, text preview, push notification with type:'screenshot'
- `src/services/firebase/notificationService.js` - Added 'screenshot' case to handleNotificationTapped
- `functions/__tests__/triggers/screenshotNotification.test.js` - Fixed RED test assertion (5 args not 6)

## Decisions Made
- **screenshotService created early:** The screenshotQueueService imports from screenshotService, so creating the queue service first would fail lint. Both were created in Task 1 to resolve the circular dependency.
- **senderId = screenshotter ID (not null):** The onNewMessage Cloud Function derives recipientId from conversationId split using senderId. Setting senderId to null would crash the function. Using the screenshotter's ID means recipientId correctly resolves to the snap sender.
- **No unread count increment:** System messages are informational events, not actionable unread messages. Users should not see an unread badge for a screenshot system message.
- **Notification body tone:** Factual/neutral per user decision: "{name} screenshotted your snap".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] screenshotService created in Task 1 instead of Task 2**
- **Found during:** Task 1 (screenshotQueueService creation)
- **Issue:** screenshotQueueService.js imports recordScreenshot from screenshotService.js. ESLint import/no-unresolved blocks commit if the target module doesn't exist.
- **Fix:** Created full screenshotService.js implementation in Task 1 alongside the queue service
- **Files modified:** src/services/firebase/screenshotService.js
- **Verification:** ESLint passes, all 5 screenshotService tests GREEN
- **Committed in:** a051f1e7 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed RED test assertion argument count**
- **Found during:** Task 3 (Cloud Function test verification)
- **Issue:** screenshotNotification.test.js expected 6 arguments to sendPushNotification but standard (non-pinned) notifications only pass 5 arguments
- **Fix:** Removed `expect.anything()` 6th argument from test assertion
- **Files modified:** functions/__tests__/triggers/screenshotNotification.test.js
- **Verification:** All 3 screenshotNotification tests pass GREEN
- **Committed in:** bca62245 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
**IMPORTANT: expo-screen-capture is a native module.** A new EAS build is required for both platforms before the screenshot detection feature can be tested on devices. OTA update alone is insufficient.

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Next Phase Readiness
- Service layer complete: screenshotService + screenshotQueueService ready for hook integration
- Cloud Function handles system_screenshot type with push notifications
- Firestore rules permit screenshottedAt writes
- Plan 08-02 can integrate useScreenshotDetection hook in SnapViewer and add SystemMessage rendering

---
*Phase: 08-screenshot-detection*
*Completed: 2026-03-18*
