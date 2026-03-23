---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Speed & Scale
status: executing
stopped_at: Completed 13-03-PLAN.md
last_updated: "2026-03-23T18:52:14Z"
last_activity: 2026-03-23 -- Completed Plan 13-03
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 9
  completed_plans: 6
  percent: 55
---

# Project State: Flick

**Status:** Executing Phase 13
**Last Updated:** 2026-03-23

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Same app, same features -- rebuilt on a faster, more scalable backend with TypeScript
**Current focus:** Phase 13 -- Auth & Storage Migration

## Current Position

Phase: 13 of 20 (Auth & Storage Migration)
Plan: 3 of 4 in current phase (completed)
Status: Plan 13-03 Complete
Last activity: 2026-03-23 -- Completed Plan 13-03

Progress: [█████-----] 55%

## Milestone History

| Milestone                  | Status      | Shipped    |
| -------------------------- | ----------- | ---------- |
| v1.0 Messaging Upgrade     | Shipped     | 2026-02-25 |
| v1.1 Pinned Snaps & Polish | Shipped     | 2026-03-20 |
| v1.2 Speed & Scale         | In progress | -          |

## Accumulated Context

**Decisions:** See PROJECT.md Key Decisions table (full log)

**Phase 12-01 decisions:**
- strict:false to avoid breaking existing JS codebase during migration
- allowJs:true so .js and .ts files coexist
- @/* path alias for clean imports from src/

**Phase 12-02 decisions:**
- UUID primary keys on all tables for Supabase Auth compatibility
- JSONB only for flexible data (selects, song, pinned_snap_data, notification data, reaction batches)
- CHECK(user1_id < user2_id) on all pair tables (friendships, conversations, streaks)
- Per-participant soft delete on conversations (deleted_at_p1/p2)
- UUID[] for comment mentions instead of JSONB for native PostgreSQL array operations

**Phase 12-03 decisions:**
- 50 RLS policies across all 18 tables with block enforcement on every friend-visibility policy
- PowerSync syncs only user's OWN photos with 30-day + developing/revealed window
- Conversations sync metadata only (not messages) for lightweight offline DB
- SQLite uses integer 0/1 for boolean fields (warning_sent on streaks)
- Admin-only operations (notification creation, streak CRUD) use service_role bypass

**Phase 13-01 decisions:**
- Stateless OTP pattern: no ConfirmationResult stored (Supabase handles state server-side)
- Public CDN URLs for photos (synchronous), 5-minute signed URLs for snaps (async)
- Supabase service files in src/services/supabase/ with {success, error} return pattern
- Supabase mocks on global.__supabaseMocks for test access

**Phase 13-02 decisions:**
- WebP compression: 0.9 for photos/snaps at 1080px, 0.7 for profile at 400px
- Edge Function uses Google Identity Toolkit REST API (not Firebase Admin SDK) for Deno compatibility
- GoTrue session tokens via temporary password strategy for silent auth migration
- Phone user lookup via direct users table query, not auth.admin.listUsers()
- base64-arraybuffer decode pattern for all React Native file uploads to Supabase Storage

**Phase 13-03 decisions:**
- PowerSyncProvider singleton with getPowerSyncDb() returning null before Phase 14 installation
- _resetForTesting export pattern for module-level state in service tests
- Resend handler calls sendVerificationCode directly (Supabase OTP is stateless)
- Silent migration: Firebase token -> Edge Function -> setSession({ access_token, refresh_token })

**v1.2 stack:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime) + PowerSync (offline SQLite) + TanStack Query (caching) + Sentry (monitoring). Replaces all 7 @react-native-firebase/* packages.

**Research flags:**
- Phase 13: Auth migration strategy needs design (keep Firebase Auth during transition vs. re-verification)
- Phase 14: PowerSync sync rules need validation against all access patterns
- Phase 17: Supabase Realtime reconnection reliability needs testing
- Phase 18: Edge Functions Deno compatibility for Expo Server SDK needs verification

**Known tech debt carried from v1.1:**
- Phase 6/8/9/10 gaps deferred (will be resolved by full rewrite in v1.2)
- React Native Firebase deprecated API warnings (eliminated by removal in Phase 20)

## Session Continuity

Last session: 2026-03-23T18:52:14Z
Stopped at: Completed 13-03-PLAN.md
Resume file: .planning/phases/13-auth-storage-migration/13-03-SUMMARY.md
