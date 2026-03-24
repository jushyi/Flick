---
phase: 15-core-services-photos-feed-darkroom
plan: 02
subsystem: database, api
tags: [supabase, rpc, sql, feed, profile, cursor-pagination, postgresql]

# Dependency graph
requires:
  - phase: 12-02
    provides: Supabase schema (users, photos, friendships, blocks tables)
  - phase: 14-02
    provides: Supabase client, TanStack Query setup, useProfile PoC
provides:
  - get_feed SQL RPC function with JOIN + block filtering + cursor pagination
  - increment_daily_photo_count SQL RPC with atomic day reset and 36-photo limit
  - feedService.ts wrapping get_feed RPC with camelCase mapping
  - profileService.ts with full user CRUD (get, update, username check, daily photo count)
affects: [feed-screen, camera-capture, profile-hooks, darkroom]

# Tech tracking
tech-stack:
  added: []
  patterns: [SQL RPC for complex queries, service-layer camelCase mapping]

key-files:
  created:
    - supabase/migrations/20260324000001_create_get_feed_rpc.sql
    - src/services/supabase/feedService.ts
    - src/services/supabase/profileService.ts
    - __tests__/services/feedService.test.ts
    - __tests__/services/profileService.test.ts
  modified: []

key-decisions:
  - "SQL RPC for feed query replaces Firestore chunked in() queries (30-ID limit) with single JOIN"
  - "SECURITY DEFINER on both RPCs for RLS bypass in server-side functions"
  - "Cast to (supabase as any) for tables not yet in Database types (placeholder until schema deployed)"
  - "getPhotoByIdWithUser uses inner JOIN via Supabase query builder (not RPC) for single photo lookups"

patterns-established:
  - "Feed RPC pattern: complex multi-table queries as SQL functions called via supabase.rpc()"
  - "Service-layer camelCase mapping: mapToX helper functions convert snake_case DB rows"
  - "UserProfileUpdatable type: Pick + Partial for safe update field whitelisting"

requirements-completed: [CORE-02, CORE-07]

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 15 Plan 02: Feed & Profile Services Summary

**get_feed SQL RPC with JOIN + block filtering + cursor pagination, feedService.ts wrapper, and profileService.ts with full user CRUD including atomic daily photo count**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T15:13:20Z
- **Completed:** 2026-03-24T15:16:57Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created get_feed SQL RPC that replaces chunked Firestore `in` queries with a single JOIN across photos+users+friendships with block filtering
- Created increment_daily_photo_count SQL RPC with atomic day reset and 36-photo daily limit
- Built feedService.ts wrapping the RPC with full snake_case to camelCase FeedPhoto mapping
- Built profileService.ts with 5 exported functions covering full user profile CRUD
- All 23 unit tests passing across both service files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create get_feed RPC migration, feedService.ts, and profileService.ts** - `d34f992f` (feat)
2. **Task 2: Write unit tests for feedService and profileService** - `918f3d55` (test)

## Files Created/Modified
- `supabase/migrations/20260324000001_create_get_feed_rpc.sql` - SQL RPC functions (get_feed, increment_daily_photo_count)
- `src/services/supabase/feedService.ts` - Feed query wrapper with getFeed and getPhotoByIdWithUser
- `src/services/supabase/profileService.ts` - User profile CRUD with 5 exported functions
- `__tests__/services/feedService.test.ts` - 7 tests covering RPC params, mapping, errors
- `__tests__/services/profileService.test.ts` - 16 tests covering CRUD, username check, daily photo count

## Decisions Made
- Used `(supabase as any)` casts for tables not yet in generated Database types (same pattern as photoService.ts)
- get_feed uses SQL-level SECURITY DEFINER for RLS bypass since it's a server-side aggregation
- getPhotoByIdWithUser uses Supabase query builder with `users!inner()` join (not RPC) for single photo lookups
- profileService exports mapToUserProfile helper for reuse by hooks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added (supabase as any) casts for placeholder Database types**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Database types are placeholder until schema is deployed and types regenerated; direct supabase.from('users') fails type checking
- **Fix:** Added `(supabase as any)` casts consistent with existing photoService.ts pattern
- **Files modified:** src/services/supabase/feedService.ts, src/services/supabase/profileService.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors on both files
- **Committed in:** d34f992f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type cast was necessary and follows established pattern. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feed and profile services ready for hook integration (useFeed, useProfile refactor)
- SQL migration ready to deploy to Supabase (dev database)
- Both services use throw-on-error pattern compatible with TanStack Query

## Self-Check: PASSED

All 5 created files verified on disk. Both commit hashes (d34f992f, 918f3d55) confirmed in git log.

---
*Phase: 15-core-services-photos-feed-darkroom*
*Completed: 2026-03-24*
