# Requirements: Flick v1.2 Speed & Scale

**Defined:** 2026-03-23
**Core Value:** Same app, same features — rebuilt on a faster, more scalable backend. Every interaction feels instant.

## v1.2 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Infrastructure & Schema

- [x] **INFRA-01**: PostgreSQL schema designed with normalized relational tables replacing all 15 Firestore collections
- [x] **INFRA-02**: Supabase project provisioned with database, auth, storage, and Edge Functions configured
- [x] **INFRA-03**: PowerSync configured with sync rules for offline-capable collections (photos, darkroom, conversations, friendships)
- [x] **INFRA-04**: Row-level security (RLS) policies enforce per-user data access on all tables
- [x] **INFRA-05**: TypeScript foundation configured (tsconfig with allowJs, path aliases, Supabase-generated database types)

### Auth & Storage

- [x] **AUTH-01**: User can authenticate via phone OTP through Supabase Auth + Twilio (replacing Firebase Phone Auth)
- [x] **AUTH-02**: Existing user accounts migrated with preserved UIDs so all relationships remain intact
- [x] **AUTH-03**: Re-authentication via OTP works for sensitive operations (account deletion)
- [x] **STOR-01**: Photos and videos upload to Supabase Storage (S3-compatible) with CDN-backed URLs
- [x] **STOR-02**: Snap photos upload to Supabase Storage with short-lived signed URLs (5-minute expiry)
- [x] **STOR-03**: Upload queue service works against new storage backend with same retry/persistence behavior
- [x] **STOR-04**: Data migration script transfers all existing photos, videos, and profile images from Firebase Storage to Supabase Storage

### Core Services

- [x] **CORE-01**: Photo service rewritten for Supabase — CRUD, reveal, triage, batch triage, soft delete all functional
- [x] **CORE-02**: Feed loads via single SQL JOIN query replacing chunked Firestore `in` queries (30-ID limit eliminated)
- [x] **CORE-03**: Darkroom service rewritten — developing/revealed state, reveal scheduling, countdown timer all functional
- [x] **CORE-04**: Friendship service rewritten — send/accept/decline requests, friend list, mutual friends all functional
- [x] **CORE-05**: Comment service rewritten — CRUD, real-time subscriptions, @mention parsing all functional
- [x] **CORE-06**: Album and monthly album services rewritten for Supabase
- [x] **CORE-07**: User profile service rewritten — CRUD, search, friend count all functional
- [x] **CORE-08**: Block and report services rewritten for Supabase
- [x] **CORE-09**: Contact sync service works against new user lookup endpoints
- [x] **CORE-10**: Real-time subscriptions work for feed, friend requests, and notifications via Supabase Realtime

### Messaging & Social

- [x] **MSG-01**: Conversation service rewritten — list, create, soft delete, unread counts all functional via Supabase
- [x] **MSG-02**: Message service rewritten — send, paginate, real-time subscription all functional
- [x] **MSG-03**: All 5 message types (text, reaction, reply, snap, tagged_photo) work identically to current behavior
- [x] **MSG-04**: Snap lifecycle rewritten — upload, send, view-once, auto-cleanup via Supabase Storage + Edge Functions
- [x] **MSG-05**: Streak engine rewritten — 3-day activation, tiered expiry, warning notifications all server-authoritative
- [x] **MSG-06**: Read receipts with privacy toggle work via Supabase (conversation-level, mutual model)
- [x] **MSG-07**: Message reactions (double-tap heart + 6-emoji picker) work with new backend
- [x] **MSG-08**: Swipe-to-reply with quoted context works with new backend
- [x] **MSG-09**: Message deletion (unsend) and delete-for-me work via Edge Functions
- [x] **MSG-10**: Screenshot detection and notification work with new backend
- [x] **MSG-11**: Tagged photo DM pipeline works — auto-send tagged photos, add-to-feed resharing with attribution

### Background Jobs

- [x] **JOBS-01**: Darkroom reveal processing runs every 2 minutes via pg_cron (replaces processDarkroomReveals Cloud Function)
- [x] **JOBS-02**: Streak expiry processing checks all active streaks, expires stale ones, sends 4h warning notifications
- [x] **JOBS-03**: Snap cleanup deletes expired snap photos from storage (replaces cleanupExpiredSnaps)
- [x] **JOBS-04**: Notification TTL cleanup deletes notifications older than 30 days
- [x] **JOBS-05**: Account deletion cascade executes scheduled deletions with full data cleanup
- [x] **JOBS-06**: Push notifications sent via Edge Functions using Expo Server SDK (all notification types ported)
- [x] **JOBS-07**: Notification debouncing/batching for reactions and tags (replaces Cloud Tasks 30s windows)
- [x] **JOBS-08**: Friend count maintenance via PostgreSQL triggers (replaces increment/decrement Cloud Functions)
- [x] **JOBS-09**: Photo soft-delete cascade (album removal, etc.) via PostgreSQL triggers
- [x] **JOBS-10**: Pinned snap notification expiry processing (48h auto-dismiss)

### Performance

- [x] **PERF-01**: TanStack Query integrated — all data fetching uses useQuery/useMutation with automatic caching
- [ ] **PERF-02**: Stale-while-revalidate pattern on feed, conversations, and profile screens (cached data renders in <100ms)
- [ ] **PERF-03**: Skeleton screens on all list views (feed, conversations, friends, comments, notifications, albums)
- [ ] **PERF-04**: Optimistic updates for message sending, reactions, friend requests, photo triage, and read receipts
- [ ] **PERF-05**: Photo/video loading uses CDN-backed permanent URLs or pre-refreshed signed URLs (no expired URL flash)
- [ ] **PERF-06**: Feed images served at appropriate sizes (400px for cards, full-res only in PhotoDetail)
- [ ] **PERF-07**: Consistent empty state screens across all list views
- [x] **PERF-08**: Offline query persistence via TanStack Query + AsyncStorage (app opens instantly with cached data)
- [x] **PERF-09**: PowerSync local SQLite provides instant reads for photos, darkroom, conversations, friendships (0ms network latency)
- [ ] **PERF-10**: New story photos from friends load within 1-2 seconds — CDN edge caching, aggressive prefetching of next friend's photos, and optimized image sizing for feed/story views
- [ ] **PERF-11**: Feed and story image prefetching loads next N images while viewing current (existing v1.1 prefetching enhanced with CDN + size optimization)

### Live Activity Fixes

- [x] **LIVE-01**: Push-to-start Live Activities work from background/killed state (fix APNS BadDeviceToken token acceptance)

### TypeScript Migration

- [ ] **TS-01**: All rewritten service files are TypeScript (.ts) with Supabase-generated database types
- [ ] **TS-02**: All rewritten hooks are TypeScript (.ts/.tsx) with proper type annotations
- [ ] **TS-03**: Remaining untouched JS files converted to TypeScript after main migration
- [ ] **TS-04**: Zero `any` types in rewritten code (strict typing for new code, allowJs for legacy)

### Cleanup

- [ ] **CLEAN-01**: All 7 @react-native-firebase/* packages removed (single EAS native build)
- [ ] **CLEAN-02**: Firebase Cloud Functions directory (functions/) removed after all jobs ported
- [ ] **CLEAN-03**: Dead code identified and removed during per-screen audit
- [ ] **CLEAN-04**: Firebase-specific config files (GoogleService-Info.plist, google-services.json) removed
- [ ] **CLEAN-05**: Sentry replaces Firebase Performance Monitoring for error tracking and traces

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Performance

- **PERF-12**: BlurHash placeholders replace base64 thumbnails for smaller payload + better visual quality
- **PERF-13**: Image CDN with on-the-fly resizing (Cloudflare Images, imgproxy)

### Advanced Offline

- **OFFLINE-01**: Offline photo triage (journal/archive) syncs when back online
- **OFFLINE-02**: Offline friend request accept/decline syncs when back online

### Monitoring

- **MON-01**: Real-time dashboard for API latency, error rates, and database query performance
- **MON-02**: User session replay for debugging production issues

## Out of Scope

| Feature | Reason |
|---------|--------|
| GraphQL API | REST with TypeScript types sufficient at this scale; GraphQL adds schema/resolver/codegen complexity |
| Full offline-first with CRDTs | Social features are inherently online; offline scoped to media capture only |
| Microservices architecture | ~75K LOC, solo developer — modular monolith is appropriate |
| Custom CDN for images | Supabase Storage has built-in CDN; revisit at 1M+ images/day |
| WebSocket real-time for everything | Only 7 of 15 data types need real-time; rest use REST + TanStack Query |
| New user-facing features | Migration only — functionally identical app |
| Database-level RLS without API layer | API-level auth checks simpler to debug for small team |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 12 | Complete |
| INFRA-02 | Phase 12 | Complete |
| INFRA-03 | Phase 12 | Complete |
| INFRA-04 | Phase 12 | Complete |
| INFRA-05 | Phase 12 | Complete |
| AUTH-01 | Phase 13 | Complete |
| AUTH-02 | Phase 13 | Complete |
| AUTH-03 | Phase 13 | Complete |
| STOR-01 | Phase 13 | Complete |
| STOR-02 | Phase 13 | Complete |
| STOR-03 | Phase 13 | Complete |
| STOR-04 | Phase 13 | Complete |
| PERF-01 | Phase 14 | Complete |
| PERF-08 | Phase 14 | Complete |
| PERF-09 | Phase 14 | Complete |
| CORE-01 | Phase 15 | Complete |
| CORE-02 | Phase 15 | Complete |
| CORE-03 | Phase 15 | Complete |
| CORE-07 | Phase 15 | Complete |
| CORE-04 | Phase 16 | Complete |
| CORE-05 | Phase 16 | Complete |
| CORE-06 | Phase 16 | Complete |
| CORE-08 | Phase 16 | Complete |
| CORE-09 | Phase 16 | Complete |
| CORE-10 | Phase 16 | Complete |
| MSG-01 | Phase 17 | Complete |
| MSG-02 | Phase 17 | Complete |
| MSG-03 | Phase 17 | Complete |
| MSG-04 | Phase 17 | Complete |
| MSG-05 | Phase 17 | Complete |
| MSG-06 | Phase 17 | Complete |
| MSG-07 | Phase 17 | Complete |
| MSG-08 | Phase 17 | Complete |
| MSG-09 | Phase 17 | Complete |
| MSG-10 | Phase 17 | Complete |
| MSG-11 | Phase 17 | Complete |
| JOBS-01 | Phase 18 | Complete |
| JOBS-02 | Phase 18 | Complete |
| JOBS-03 | Phase 18 | Complete |
| JOBS-04 | Phase 18 | Complete |
| JOBS-05 | Phase 18 | Complete |
| JOBS-06 | Phase 18 | Complete |
| JOBS-07 | Phase 18 | Complete |
| JOBS-08 | Phase 18 | Complete |
| JOBS-09 | Phase 18 | Complete |
| JOBS-10 | Phase 18 | Complete |
| LIVE-01 | Phase 18 | Complete |
| PERF-02 | Phase 19 | Pending |
| PERF-03 | Phase 19 | Pending |
| PERF-04 | Phase 19 | Pending |
| PERF-05 | Phase 19 | Pending |
| PERF-06 | Phase 19 | Pending |
| PERF-07 | Phase 19 | Pending |
| PERF-10 | Phase 19 | Pending |
| PERF-11 | Phase 19 | Pending |
| TS-01 | Phase 20 | Pending |
| TS-02 | Phase 20 | Pending |
| TS-03 | Phase 20 | Pending |
| TS-04 | Phase 20 | Pending |
| CLEAN-01 | Phase 20 | Pending |
| CLEAN-02 | Phase 20 | Pending |
| CLEAN-03 | Phase 20 | Pending |
| CLEAN-04 | Phase 20 | Pending |
| CLEAN-05 | Phase 20 | Pending |

**Coverage:**
- v1.2 requirements: 64 total
- Mapped to phases: 64
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
