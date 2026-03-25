---
phase: 18-background-jobs-notifications
plan: 03
subsystem: database
tags: [postgresql, triggers, pg_cron, pg_net, edge-functions, deno, supabase-storage, supabase-auth]

# Dependency graph
requires:
  - phase: 18-01
    provides: "send-push-notification Edge Function for pg_net calls"
  - phase: 12-02
    provides: "Core schema tables (photos, friendships, conversations, messages, users, etc.)"
  - phase: 18-01
    provides: "Phase 18 schema additions (pending_notifications, push_receipts tables)"
provides:
  - "Photo soft-delete cascade trigger (album_photos, photo_reactions, photo_tags, notifications, pending_notifications)"
  - "Friend count maintenance triggers (increment on accept, decrement on remove)"
  - "New message push notification trigger via pg_net"
  - "Account deletion cascade function with cleanup-storage Edge Function"
  - "Snap cleanup cron function with storage file deletion"
  - "cleanup-storage Edge Function for storage and auth user deletion"
affects: [19-performance-polish, 20-cutover, 21-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [pg_cron scheduled functions, pg_net HTTP calls to Edge Functions, SECURITY DEFINER trigger functions, bucket-grouped storage deletion]

key-files:
  created:
    - supabase/migrations/20260324100003_phase18_triggers_and_cascades.sql
    - supabase/functions/cleanup-storage/index.ts
  modified: []

key-decisions:
  - "Used participant1_id/participant2_id (actual schema) instead of user1_id/user2_id in notify_new_message trigger"
  - "Used snap_storage_path and snap_viewed_at (actual column names) instead of snap_url and viewed_at for snap cleanup"
  - "Used current_setting('app.settings.supabase_url') || '/functions/v1/...' pattern matching existing triggers"
  - "Always call cleanup-storage for user_deletion even without storage paths (to delete auth account)"
  - "npm: prefix import for Supabase client in Edge Function (modern Deno pattern per 18-01 decision)"

patterns-established:
  - "Bucket-grouped storage deletion: parse bucket from path prefix, batch remove per bucket"
  - "Two-step deletion: SQL cascade for relational data, Edge Function for external resources (storage, auth)"

requirements-completed: [JOBS-03, JOBS-05, JOBS-06, JOBS-08, JOBS-09]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 18 Plan 03: Triggers and Cascades Summary

**PostgreSQL triggers for photo soft-delete cascade, friend count maintenance, new message push notifications, account deletion with storage/auth cleanup, and snap expiry cron**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T14:11:02Z
- **Completed:** 2026-03-25T14:13:08Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Photo soft-delete trigger cascades cleanup to 5 related tables (album_photos, photo_reactions, photo_tags, notifications, pending_notifications)
- Friend count triggers maintain users.friend_count with CREATE OR REPLACE for idempotency
- New message INSERT trigger sends push notification to conversation partner via pg_net
- Account deletion function deletes all user data across 12+ tables then calls Edge Function for storage and auth cleanup
- Snap cleanup function finds viewed snaps older than 24h and delegates storage deletion to Edge Function
- cleanup-storage Edge Function handles both expired snap file deletion and full user account deletion

## Task Commits

Each task was committed atomically:

1. **Task 1: Create photo soft-delete trigger, friend count triggers, new message notification trigger, and account deletion SQL function** - `eb5f6e5c` (feat)
2. **Task 2: Create cleanup-storage Edge Function** - `10d64920` (feat)

## Files Created/Modified
- `supabase/migrations/20260324100003_phase18_triggers_and_cascades.sql` - All SQL triggers, functions, and cron schedules
- `supabase/functions/cleanup-storage/index.ts` - Edge Function for storage file deletion and auth user removal

## Decisions Made
- Used actual schema column names (participant1_id/participant2_id, snap_storage_path, snap_viewed_at) instead of plan's interface names -- plan interfaces did not match actual migration schema
- Matched existing pg_net URL pattern from 20260324000006_create_message_triggers.sql (app.settings.supabase_url + /functions/v1/)
- Always send cleanup-storage call for user_deletion even when no storage paths exist, to ensure auth account is deleted
- Used npm: prefix import pattern for Supabase client in Deno (consistent with 18-01 Edge Functions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected column names to match actual schema**
- **Found during:** Task 1 (SQL migration)
- **Issue:** Plan interfaces referenced user1_id/user2_id for conversations (actual: participant1_id/participant2_id), snap_url/viewed_at for messages (actual: snap_storage_path/snap_viewed_at), and edge_function_url setting (actual: supabase_url + /functions/v1/)
- **Fix:** Used correct column names and URL patterns from the actual migration files
- **Files modified:** supabase/migrations/20260324100003_phase18_triggers_and_cascades.sql
- **Verification:** grep confirms all function and trigger names present
- **Committed in:** eb5f6e5c (Task 1 commit)

**2. [Rule 2 - Missing Critical] Always call cleanup-storage for user deletion**
- **Found during:** Task 1 (account deletion function)
- **Issue:** Plan only called cleanup-storage when storage_paths existed, but auth user must always be deleted
- **Fix:** Added else branch to always call cleanup-storage Edge Function with empty paths array when no storage files exist
- **Files modified:** supabase/migrations/20260324100003_phase18_triggers_and_cascades.sql
- **Verification:** Code path exists for both cases (with and without storage paths)
- **Committed in:** eb5f6e5c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The cleanup-storage Edge Function will be deployed alongside other Edge Functions during cutover.

## Next Phase Readiness
- All Phase 18 triggers and cascades are ready
- cleanup-storage Edge Function is ready for deployment
- Remaining Phase 18 plans (04, 05) can proceed independently

---
*Phase: 18-background-jobs-notifications*
*Completed: 2026-03-25*
