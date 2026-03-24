---
phase: 15-core-services-photos-feed-darkroom
plan: 03
subsystem: hooks
tags: [powersync, tanstack-query, useInfiniteQuery, reactive-sql, darkroom, feed]

requires:
  - phase: 15-01
    provides: "photoService.ts (Photo type, mapToPhoto), darkroomService.ts (checkAndRevealPhotos, calculateBatchRevealAt)"
  - phase: 15-02
    provides: "feedService.ts (getFeed RPC, FeedPhoto type)"
  - phase: 14-02
    provides: "PowerSync reactive useQuery, TanStack QueryClientProvider, queryKeys factory"
provides:
  - "useDarkroom.ts: reactive darkroom hook with PowerSync queries, countdown timer, reveal check"
  - "useFeedPhotos.ts: paginated feed hook with TanStack useInfiniteQuery, stories grouping, curation"
affects: [15-04, 16-screen-migration, darkroom-screen, feed-screen]

tech-stack:
  added: []
  patterns:
    - "PowerSync useQuery for reactive local SQLite reads in hooks"
    - "TanStack useInfiniteQuery with cursor pagination for paginated server data"
    - "Pure function exports (curateTopPhotosPerFriend, groupByUser) for direct unit testing"
    - "mockImplementation with SQL string matching for PowerSync useQuery test isolation"

key-files:
  created:
    - src/hooks/useDarkroom.ts
    - src/hooks/useFeedPhotos.ts
    - __tests__/hooks/useDarkroom.test.ts
    - __tests__/hooks/useFeedPhotos.test.ts
  modified: []

key-decisions:
  - "Used mockImplementation with SQL string matching for PowerSync useQuery tests (renderHook re-renders consume mockReturnValueOnce)"
  - "Exported curateTopPhotosPerFriend and groupByUser as named exports for direct pure-function testing"
  - "Explicit .ts import in tests to avoid Jest resolving old .js file (strangler fig coexistence)"

patterns-established:
  - "PowerSync reactive hook pattern: usePowerSyncQuery with SQL + mapToPhoto for typed reactive data"
  - "TanStack infinite query hook pattern: useInfiniteQuery + queryKeys + meta.persist for cacheable paginated hooks"
  - "Strangler fig test imports: explicit .ts extension to disambiguate from old .js hooks"

requirements-completed: [CORE-01, CORE-02, CORE-03, CORE-07]

duration: 5min
completed: 2026-03-24
---

# Phase 15 Plan 03: Hook Migration Summary

**Reactive PowerSync darkroom hook with countdown timer and TanStack infinite query feed hook with stories-style grouping and engagement curation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T15:19:28Z
- **Completed:** 2026-03-24T15:24:55Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- useDarkroom.ts provides reactive developing/revealed photo lists from PowerSync local SQLite with 1-second countdown timer and reveal check/trigger
- useFeedPhotos.ts provides paginated feed via TanStack useInfiniteQuery with cursor pagination, top-5-per-friend curation by engagement, and stories-style grouping
- 24 total tests (11 darkroom + 13 feed) covering all hook return values, timer behavior, pagination, grouping, and service integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite useDarkroom.ts with PowerSync reactive queries** - `0046fe11` (feat)
2. **Task 2: Rewrite useFeedPhotos.ts with TanStack useInfiniteQuery** - `10bf7766` (feat)

## Files Created/Modified
- `src/hooks/useDarkroom.ts` - PowerSync reactive darkroom hook with countdown timer and reveal check
- `src/hooks/useFeedPhotos.ts` - TanStack useInfiniteQuery feed hook with stories grouping and curation
- `__tests__/hooks/useDarkroom.test.ts` - 11 tests for darkroom hook behavior
- `__tests__/hooks/useFeedPhotos.test.ts` - 13 tests for feed hook behavior (pure functions + hook integration)

## Decisions Made
- Used `mockImplementation` with SQL string matching for PowerSync useQuery tests because `mockReturnValueOnce` gets consumed across re-renders in renderHook
- Exported `curateTopPhotosPerFriend` and `groupByUser` as named exports for direct pure-function testing alongside hook integration tests
- Used explicit `.ts` extension in test imports to prevent Jest from resolving the old `.js` hook file (strangler fig coexistence pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PowerSync mock resolution via moduleNameMapper**
- **Found during:** Task 1
- **Issue:** jest.mock('@powersync/react') in test file was overridden by moduleNameMapper pointing to __tests__/__mocks__/@powersync/react.js
- **Fix:** Imported useQuery from the auto-mock file directly and controlled it as mockUseQuery, used mockImplementation for stable re-render behavior
- **Files modified:** __tests__/hooks/useDarkroom.test.ts
- **Verification:** All 11 tests pass

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mock resolution fix was necessary for test infrastructure. No scope creep.

## Issues Encountered
None beyond the mock resolution deviation above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - both hooks are fully wired to their respective service layers.

## Next Phase Readiness
- Both hooks ready for screen migration (Plan 04 or Phase 16)
- Old .js hook files preserved for strangler fig -- screens can switch imports incrementally
- Feed hook provides both flat curated list (backwards compat) and grouped FeedGroup array (stories UI)

---
*Phase: 15-core-services-photos-feed-darkroom*
*Completed: 2026-03-24*
