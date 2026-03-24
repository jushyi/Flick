---
phase: 17-messaging-social
plan: 01
subsystem: database
tags: [postgresql, triggers, edge-functions, supabase, messaging, streaks, rls]

requires:
  - phase: 12-typescript-supabase-foundation
    provides: conversations, messages, and streaks tables
provides:
  - message_deletions table with RLS for per-user message hiding
  - Read receipt columns (last_read_at_p1/p2) on conversations
  - Emoji and reply_preview columns on messages
  - PostgreSQL trigger for conversation metadata auto-update on new message
  - PostgreSQL trigger for streak upsert/mutual detection on snap messages
  - PostgreSQL trigger chain for snap file cleanup via pg_net + Edge Function
  - snap-cleanup Edge Function for Supabase Storage deletion
  - streaks namespace in queryKeys factory
affects: [17-02, 17-03, 17-04, 17-05, 18-notifications]

tech-stack:
  added: [pg_net extension]
  patterns: [SECURITY DEFINER triggers, tiered expiry windows, pg_net HTTP POST to Edge Functions]

key-files:
  created:
    - supabase/migrations/20260324000005_add_messaging_columns.sql
    - supabase/migrations/20260324000006_create_message_triggers.sql
    - supabase/functions/snap-cleanup/index.ts
  modified:
    - src/lib/queryKeys.ts

key-decisions:
  - "Migration filenames use 000005/000006 sequence (000001-000004 already taken by Phase 15-16)"
  - "pg_net extension enabled in extensions schema for trigger-to-Edge-Function chain"
  - "Streak mutual detection uses 24-hour window check on both participants"

patterns-established:
  - "Trigger-to-Edge-Function pattern: AFTER UPDATE trigger calls net.http_post() with service_role_key"
  - "Tiered streak expiry: <3 days no expiry, 3-9 days 48h, 10-49 days 72h, 50+ days 96h"
  - "Conversation metadata update via trigger: zero client involvement for last_message_* and unread_count"

requirements-completed: [MSG-01, MSG-04, MSG-05, MSG-06, MSG-09]

duration: 2min
completed: 2026-03-24
---

# Phase 17 Plan 01: Messaging Database Foundation Summary

**PostgreSQL triggers for server-authoritative conversation metadata, streak upsert with tiered expiry, and snap cleanup chain via pg_net to Edge Function**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T20:09:56Z
- **Completed:** 2026-03-24T20:12:04Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Schema additions: message_deletions table with RLS, read receipt columns, emoji/reply_preview columns, pg_net extension
- Three PostgreSQL triggers: conversation metadata update (skips reactions for unread), streak upsert with mutual detection and tiered expiry, snap cleanup chain
- Snap-cleanup Edge Function that deletes files from Supabase Storage
- queryKeys factory extended with streaks namespace (all, detail, forUser)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema additions migration** - `919133e7` (feat)
2. **Task 2: PostgreSQL triggers for message lifecycle** - `207fe9f9` (feat)
3. **Task 3: Snap cleanup Edge Function and query keys extension** - `5a42a4b1` (feat)

## Files Created/Modified
- `supabase/migrations/20260324000005_add_messaging_columns.sql` - Read receipt columns, emoji, reply_preview, message_deletions table, pg_net
- `supabase/migrations/20260324000006_create_message_triggers.sql` - Three trigger functions and triggers for message lifecycle
- `supabase/functions/snap-cleanup/index.ts` - Deno Edge Function for snap file deletion from Storage
- `src/lib/queryKeys.ts` - Added streaks namespace with all/detail/forUser keys

## Decisions Made
- Migration filenames use 000005/000006 sequence since 000001-000004 were already taken by Phase 15-16 migrations
- pg_net extension enabled in extensions schema (standard Supabase convention)
- Streak mutual detection checks both users snapped within last 24 hours before incrementing day_count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration filename collision**
- **Found during:** Task 1 (Schema additions migration)
- **Issue:** Plan specified filenames 20260324000001/000002 but those were already taken by Phase 15-16 migrations
- **Fix:** Used 20260324000005/000006 instead
- **Files modified:** Both migration files use corrected names
- **Verification:** No filename conflicts in migrations directory

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Filename change only, no functional impact. All SQL content matches plan exactly.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all artifacts are fully functional.

## Next Phase Readiness
- Schema additions and triggers ready for `supabase db push`
- snap-cleanup Edge Function ready for `supabase functions deploy snap-cleanup`
- queryKeys.ts streaks namespace available for Phase 17-02+ hooks
- All subsequent Phase 17 plans can build on these schema additions and triggers

## Self-Check: PASSED

All 4 created/modified files verified on disk. All 3 task commits verified in git log.

---
*Phase: 17-messaging-social*
*Completed: 2026-03-24*
