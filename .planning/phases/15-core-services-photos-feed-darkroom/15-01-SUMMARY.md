---
phase: 15-core-services-photos-feed-darkroom
plan: 01
subsystem: api
tags: [powersync, supabase, sqlite, photo-lifecycle, darkroom, reactions]

# Dependency graph
requires:
  - phase: 14-data-layer-caching-foundation
    provides: PowerSync provider singleton, TanStack Query setup, queryKeys factory
  - phase: 12-02
    provides: PostgreSQL schema for photos, photo_reactions tables
provides:
  - photoService.ts with 11 exports for full photo CRUD, triage, reactions
  - darkroomService.ts with 5 exports for batch reveal logic
  - Upload queue wiring to fill photo image_url after upload
  - PowerSync mock for service-layer unit tests
  - Photo interface and mapToPhoto helper for snake_case to camelCase conversion
affects: [15-02-feed-service, 15-03-hooks, 15-04-wiring, 16-social-albums, 18-cloud-functions]

# Tech tracking
tech-stack:
  added: []
  patterns: [throw-on-error service pattern, PowerSync local writes for offline mutations, Supabase client for non-synced tables]

key-files:
  created:
    - src/services/supabase/photoService.ts
    - src/services/supabase/darkroomService.ts
    - __tests__/services/photoService.test.ts
    - __tests__/services/darkroomService.test.ts
    - __tests__/setup/powersync.mock.ts
  modified:
    - src/services/uploadQueueService.ts

key-decisions:
  - "Reactions use Supabase client directly (not PowerSync) since photo_reactions is not in PowerSync schema"
  - "reaction_count on photos table NOT updated by client -- Phase 18 will add a database trigger"
  - "Batch reveal coordination: new photos join existing developing batch instead of getting separate timers"
  - "Snaps excluded from updatePhotoAfterUpload (use signed URLs, not permanent CDN)"
  - "Database type placeholder requires (supabase as any) cast for photo_reactions operations"

patterns-established:
  - "Throw-on-error pattern: all Supabase services throw instead of returning { success, error }"
  - "PowerSync local writes: photo mutations via db.execute(SQL) for offline-first sync"
  - "mapToPhoto helper: snake_case DB rows to camelCase TypeScript interfaces"
  - "Test pattern: mock PowerSync via jest.mock('@/lib/powersync/PowerSyncProvider'), configure supabase.from() via global __supabaseMocks"

requirements-completed: [CORE-01, CORE-03]

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 15 Plan 01: Photo & Darkroom Services Summary

**PowerSync-backed photo lifecycle service with 11 CRUD/triage/reaction operations, batch darkroom reveal logic, and upload queue wiring for image_url population**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T15:00:07Z
- **Completed:** 2026-03-24T15:10:19Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- photoService.ts with complete photo lifecycle: create, update after upload, triage (journal/archive), batch triage, soft delete, restore, query by user/id, caption update, reactions via Supabase
- darkroomService.ts with batch reveal system: check and reveal expired photos, get next reveal time, calculate batch reveal_at (joins existing batch or creates 0-5 min window), query developing/revealed photos
- uploadQueueService.ts wired to call updatePhotoAfterUpload after successful upload, resolving RESEARCH.md Pitfall 1 (photos stuck with image_url=NULL)
- 32 unit tests across both services covering all operations, error paths, and data mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PowerSync mock and photoService.ts** - `6b1f7985` (feat)
2. **Task 2: Create darkroomService.ts and wire uploadQueueService** - `2a38e089` (feat)
3. **Task 3: Write unit tests for photoService and darkroomService** - `800fe083` (test)

## Files Created/Modified
- `src/services/supabase/photoService.ts` - Photo CRUD, triage, reactions with PowerSync local writes
- `src/services/supabase/darkroomService.ts` - Batch reveal logic, countdown helpers, developing/revealed queries
- `src/services/uploadQueueService.ts` - Added updatePhotoAfterUpload call after successful upload
- `__tests__/services/photoService.test.ts` - 20 tests for all photo operations
- `__tests__/services/darkroomService.test.ts` - 12 tests for reveal and batch coordination
- `__tests__/setup/powersync.mock.ts` - Shared PowerSync mock factory for service tests

## Decisions Made
- Reactions use Supabase client directly since photo_reactions is not in the PowerSync SQLite schema -- reactions need server-side conflict resolution via UNIQUE constraint
- reaction_count on photos table is NOT updated by client to avoid race conditions -- Phase 18 will add a PostgreSQL trigger to maintain it automatically
- Batch reveal coordination: when a user has existing developing photos with a future reveal_at, new photos join that batch instead of getting separate timers
- Snaps are excluded from the updatePhotoAfterUpload call because they use short-lived signed URLs, not permanent CDN URLs
- Used `(supabase as any)` cast for photo_reactions operations because Database types are placeholder until schema is deployed and types regenerated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error with Supabase placeholder types**
- **Found during:** Task 1 (photoService.ts)
- **Issue:** `supabase.from('photo_reactions').upsert(...)` fails TS2769 because Database type is a placeholder with `Tables: Record<string, never>`
- **Fix:** Used `(supabase as any)` cast for reaction operations. Will be resolved when DB types are regenerated from live schema.
- **Files modified:** src/services/supabase/photoService.ts
- **Verification:** `npx tsc --noEmit` passes with no errors on photoService.ts

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cast for type safety gap in placeholder types. No scope creep.

## Issues Encountered
- Worktree duplicate files (`.claude/worktrees/`) caused jest to run stale test copies. Resolved by using full absolute paths when running jest commands.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all services are fully implemented with real PowerSync SQL operations and Supabase client calls.

## Next Phase Readiness
- photoService and darkroomService are ready for hook integration in 15-03
- Feed service (15-02) can import mapToPhoto and Photo interface
- Upload queue is fully wired -- photos will get image_url populated after upload

---
*Phase: 15-core-services-photos-feed-darkroom*
*Completed: 2026-03-24*
