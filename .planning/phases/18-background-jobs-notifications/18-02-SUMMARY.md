---
phase: 18-background-jobs-notifications
plan: 02
subsystem: database
tags: [pg_cron, pg_net, postgresql, background-jobs, push-notifications, scheduled-functions]

# Dependency graph
requires:
  - phase: 18-01
    provides: "Schema additions (updated_at on photos, pg_net/pg_cron extensions context)"
  - phase: 12-02
    provides: "Core schema tables (photos, users, streaks, notifications, reaction_batches, conversations)"
provides:
  - "5 pg_cron scheduled SQL functions replacing Firebase Cloud Functions"
  - "Darkroom reveal processing (every 2 min)"
  - "Streak expiry with 4-hour warning push (every 15 min)"
  - "Notification cleanup (daily)"
  - "Pinned snap expiry with Live Activity dismissal (every 2 hours)"
  - "Account deletion reminders (daily)"
affects: [18-03, 18-04, 18-05, 20-firebase-removal]

# Tech tracking
tech-stack:
  added: [pg_cron, pg_net]
  patterns: [SECURITY DEFINER cron functions, current_setting for secrets, pg_net http_post to Edge Functions]

key-files:
  created:
    - supabase/migrations/20260324100002_phase18_cron_jobs.sql
  modified: []

key-decisions:
  - "Subquery pattern for PostgreSQL UPDATE LIMIT (WHERE id IN SELECT ... LIMIT 500)"
  - "SECURITY DEFINER + SET search_path = public on all cron functions for RLS bypass"
  - "All secrets via current_setting (app.settings.*) -- zero hardcoded values in migration"

patterns-established:
  - "pg_cron function pattern: CREATE OR REPLACE FUNCTION + SECURITY DEFINER + SET search_path + cron.schedule"
  - "pg_net push pattern: net.http_post with current_setting for URL and auth, jsonb_build_object for body"
  - "Batch processing: LIMIT on SELECT subqueries, FOR LOOP with pg_net calls per record"

requirements-completed: [JOBS-01, JOBS-02, JOBS-04, JOBS-10]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 18 Plan 02: Cron Jobs Summary

**5 pg_cron SQL functions replacing Firebase Cloud Functions: darkroom reveals (2min), streak expiry with warning push (15min), notification cleanup (daily), pinned snap expiry (2h), deletion reminders (daily) -- all using pg_net to call send-push-notification Edge Function**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T14:10:48Z
- **Completed:** 2026-03-25T14:12:50Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created all 5 pg_cron scheduled SQL functions in a single migration file
- Darkroom reveals batch-processes up to 500 photos per run with LIMIT guard and deleted_at IS NULL safety
- Streak expiry handles both 4-hour warning phase (push to both users) and expiry phase (full reset)
- All functions use SECURITY DEFINER for RLS bypass and current_setting for configurable secrets/URLs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create darkroom reveals and streak expiry SQL functions** - `74905e02` (feat)
2. **Task 2: Create cleanup, pinned snap expiry, and deletion reminder SQL functions** - `a686d443` (feat)

## Files Created/Modified
- `supabase/migrations/20260324100002_phase18_cron_jobs.sql` - All 5 pg_cron functions and 5 cron.schedule calls

## Decisions Made
- Used PostgreSQL subquery pattern (WHERE id IN SELECT ... LIMIT) instead of direct UPDATE LIMIT which is not valid PostgreSQL syntax
- All functions set search_path = public explicitly to prevent search_path injection with SECURITY DEFINER
- Streak warning marks warning_sent = TRUE before sending push to prevent duplicate notifications on retry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid PostgreSQL UPDATE LIMIT syntax**
- **Found during:** Task 1 (process_darkroom_reveals)
- **Issue:** Plan specified `UPDATE ... LIMIT 500` but PostgreSQL does not support LIMIT on UPDATE statements
- **Fix:** Used subquery pattern: `UPDATE photos SET ... WHERE id IN (SELECT id FROM photos WHERE ... LIMIT 500)`
- **Files modified:** supabase/migrations/20260324100002_phase18_cron_jobs.sql
- **Verification:** Valid PostgreSQL syntax confirmed
- **Committed in:** 74905e02 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential syntax fix for PostgreSQL compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The `app.settings.edge_function_url` and `app.settings.service_role_key` PostgreSQL settings must be configured in the Supabase dashboard (covered by infrastructure setup in earlier phases).

## Next Phase Readiness
- All 5 cron functions ready for deployment with migration
- send-push-notification Edge Function (from 18-01) is the target for all pg_net calls
- Phase 18-03 (Realtime subscriptions) can proceed independently

## Self-Check: PASSED

- [x] supabase/migrations/20260324100002_phase18_cron_jobs.sql exists
- [x] Commit 74905e02 found in git log
- [x] Commit a686d443 found in git log
- [x] 18-02-SUMMARY.md created

---
*Phase: 18-background-jobs-notifications*
*Completed: 2026-03-25*
