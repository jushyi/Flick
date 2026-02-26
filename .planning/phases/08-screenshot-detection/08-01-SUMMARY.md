---
phase: 08-screenshot-detection
plan: 01
subsystem: messaging
tags: [expo-screen-capture, firestore-rules, screenshot-detection, cloud-functions, push-notifications, offline-queue]

# Dependency graph
requires:
  - phase: 08-00
    provides: RED test scaffolds for screenshotService and screenshot notification Cloud Function
provides:
  - screenshotService.js with idempotent recordScreenshot (screenshottedAt + system message)
  - screenshotQueueService.js with AsyncStorage offline queue and retry
  - onNewMessage Cloud Function handling for system_screenshot message type
  - Firestore rules allowing screenshottedAt field on message updates
  - expo-screen-capture installed and registered in app.json plugins
  - Screenshot notification deep-link to Conversation screen
affects: [08-screenshot-detection]

# Tech tracking
tech-stack:
  added: [expo-screen-capture ~8.0.9]
  patterns: [idempotent check-then-write for screenshot recording, system message type in conversation, offline queue for failed writes]

key-files:
  created:
    - src/services/firebase/screenshotService.js
    - src/services/screenshotQueueService.js
  modified:
    - package.json
    - app.json
    - firestore.rules
    - functions/index.js
    - src/services/firebase/notificationService.js
    - __tests__/setup/jest.setup.js
    - functions/__tests__/triggers/screenshotNotification.test.js

key-decisions:
  - "senderId on system_screenshot message set to screenshotter's ID so onNewMessage derives recipientId correctly (snap sender gets notification)"
  - "system_screenshot messages do NOT increment unread count (informational, not actionable)"
  - "Notification deep-link handles both 'screenshot' and 'system_screenshot' type values for flexibility"
  - "Updated muted-conversation test to use existing dmEnabled preference check (no mutedBy field exists in codebase)"
  - "Removed { virtual: true } from expo-screen-capture jest mock now that package is installed"

patterns-established:
  - "System message pattern: type 'system_screenshot' with senderId = actor, not null, for Cloud Function compatibility"
  - "Offline queue pattern for non-critical writes: AsyncStorage persistence with MAX_RETRIES discard"

requirements-completed: [SCRN-01, SCRN-03]

# Metrics
duration: 10min
completed: 2026-02-26
---

# Phase 08 Plan 01: Screenshot Detection Service Layer Summary

**Idempotent screenshot recording service with Firestore writes (screenshottedAt + system message), AsyncStorage offline queue, Cloud Function push notification to snap sender, and notification deep-link routing**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-26T14:18:06Z
- **Completed:** 2026-02-26T14:28:23Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- screenshotService.js with idempotent recordScreenshot: checks screenshottedAt before writing, skips non-snap types, creates system_screenshot message in conversation
- screenshotQueueService.js with AsyncStorage persistence: queueScreenshotEvent, processScreenshotQueue (with MAX_RETRIES=3 discard), getQueueLength
- onNewMessage Cloud Function handles system_screenshot: updates lastMessage preview with message text, sends push notification with "screenshotted your snap" body, does NOT increment unread count, does NOT trigger streak updates
- Firestore rules updated to allow screenshottedAt field on message update rule
- expo-screen-capture ~8.0.9 installed and registered in app.json plugins
- Notification deep-link routes screenshot taps to Conversation screen
- All 5 screenshotService.test.js tests GREEN, all 3 screenshotNotification.test.js tests GREEN, all 22 smoke tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Install expo-screen-capture, update Firestore rules, create screenshotQueueService** - `2833fa9` (feat)
2. **Task 2: Create screenshotService with idempotent check-then-write logic** - `0435d70` (feat)
3. **Task 3: Extend onNewMessage for system_screenshot + add notification deep-link** - `a376843` (feat)

## Files Created/Modified
- `src/services/firebase/screenshotService.js` - Idempotent screenshot recording: screenshottedAt update + system_screenshot message creation
- `src/services/screenshotQueueService.js` - AsyncStorage offline queue for failed screenshot writes with retry
- `package.json` - Added expo-screen-capture ~8.0.9 dependency
- `app.json` - Added expo-screen-capture to plugins array
- `firestore.rules` - Added screenshottedAt to allowed message update fields for non-sender participants
- `functions/index.js` - Added system_screenshot handling in onNewMessage (no unread increment, text preview, push notification, data type)
- `src/services/firebase/notificationService.js` - Added screenshot/system_screenshot case in handleNotificationTapped for deep-link to Conversation
- `__tests__/setup/jest.setup.js` - Removed { virtual: true } from expo-screen-capture mock (package now installed)
- `functions/__tests__/triggers/screenshotNotification.test.js` - Updated mute test to use dmEnabled preference check

## Decisions Made
- Set senderId on system_screenshot message to the screenshotter's ID (not null) so the existing onNewMessage recipientId derivation logic works correctly without modification. The snap sender (who should receive the notification) is automatically derived as the "other participant" in the conversation.
- system_screenshot messages do NOT increment unread count -- they are informational system events, not actionable messages that need the user's attention.
- Added both 'screenshot' and 'system_screenshot' as handled notification types in notificationService to handle potential notification data type variations.
- Updated the muted-conversation test from Wave 0 to use the existing dmEnabled user preference check instead of a non-existent mutedBy conversation field. The plan explicitly states "The existing dmEnabled check already covers screenshot notifications."
- Removed the { virtual: true } flag from the expo-screen-capture jest.setup.js mock now that the package is installed in node_modules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added eslint-disable for unresolved import in screenshotQueueService**
- **Found during:** Task 1 (screenshotQueueService creation)
- **Issue:** screenshotQueueService.js imports from screenshotService.js which does not exist until Task 2. ESLint import/no-unresolved fails the pre-commit hook.
- **Fix:** Added eslint-disable-next-line comment for the import. Removed it in Task 2 when screenshotService.js was created.
- **Files modified:** src/services/screenshotQueueService.js
- **Verification:** Lint passes, import resolves after Task 2
- **Committed in:** 2833fa9 (Task 1), removed in 0435d70 (Task 2)

**2. [Rule 1 - Bug] Fixed Cloud Function test for non-existent mutedBy conversation field**
- **Found during:** Task 3 (Cloud Function test verification)
- **Issue:** Wave 0 test assumed a mutedBy field on conversation documents for conversation-level muting, but this feature does not exist in the codebase. The plan explicitly says to use the existing dmEnabled preference check.
- **Fix:** Updated test to set notificationPreferences.directMessages: false on the recipient user (the actual mute mechanism) instead of mutedBy on conversation.
- **Files modified:** functions/__tests__/triggers/screenshotNotification.test.js
- **Verification:** All 3 Cloud Function tests pass GREEN
- **Committed in:** a376843 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations documented above.

## User Setup Required
**IMPORTANT: expo-screen-capture is a native module.** A new EAS build is required for both platforms before any JS changes using this module can work at runtime. OTA update alone is insufficient.

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Next Phase Readiness
- Service layer complete: screenshotService and screenshotQueueService ready for UI integration
- Cloud Function handles system_screenshot push notifications
- Firestore rules permit screenshottedAt writes
- Plan 08-02 can now integrate useScreenshotDetection hook in SnapViewer and SystemMessage rendering in ConversationScreen
- All Wave 0 RED tests from 08-00 are now GREEN

## Self-Check: PASSED

- FOUND: src/services/firebase/screenshotService.js
- FOUND: src/services/screenshotQueueService.js
- FOUND: .planning/phases/08-screenshot-detection/08-01-SUMMARY.md
- FOUND: commit 2833fa9 (Task 1)
- FOUND: commit 0435d70 (Task 2)
- FOUND: commit a376843 (Task 3)

---
*Phase: 08-screenshot-detection*
*Completed: 2026-02-26*
