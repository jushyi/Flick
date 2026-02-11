---
phase: 47-firebase-perf-monitoring
plan: 02
subsystem: infra
tags: [firebase-perf, withTrace, custom-traces, performance-monitoring]

# Dependency graph
requires:
  - phase: 47-01
    provides: performanceService.js with withTrace wrapper and initPerformanceMonitoring
provides:
  - 14 custom performance traces across 8 Firebase service files
  - Full-stack visibility into auth, feed, camera, profile, social, notification, and stories operations
affects: [47-03-screen-traces, 48-ui-ux-audit]

# Tech tracking
tech-stack:
  added: []
  patterns: [withTrace wrapper for async service functions, feature-area trace naming convention]

key-files:
  created: []
  modified:
    - src/services/firebase/phoneAuthService.js
    - src/services/firebase/feedService.js
    - src/services/firebase/storageService.js
    - src/services/firebase/photoService.js
    - src/services/firebase/userService.js
    - src/services/firebase/friendshipService.js
    - src/services/firebase/notificationService.js
    - src/services/firebase/viewedStoriesService.js

key-decisions:
  - '14 traces instead of ~18: phoneAuthService has no separate signup function (phone auth is unified), notificationService has no load-feed function in this file'

patterns-established:
  - 'Feature-area trace naming: auth/, feed/, camera/, profile/, photo/, social/, notif/, stories/'
  - 'putMetric for count data: photo_count, friend_count'
  - 'Attributes for query context: cache_status'

issues-created: []

# Metrics
duration: 6min
completed: 2026-02-11
---

# Phase 47 Plan 02: Service File Instrumentation Summary

**14 custom withTrace calls across 8 Firebase service files covering auth, feed, camera, profile, photo, social, notification, and stories operations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-11T00:12:03Z
- **Completed:** 2026-02-11T00:17:58Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Instrumented all 8 target service files with withTrace performance traces
- Added putMetric calls for photo_count, friend_count on feed and social operations
- Added cache_status attribute on feed/load to distinguish initial vs paginated loads
- Feature-area naming convention consistently applied across all 14 traces

## Task Commits

Each task was committed atomically:

1. **Task 1: Instrument auth, feed, camera, and photo services** - `6f14b3b` (feat)
2. **Task 2: Instrument social, profile, notification, and stories services** - `cb396f9` (feat)

## Trace Inventory

| Service File            | Traces | Names                                                                         |
| ----------------------- | ------ | ----------------------------------------------------------------------------- |
| phoneAuthService.js     | 2      | auth/login, auth/verify_code                                                  |
| feedService.js          | 2      | feed/load (with metrics), feed/refresh (with metric)                          |
| storageService.js       | 2      | camera/upload, profile/upload_photo                                           |
| photoService.js         | 1      | photo/triage                                                                  |
| userService.js          | 2      | profile/load, profile/update                                                  |
| friendshipService.js    | 3      | social/load_friends (with metric), social/send_request, social/accept_request |
| notificationService.js  | 1      | notif/register_token                                                          |
| viewedStoriesService.js | 1      | stories/mark_viewed                                                           |
| **Total**               | **14** |                                                                               |

## Files Created/Modified

- `src/services/firebase/phoneAuthService.js` - Added auth/login, auth/verify_code traces
- `src/services/firebase/feedService.js` - Added feed/load, feed/refresh traces with photo_count metrics
- `src/services/firebase/storageService.js` - Added camera/upload, profile/upload_photo traces
- `src/services/firebase/photoService.js` - Added photo/triage trace
- `src/services/firebase/userService.js` - Added profile/load, profile/update traces
- `src/services/firebase/friendshipService.js` - Added social/load_friends, social/send_request, social/accept_request traces
- `src/services/firebase/notificationService.js` - Added notif/register_token trace
- `src/services/firebase/viewedStoriesService.js` - Added stories/mark_viewed trace

## Decisions Made

- 14 traces instead of estimated ~18: phoneAuthService has no separate signup function (phone auth is unified flow for login and signup), notificationService has no "load notification feed" function in this service file (notification loading likely happens via Firestore queries in context/hooks)

## Deviations from Plan

None — plan executed as written with expected adaptation to actual function names.

## Issues Encountered

None

## Next Phase Readiness

- 14 custom traces covering all critical backend operations
- Ready for 47-03: Screen Traces & Build Verification

---

_Phase: 47-firebase-perf-monitoring_
_Completed: 2026-02-11_
