# Phase 16: Core Services -- Social & Albums - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite all social features for Supabase: friendships, comments, albums (user-created + monthly), blocking, reporting, contact sync, and real-time subscriptions. All behavior is functionally identical to current Firebase implementation. Services, hooks, and their consuming screen integrations are all in scope. No new features -- same friend requests, comment threads, album CRUD, block/report flows, and contact-based friend suggestions.

</domain>

<decisions>
## Implementation Decisions

### Friendship service
- PowerSync local writes for all friendship operations (send, accept, decline, unfriend). Friendships table is PowerSync-synced (Phase 12 decision)
- Instant UI updates via local SQLite write, PowerSync syncs to Supabase automatically
- Other user sees friend request updates via PowerSync sync cycle (typically seconds) -- no separate Realtime channel needed
- Keep deterministic ID pattern with CHECK(user1_id < user2_id) constraint from Phase 12 schema
- Unfriending: PowerSync local delete + PostgreSQL trigger decrements friend counts on both users
- Friend count maintenance via DB triggers (created in this phase, aligns with Phase 18 trigger patterns)

### Comment service
- TanStack useQuery for fetching comments + Supabase Realtime channel filtered by photo_id for live updates
- Realtime INSERT events trigger TanStack cache invalidation (queryClient.invalidateQueries)
- Keep flat threading model: parent_id for thread grouping, mentioned_comment_id for reply-to-reply targeting
- @mention autocomplete queries PowerSync local SQLite for accepted friends (instant, offline-capable)
- Comment count maintained by PostgreSQL trigger on INSERT/DELETE (auto-increment/decrement comment_count on photos table)
- Comment likes use TanStack mutations (comment_likes table is not PowerSync-synced)

### Album service
- Junction table (album_photos) for photo-album relationships -- standard relational pattern from Phase 12 schema
- TanStack useMutation for all CRUD with optimistic updates (add/remove photos, create, delete, update cover)
- Albums are NOT PowerSync-synced -- TanStack Query handles caching
- Monthly albums are a client-side query (not stored data): query photos grouped by month via Supabase RPC. No materialized records needed

### Block & report services
- Block: direct Supabase insert/delete via TanStack mutations. RLS policies already enforce block visibility (Phase 12)
- Report: direct Supabase insert via TanStack mutation. Simple write, no complex logic
- On block: feed and friend suggestions automatically exclude blocked users via existing RLS policies
- Cleanup of blocked user's content (comments, reactions on blocker's photos) handled by PostgreSQL trigger or Edge Function

### Contact sync service
- Single Supabase RPC call with ANY() for phone number lookup -- no batch limit (replaces Firestore's 10-item `in` query batching)
- Server-side filtering in the RPC: excludes existing friends and pending requests from results
- Client-side E.164 normalization via libphonenumber-js (already installed, no change)
- Same sync flow: request permission -> get contacts -> normalize -> RPC lookup -> display suggestions

### Real-time subscriptions (CORE-10)
- Friendships: PowerSync sync provides real-time updates for both users
- Comments: Supabase Realtime channel per photo_id, invalidates TanStack cache
- Friend requests / notifications: PowerSync sync for friendships, TanStack + Realtime for notifications
- No Realtime channels for albums or blocks (low-frequency operations, TanStack refetch on app foreground sufficient)

### Claude's Discretion
- Exact Supabase RPC SQL for contact sync (phone lookup with friendship filtering)
- PostgreSQL trigger implementation for comment_count and friend_count
- Supabase Realtime channel subscription management (connect/disconnect lifecycle in hooks)
- Hook API surface and return types for new hooks
- Block cleanup logic (trigger vs Edge Function for removing blocked user's content)
- Test structure and mock patterns for new services
- Whether monthly album query uses an RPC function or a database view

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Supabase, PowerSync, TanStack Query package versions and integration patterns
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig migration pattern, service layer restructuring, data flow changes

### Prior phase context (prerequisites)
- `.planning/phases/12-schema-infrastructure-foundation/12-CONTEXT.md` -- Schema design (snake_case, UUID PKs, CHECK constraints on pair tables, JSONB for flexible data), PowerSync sync scope (friendships synced, comments/albums NOT synced), RLS policies (block enforcement at RLS level)
- `.planning/phases/13-auth-storage-migration/13-CONTEXT.md` -- Storage paths, public CDN URLs for regular photos, service layer pattern
- `.planning/phases/14-data-layer-caching-foundation/14-CONTEXT.md` -- PowerSync useQuery for synced tables, TanStack for non-synced, query key factory pattern, Realtime invalidates TanStack cache, staleTime 30s, gcTime 10min
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` -- Throw-on-error pattern for new services, services in src/services/supabase/, PowerSync local writes for synced tables, TanStack mutations for non-synced

### Database schema
- `supabase/migrations/` -- All table definitions including friendships, comments, comment_likes, albums, album_photos, blocks, reports, users (phone column for contact sync)

### Requirements
- `.planning/REQUIREMENTS.md` -- CORE-04 (friendships), CORE-05 (comments), CORE-06 (albums), CORE-08 (blocks/reports), CORE-09 (contact sync), CORE-10 (real-time subscriptions)
- `.planning/ROADMAP.md` -- Phase 16 success criteria (5 items)

### Existing services being replaced
- `src/services/firebase/friendshipService.js` (583 lines) -- Send/accept/decline requests, friend list, real-time subscriptions, deterministic IDs
- `src/services/firebase/commentService.js` (794 lines) -- CRUD, threaded comments, @mentions, real-time subscriptions, comment count maintenance
- `src/services/firebase/albumService.js` (420 lines) -- Album CRUD, add/remove photos, cover photo logic
- `src/services/firebase/monthlyAlbumService.js` (187 lines) -- Auto-generated monthly album grouping
- `src/services/firebase/blockService.js` (335 lines) -- Block/unblock, blocked user list, content cleanup
- `src/services/firebase/reportService.js` (103 lines) -- Report user submission
- `src/services/firebase/contactSyncService.js` -- Phone normalization, batch lookup, friend suggestion filtering
- `src/hooks/useComments.js` (500 lines) -- Comment CRUD hook, real-time subscriptions
- `src/hooks/useMentionSuggestions.js` (224 lines) -- @mention autocomplete from friends list

### Project context
- `.planning/PROJECT.md` -- Constraints (dev-first migration, functionally identical, offline media capture non-negotiable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts` -- Supabase client (Phase 13)
- `src/lib/queryKeys.ts` -- Query key factory pattern (Phase 14). Extend with: queryKeys.friendships, queryKeys.comments, queryKeys.albums, queryKeys.contacts
- PowerSync database and connector (Phase 14) -- local SQLite reads/writes for friendships
- `src/services/supabase/` -- New service directory established in Phase 15
- `libphonenumber-js` -- Already installed for E.164 phone normalization

### Established Patterns
- New services throw on error (TanStack catches) -- established Phase 15
- PowerSync local writes for synced tables (friendships) -- instant UI, offline capable
- TanStack mutations for non-synced tables (comments, albums, blocks, reports)
- Supabase Realtime for live comment updates -- invalidates TanStack cache
- snake_case in DB, camelCase in TypeScript (service layer mapping)
- Service layer: single file per service in src/services/supabase/

### Integration Points
- FriendsScreen, FriendsListScreen -- consume friendship service/hooks
- PhotoDetail comment section -- consumes comment service/hooks
- ProfileStackNavigator album screens (CreateAlbum, AlbumGrid, AlbumPhotoPicker, MonthlyAlbumGrid)
- BlockedUsersScreen, ReportUserScreen -- consume block/report services
- ContactsSyncScreen, ContactsSettingsScreen -- consume contact sync service
- ActivityScreen -- displays friend request notifications

</code_context>

<specifics>
## Specific Ideas

- Friendships should feel instant: PowerSync local writes mean accept/decline updates UI before server confirms
- Comments should stream in live: Supabase Realtime channel per photo ensures new comments appear without manual refresh
- Contact sync is dramatically simpler: one SQL query replaces multiple batched Firestore queries with 10-item limits
- Monthly albums are a query, not stored data: always current, zero maintenance

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 16-core-services-social-albums*
*Context gathered: 2026-03-23*
