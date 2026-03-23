---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Speed & Scale
status: planning
stopped_at: Phase 15 context gathered
last_updated: "2026-03-23T18:15:00.156Z"
last_activity: 2026-03-23 -- Completed Plan 12-03
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 9
  completed_plans: 3
  percent: 100
---

# Project State: Flick

**Status:** Ready to plan
**Last Updated:** 2026-03-23

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Same app, same features -- rebuilt on a faster, more scalable backend with TypeScript
**Current focus:** Phase 12 -- Schema & Infrastructure Foundation

## Current Position

Phase: 12 of 20 (Schema & Infrastructure Foundation)
Plan: 3 of 3 in current phase (completed)
Status: Phase 12 Complete
Last activity: 2026-03-23 -- Completed Plan 12-03

Progress: [██████████] 100%

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

Last session: 2026-03-23T18:15:00.154Z
Stopped at: Phase 15 context gathered
Resume file: .planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md
