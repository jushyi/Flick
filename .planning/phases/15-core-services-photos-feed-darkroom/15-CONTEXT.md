# Phase 15: Core Services -- Photos, Feed, Darkroom - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the photo lifecycle, feed queries, darkroom reveal system, and user profile services to use Supabase + PowerSync + TanStack Query. All behavior is functionally identical to current Firebase implementation but faster. Services, hooks, and their integration are all in scope. No new features -- same capture, develop, reveal, triage, feed display, and profile CRUD.

</domain>

<decisions>
## Implementation Decisions

### Service rewrite scope
- Single file per service: photoService.ts, feedService.ts, darkroomService.ts, profileService.ts (replaces userService.js)
- New services live in `src/services/supabase/` -- parallel to existing `src/services/firebase/`. Both coexist during strangler fig migration
- Services AND their consuming hooks rewritten together in this phase (useFeedPhotos, useDarkroom, etc.). End-to-end: service talks to Supabase, hook uses TanStack/PowerSync, screens get data
- New services use throw-on-error pattern (TanStack Query catches errors automatically). Old `{ success, error }` pattern stays in unrewritten Firebase services only

### Feed query design
- Feed loads via Supabase RPC database function (`get_feed`), not a PostgreSQL view. Single SQL JOIN replaces 30-ID chunking. Parameters: userId, cursor, limit
- TanStack useInfiniteQuery wraps the RPC call with cursor-based pagination (WHERE created_at < $cursor ORDER BY created_at DESC LIMIT 20)
- RPC returns flat list of photos with user data joined. useFeedPhotos hook groups by userId client-side (same as current stories-style grouping)
- Feed data is NOT PowerSync-synced (Phase 12 decision: only user's own photos sync). TanStack Query caches feed results with stale-while-revalidate

### Darkroom reveal flow
- No separate darkroom state table. reveal_at lives on each photo row. "Next reveal time" = MIN(reveal_at) from user's developing photos
- Batch reveal preserved (current behavior): all developing photos share one reveal_at. When a reveal fires, ALL current developing photos are revealed together. New photos captured after get a new batch reveal_at
- Two client-side reveal triggers: App.js foreground check and DarkroomScreen focus check. Client reads PowerSync local photos where status='developing' AND reveal_at <= now(). If found, updates locally
- Reveal writes go through PowerSync local SQLite (update status to 'revealed'). PowerSync syncs to Supabase. Instant UI update, works offline
- pg_cron background catch-all is Phase 18 scope -- not built here

### Photo lifecycle
- On capture: photo record inserted into PowerSync local SQLite immediately with status='developing', image_url=NULL, local_uri set. Appears in darkroom instantly. Upload queue fills in image_url and storage_path when upload completes
- reveal_at assigned at capture time: calculateNextRevealTime() returns a batch reveal time. If other developing photos exist, new photo gets their reveal_at. If none, generates new random 0-5min window
- Triage (journal/archive) and soft delete use PowerSync local writes. Update photo_state or deleted_at in local SQLite, synced to Supabase automatically. Instant UI response
- Batch triage also uses PowerSync local writes (multiple photo updates in local SQLite)
- Reactions use TanStack mutations (photo_reactions table is not PowerSync-synced). Optimistic cache update via TanStack Query

### Profile service
- Separate profileService.ts handles user CRUD, username availability checks, daily photo count, profile setup completion
- Profile data read via TanStack useQuery (not PowerSync -- users table is not synced locally per Phase 12 decisions)
- Profile writes via TanStack useMutation with optimistic updates

### Claude's Discretion
- Exact RPC function SQL for feed query (JOIN structure, block filtering integration)
- PowerSync write helpers / patterns for photo operations
- How batch reveal_at coordination works when multiple photos are captured in sequence
- Hook API surface (return types, loading/error states, refetch patterns)
- Whether to create a Supabase database trigger for reaction_count increment or handle in service layer
- Test structure and mock patterns for new services

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Supabase, PowerSync, TanStack Query package versions and integration patterns
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig migration pattern, service layer restructuring, data flow changes

### Prior phase context (prerequisites)
- `.planning/phases/12-schema-infrastructure-foundation/12-CONTEXT.md` -- Schema design (snake_case, UUID PKs, JSONB for flexible data), PowerSync sync scope (4 tables: photos, conversations, friendships, streaks), RLS policies (friend-visibility, block enforcement)
- `.planning/phases/13-auth-storage-migration/13-CONTEXT.md` -- Storage paths, public CDN URLs for regular photos, WebP format, upload queue on PowerSync local SQLite
- `.planning/phases/14-data-layer-caching-foundation/14-CONTEXT.md` -- PowerSync useQuery for synced tables, TanStack for non-synced, query key factory pattern, staleTime 30s, gcTime 10min, throw-on-error for TanStack mutations

### Database schema
- `supabase/migrations/20260323000001_create_users.sql` -- Users table structure (daily_photo_count, last_photo_date, profile fields)
- `supabase/migrations/20260323000002_create_photos.sql` -- Photos table (status, photo_state, reveal_at, deleted_at), photo_reactions, photo_tags, viewed_photos tables

### Requirements
- `.planning/REQUIREMENTS.md` -- CORE-01 (photo service), CORE-02 (feed JOIN), CORE-03 (darkroom), CORE-07 (profile service)
- `.planning/ROADMAP.md` -- Phase 15 success criteria (4 items)

### Existing services being replaced
- `src/services/firebase/photoService.js` -- 25+ exports: createPhoto, revealPhotos, triagePhoto, batchTriage, softDelete, reactions, tags, captions
- `src/services/firebase/feedService.js` -- 10 exports: getFeedPhotos, subscribeFeedPhotos, toggleReaction, getFriendStoriesData
- `src/services/firebase/darkroomService.js` -- 6 exports: getDarkroom, isDarkroomReadyToReveal, scheduleNextReveal, ensureDarkroomInitialized
- `src/services/firebase/userService.js` -- 8 exports: getDailyPhotoCount, incrementDailyPhotoCount, getUserProfile, updateUserProfile, checkUsernameAvailability

### Project context
- `.planning/PROJECT.md` -- Constraints (dev-first migration, functionally identical, offline media capture non-negotiable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts` -- Supabase client already created (Phase 13 foundation)
- `src/lib/queryKeys.ts` -- Query key factory pattern (Phase 14). Feed, photos, profile keys should follow this pattern
- PowerSync database and connector from Phase 14 -- local SQLite reads/writes available
- `src/hooks/useFeedPhotos.js` (321 lines) -- Current feed hook with stories grouping logic. Rewrite target
- `src/hooks/useDarkroom.js` (726 lines) -- Current darkroom hook with countdown timer, reveal logic. Rewrite target

### Established Patterns
- Service layer: new services throw on error (TanStack catches). Old services keep `{ success, error }`
- PowerSync local writes for synced tables (photos, conversations, friendships, streaks)
- TanStack mutations for non-synced data (reactions, profiles)
- Query key factory: queryKeys.photos.list(), queryKeys.feed.infinite(), queryKeys.profile.detail(id)
- snake_case in DB, camelCase in TypeScript (mapping in service layer)

### Integration Points
- `src/services/supabase/` -- new service directory (parallel to firebase/)
- `src/services/supabase/index.ts` -- barrel file for new services
- Supabase RPC functions need corresponding SQL migrations (get_feed, reveal_photos, etc.)
- useCamera hook calls createPhoto -- needs to switch to new service
- App.js foreground check and DarkroomScreen focus check -- need to call new darkroom service
- AuthContext.updateProfile -- needs to use new profileService

</code_context>

<specifics>
## Specific Ideas

- Feed should feel instant: TanStack cache serves stale data while fresh feed loads in background (stale-while-revalidate)
- Darkroom should work offline: PowerSync local writes mean photos develop and reveal even without network
- Batch reveal preserves current UX: user opens darkroom and sees all photos reveal together, not one by one
- Profile CRUD is straightforward Supabase CRUD via TanStack -- no special patterns needed

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 15-core-services-photos-feed-darkroom*
*Context gathered: 2026-03-23*
