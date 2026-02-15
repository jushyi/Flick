---
phase: 52-systematic-uat
plan: 03
subsystem: auth
tags: [phone-auth, sign-out, sign-in, delete-account, expo-image, firebase-perf, uat]

# Dependency graph
requires:
  - phase: 52-01
    provides: Test account created and logged in
provides:
  - Auth sign out/in flow verified on device
  - Delete account flow verified (validation, confirmation, cancel)
  - expo-image cache cleared on sign out (gray photos fix)
  - Firebase Performance modular API fix
affects: [52-04, 52-08, 53]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - expo-image cache clearing on auth state change

key-files:
  created: []
  modified:
    - src/context/AuthContext.js
    - src/services/firebase/performanceService.js

key-decisions:
  - 'Clear expo-image disk+memory cache on sign out to prevent stale gray photos on re-login'
  - 'Use perf.dataCollectionEnabled property setter instead of removed modular setPerformanceCollectionEnabled'
  - 'Use trace() + start() instead of removed modular startTrace()'

patterns-established:
  - 'expo-image cache must be invalidated on auth state transitions'

issues-created: []

# Metrics
duration: 54min
completed: 2026-02-14
---

# Plan 52-03 Summary: Auth & Account Management UAT

**Sign out/in flow and delete account validation verified on device, with two inline bug fixes: expo-image stale cache on re-login and Firebase Performance modular API TypeError**

## Performance

- **Duration:** 54 min
- **Started:** 2026-02-14T20:38:17Z
- **Completed:** 2026-02-14T21:32:04Z
- **Tasks:** 3
- **Files modified:** 2

## Test Results

**Sign Out/In:**

- Sign out: PASS — confirmation alert appears, returns to PhoneInputScreen
- Sign in: PASS — SMS received, code accepted, navigates to MainTabs
- Profile data preservation: PASS — all data intact after re-login
- Highlights rendering after re-login: PASS (after fix) — expo-image cache clearing resolved gray blanks

**Edge Cases:**

- Wrong code handling: PASS — error message shown, no crash
- Resend code: PASS — new SMS arrives, latest code works

**Delete Account:**

- Navigation: PASS — DeleteAccountScreen appears with warning
- Validation: PASS — case-sensitive "DELETE" required, button state updates immediately
- Confirmation flow: PASS — final alert appears, cancel preserves account
- Cancel preservation: PASS — account fully intact, all data accessible

## Task Commits

Each task was committed atomically:

1. **Task 1: Sign out/in flow (checkpoint)** — `34ce8fa` (fix) — expo-image cache clearing on sign out
2. **Task 2: Delete account flow (checkpoint)** — no code changes, manual verification only
3. **Task 3: Fix issues found** — `a93c0d5` (fix) — Firebase Performance modular API imports

**Plan metadata:** (pending)

## Files Created/Modified

- `src/context/AuthContext.js` — Added expo-image cache clearing (clearMemoryCache + clearDiskCache) during sign out flow
- `src/services/firebase/performanceService.js` — Fixed modular API imports: setPerformanceCollectionEnabled → dataCollectionEnabled property, startTrace → trace() + start()

## Decisions Made

- Clear expo-image disk+memory cache on sign out — prevents stale gray photos when user re-authenticates
- Use `perf.dataCollectionEnabled = false` instead of removed `setPerformanceCollectionEnabled()` modular function
- Use `trace()` + `start()` instead of removed `startTrace()` modular function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gray/blank highlights (Selects) after sign out and re-login**

- **Found during:** Task 1 (Sign out/in verification)
- **Issue:** expo-image persistent disk/memory cache survived across sign out/in cycles, serving stale image data that rendered as gray blanks
- **Fix:** Added `Image.clearMemoryCache()` and `Image.clearDiskCache()` to AuthContext signOut() flow
- **Files modified:** src/context/AuthContext.js
- **Verification:** User confirmed highlights load properly after re-login
- **Committed in:** 34ce8fa

**2. [Rule 3 - Blocking] Firebase Performance modular API TypeError on app startup**

- **Found during:** Task 1 (app reload for testing)
- **Issue:** `setPerformanceCollectionEnabled` and `startTrace` are not exported from `@react-native-firebase/perf` v23 modular API, causing runtime TypeError
- **Fix:** Used `perf.dataCollectionEnabled` property setter and `trace()` + `start()` modular functions
- **Files modified:** src/services/firebase/performanceService.js
- **Verification:** App starts without TypeError
- **Committed in:** a93c0d5

### Deferred Enhancements

None.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for app to function correctly during testing. No scope creep.

## Issues Encountered

None — both discovered issues were fixed inline.

## Next Phase Readiness

- Auth flows fully verified, ready for subsequent UAT plans
- Account preserved for remaining test plans (52-04 through 52-09)

---

_Phase: 52-systematic-uat_
_Completed: 2026-02-14_
