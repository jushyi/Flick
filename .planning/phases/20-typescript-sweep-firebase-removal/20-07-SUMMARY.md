---
phase: 20-typescript-sweep-firebase-removal
plan: 07
subsystem: testing
tags: [jest, typescript, supabase-mock, sentry-mock, test-infrastructure]

requires:
  - phase: 12-typescript-foundation
    provides: TypeScript configuration and path aliases

provides:
  - jest.setup.ts with Supabase + Sentry mocks replacing Firebase mocks
  - sentryService test scaffold for Plan 02 validation
  - moduleNameMapper entries for @sentry/react-native and Firebase manual mocks

affects: [20-02, 20-03, 20-04, 20-05, 20-06, 20-08]

tech-stack:
  added: []
  patterns: ["(global as any).__supabaseMocks for Supabase test mock access", "(global as any).__sentryMocks for Sentry test mock access", "moduleNameMapper for uninstalled package mocking"]

key-files:
  created:
    - __tests__/setup/jest.setup.ts
    - __tests__/services/sentryService.test.ts
    - __tests__/__mocks__/@sentry/react-native.js
    - __tests__/__mocks__/@react-native-firebase/functions.js
    - __tests__/__mocks__/@react-native-firebase/messaging.js
    - __tests__/__mocks__/@react-native-firebase/perf.js
    - __tests__/__mocks__/performanceService.js
  modified:
    - jest.config.js
    - __tests__/__mocks__/@react-native-firebase/firestore.js

key-decisions:
  - "Kept legacy Firebase jest.mock globals for backward compatibility with old .js tests"
  - "Used moduleNameMapper for @sentry/react-native since package not yet installed"
  - "Added modular API exports to firestore manual mock for source code import compatibility"
  - "Used describe.skip for sentryService tests until Plan 02 creates source module"

patterns-established:
  - "Supabase mock pattern: __supabaseMocks global with auth, storage, storageBucket, functions, from"
  - "Sentry mock pattern: __sentryMocks global with init, setUser, startSpan, captureException"
  - "Manual mock files in __tests__/__mocks__/ with moduleNameMapper for uninstalled packages"

requirements-completed: [CLEAN-05, TS-04]

duration: 12min
completed: 2026-03-25
---

# Phase 20 Plan 07: Test Infrastructure Summary

**jest.setup.ts with Supabase/Sentry mocks, legacy Firebase backward compatibility, and sentryService test scaffold**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T18:10:11Z
- **Completed:** 2026-03-25T18:22:34Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created jest.setup.ts with full Supabase client mock (auth, from, storage, rpc, channel) and Sentry mock
- Maintained backward compatibility with legacy .js tests by populating global Firebase mocks from manual mock files
- Created sentryService.test.ts scaffold with tests for initSentry, withTrace, setSentryUser (skipped until Plan 02)
- 46 test suites passing (34 failing due to pre-existing deleted Firebase service files from other parallel agents)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite jest.setup with Supabase + Sentry mocks** - `0fbf7a65` (feat)
2. **Task 2: Create sentryService test scaffold** - `eaa6a9c7` (test)

## Files Created/Modified
- `__tests__/setup/jest.setup.ts` - Main test setup with Supabase, Sentry, Expo, and legacy Firebase mocks
- `__tests__/services/sentryService.test.ts` - Test scaffold for sentryService (Plan 02 target)
- `__tests__/__mocks__/@sentry/react-native.js` - Manual mock for uninstalled @sentry/react-native
- `__tests__/__mocks__/@react-native-firebase/functions.js` - Manual mock for Firebase Functions
- `__tests__/__mocks__/@react-native-firebase/messaging.js` - Manual mock for Firebase Messaging
- `__tests__/__mocks__/@react-native-firebase/perf.js` - Manual mock for Firebase Performance
- `__tests__/__mocks__/performanceService.js` - Manual mock for deleted performanceService
- `__tests__/__mocks__/@react-native-firebase/firestore.js` - Updated with modular API exports
- `jest.config.js` - Updated setup path to .ts and added moduleNameMapper entries

## Decisions Made
- Kept legacy Firebase global mocks in jest.setup.ts for backward compatibility: old .js tests reference global.mockGetDoc, global.mockSignOut, etc. These are populated from manual mock files and will be removed when .js tests are converted to .ts.
- Used moduleNameMapper for @sentry/react-native because the package is not yet installed (Plan 02 installs it). The manual mock file at __tests__/__mocks__/@sentry/ allows Jest to resolve the module.
- Added modular API exports (getDoc, getDocs, collection, doc, etc.) to the firestore manual mock file so source code using `import { getDoc } from '@react-native-firebase/firestore'` can resolve properly.
- Used describe.skip for sentryService tests since the source module does not exist yet. Plan 02's executor will remove the .skip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created manual mock files for Firebase messaging/functions/perf**
- **Found during:** Task 1 (jest.setup rewrite)
- **Issue:** Old jest.setup.js provided jest.mock() for @react-native-firebase/messaging, functions, and perf inline. Without those, old .js tests that import these fail.
- **Fix:** Created manual mock files at __tests__/__mocks__/@react-native-firebase/{messaging,functions,perf}.js and added moduleNameMapper entries.
- **Files modified:** jest.config.js, 3 new mock files
- **Verification:** npm test passes for suites not blocked by deleted service files
- **Committed in:** 0fbf7a65

**2. [Rule 3 - Blocking] Created performanceService manual mock**
- **Found during:** Task 1 (jest.setup rewrite)
- **Issue:** src/services/firebase/performanceService.js was deleted by other agents. Old .js tests mock it with jest.mock() which fails when module path doesn't exist.
- **Fix:** Created __tests__/__mocks__/performanceService.js and added moduleNameMapper entry to resolve the path.
- **Files modified:** jest.config.js, __tests__/__mocks__/performanceService.js
- **Verification:** performanceService mock resolves correctly
- **Committed in:** 0fbf7a65

**3. [Rule 3 - Blocking] Added modular API exports to firestore manual mock**
- **Found during:** Task 1 (jest.setup rewrite)
- **Issue:** Source code imports like `import { getDoc, doc } from '@react-native-firebase/firestore'` need named exports. Manual mock only had mock-prefixed exports.
- **Fix:** Added all modular API exports (getDoc, getDocs, doc, collection, etc.) to the firestore manual mock.
- **Files modified:** __tests__/__mocks__/@react-native-firebase/firestore.js
- **Verification:** Tests using modular Firestore imports resolve correctly
- **Committed in:** 0fbf7a65

**4. [Rule 3 - Blocking] Retained legacy Firebase global mocks**
- **Found during:** Task 1 (jest.setup rewrite)
- **Issue:** Plan says "Remove ALL @react-native-firebase/* mocks" but old .js tests use global.mockGetDoc, global.mockSignOut, etc.
- **Fix:** Added legacy Firebase global mock population section in jest.setup.ts sourcing from manual mock files.
- **Files modified:** __tests__/setup/jest.setup.ts
- **Verification:** Smoke test and other .js tests that reference globals pass
- **Committed in:** 0fbf7a65

---

**Total deviations:** 4 auto-fixed (4 blocking)
**Impact on plan:** All auto-fixes necessary for backward compatibility. Without them, all 80 test suites would fail. The plan's intent (Supabase + Sentry mocks) was fully achieved alongside the backward compat fixes.

## Issues Encountered
- 34 test suites fail due to pre-existing issue: src/services/firebase/*.js files deleted by other parallel agents while old .js tests still reference them. This is expected during the migration and will resolve as old .js tests are converted to .ts in subsequent plans. With the original jest.setup.js, all 80 suites fail on the current branch state, so the new jest.setup.ts is an improvement.

## Known Stubs
None - no stubs in test infrastructure files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure ready for Plan 02 (sentryService) and all subsequent conversion plans
- Supabase mocks available via __supabaseMocks global
- Sentry mocks available via __sentryMocks global and jest.mock
- Legacy Firebase mocks preserved until .js test conversion completes

## Self-Check: PASSED

- All 7 created files exist
- jest.setup.js confirmed deleted
- Commit 0fbf7a65 (Task 1) exists
- Commit eaa6a9c7 (Task 2) exists

---
*Phase: 20-typescript-sweep-firebase-removal*
*Completed: 2026-03-25*
