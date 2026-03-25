---
phase: 18-background-jobs-notifications
plan: 01
subsystem: infra
tags: [supabase, edge-functions, push-notifications, expo, deno, pg_cron, pg_net]

# Dependency graph
requires:
  - phase: 12-02
    provides: users table, photos table, notifications table, reaction_batches table
provides:
  - pending_notifications table for reaction/tag batching
  - push_receipts table for Expo receipt tracking
  - push_to_start_token and notification_preferences columns on users
  - pg_net and pg_cron extensions enabled
  - send-push-notification Edge Function handling all 14 notification types
  - Shared notification-templates.ts and expo-push.ts utilities
affects: [18-02, 18-03, 18-04, 18-05, 20-cleanup]

# Tech tracking
tech-stack:
  added: [pg_net, pg_cron]
  patterns: [direct-fetch-expo-api, service-role-auth-edge-functions, shared-utilities-pattern]

key-files:
  created:
    - supabase/migrations/20260324100001_phase18_schema_additions.sql
    - supabase/functions/_shared/notification-templates.ts
    - supabase/functions/_shared/expo-push.ts
    - supabase/functions/send-push-notification/index.ts
  modified: []

key-decisions:
  - "Direct fetch to Expo Push API instead of expo-server-sdk (Deno-compatible, no dependency)"
  - "All 14 notification types in single Edge Function (matches Cloud Functions architecture)"
  - "Tag templates include all 5 variants from Cloud Functions (not just 2 from plan)"

patterns-established:
  - "Edge Function shared utilities in supabase/functions/_shared/*.ts"
  - "Service-role auth validation pattern for server-to-server Edge Function calls"
  - "npm: prefix imports for Supabase client in Deno Edge Functions"

requirements-completed: [JOBS-06, JOBS-07]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 18 Plan 01: Push Notification Foundation Summary

**Supabase Edge Function for all 14 push notification types with Expo direct-fetch API, pending_notifications + push_receipts schema, and pg_cron/pg_net extensions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T14:06:22Z
- **Completed:** 2026-03-25T14:08:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created Phase 18 schema migration with pending_notifications table, push_receipts table, push_to_start_token and notification_preferences columns, plus pg_net and pg_cron extensions
- Built send-push-notification Edge Function handling all 14 notification event types with templates matching Cloud Functions copy exactly
- Created reusable shared utilities (notification-templates.ts, expo-push.ts) for use by other Phase 18 Edge Functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Phase 18 schema migration** - `2a921073` (feat)
2. **Task 2: Create shared notification utilities and send-push-notification Edge Function** - `fdc83246` (feat)

## Files Created/Modified
- `supabase/migrations/20260324100001_phase18_schema_additions.sql` - Schema additions: 2 tables, 2 columns, 2 extensions
- `supabase/functions/_shared/notification-templates.ts` - All 14 notification templates with getRandomTemplate and buildNotification
- `supabase/functions/_shared/expo-push.ts` - Expo Push API wrapper (sendExpoPush, checkExpoPushReceipts, isValidExpoPushToken)
- `supabase/functions/send-push-notification/index.ts` - Central Edge Function dispatching all push types

## Decisions Made
- Used direct fetch to Expo Push API instead of expo-server-sdk import (per RESEARCH.md recommendation -- Deno-compatible, no dependency risk)
- Included all 5 tag templates from Cloud Functions (plan specified only 2; matched original for copy fidelity)
- Used npm: prefix for @supabase/supabase-js import (modern Deno pattern per research, not esm.sh)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added all 5 tag templates from Cloud Functions**
- **Found during:** Task 2 (notification-templates.ts)
- **Issue:** Plan specified only 2 tag templates but Cloud Functions had 5 variants
- **Fix:** Included all 5 tag templates and all 3 tag_batch templates to match original copy exactly
- **Files modified:** supabase/functions/_shared/notification-templates.ts
- **Verification:** All templates verified against functions/index.js lines 32-49
- **Committed in:** fdc83246

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix ensures notification copy matches Cloud Functions exactly. No scope creep.

## Issues Encountered
None

## User Setup Required
**External services require manual configuration.** The Edge Function needs:
- `EXPO_ACCESS_TOKEN` secret set via `supabase secrets set EXPO_ACCESS_TOKEN=<token>` (from Expo Dashboard > Account Settings > Access Tokens)

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- send-push-notification Edge Function ready to be called by pg_cron jobs (18-02), database triggers (18-03, 18-04), and other Edge Functions (18-05)
- pending_notifications table ready for reaction/tag batching logic
- push_receipts table ready for receipt-checking cron job

---
*Phase: 18-background-jobs-notifications*
*Completed: 2026-03-25*
