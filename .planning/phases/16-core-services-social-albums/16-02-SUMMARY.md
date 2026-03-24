---
phase: 16-core-services-social-albums
plan: 02
subsystem: comments, hooks
tags: [supabase, realtime, tanstack-query, powersync, comments, mentions]

# Dependency graph
requires:
  - phase: 16-core-services-social-albums
    plan: 01
    provides: Query keys for comments domain, friendshipService.getFriendIds, comments table with all columns
  - phase: 14-data-layer-caching-foundation
    provides: PowerSync database, TanStack Query setup, supabase client
provides:
  - Comment CRUD service via Supabase (6 exported functions)
  - useComments hook with Supabase Realtime live updates
  - useAddComment, useDeleteComment, useLikeComment, useUnlikeComment mutation hooks
  - useMentionSuggestions hook with PowerSync local query + TanStack cache
affects: [16-03, 16-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase Realtime channel per resource ID invalidates TanStack cache on postgres_changes events"
    - "PowerSync local SQLite for offline @mention autocomplete (friend IDs), TanStack cache for profile data"
    - "Optimistic updates with rollback in like/unlike mutations"
    - "Explicit .ts require() in tests to disambiguate from legacy .js hooks"

key-files:
  created:
    - src/services/supabase/commentService.ts
    - src/hooks/useComments.ts
    - src/hooks/useMentionSuggestions.ts
    - __tests__/services/commentService.test.ts
    - __tests__/hooks/useComments.test.ts
    - __tests__/hooks/useMentionSuggestions.test.ts
  modified: []

key-decisions:
  - "Flat threading preserved: parent_id always flattened to top-level, mentioned_comment_id tracks reply target"
  - "Explicit require('.ts') in hook tests to avoid resolution conflict with legacy .js hooks"
  - "Supabase join syntax (user:users) for comment user data instead of separate fetch"

patterns-established:
  - "Supabase Realtime hook pattern: channel subscription in useEffect, removeChannel in cleanup, invalidate TanStack cache"
  - "Hook test pattern for .ts/.js coexistence: require('../../src/hooks/hookName.ts') explicit extension"
  - "PowerSync + TanStack cache hybrid: local SQLite for IDs, queryClient.getQueryData for profiles"

requirements-completed: [CORE-05, CORE-10]

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 16 Plan 02: Comment Service, useComments Hook, and Mention Autocomplete Summary

**Comment CRUD via Supabase with flat threading, Realtime live updates via TanStack Query cache invalidation, and offline-capable @mention autocomplete using PowerSync local friendships + cached profiles (17 tests passing)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T18:52:26Z
- **Completed:** 2026-03-24T19:02:00Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments

- Implemented commentService.ts with 6 exported functions: getComments, addComment, deleteComment, likeComment, unlikeComment, getCommentLikes
- Flat threading logic preserved: addComment flattens parent_id to top-level when replying to a reply, sets mentioned_comment_id to the actual target
- Validation: MAX_COMMENT_LENGTH=2000, MAX_MENTIONS_PER_COMMENT=10 with thrown errors
- Snake_case to camelCase mapping via mapComment helper, including joined user profile data
- useComments hook creates Supabase Realtime channel per photo_id, invalidates TanStack cache on postgres_changes events
- Mutation hooks (useAddComment, useDeleteComment, useLikeComment, useUnlikeComment) with proper cache invalidation
- useLikeComment and useUnlikeComment implement optimistic updates with rollback on error
- useMentionSuggestions queries PowerSync for accepted friend IDs, then resolves profiles from TanStack Query cache
- Mention filtering: case-insensitive startsWith on username or displayName

## Task Commits

1. **Task 1: Comment service and unit tests (TDD)** - `3303f954` (feat)
2. **Task 2: useComments + useMentionSuggestions hooks with tests** - `3eebcee2` (feat)

## Files Created

- `src/services/supabase/commentService.ts` -- 6 exported functions for comment CRUD, flat threading, likes
- `src/hooks/useComments.ts` -- TanStack Query + Supabase Realtime, 5 exported hooks
- `src/hooks/useMentionSuggestions.ts` -- PowerSync local query + TanStack cache for @mention autocomplete
- `__tests__/services/commentService.test.ts` -- 9 tests covering all CRUD, threading, validation
- `__tests__/hooks/useComments.test.ts` -- 4 tests covering Realtime subscription, cleanup, cache invalidation
- `__tests__/hooks/useMentionSuggestions.test.ts` -- 4 tests covering PowerSync query, filtering, cache lookup

## Decisions Made

- **Flat threading preservation**: parent_id flattening and mentioned_comment_id tracking carried over from Firebase commentService pattern
- **Explicit .ts require in tests**: Both .js (legacy Firebase) and .ts (Supabase) hooks exist side-by-side; tests use `require('path.ts')` to force the correct version
- **Supabase join for user data**: `select('*, user:users(...)')` in getComments avoids N+1 queries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Jest module resolution conflict**
- **Found during:** Task 2
- **Issue:** Jest resolves `.js` before `.ts` when both exist; tests imported legacy Firebase hooks instead of new Supabase hooks
- **Fix:** Used explicit `require('../../src/hooks/hookName.ts')` in tests and local `jest.mock` overrides
- **Files modified:** __tests__/hooks/useComments.test.ts, __tests__/hooks/useMentionSuggestions.test.ts

**2. [Rule 3 - Blocking] Supabase mock not propagating to hook modules**
- **Found during:** Task 2
- **Issue:** Global jest.setup.js supabase mock lacks Realtime methods (channel, removeChannel)
- **Fix:** Local jest.mock('@/lib/supabase') in hook tests with full Realtime mock chain
- **Files modified:** __tests__/hooks/useComments.test.ts

## Known Stubs

None -- all functions fully implemented and tested.

## Next Plan Readiness

- commentService ready for screen integration (CommentsBottomSheet, PhotoDetail)
- useComments hook ready to replace legacy Firebase useComments.js in UI components
- useMentionSuggestions ready for autocomplete overlay UI
- Mutation hooks ready for comment input and interaction handlers

## Self-Check: PASSED

- All 6 created files exist on disk
- Commit 3303f954 (Task 1) verified
- Commit 3eebcee2 (Task 2) verified
- 17/17 tests passing across 3 test suites

---

_Phase: 16-core-services-social-albums_
_Completed: 2026-03-24_
