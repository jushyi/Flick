---
phase: 46-performance-optimization
plan: 02
subsystem: database
tags: [firestore, indexes, query-limits, count-aggregation, batch-reads, performance]

# Dependency graph
requires:
  - phase: 46-01
    provides: server-side filtered feed queries with `in` operator
provides:
  - composite indexes for all queried field combinations
  - bounded queries with .limit() on all service files
  - batch user data fetching with deduplication
  - count() aggregation for photo counts
affects: [46-07-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      getCountFromServer for count-only queries,
      batch user fetch with Promise.all + Map lookup,
      .limit() on all Firestore queries,
    ]

key-files:
  created: []
  modified:
    - firestore.indexes.json
    - src/services/firebase/photoService.js
    - src/services/firebase/feedService.js
    - src/services/firebase/albumService.js
    - src/services/firebase/blockService.js
    - src/services/firebase/notificationService.js
    - src/services/firebase/userService.js
    - src/services/firebase/friendshipService.js

key-decisions:
  - 'Use getCountFromServer for all count-only queries (developing, revealed, journaled, archived)'
  - 'Batch user reads via Promise.all with Set deduplication and Map lookup'
  - '500 limit for social bounds (blocks, friends), 100 for content (photos, albums), 1 for existence checks'

patterns-established:
  - 'All Firestore queries must have .limit() — no unbounded reads'
  - 'Count-only operations use getCountFromServer instead of getDocs().size'
  - 'Multi-user reads batched with batchFetchUserData helper'

issues-created: []

# Metrics
duration: 9min
completed: 2026-02-10
---

# Phase 46 Plan 02: Firestore Indexes & Read Optimization Summary

**Composite indexes for 5 new query patterns, .limit() on all unbounded queries across 7 service files, batch user reads with dedup, and count() aggregation for photo counts**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-10T14:29:31Z
- **Completed:** 2026-02-10T14:38:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added 5 new composite indexes and 12 field exemptions to firestore.indexes.json
- Applied .limit() to every unbounded Firestore query across 7 service files
- Parallelized sequential user reads in blockService with Promise.all
- Created batchFetchUserData helper for deduplicated batch user fetching in feedService
- Converted all count-only operations (getDevelopingPhotoCount, getDarkroomCounts, getFeedStats) to getCountFromServer
- Rewrote markNotificationsAsRead with batched loop pattern (500 per batch)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update indexes and add query limits** - `2d0b697` (perf)
2. **Task 2: Batch user reads and use count aggregation** - `acc5f99` (perf)

**Plan metadata:** (pending)

## Files Created/Modified

- `firestore.indexes.json` - 5 new composite indexes + 12 field exemptions (8 total indexes)
- `src/services/firebase/photoService.js` - .limit() on all queries, getCountFromServer for counts
- `src/services/firebase/feedService.js` - batchFetchUserData helper, getCountFromServer for getFeedStats, .limit() on all queries
- `src/services/firebase/albumService.js` - .limit(50) on getUserAlbums
- `src/services/firebase/blockService.js` - .limit(500) on block queries, Promise.all for getBlockedUsersWithProfiles
- `src/services/firebase/notificationService.js` - .limit(500) batched loop for markNotificationsAsRead
- `src/services/firebase/userService.js` - .limit(1) on checkUsernameAvailability
- `src/services/firebase/friendshipService.js` - .limit(500) on all friendship queries

## Decisions Made

- Used 500 as practical upper bound for social queries (blocks, friends) — covers extreme cases without unbounded risk
- Used 100 for content queries (photos, albums) — reasonable page size
- Used 1 for existence checks (username availability) — only need to know if any match exists
- Converted getDarkroomCounts to count() aggregation even though only getDevelopingPhotoCount was explicitly called out — same pattern, same benefit

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed shadowed `limit` parameter in getTopPhotosByEngagement**

- **Found during:** Task 1 (adding .limit() imports)
- **Issue:** Function parameter named `limit` shadowed the Firestore `limit` function import, causing runtime error
- **Fix:** Renamed parameter from `limit` to `maxCount`
- **Files modified:** src/services/firebase/feedService.js
- **Verification:** No naming conflict, function works correctly
- **Committed in:** 2d0b697 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Additional unbounded queries bounded**

- **Found during:** Task 1 (scanning all service files)
- **Issue:** Several queries not explicitly listed in plan were also unbounded (removeBlockedUserContent, getDarkroomCounts, getDevelopingPhotos, getDeletedPhotos, migratePhotoStateField, getUserStoriesData, getFriendStoriesData, getTopPhotosByEngagement)
- **Fix:** Added .limit() to all discovered unbounded queries
- **Files modified:** All service files
- **Verification:** Grep confirms no unbounded getDocs/onSnapshot queries remain
- **Committed in:** 2d0b697 (Task 1 commit)

**3. [Rule 2 - Missing Critical] getDarkroomCounts also converted to count()**

- **Found during:** Task 2 (count aggregation work)
- **Issue:** getDarkroomCounts used getDocs().size identically to getDevelopingPhotoCount — same inefficiency
- **Fix:** Converted to getCountFromServer for both developing and revealed queries
- **Files modified:** src/services/firebase/photoService.js
- **Verification:** Function returns counts without downloading documents
- **Committed in:** acc5f99 (Task 2 commit)

### Deferred Enhancements

None.

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing critical), 0 deferred
**Impact on plan:** All auto-fixes necessary for correctness and completeness. No scope creep.

## Issues Encountered

None

## Next Phase Readiness

- All Firestore queries now bounded with appropriate limits
- Composite indexes defined for all queried field combinations
- User data reads optimized from N individual calls to batch
- Count operations download zero documents
- Ready for 46-03-PLAN.md (Image Loading & Caching)

---

_Phase: 46-performance-optimization_
_Completed: 2026-02-10_
