---
phase: quick-24
plan: 01
subsystem: infra
tags: [push-notifications, expo, firebase-functions, logging, cloud-functions]

requires:
  - phase: none
    provides: N/A
provides:
  - Production-visible push notification pipeline logging in Cloud Functions
  - Stale push token detection on client-side token registration
  - Ticket result logging (ok/error) for every push send via Expo Push Service
affects: [push-notifications, cloud-functions, debugging]

tech-stack:
  added: []
  patterns: [info-level-production-logging, stale-token-detection, ticket-result-logging]

key-files:
  created: []
  modified:
    - functions/logger.js
    - functions/notifications/sender.js
    - src/services/firebase/notificationService.js

key-decisions:
  - 'Upgrade Cloud Functions logger to INFO level in production (was WARN-only, making push pipeline invisible)'
  - 'Log Expo Push Service ticket results at info/warn level instead of debug (visible in Cloud Logging)'
  - 'Add stale token comparison in storeNotificationToken to detect bundle ID switches'

patterns-established:
  - 'Info-level logs visible in production: Cloud Functions now output info-level logs for operational visibility'
  - 'Ticket result logging: Every push notification send logs its Expo ticket status (ok vs error)'

requirements-completed: [QUICK-24]

duration: 12min
completed: 2026-02-24
---

# Quick Task 24: Push Notifications Diagnosis and Logging Fix

**Upgraded Cloud Functions logger to production-visible INFO level and added push ticket result logging to diagnose stale token issue from dev/prod bundle ID split**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-24T17:07:42Z
- **Completed:** 2026-02-24T17:19:24Z
- **Tasks:** 2
- **Files modified:** 3

## Root Cause

Push notifications were not being delivered on the dev app because the dev Firestore database contained stale Expo push tokens from before the dev/prod bundle ID split. When the app was split into separate bundles (`com.spoodsjs.flick` for prod, `com.spoodsjs.flick.dev` for dev), the existing tokens in dev Firestore were still registered for the production bundle ID. Expo/APNs cannot deliver push notifications to a token registered for a different bundle ID.

In-app notifications (Firestore documents) worked fine because they are purely database reads and do not involve the push delivery pipeline.

The push pipeline was also completely invisible in Cloud Logging because the logger suppressed all info-level output in production (only WARN and ERROR were visible, and the `info()` function additionally required `isEmulator` to be true).

## Accomplishments

- Diagnosed the push notification pipeline across 5 layers: functions deployment, EXPO_ACCESS_TOKEN, logger visibility, env vars, and token format
- Identified the root cause: stale push tokens from the dev/prod bundle ID split
- Identified a secondary issue: Cloud Functions logger suppressed all info-level output in production, making the entire push notification pipeline invisible
- Upgraded logger to output info-level logs in production (removed `isEmulator` guard from `info()` and lowered `CURRENT_LOG_LEVEL` to `INFO`)
- Added ticket result logging in `sender.js` so every Expo Push Service response is visible
- Added stale token detection in `notificationService.js` that warns when a token changes during registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Diagnose the push notification pipeline** - (no code changes, diagnostic only)
2. **Task 2: Apply logging fix and stale token detection** - `381f4e6` (fix)

## Files Created/Modified

- `functions/logger.js` - Upgraded production log level from WARN to INFO; removed `isEmulator` guard from `info()` function so info-level logs appear in Cloud Logging
- `functions/notifications/sender.js` - Added ticket result logging at info/warn level with userId, token prefix, ticket ID, and notification type
- `src/services/firebase/notificationService.js` - Added stale token comparison in `storeNotificationToken()` that warns when token changes; upgraded `getNotificationToken()` to log token prefix and projectId at info level

## Decisions Made

- **Upgraded logger to INFO in production:** Previously only WARN and ERROR were visible. INFO is needed for operational visibility into the push pipeline (sends, receipts, token registrations). DEBUG remains emulator-only to avoid excessive log volume.
- **Log ticket results at info/warn (not debug):** Every `sendPushNotification` call now logs whether the Expo ticket was `ok` or `error`, making delivery issues immediately visible in Cloud Functions logs.
- **Stale token detection via local SecureStore comparison:** The client-side `storeNotificationToken` now compares the new token against the locally stored one. If different, it logs a warning. This catches bundle ID switches, reinstalls, and token refreshes.

## Deviations from Plan

None - plan executed as written. The diagnostic findings informed the fix application.

## Issues Encountered

- Cloud Functions logs (`firebase functions:log`) only showed execution start/finish messages (GCP-level) with no application-level output due to the logger suppressing info-level in production. This was the secondary problem that made the primary issue (stale tokens) invisible.
- `EXPO_ACCESS_TOKEN` secret does not exist on either Firebase project (dev or prod). This is not the root cause -- Expo SDK works without it (falls back to anonymous/lower rate limits). The user may want to set this up for production reliability.

## User Action Required

After deploying these changes:

1. **Deploy functions to dev:** `firebase deploy --only functions --project re-lapse-fa89b`
2. **Deploy OTA update to dev app:** `eas update --branch development --message "Fix push notification logging and token detection"`
3. **Re-open the dev app** on physical devices -- this triggers the auth state change listener in App.js which calls `getNotificationToken()` to register a fresh token for the dev bundle ID
4. **Verify:** Send a DM between two test accounts on the dev app. Check Cloud Functions logs: `firebase functions:log --project re-lapse-fa89b --only onNewMessage`
5. The logs should now show: token registration, push send attempt, Expo ticket result (ok or error)

## Next Steps

- Consider setting up `EXPO_ACCESS_TOKEN` as a Firebase secret on both projects for higher rate limits
- After confirming pushes work on dev, the same logging improvements will help diagnose any future push issues on production
- Monitor Cloud Logging costs -- info-level logging produces more output than warn-only

---

_Quick Task: 24-push-notifs-for-dev-app-doesn-t-seem-to-_
_Completed: 2026-02-24_
