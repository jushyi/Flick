---
phase: 09-pinned-snaps-ios
plan: 18
subsystem: infra
tags: [firebase-admin, firebase-functions, cloud-functions, v2-api, migration]

# Dependency graph
requires: []
provides:
  - "firebase-admin v13.5+ with admin.messaging().send() live_activity_token field"
  - "firebase-functions v7+ with v2 trigger API (onDocumentCreated, onDocumentWritten, onSchedule)"
  - "Direct FieldValue/Timestamp imports from firebase-admin/firestore"
affects: [09-16-push-to-start-live-activities]

# Tech tracking
tech-stack:
  added: [firebase-admin@13.7.0, firebase-functions@7.2.2, firebase-functions-test@3.4.1]
  patterns: [v2 trigger API, direct firestore imports]

key-files:
  modified:
    - functions/package.json
    - functions/index.js
    - functions/notifications/receipts.js
    - functions/notifications/batching.js
    - functions/tasks/sendBatchedNotification.js
    - functions/__tests__/setup.js
    - functions/__tests__/smoke.test.js
    - functions/__tests__/scheduled/functions.test.js
    - functions/__tests__/triggers/streakFunctions.test.js

key-decisions:
  - "v1-to-v2 test adapter pattern: mock functions wrap handlers to accept both v1 (snap, context) and v2 (event) call styles, avoiding rewrite of all test files"
  - "Memory units changed from MB to MiB to match v2 API convention"
  - "onUpdate triggers migrated to onDocumentWritten with explicit before/after null guards"
  - "Helper files (receipts.js, batching.js, sendBatchedNotification.js) updated with direct FieldValue import"

patterns-established:
  - "v2 trigger pattern: onDocumentCreated({ document: 'path/{param}', memory, timeoutSeconds }, async (event) => { ... })"
  - "Direct import pattern: const { FieldValue, Timestamp } = require('firebase-admin/firestore')"

requirements-completed: [PINI-02]

# Metrics
duration: 13min
completed: 2026-03-19
---

# Phase 09 Plan 18: Firebase Functions v2 Migration Summary

**firebase-admin upgraded to v13.7.0 and firebase-functions to v7.2.2, all 24 trigger functions migrated from v1 to v2 API**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-19T20:28:03Z
- **Completed:** 2026-03-19T20:41:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Upgraded firebase-admin from ^12.0.0 to ^13.5.0 (installed 13.7.0), unblocking push-to-start Live Activities
- Migrated all 24 v1 trigger/scheduled/HTTP functions to v2 API (onDocumentCreated, onDocumentWritten, onDocumentDeleted, onSchedule, onRequest)
- Replaced all admin.firestore.FieldValue/Timestamp references with direct imports from firebase-admin/firestore across 4 source files
- All 148 tests pass across 9 test suites with v1-to-v2 adapter layer

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade firebase-admin and firebase-functions packages** - `75893209` (chore)
2. **Task 2: Migrate Firestore triggers and scheduled functions to v2 API** - `3ba104f3` (feat)

## Files Created/Modified
- `functions/package.json` - Updated dependency versions
- `functions/index.js` - All v1 triggers migrated to v2; FieldValue/Timestamp direct imports
- `functions/notifications/receipts.js` - FieldValue direct import
- `functions/notifications/batching.js` - FieldValue direct import
- `functions/tasks/sendBatchedNotification.js` - FieldValue direct import
- `functions/__tests__/setup.js` - v2 trigger mocks with v1-to-v2 adapter wrappers
- `functions/__tests__/smoke.test.js` - Updated to test FieldValue from firebase-admin/firestore
- `functions/__tests__/scheduled/functions.test.js` - Timestamp import from firebase-admin/firestore
- `functions/__tests__/triggers/streakFunctions.test.js` - v2 event shape for onNewMessage tests

## Decisions Made
- Used v1-to-v2 adapter pattern in test mocks: mock functions wrap v2 handlers to accept both v1 `(snap, context)` and v2 `(event)` call styles. This avoids rewriting 60+ test calls across 4 test files.
- Changed memory units from `MB` to `MiB` to match firebase-functions v2 API convention
- Migrated all onUpdate triggers to onDocumentWritten with explicit `event.data.before`/`event.data.after` null guards
- Updated helper files (receipts.js, batching.js, sendBatchedNotification.js) with direct FieldValue imports since they also referenced admin.firestore.FieldValue

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated test infrastructure for v2 API compatibility**
- **Found during:** Task 2
- **Issue:** Test mocks used v1 firebase-functions mock (runWith, firestore.document, pubsub.schedule). Tests called handlers with v1 `(snap, context)` signature but handlers now expect v2 `(event)` signature.
- **Fix:** Replaced v1 mock with v2 mocks (onDocumentCreated, onDocumentWritten, onDocumentDeleted, onSchedule, onRequest). Added v1-to-v2 adapter wrappers in mock functions. Updated smoke test and scheduled/streak test imports.
- **Files modified:** functions/__tests__/setup.js, functions/__tests__/smoke.test.js, functions/__tests__/scheduled/functions.test.js, functions/__tests__/triggers/streakFunctions.test.js
- **Verification:** All 148 tests pass
- **Committed in:** 3ba104f3

**2. [Rule 2 - Missing Critical] Updated helper files with direct FieldValue imports**
- **Found during:** Task 2
- **Issue:** notifications/receipts.js, notifications/batching.js, and tasks/sendBatchedNotification.js all used admin.firestore.FieldValue which is deprecated in firebase-admin v13
- **Fix:** Added `const { FieldValue } = require('firebase-admin/firestore')` and replaced all admin.firestore.FieldValue references
- **Files modified:** functions/notifications/receipts.js, functions/notifications/batching.js, functions/tasks/sendBatchedNotification.js
- **Verification:** Functions load without errors, all tests pass
- **Committed in:** 3ba104f3

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. Test infrastructure and helper files were not explicitly listed in the plan but required migration for the upgrade to work. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The upgraded functions will need to be deployed via `firebase deploy --only functions` but this is part of the normal deployment workflow.

## Next Phase Readiness
- firebase-admin v13.5+ is available for push-to-start Live Activities (Plan 09-16)
- All Cloud Functions ready for deployment with v2 API
- admin.messaging().send() with live_activity_token field is now available

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-19*
