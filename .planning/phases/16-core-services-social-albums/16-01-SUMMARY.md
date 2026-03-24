---
phase: 16-core-services-social-albums
plan: 01
subsystem: database, api
tags: [postgresql, triggers, rpcs, powersync, friendships, query-keys, supabase]

# Dependency graph
requires:
  - phase: 14-data-layer-caching-foundation
    provides: PowerSync database, query key factory pattern, TanStack Query setup
  - phase: 12-schema-infrastructure-foundation
    provides: Friendships, comments, blocks tables with RLS policies
provides:
  - Query key factories for friendships, blocks, contacts domains
  - Extended comments.likes and albums.monthly query sub-keys
  - PostgreSQL triggers for friend_count, comment_count, comment_like_count maintenance
  - Block cleanup trigger (auto-remove blocked user content)
  - Contact sync RPC (find_contacts_on_app)
  - Monthly photos RPC (get_monthly_photos)
  - Comments table augmented with mentioned_comment_id, media_url, media_type, like_count
  - Friendship service with PowerSync local writes (9 exported functions)
affects: [16-02, 16-03, 16-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PowerSync local writes for synced tables (friendships) -- instant UI, offline capable"
    - "Deterministic ID sorting for pair tables: [user1_id, user2_id].sort()"
    - "PostgreSQL SECURITY DEFINER triggers for count maintenance"
    - "Dynamic require() in tests for PowerSync mock compatibility"

key-files:
  created:
    - src/services/supabase/friendshipService.ts
    - supabase/migrations/20260324000002_create_social_triggers.sql
    - supabase/migrations/20260324000003_create_social_rpcs.sql
    - supabase/migrations/20260324000004_add_comment_columns.sql
    - __tests__/services/friendshipService.test.ts
  modified:
    - src/lib/queryKeys.ts
    - __tests__/lib/queryKeys.test.ts

key-decisions:
  - "Migration timestamps offset to 000002-000004 to avoid collision with existing 000001_create_get_feed_rpc"
  - "PowerSync Proxy mock requires dynamic require() in tests (static import + jest.mock mismatches)"
  - "getFriendIds added as 9th function for mention autocomplete and feed filtering needs"

patterns-established:
  - "PowerSync service test pattern: mock execute/getAll, dynamic require service, verify SQL and params"
  - "Trigger pattern: SECURITY DEFINER, GREATEST(count-1, 0) for safe decrement, COALESCE(NEW, OLD) return"

requirements-completed: [CORE-04, CORE-10]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 16 Plan 01: Shared Infrastructure and Friendship Service Summary

**PostgreSQL triggers/RPCs for count maintenance and contact sync, extended query keys for all Phase 16 domains, and friendship CRUD service with PowerSync local writes (33 tests passing)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T18:41:20Z
- **Completed:** 2026-03-24T18:48:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Extended queryKeys.ts with friendships (5 sub-keys), blocks (2), contacts (2), plus comments.likes and albums.monthly
- Created 4 PostgreSQL triggers: friend_count on friendships, comment_count on comments, comment_like_count on comment_likes, block cleanup on blocks
- Created 2 RPCs: find_contacts_on_app (phone lookup with friendship/block filtering), get_monthly_photos (grouped by YYYY-MM)
- Augmented comments table with mentioned_comment_id, media_url, media_type, like_count columns
- Implemented friendshipService.ts with 9 exported functions all using PowerSync local SQLite writes
- All functions use deterministic ID sorting to satisfy CHECK(user1_id < user2_id) constraint

## Task Commits

1. **Task 1: Extend query keys and create all SQL migrations** - `208e3ca9` (feat)
2. **Task 2: Friendship service with PowerSync local writes** - TDD RED `67062db4` (test), GREEN `5273ac33` (feat)

## Files Created/Modified

- `src/lib/queryKeys.ts` -- Added friendships, blocks, contacts key factories; extended comments and albums
- `supabase/migrations/20260324000002_create_social_triggers.sql` -- 4 triggers (friend_count, comment_count, comment_like_count, block_cleanup)
- `supabase/migrations/20260324000003_create_social_rpcs.sql` -- 2 RPCs (find_contacts_on_app, get_monthly_photos)
- `supabase/migrations/20260324000004_add_comment_columns.sql` -- 4 new columns on comments table
- `src/services/supabase/friendshipService.ts` -- 9 exported functions for friendship CRUD via PowerSync
- `__tests__/lib/queryKeys.test.ts` -- 21 tests (11 new for added keys)
- `__tests__/services/friendshipService.test.ts` -- 12 tests covering all 9 service functions

## Decisions Made

- **Migration timestamp offset**: Used 000002-000004 instead of 000001-000003 to avoid collision with existing get_feed_rpc migration
- **Dynamic require() in friendship tests**: PowerSync's Proxy-based export requires dynamic import after jest.mock() setup
- **getFriendIds as 9th function**: Added beyond the 8 in the plan for mention autocomplete and feed filtering use cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration timestamp collision**
- **Found during:** Task 1
- **Issue:** Plan specified 20260324000001 for triggers, but 20260324000001_create_get_feed_rpc.sql already exists
- **Fix:** Offset all new migrations to 000002, 000003, 000004
- **Files modified:** Migration filenames

**2. [Rule 1 - Bug] PowerSync Proxy mock incompatibility**
- **Found during:** Task 2 (TDD GREEN)
- **Issue:** Static import + jest.mock('../../src/...') path did not intercept PowerSync Proxy-based powerSyncDb export
- **Fix:** Switched to dynamic require() pattern with jest.mock on the relative path
- **Files modified:** __tests__/services/friendshipService.test.ts

## Known Stubs

None -- all functions fully implemented and tested.

## Next Plan Readiness

- Friendship service ready for consumption by hooks and screens in Plan 16-02
- Query keys ready for TanStack Query integration across all Phase 16 services
- Triggers ready for deployment via Supabase migration
- RPCs ready for contact sync and monthly album services

---

_Phase: 16-core-services-social-albums_
_Completed: 2026-03-24_
