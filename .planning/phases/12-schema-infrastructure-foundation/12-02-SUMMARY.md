---
phase: 12-schema-infrastructure-foundation
plan: 02
subsystem: database
tags: [postgresql, supabase, migrations, rls, schema, sql]

# Dependency graph
requires:
  - phase: 12-01
    provides: Supabase project scaffold with config.toml and migrations directory
provides:
  - 18 normalized PostgreSQL tables replacing all Firestore collections
  - RLS enabled on every table
  - 3 SECURITY DEFINER helper functions (is_friend, is_blocked, is_conversation_participant)
  - Reusable update_updated_at_column() trigger function
  - Seed data for dev database resets
affects: [12-03-rls-policies, 13-auth-migration, 14-powersync, 15-photo-service, 16-social-service, 17-messaging-service, 18-edge-functions]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic-pair-ordering, jsonb-for-flexible-data, soft-delete-with-deleted_at, per-participant-soft-delete]

key-files:
  created:
    - supabase/migrations/20260323000001_create_users.sql
    - supabase/migrations/20260323000002_create_photos.sql
    - supabase/migrations/20260323000003_create_social.sql
    - supabase/migrations/20260323000004_create_conversations.sql
    - supabase/migrations/20260323000005_create_content.sql
    - supabase/migrations/20260323000006_create_rls_helpers.sql
    - supabase/seed.sql
  modified: []

key-decisions:
  - "UUID primary keys on all tables for Supabase Auth compatibility"
  - "JSONB only for genuinely flexible data (selects, song, pinned_snap_data, notification data, reaction batches)"
  - "CHECK(user1_id < user2_id) on all pair tables (friendships, conversations, streaks)"
  - "Per-participant soft delete on conversations (deleted_at_p1/p2) instead of single deleted_at"
  - "UUID[] for comment mentions instead of JSONB for native PostgreSQL array operations"

patterns-established:
  - "Deterministic pair ordering: all two-user relationship tables use CHECK(lower_id < higher_id)"
  - "RLS-first: every CREATE TABLE immediately followed by ALTER TABLE ENABLE ROW LEVEL SECURITY"
  - "SECURITY DEFINER helpers: reusable functions with SET search_path = public for RLS policies"
  - "Soft delete pattern: deleted_at TIMESTAMPTZ column with partial indexes filtering WHERE deleted_at IS NULL"

requirements-completed: [INFRA-01]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 12 Plan 02: PostgreSQL Schema Migrations Summary

**18 normalized PostgreSQL tables with RLS, indexes, CHECK constraints, and 3 SECURITY DEFINER helper functions replacing all Firestore collections**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T17:31:24Z
- **Completed:** 2026-03-23T17:35:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 18 PostgreSQL tables covering all 17 Firestore collections plus album_photos junction table
- RLS enabled on every table (18/18), indexes on all foreign key columns and query patterns
- Deterministic pair ordering with CHECK constraints on friendships, conversations, and streaks
- 3 SECURITY DEFINER helper functions ready for RLS policy creation in Plan 03
- Seed data with 3 test users, friendship, photos, and conversation for dev resets

## Task Commits

Each task was committed atomically:

1. **Task 1: Create core entity migrations (users, photos, social)** - `28f26636` (feat)
2. **Task 2: Create messaging, content, and helper function migrations + seed data** - `288b4392` (feat)

## Files Created/Modified
- `supabase/migrations/20260323000001_create_users.sql` - Users table with 20 columns including JSONB selects/song/pinned_snap_data, updated_at trigger
- `supabase/migrations/20260323000002_create_photos.sql` - Photos, photo_reactions, photo_tags, viewed_photos (4 tables)
- `supabase/migrations/20260323000003_create_social.sql` - Friendships (with CHECK constraint), blocks, reports (3 tables)
- `supabase/migrations/20260323000004_create_conversations.sql` - Conversations (with CHECK constraint), messages, streaks (3 tables)
- `supabase/migrations/20260323000005_create_content.sql` - Comments, comment_likes, albums, album_photos, notifications, reaction_batches, support_requests (7 tables)
- `supabase/migrations/20260323000006_create_rls_helpers.sql` - is_friend(), is_blocked(), is_conversation_participant() functions
- `supabase/seed.sql` - Test data for dev database resets

## Decisions Made
- UUID primary keys on all tables for Supabase Auth compatibility (auth.uid() returns UUID)
- JSONB used only for genuinely flexible/variable-structure data, all other fields are typed columns
- UUID[] native array type for comment mentions instead of JSONB array for better query ergonomics
- Per-participant soft delete on conversations allows independent deletion without losing the other user's messages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 18 tables ready for RLS policy creation in Plan 03
- 3 SECURITY DEFINER helper functions (is_friend, is_blocked, is_conversation_participant) available for policy definitions
- Seed data enables dev testing once Supabase is linked

---
*Phase: 12-schema-infrastructure-foundation*
*Completed: 2026-03-23*
