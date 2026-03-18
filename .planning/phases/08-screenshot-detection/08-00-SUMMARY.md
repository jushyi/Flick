---
phase: 08-screenshot-detection
plan: 00
subsystem: testing
tags: [jest, expo-screen-capture, cloud-functions, screenshot-detection, tdd]

# Dependency graph
requires: []
provides:
  - "RED test scaffolds for screenshotService (5 tests covering SCRN-02, SCRN-03)"
  - "RED test scaffolds for screenshot notification Cloud Function (3 tests covering SCRN-01)"
  - "expo-screen-capture mock in jest setup for hook-level tests"
affects: [08-screenshot-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "moduleNameMapper for uninstalled native modules in jest.config.js"
    - "Manual mock file at __tests__/__mocks__/ for modules not yet in node_modules"

key-files:
  created:
    - "__tests__/services/screenshotService.test.js"
    - "functions/__tests__/triggers/screenshotNotification.test.js"
    - "__tests__/__mocks__/expo-screen-capture.js"
  modified:
    - "__tests__/setup/jest.setup.js"
    - "jest.config.js"

key-decisions:
  - "Used moduleNameMapper + manual mock file for expo-screen-capture since package is not yet installed (requires native build)"
  - "Cloud Function tests assert type:'screenshot' in notification data and no unreadCount increment to ensure RED state against current generic handler"

patterns-established:
  - "Manual mock pattern: create __tests__/__mocks__/<package>.js + add moduleNameMapper entry for packages not yet in node_modules"

requirements-completed: [SCRN-01, SCRN-02, SCRN-03]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 8 Plan 00: Screenshot Detection RED Test Scaffolds Summary

**RED test suites for screenshotService (5 tests) and screenshotNotification Cloud Function (3 tests) with expo-screen-capture mock infrastructure**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T16:58:45Z
- **Completed:** 2026-03-18T17:03:23Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- expo-screen-capture mock registered in jest.setup.js with global mockAddScreenshotListener, plus manual mock file and moduleNameMapper for uninstalled native module
- screenshotService.test.js with 5 RED tests: screenshottedAt write, system message creation, idempotency guard, non-snap skip, error handling
- screenshotNotification.test.js with 3 RED tests (2 failing): push notification type:screenshot assertion, notification preferences check, no unreadCount increment for system messages
- Existing smoke test suite (22 tests) continues to pass with new mock

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expo-screen-capture mock to jest.setup.js** - `8da6c85f` (test)
2. **Task 2: Create RED test file for screenshotService** - `d698ebe8` (test)
3. **Task 3: Create RED test file for screenshot notification Cloud Function** - `88a69dc9` (test)

## Files Created/Modified
- `__tests__/__mocks__/expo-screen-capture.js` - Manual mock for uninstalled native module
- `__tests__/setup/jest.setup.js` - Added expo-screen-capture mock with global mockAddScreenshotListener
- `jest.config.js` - Added moduleNameMapper entry for expo-screen-capture
- `__tests__/services/screenshotService.test.js` - 5 RED tests for SCRN-02 and SCRN-03 behaviors
- `functions/__tests__/triggers/screenshotNotification.test.js` - 3 RED tests for SCRN-01 behaviors

## Decisions Made
- **moduleNameMapper for uninstalled module:** expo-screen-capture is not yet in node_modules (requires native EAS build). Created a manual mock file at `__tests__/__mocks__/expo-screen-capture.js` and added a `moduleNameMapper` entry in `jest.config.js` to resolve imports. The jest.setup.js mock overrides this with configurable jest.fn() instances.
- **Cloud Function RED test strategy:** The current `onNewMessage` function handles system_screenshot generically (as direct_message type, with unread count increment). Tests assert specific screenshot behavior (type:'screenshot' in notification data, no unreadCount increment) that will only pass after Plan 08-02 adds dedicated handling. This ensures 2 of 3 tests are genuinely RED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] expo-screen-capture not in node_modules**
- **Found during:** Task 1 (jest.setup.js mock)
- **Issue:** `jest.mock('expo-screen-capture', ...)` in setupFilesAfterEnv fails because Jest cannot resolve a module that is not installed
- **Fix:** Created manual mock file at `__tests__/__mocks__/expo-screen-capture.js` and added `moduleNameMapper` entry in `jest.config.js` to bypass module resolution
- **Files modified:** `jest.config.js`, `__tests__/__mocks__/expo-screen-capture.js`
- **Verification:** Smoke test passes (22/22 tests)
- **Committed in:** 8da6c85f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to make the expo-screen-capture mock work before the package is installed. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All RED test scaffolds in place for Plans 08-01 (screenshotService implementation) and 08-02 (Cloud Function system_screenshot handling)
- Plans 08-01 and 08-02 can use real test commands in verify steps instead of --passWithNoTests
- expo-screen-capture package still needs to be installed (npx expo install expo-screen-capture) as part of Plan 08-01

---
*Phase: 08-screenshot-detection*
*Completed: 2026-03-18*
