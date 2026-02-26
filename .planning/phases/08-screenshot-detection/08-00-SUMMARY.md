---
phase: 08-screenshot-detection
plan: 00
subsystem: testing
tags: [jest, tdd, red-tests, expo-screen-capture, cloud-functions, screenshot-detection]

# Dependency graph
requires: []
provides:
  - RED test scaffolds for screenshotService (5 tests)
  - RED test scaffolds for screenshot notification Cloud Function (3 tests)
  - expo-screen-capture mock in jest.setup.js
affects: [08-screenshot-detection]

# Tech tracking
tech-stack:
  added: []
  patterns: [virtual mock for uninstalled expo modules, RED-first TDD scaffolding]

key-files:
  created:
    - __tests__/services/screenshotService.test.js
    - functions/__tests__/triggers/screenshotNotification.test.js
  modified:
    - __tests__/setup/jest.setup.js

key-decisions:
  - "Used { virtual: true } for expo-screen-capture mock since package not yet installed"
  - "Tightened notification test assertions to check type: system_screenshot (not direct_message) ensuring true RED state"
  - "Added unreadCount non-increment assertion to lastMessage test for complete system_screenshot behavior coverage"

patterns-established:
  - "Virtual module mocking: use { virtual: true } in jest.mock for packages not yet in node_modules"

requirements-completed: [SCRN-01, SCRN-02, SCRN-03]

# Metrics
duration: 6min
completed: 2026-02-26
---

# Phase 08 Plan 00: Test Scaffolds Summary

**RED test scaffolds for screenshot detection: 5 screenshotService tests + 3 Cloud Function notification tests + expo-screen-capture virtual mock**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T14:07:21Z
- **Completed:** 2026-02-26T14:13:08Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- expo-screen-capture mock added to jest.setup.js with addScreenshotListener, usePreventScreenCapture, preventScreenCaptureAsync, allowScreenCaptureAsync
- screenshotService.test.js with 5 RED tests: screenshottedAt write, system message creation, idempotency guard, non-snap skip, error handling
- screenshotNotification.test.js with 3 RED tests: push to snap sender with system_screenshot type, muted conversation skip, lastMessage update without unread increment
- Existing smoke tests remain green (22/22 pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expo-screen-capture mock to jest.setup.js** - `99bda7e` (test)
2. **Task 2: Create RED test file for screenshotService** - `08fb5ce` (test)
3. **Task 3: Create RED test file for screenshot notification Cloud Function** - `ad57d45` (test)

## Files Created/Modified
- `__tests__/setup/jest.setup.js` - Added expo-screen-capture virtual mock with addScreenshotListener and global export
- `__tests__/services/screenshotService.test.js` - 5 RED tests for recordScreenshot behavior (module not found)
- `functions/__tests__/triggers/screenshotNotification.test.js` - 3 RED tests for onNewMessage system_screenshot handling (assertion failures)

## Decisions Made
- Used `{ virtual: true }` option for jest.mock('expo-screen-capture') because the package is not yet installed (will be added in Plan 08-01 or 08-02). This prevents "Cannot find module" errors in the setup file itself while still allowing tests to import the mock.
- Tightened Cloud Function test assertions to check `type: 'system_screenshot'` in notification data (currently falls through as `'direct_message'`), ensuring all 3 tests are genuinely RED until the system_screenshot handling is implemented.
- Added explicit unreadCount non-increment assertion to test 3 to verify system_screenshot messages do not increase unread counters (new behavior).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added { virtual: true } to expo-screen-capture mock**
- **Found during:** Task 1 (jest.setup.js mock addition)
- **Issue:** expo-screen-capture is not installed yet. jest.mock fails with "Cannot find module" without virtual flag.
- **Fix:** Added `{ virtual: true }` as third argument to jest.mock()
- **Files modified:** __tests__/setup/jest.setup.js
- **Verification:** Smoke tests pass (22/22)
- **Committed in:** 99bda7e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for mock to work before package is installed. No scope creep.

## Issues Encountered
None beyond the virtual mock adjustment documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RED test scaffolds ready for Plans 08-01 (screenshotService implementation) and 08-02 (Cloud Function system_screenshot handling)
- Plans 08-01 and 08-02 can use real test commands in their verify steps instead of --passWithNoTests
- expo-screen-capture package still needs to be installed (Plan 08-01)

## Self-Check: PASSED

- FOUND: __tests__/setup/jest.setup.js
- FOUND: __tests__/services/screenshotService.test.js
- FOUND: functions/__tests__/triggers/screenshotNotification.test.js
- FOUND: .planning/phases/08-screenshot-detection/08-00-SUMMARY.md
- FOUND: commit 99bda7e (Task 1)
- FOUND: commit 08fb5ce (Task 2)
- FOUND: commit ad57d45 (Task 3)

---
*Phase: 08-screenshot-detection*
*Completed: 2026-02-26*
