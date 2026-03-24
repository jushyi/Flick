# Roadmap: Flick

## Milestones

- ✅ **v1.0 Messaging Upgrade** -- Phases 1-5 (shipped 2026-02-25)
- ✅ **v1.1 Pinned Snaps & Polish** -- Phases 6-11 (shipped 2026-03-20)
- 🚧 **v1.2 Speed & Scale** -- Phases 12-20 (in progress)

## Phases

<details>
<summary>v1.0 Messaging Upgrade (Phases 1-5) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: Message Infrastructure & Read Receipts (2/2 plans)
- [x] Phase 2: Message Interactions (6/6 plans)
- [x] Phase 3: Snap Messages (8/8 plans)
- [x] Phase 4: Snap Streaks (4/4 plans)
- [x] Phase 5: Photo Tag Integration (4/4 plans)

</details>

<details>
<summary>v1.1 Pinned Snaps & Polish (Phases 6-11) -- SHIPPED 2026-03-20</summary>

- [x] Phase 6: Tech Debt & Darkroom Optimization (5 plans)
- [x] Phase 7: Performance Enhancements to Story Viewing (4 plans)
- [x] Phase 8: Screenshot Detection (4 plans)
- [x] Phase 9: Pinned Snaps iOS (20 plans)
- [x] Phase 10: Pinned Snaps Android (3 plans)
- [x] Phase 11: Add Video Support to Main Camera (8 plans)

</details>

### v1.2 Speed & Scale

**Milestone Goal:** Same app, same features -- rebuilt on Supabase + PowerSync with TypeScript. Every interaction feels Instagram/TikTok-level instant.

- [x] **Phase 12: Schema & Infrastructure Foundation** - PostgreSQL schema, Supabase project, PowerSync config, TypeScript foundation (completed 2026-03-23)
- [x] **Phase 13: Auth & Storage Migration** - Phone auth via Supabase/Twilio, photo storage migration, upload queue (completed 2026-03-24)
- [x] **Phase 14: Data Layer & Caching Foundation** - TanStack Query integration, PowerSync local SQLite, offline query persistence (completed 2026-03-24)
- [x] **Phase 15: Core Services -- Photos, Feed, Darkroom** - Photo CRUD, feed SQL joins, darkroom reveal, user profiles (completed 2026-03-24)
- [x] **Phase 16: Core Services -- Social & Albums** - Friendships, comments, albums, blocks/reports, contacts, real-time subscriptions (completed 2026-03-24)
- [ ] **Phase 17: Messaging & Social** - Conversations, messages, snaps, streaks, reactions, replies, tagged photos
- [ ] **Phase 18: Background Jobs & Notifications** - pg_cron jobs, Edge Functions, push notifications, triggers, Live Activity fix
- [ ] **Phase 19: Performance Polish** - Skeleton screens, optimistic updates, CDN URLs, image sizing, empty states, prefetching
- [ ] **Phase 20: TypeScript Sweep & Firebase Removal** - Convert remaining JS files, remove all Firebase packages, dead code cleanup

## Phase Details

### Phase 12: Schema & Infrastructure Foundation
**Goal**: The data foundation is proven -- a normalized PostgreSQL schema exists with tables for all 15 Firestore collections, Supabase services are provisioned, PowerSync sync rules are configured, and TypeScript tooling is ready
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A PostgreSQL schema exists in Supabase with normalized relational tables and foreign keys replacing all Firestore collections (users, photos, friendships, comments, albums, notifications, blocks, reports, reactionBatches, conversations, messages, and darkroom state)
  2. PowerSync sync rules are configured and tested for offline-capable collections (photos, darkroom, conversations, friendships) -- local SQLite reads return data without network
  3. Row-level security policies on all tables enforce that users can only read/write their own data and data shared with them (friends' photos, mutual conversations)
  4. TypeScript compiles with allowJs enabled, path aliases resolve, and `supabase gen types typescript` produces database types that import cleanly into service files
**Plans:** 3/3 plans complete

Plans:
- [ ] 12-01-PLAN.md -- Supabase CLI setup + TypeScript foundation
- [ ] 12-02-PLAN.md -- PostgreSQL schema migrations (18 tables + indexes + seed data)
- [ ] 12-03-PLAN.md -- RLS policies + PowerSync sync rules + client-side schema

### Phase 13: Auth & Storage Migration
**Goal**: Users can authenticate and upload/view media through Supabase -- phone OTP login works, existing accounts are migrated, and all photo/video/snap storage operations target Supabase Storage
**Depends on**: Phase 12
**Requirements**: AUTH-01, AUTH-02, AUTH-03, STOR-01, STOR-02, STOR-03, STOR-04
**Success Criteria** (what must be TRUE):
  1. A new user can sign up with phone number, receive an OTP via Twilio, verify it, and land on the profile setup screen
  2. An existing user's account has been migrated with preserved UID so all friendships, photos, and conversations remain linked
  3. Re-authentication via OTP works for account deletion flow
  4. Photos and videos upload to Supabase Storage and are accessible via CDN-backed URLs
  5. Snap photos upload with 5-minute signed URLs matching current ephemeral behavior
  6. The upload queue service retries failed uploads and persists queue across app restarts against the new storage backend
**Plans:** 4/4 plans complete

Plans:
- [ ] 13-01-PLAN.md -- Jest TS config, Supabase mocks, phone auth service, signed URL service
- [ ] 13-02-PLAN.md -- Storage service (WebP uploads), Edge Function auth migration bridge
- [ ] 13-03-PLAN.md -- Upload queue rewrite, AuthContext migration, auth screen rewrites
- [ ] 13-04-PLAN.md -- Firebase Storage data migration script, URL migration SQL

### Phase 14: Data Layer & Caching Foundation
**Goal**: The app has a unified data-fetching layer -- TanStack Query manages all server state with caching, PowerSync provides instant local reads, and the app opens with cached data instead of loading spinners
**Depends on**: Phase 13
**Requirements**: PERF-01, PERF-08, PERF-09
**Success Criteria** (what must be TRUE):
  1. All data fetching uses useQuery/useMutation hooks with automatic cache management (no manual state tracking for server data)
  2. Opening the app after a cold start renders cached feed, conversations, and profile data from AsyncStorage before any network request completes
  3. PowerSync local SQLite provides instant reads (0ms network latency) for photos, darkroom state, conversations, and friendships -- data appears immediately on screen navigation
**Plans:** 2/2 plans complete

Plans:
- [ ] 14-01-PLAN.md -- Package installation, Metro/Jest config, core data layer modules (QueryClient, queryKeys, PowerSync database, SupabaseConnector)
- [ ] 14-02-PLAN.md -- Provider wiring in App.js, useProfile PoC hook, unit tests for all modules

### Phase 15: Core Services -- Photos, Feed, Darkroom
**Goal**: The photo lifecycle works end-to-end through Supabase -- capture, upload, develop, reveal, triage, and feed display all function identically to current behavior but faster
**Depends on**: Phase 14
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-07
**Success Criteria** (what must be TRUE):
  1. User can capture a photo/video, see it enter the darkroom as "developing," and have it reveal after the random timer expires
  2. The feed loads via a single SQL JOIN query and renders all friends' revealed photos without the previous 30-ID chunking limitation
  3. User profile CRUD (display name, username, profile photo, song, selects) works against Supabase with no behavior change
  4. Photo triage (journal/archive), batch triage, and soft delete all function identically to current behavior
**Plans:** 4/4 plans complete

Plans:
- [x] 15-01-PLAN.md -- photoService.ts + darkroomService.ts + uploadQueue wiring (PowerSync local writes, reveal logic)
- [x] 15-02-PLAN.md -- get_feed RPC migration + feedService.ts + profileService.ts
- [x] 15-03-PLAN.md -- useDarkroom.ts + useFeedPhotos.ts hook rewrites
- [x] 15-04-PLAN.md -- Screen wiring (DarkroomScreen, FeedScreen, useCameraBase, App.js strangler fig switch)

### Phase 16: Core Services -- Social & Albums
**Goal**: All social features work through Supabase -- friendships, comments, albums, blocking, reporting, and contact sync function identically with real-time updates
**Depends on**: Phase 15
**Requirements**: CORE-04, CORE-05, CORE-06, CORE-08, CORE-09, CORE-10
**Success Criteria** (what must be TRUE):
  1. User can send, accept, and decline friend requests, and the friend list updates in real-time via Supabase Realtime
  2. Comments with @mention parsing and autocomplete work on any photo
  3. User-created albums and auto-generated monthly albums display correctly with all CRUD operations
  4. Block and report flows work -- blocked users disappear from feed and friend suggestions
  5. Contact sync finds friends by phone number against the new user lookup
**Plans:** 5/5 plans complete

Plans:
- [x] 16-01-PLAN.md -- Query keys, DB triggers/RPCs, friendship service (PowerSync local writes)
- [x] 16-02-PLAN.md -- Comment service, useComments with Supabase Realtime, @mention autocomplete
- [x] 16-03-PLAN.md -- Album service (junction table), monthly albums RPC, hooks with optimistic updates
- [x] 16-04-PLAN.md -- Block/report services, contact sync via Supabase RPC
- [x] 16-05-PLAN.md -- Gap closure: useFriendships TanStack Query hooks wrapping friendshipService

### Phase 17: Messaging & Social
**Goal**: The entire messaging system works through Supabase -- all 5 message types, snap lifecycle, streaks, read receipts, reactions, replies, and tagged photo pipeline function identically
**Depends on**: Phase 16
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06, MSG-07, MSG-08, MSG-09, MSG-10, MSG-11
**Success Criteria** (what must be TRUE):
  1. Conversation list loads with unread counts, and creating/soft-deleting conversations works
  2. All 5 message types (text, reaction, reply, snap, tagged_photo) send and display identically to current behavior
  3. Snap lifecycle works end-to-end: upload, send, view-once Polaroid viewer, auto-cleanup from storage
  4. Streak engine maintains 3-day activation, tiered expiry windows, and warning notifications (all server-authoritative)
  5. Read receipts with privacy toggle, emoji reactions, swipe-to-reply, message unsend, and delete-for-me all work
**Plans:** 5 plans

Plans:
- [ ] 17-01-PLAN.md -- Schema additions (message_deletions, read receipt columns, emoji, reply_preview) + PostgreSQL triggers + snap-cleanup Edge Function + queryKeys extension
- [ ] 17-02-PLAN.md -- messageService.ts (conversation CRUD, all 5 message types, unsend, delete-for-me, pagination) + unit tests
- [ ] 17-03-PLAN.md -- snapService.ts (WebP upload, send, view-once, signed URLs) + streakService.ts (pure functions for state derivation) + unit tests
- [ ] 17-04-PLAN.md -- useMessages.ts (PowerSync conversation list) + useConversation.ts (TanStack + Realtime) + useStreaks.ts (PowerSync streak reads)
- [ ] 17-05-PLAN.md -- Screen integration (MessagesListScreen, ConversationScreen wired to new hooks) + human verification

### Phase 18: Background Jobs & Notifications
**Goal**: All server-side automation runs on Supabase infrastructure -- scheduled jobs via pg_cron, event-driven Edge Functions, PostgreSQL triggers, and push notifications all replace Cloud Functions with identical behavior
**Depends on**: Phase 17
**Requirements**: JOBS-01, JOBS-02, JOBS-03, JOBS-04, JOBS-05, JOBS-06, JOBS-07, JOBS-08, JOBS-09, JOBS-10, LIVE-01
**Success Criteria** (what must be TRUE):
  1. Darkroom reveals process every 2 minutes via pg_cron and photos transition from developing to revealed
  2. Streak expiry checks run on schedule, expire stale streaks, and send 4-hour warning push notifications
  3. Push notifications deliver for all event types (new message, friend request, photo reveal, snap received, tag, streak warning) via Edge Functions using Expo Server SDK
  4. Snap cleanup, notification TTL, and account deletion cascade all run on schedule without manual intervention
  5. Friend count and photo soft-delete cascades execute via PostgreSQL triggers
  6. Push-to-start Live Activities work from background/killed state (APNS token acceptance fixed)
**Plans**: TBD

### Phase 19: Performance Polish
**Goal**: Every screen feels instant -- cached data renders in under 100ms, skeleton screens replace loading spinners, optimistic updates make interactions feel zero-latency, and images load without expired URL flashes
**Depends on**: Phase 18
**Requirements**: PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, PERF-10, PERF-11
**Success Criteria** (what must be TRUE):
  1. Feed, conversations, and profile screens render cached data while revalidating in the background (stale-while-revalidate, cached data visible in under 100ms)
  2. All list views (feed, conversations, friends, comments, notifications, albums) show skeleton screens during initial load instead of blank screens or spinners
  3. Sending a message, reacting, accepting a friend request, triaging a photo, and marking as read all update the UI instantly before the server confirms
  4. Photos and videos load via CDN-backed permanent URLs or pre-refreshed signed URLs with no expired URL flash or re-fetch delay
  5. Feed images are served at 400px for cards and full-res only in PhotoDetail, reducing bandwidth and load time
  6. All list views have consistent empty state screens (no blank white/dark screens)
**Plans:** 5 plans

Plans:
- [ ] 19-01-PLAN.md -- SkeletonBase primitive + 9 skeleton screen components + Toast config + react-native-toast-message install
- [ ] 19-02-PLAN.md -- imageUrl.ts utility (CDN transforms, signed URL expiry) + EmptyState component
- [ ] 19-03-PLAN.md -- useOptimisticMutation helper hook + stale-while-revalidate verification
- [ ] 19-04-PLAN.md -- Screen integration (wire skeletons, empty states, image transforms, prefetching into all 9 screens) + human verification
- [ ] 19-05-PLAN.md -- Wire optimistic updates into mutation hooks + proactive snap URL refresh integration

### Phase 20: TypeScript Sweep & Firebase Removal
**Goal**: The codebase is fully TypeScript with zero Firebase dependencies -- all remaining JS files are converted, Firebase packages are removed in a single EAS build, and dead code is cleaned up
**Depends on**: Phase 19
**Requirements**: TS-01, TS-02, TS-03, TS-04, CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05
**Success Criteria** (what must be TRUE):
  1. All service files (.ts) and hook files (.ts/.tsx) use Supabase-generated database types with zero `any` types
  2. All remaining JS files that were not touched during migration are converted to TypeScript
  3. All 7 @react-native-firebase/* packages are removed from package.json and the app builds successfully via EAS
  4. The functions/ directory (Firebase Cloud Functions) is removed with all jobs confirmed running on Supabase
  5. Sentry is integrated for error tracking and performance traces, replacing Firebase Performance Monitoring
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. Schema & Infrastructure Foundation | 3/3 | Complete    | 2026-03-23 | - |
| 13. Auth & Storage Migration | 4/4 | Complete   | 2026-03-24 | - |
| 14. Data Layer & Caching Foundation | 2/2 | Complete    | 2026-03-24 | - |
| 15. Core Services -- Photos, Feed, Darkroom | v1.2 | 4/4 | Complete    | 2026-03-24 |
| 16. Core Services -- Social & Albums | v1.2 | 5/5 | Complete    | 2026-03-24 |
| 17. Messaging & Social | v1.2 | 0/5 | Not started | - |
| 18. Background Jobs & Notifications | v1.2 | 0/TBD | Not started | - |
| 19. Performance Polish | v1.2 | 0/5 | Not started | - |
| 20. TypeScript Sweep & Firebase Removal | v1.2 | 0/TBD | Not started | - |

### Phase 21: Full verification of phases 13-20 - guided UAT of Supabase migration

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 20
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 21 to break down)
