---
phase: 18-background-jobs-notifications
plan: 04
subsystem: database, infra
tags: [pg_cron, pg_net, expo-push, edge-functions, notification-batching, push-receipts]

requires:
  - phase: 18-01
    provides: "pending_notifications and push_receipts tables, pg_net and pg_cron extensions"
provides:
  - "process_pending_notifications() SQL function draining batched notifications every 30s"
  - "check-push-receipts Edge Function validating Expo push receipts every 5min"
  - "pg_cron schedules for both notification batching and receipt checking"
affects: [send-push-notification, users-push-token]

tech-stack:
  added: []
  patterns: ["pg_cron sub-minute scheduling via '30 seconds' syntax", "Edge Function receipt checking with token invalidation"]

key-files:
  created:
    - supabase/migrations/20260324100004_phase18_notification_batching.sql
    - supabase/functions/check-push-receipts/index.ts
  modified: []

key-decisions:
  - "Skip receipts not yet available from Expo API rather than deleting -- picked up on next 5-min run"
  - "Batch delete processed push_receipt rows in single query for efficiency"

patterns-established:
  - "pg_cron sub-minute schedule: cron.schedule('name', '30 seconds', 'SELECT fn()') for high-frequency drains"
  - "Receipt checking pattern: query old rows, check Expo API, invalidate stale tokens, batch delete"

requirements-completed: [JOBS-07]

duration: 1min
completed: 2026-03-25
---

# Phase 18 Plan 04: Notification Batching & Receipt Checking Summary

**pg_cron notification drain every 30s grouping reactions/tags by user+source+type, plus Expo push receipt checker invalidating stale tokens every 5 minutes**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-25T14:11:03Z
- **Completed:** 2026-03-25T14:12:21Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Notification batching drain replaces Cloud Tasks 30-second debounce with pg_cron micro-batch processing
- Push receipt checking runs every 5 minutes via Edge Function, cleaning up invalid DeviceNotRegistered tokens
- Both systems use established pg_net + Edge Function call pattern with service_role auth

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notification batching drain and receipt checking cron** - `782e1e7a` (feat)
2. **Task 2: Create check-push-receipts Edge Function** - `eb5f6e5c` (feat)

## Files Created/Modified
- `supabase/migrations/20260324100004_phase18_notification_batching.sql` - process_pending_notifications() function with pg_cron schedules for batching drain (30s) and receipt checking (5min)
- `supabase/functions/check-push-receipts/index.ts` - Edge Function checking Expo push receipts, invalidating stale tokens, cleaning up push_receipts table

## Decisions Made
- Skip receipts not yet available from Expo API (not yet processed) rather than deleting them -- they will be picked up on the next 5-minute run
- Batch delete processed push_receipt rows in a single `.in('id', idsToDelete)` query for efficiency rather than individual deletes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification pipeline complete: pending_notifications table (18-01) -> batching drain (18-04) -> send-push-notification Edge Function (18-01)
- Push receipt lifecycle complete: push_receipts table (18-01) -> check-push-receipts cron (18-04) -> token invalidation
- Ready for Phase 18-05 (Live Activity notifications) or remaining Phase 18 plans

---
*Phase: 18-background-jobs-notifications*
*Completed: 2026-03-25*
