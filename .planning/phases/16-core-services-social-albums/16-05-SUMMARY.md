---
phase: 16-core-services-social-albums
plan: 05
subsystem: hooks
tags: [tanstack-query, react-hooks, friendships, powersync, cache-invalidation]

# Dependency graph
requires:
  - phase: 16-01
    provides: friendshipService.ts with PowerSync local writes and reads
provides:
  - useFriends, usePendingRequests, useSentRequests, useFriendshipStatus query hooks
  - useSendFriendRequest, useAcceptFriendRequest, useDeclineFriendRequest, useUnfriend mutation hooks
  - Unit tests for all 8 friendship hooks
affects: [17-realtime, 18-cloud-functions, screens-consuming-friendships]

# Tech tracking
tech-stack:
  added: []
  patterns: [friendship-hooks-pattern-matching-useBlocks]

key-files:
  created:
    - src/hooks/useFriendships.ts
    - __tests__/hooks/useFriendships.test.ts
  modified: []

key-decisions:
  - "Followed useBlocks.ts pattern exactly for consistency across hook layer"
  - "Mutations invalidate queryKeys.friendships.all broadly (not per-user) for simplicity"

patterns-established:
  - "Friendship hooks: same query/mutation pattern as useBlocks and useAlbums"

requirements-completed: [CORE-04, CORE-10]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 16 Plan 05: useFriendships Hooks Summary

**TanStack Query hooks wrapping friendshipService for reactive friend list, pending requests, and friendship status with cache invalidation on mutations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T19:41:39Z
- **Completed:** 2026-03-24T19:47:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 4 query hooks (useFriends, usePendingRequests, useSentRequests, useFriendshipStatus) wrapping all friendshipService read operations
- 4 mutation hooks (useSendFriendRequest, useAcceptFriendRequest, useDeclineFriendRequest, useUnfriend) with proper cache invalidation
- 9 passing unit tests covering all hooks including disabled-query and cache-invalidation verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useFriendships.ts TanStack Query hooks** - `77648677` (feat)
2. **Task 2: Create useFriendships.test.ts unit tests** - `fd5690d5` (test)

## Files Created/Modified
- `src/hooks/useFriendships.ts` - 8 exported TanStack Query hooks wrapping friendshipService for reactive UI
- `__tests__/hooks/useFriendships.test.ts` - 9 unit tests covering queries, mutations, and cache invalidation

## Decisions Made
- Followed useBlocks.ts pattern exactly for consistency across the hook layer
- Mutations invalidate queryKeys.friendships.all broadly rather than per-user keys for simplicity (TanStack fuzzy matching handles sub-keys)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 16 services now have hook layers (photos, darkroom, feed, comments, albums, blocks, contacts, friendships)
- Phase 16 verification gap is closed -- friendshipService is fully wrapped with reactive hooks
- Ready for Phase 17 (Realtime) and screen integration

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 16-core-services-social-albums*
*Completed: 2026-03-24*
