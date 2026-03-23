# Feature Landscape: v1.2 Speed & Scale (Backend Migration)

**Domain:** Backend migration, TypeScript migration, performance overhaul for social media app
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (migration patterns well-established; performance UX patterns are HIGH confidence; specific backend choice impacts feature implementation details)

## Context: What Already Exists (Full Feature Parity Checklist)

Every item below MUST work identically after migration. This is the exhaustive inventory derived from Firestore collections, Cloud Functions, and client services.

### Firestore Collections to Migrate

| Collection | Documents | Key Fields | Real-Time? | Client Service |
|-----------|-----------|------------|------------|----------------|
| `users/` | User profiles | uid, username, displayName, photoURL, friends, fcmToken, nextRevealAt, friendCount, selects, profileSong | Yes (onSnapshot) | userService, feedService |
| `photos/` | All photos | userId, photoURL, status (developing/revealed), photoState (journal/archive/null), createdAt, thumbnailDataURL, taggedUserIds, reactions, songAttachment | Yes (onSnapshot) | photoService, feedService |
| `friendships/` | Friend relationships | user1Id, user2Id, status (pending/accepted), requestedBy, createdAt | Yes (onSnapshot) | friendshipService |
| `comments/` | Photo comments | photoId, userId, text, mentions, createdAt | Yes (onSnapshot) | commentService |
| `albums/` | User-created albums | userId, title, photoIds, coverPhotoId | No (getDocs) | albumService |
| `notifications/` | In-app notifications | userId, type, read, createdAt (TTL: 30 days) | Yes (onSnapshot) | notificationService |
| `blocks/` | User blocks | blockerId, blockedId | No (getDocs) | blockService |
| `reports/` | User reports | reporterId, reportedId, reason | No (write-only) | reportService |
| `reactionBatches/` | Batched reaction notifs | photoId, reactorId, reactions, status, sentAt (TTL: 7 days) | No (server-only) | N/A (Cloud Functions) |
| `conversations/` | DM conversations | participants, lastMessage, deletedAt, unreadCount | Yes (onSnapshot) | messageService |
| `conversations/{id}/messages/` | Individual messages | senderId, text, gifUrl, imageUrl, type, emoji, targetMessageId, replyTo, snapStoragePath, caption, viewedAt, expiresAt, createdAt | Yes (onSnapshot) | messageService, snapService |
| `darkrooms/` | Per-user darkroom state | userId, nextRevealAt, lastRevealedAt, createdAt | Yes (getDoc) | darkroomService |
| `streaks/` | Snap streaks | participants, dayCount, expiresAt, warning, lastSnapBy, createdAt, updatedAt | Yes (onSnapshot) | streakService |
| `supportRequests/` | Help/support tickets | userId, subject, description | No (write-only) | supportService |

### Cloud Functions to Migrate (30 functions)

| Function | Trigger | Purpose | Latency-Critical? |
|----------|---------|---------|-------------------|
| `onNewMessage` | Firestore onCreate | Central DM routing: lastMessage, unreadCount, push notif, streak updates | YES |
| `sendPhotoRevealNotification` | Firestore onWrite | Push notification when photos revealed | YES |
| `sendFriendRequestNotification` | Firestore onCreate | Push notification for friend requests | No |
| `sendFriendAcceptedNotification` | Firestore onWrite | Push notification when friend accepts | No |
| `sendReactionNotification` | Firestore onWrite | Debounced/batched reaction notifications | No |
| `sendTaggedPhotoNotification` | Firestore onWrite | Debounced tag notifications | No |
| `sendCommentNotification` | Firestore onCreate | Push notification for comments | No |
| `processDarkroomReveals` | Scheduled (2 min) | Background reveal catch-all | YES |
| `checkPushReceipts` | Scheduled | Verify push delivery receipts | No |
| `getSignedPhotoUrl` | onCall | Generate signed URLs (7-day expiry) | YES |
| `getSignedSnapUrl` | onCall | Generate signed URLs (5-min expiry) | YES |
| `deleteUserAccount` | onCall | Full account deletion (cascade) | No |
| `scheduleUserAccountDeletion` | onCall | Schedule soft delete | No |
| `cancelUserAccountDeletion` | onCall | Cancel scheduled deletion | No |
| `getMutualFriendSuggestions` | onCall | Friend suggestions based on graph | No |
| `getMutualFriendsForComments` | onCall | Mutual friends for @mention autocomplete | No |
| `unsendMessage` | onCall | Server-side message deletion | No |
| `addTaggedPhotoToFeed` | onCall | Reshare tagged photo with attribution | No |
| `onSnapViewed` | Firestore onWrite | Trigger snap photo cleanup from Storage | YES |
| `cleanupExpiredSnaps` | Scheduled | Orphan snap cleanup safety net | No |
| `expirePinnedSnapNotifications` | Scheduled | Clear expired pinned snap Live Activities | No |
| `processStreakExpiry` | Scheduled | Expire stale streaks, send warnings | No |
| `sendDeletionReminderNotification` | Scheduled | Remind users of pending account deletion | No |
| `processScheduledDeletions` | Scheduled | Execute scheduled account deletions | No |
| `processScheduledPhotoDeletions` | Scheduled | Execute scheduled photo deletions | No |
| `cleanupOldNotifications` | Scheduled | TTL cleanup for notifications (30 days) | No |
| `incrementFriendCountOnAccept` | Firestore onWrite | Denormalized friend count maintenance | No |
| `decrementFriendCountOnRemove` | Firestore onDelete | Denormalized friend count maintenance | No |
| `backfillFriendCounts` | onCall | One-time friend count backfill | No |
| `onReportCreated` | Firestore onCreate | Email notification for reports | No |
| `onSupportRequestCreated` | Firestore onCreate | Email notification for support requests | No |
| `onPhotoSoftDeleted` | Firestore onWrite | Cascade soft delete (remove from albums, etc.) | No |
| `sendBatchedNotification` | onRequest | HTTP endpoint for batched notification delivery | No |

### Client Services to Rewrite

| Service | Key Operations | Offline Support? | Real-Time? |
|---------|---------------|-----------------|------------|
| photoService | CRUD, reveal, triage, batch triage, soft delete | Upload queue (AsyncStorage) | onSnapshot for darkroom |
| feedService | Paginated feed, friend stories, reactions | None currently | onSnapshot |
| darkroomService | Get/create darkroom, check reveal, schedule next | AsyncStorage cache | getDoc |
| messageService | Conversations list, messages, send, read tracking, pagination | None currently | onSnapshot x2 |
| snapService | Upload, send, mark viewed, signed URL fetch | Retry with backoff | None |
| friendshipService | Send/accept/decline, list friends, check status | None | onSnapshot |
| streakService | Read-only subscriptions, state derivation | None | onSnapshot |
| commentService | CRUD, real-time subscription, mention parsing | None | onSnapshot |
| albumService | CRUD, photo management | None | None |
| monthlyAlbumService | Auto-generated monthly albums | None | None |
| notificationService | FCM token management, push notification handling | None | None |
| signedUrlService | URL generation/refresh with in-memory cache | In-memory cache | None |
| storageService | Upload/delete photos and videos to Firebase Storage | None | None |
| blockService | Block/unblock, get blocked lists | None | None |
| reportService | Submit report | None | None |
| accountService | Schedule/cancel deletion | None | None |
| uploadQueueService | Persistent upload queue with retry | AsyncStorage persistence | None |
| screenshotService | Screenshot detection, notification | Queue (screenshotQueueService) | None |
| contactSyncService | Contact matching for friend suggestions | None | None |
| viewedStoriesService | Track viewed stories | None | None |
| userService | Profile CRUD, search | None | None |
| phoneAuthService | Phone OTP auth flow | None | None |
| performanceService | Firebase Performance traces | None | None |
| liveActivityService | iOS Live Activities, Android persistent notifs | None | None |

---

## Table Stakes (Must Have for Migration)

Features the new backend MUST support from day one. Missing any of these means the migration is incomplete and the app regresses.

### Data Layer Parity

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| **Relational data with joins** | Friends feed requires joining photos with user profiles; conversations join with friend data; comments join with user profiles. Firestore forces client-side joins (N+1 queries). New backend must support server-side joins. | HIGH | This is the primary driver for migration. Every feed render currently does 30+ separate Firestore reads. |
| **Real-time subscriptions** | Conversations, feed, friend requests, streaks all use onSnapshot listeners. Users expect instant updates without pull-to-refresh. | HIGH | WebSocket-based real-time (Supabase Realtime, custom WebSocket server, or SSE). Must support filtered subscriptions (only my conversations, only my friends' photos). |
| **Cursor-based pagination** | Messages use startAfter cursor pagination. Feed uses time-based pagination. Must maintain. | LOW | Standard pattern in any SQL or document database. |
| **Atomic batch operations** | Photo reveal (batch update all developing photos), batch triage, cascade deletes all require transactional writes. | MEDIUM | SQL transactions are stronger than Firestore batches. Net positive. |
| **Deterministic document IDs** | Conversations and streaks use `[lowerUserId]_[higherUserId]` pattern for deduplication. Friendships use same pattern. | LOW | Unique constraints in SQL handle this natively. |
| **Server timestamps** | Every write uses serverTimestamp() for consistency. | LOW | Standard in any backend. |
| **TTL / auto-cleanup** | Notifications (30 days), reactionBatches (7 days), expired snaps. | LOW | Cron jobs or database-level TTL policies. |
| **File storage with signed URLs** | Photos and snaps stored in Firebase Storage with signed URLs (7-day for photos, 5-min for snaps). | MEDIUM | S3-compatible storage (Supabase Storage, Cloudflare R2, AWS S3) with presigned URLs. |

### Authentication Parity

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| **Phone-only OTP authentication** | App uses phone auth exclusively. No email/password fallback. Must support international phone numbers. | MEDIUM | Supabase Auth has phone auth via Twilio. Custom backend needs Twilio/Vonage integration. Firebase Auth migration requires user export/import. |
| **Re-authentication for sensitive ops** | Delete account flow re-authenticates with OTP before proceeding. | LOW | Standard auth pattern. |
| **FCM token management** | Push notifications send to FCM tokens stored per user. Token refresh on app foreground. | LOW | FCM tokens are independent of auth provider -- just store in user record. |

### Push Notification Parity

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| **Expo push notifications** | App uses expo-notifications with Expo push tokens. Cloud Functions send via Expo Server SDK. | LOW | Expo push sending is backend-agnostic. Just need HTTP calls to Expo push API. |
| **Notification debouncing/batching** | Reactions debounced into batches. Tags debounced (30s window). Prevents notification spam. | MEDIUM | Needs in-memory state or Redis for debounce windows. Cannot rely on database triggers alone. |
| **Randomized notification templates** | Multiple templates per notification type, randomly selected. | LOW | Application logic, backend-agnostic. |
| **APNS direct sending (Live Activities)** | Push-to-start Live Activities require direct APNS, not Expo push. | MEDIUM | Existing liveActivitySender.js handles this. Backend-agnostic -- just needs APNS cert/key access. |

### Scheduled Job Parity

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| **Darkroom reveals (every 2 min)** | Background catch-all for photo reveals. Users who don't open app still get photos revealed. | MEDIUM | Cron job or queue worker. Must handle thousands of users efficiently. |
| **Streak expiry processing** | Check all active streaks, expire stale ones, send warnings 4h before expiry. | MEDIUM | Cron job scanning streaks table. |
| **Snap cleanup** | Delete expired snap photos from storage. Safety net for snaps not cleaned up on view. | LOW | Cron job with storage deletion. |
| **Notification TTL cleanup** | Delete notifications older than 30 days. | LOW | SQL DELETE WHERE or cron job. |
| **Account deletion processing** | Execute scheduled deletions after recovery period. Cascade delete all user data. | MEDIUM | Must cascade: photos, comments, friendships, conversations, streaks, albums, notifications. |

### Offline & Upload Queue Parity

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| **Persistent upload queue** | Photos/videos queued in AsyncStorage, survive app restarts, upload with exponential backoff retry (3 attempts). Non-negotiable per project constraints. | HIGH | This is client-side (AsyncStorage + upload logic). Backend just needs upload endpoints. But migration must not break the queue -- items queued to old backend must drain before switchover. |
| **Screenshot detection queue** | Screenshots queued and sent when online. | LOW | Same AsyncStorage pattern as upload queue. |

---

## Differentiators (Performance UX -- What Makes It Feel Instagram-Fast)

These are not feature parity items. They are NEW performance patterns that the migration should introduce to justify the effort. This is what "every interaction feels Instagram/TikTok-level instant" means.

### Loading State Patterns

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Skeleton screens on every list** | Users perceive skeleton-loaded content as loading 50% faster than spinner-loaded content. Feed, conversations list, friend list, comments -- all should show skeleton placeholders matching final layout. | MEDIUM | Use `react-native-skeleton-placeholder` or Moti. Create reusable `<SkeletonFeedCard>`, `<SkeletonConversation>`, `<SkeletonComment>` components. Must match actual layout dimensions exactly. |
| **BlurHash image placeholders** | Colored blur placeholder while full image loads. Instagram uses this. Eliminates white/gray flash during image load. | MEDIUM | Generate BlurHash on backend during photo upload (add `blurhash` column). Store 20-30 char string per photo. Decode on client with `expo-image` built-in blurhash support. |
| **Progressive image loading** | Thumbnail -> blur -> full resolution. Feed photos should show tiny thumbnail immediately (already have `thumbnailDataURL`), then load full image. | LOW | Already partially implemented via `thumbnailDataURL` base64 field. Migration should formalize this: backend generates both thumbnail and blurhash on upload. |
| **Empty state screens** | Consistent empty states for: no photos in darkroom, no conversations, no friends, no notifications, no comments, no albums. Currently inconsistent. | LOW | Design system component: `<EmptyState icon={} title={} subtitle={} action={} />`. |

### Caching & Data Freshness

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **TanStack Query (React Query) integration** | Automatic cache management, background refetch, stale-while-revalidate, deduplication of identical requests, automatic retry. Replaces manual useState/useEffect data fetching. | HIGH | This is the single highest-impact performance improvement. Every service call wrapped in `useQuery` / `useMutation`. Requires rewriting all custom hooks. |
| **Offline query persistence** | TanStack Query can persist cache to AsyncStorage via `@tanstack/query-async-storage-persister`. App opens instantly with cached data, refreshes in background. | MEDIUM | Depends on TanStack Query adoption. Configuration-level, not feature-level. |
| **Stale-while-revalidate for feed** | Show cached feed immediately on app open, refresh in background. User sees content in <100ms instead of waiting for network. | LOW | TanStack Query `staleTime` + `gcTime` configuration. Feed: staleTime 30s, gcTime 5min. |
| **Image cache with expo-image** | Already using expo-image with `cachePolicy="memory-disk"`. Migration should ensure all images route through expo-image consistently. | LOW | Audit all Image usage -- ensure zero `react-native` Image imports remain. |
| **Signed URL pre-refresh** | Refresh signed URLs before they expire, not after. Currently URLs expire and user sees broken image before refresh triggers. | LOW | Background job that refreshes URLs with <24h remaining. Or switch to CDN with permanent public URLs (preferred if storage supports it). |

### Optimistic Updates

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Optimistic message sending** | Message appears in conversation immediately, before server confirms. If send fails, show retry indicator. Instagram/iMessage pattern. | MEDIUM | TanStack Query `useMutation` with `onMutate` to prepend message to cache. Roll back on error. |
| **Optimistic reactions** | Reaction count increments immediately on tap. Roll back if server rejects. | LOW | Same pattern. Already somewhat fast but Firestore write latency adds 200-500ms delay. |
| **Optimistic friend request** | "Request Sent" state shows immediately. | LOW | Already fast, but formalizing with TanStack Query mutation. |
| **Optimistic photo triage** | Journal/archive/delete reflects immediately in UI. | LOW | Photo disappears from darkroom/feed instantly, server confirms in background. |
| **Optimistic read receipts** | Mark as read in UI immediately, write to server in background. | LOW | Already doing this somewhat -- formalize with mutation. |

### Navigation & Transition Performance

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Preloaded screen data** | When user taps a conversation, message history is already cached from conversation list fetch. No loading spinner on conversation open. | MEDIUM | TanStack Query `prefetchQuery` on conversation list item render. Prefetch first page of messages for visible conversations. |
| **Instant tab switching** | Tab switches should never show loading spinners. Cached data renders immediately. | LOW | TanStack Query cache + stale-while-revalidate. |
| **Feed scroll position preservation** | Switching tabs and returning to feed should preserve scroll position. | LOW | FlashList `estimatedItemSize` + React Navigation state preservation (already handled by default). |
| **Lazy screen loading** | Screens not yet visited should not load data. Only fetch on first visit. | LOW | React Navigation lazy loading (default behavior). TanStack Query only fetches when component mounts. |

---

## Anti-Features (Explicitly NOT Building in v1.2)

| Anti-Feature | Why Avoid | What to Do Instead |
|-------------|-----------|-------------------|
| **GraphQL API** | Adds complexity (schema definition, resolver layer, client codegen) without clear benefit for this app's query patterns. REST with well-designed endpoints is simpler and sufficient. | REST API with TypeScript types shared between client and server. Consider tRPC if you want end-to-end type safety without GraphQL overhead. |
| **Full offline-first with conflict resolution** | True offline-first (CRDTs, conflict resolution, sync queues for every operation) is extremely complex and only justified for collaborative editing apps. Flick's social features are inherently online (you can't send a DM offline). | Offline MEDIA CAPTURE (upload queue) is non-negotiable and already works. For reads, TanStack Query cache provides "offline reads" of previously fetched data. For writes beyond media, show "no connection" state. |
| **Real-time typing indicators** | Already out of scope per PROJECT.md. Creates social pressure, constant writes, low impact. | Nothing. Not building this. |
| **Message search / full-text search** | Requires Elasticsearch/Algolia/Typesense. Low value for ephemeral-focused app. | Nothing. Already out of scope. |
| **WebSocket-based real-time for everything** | Not every data type needs real-time. Albums, blocks, reports, support requests are fine with REST. Over-subscribing wastes server resources and battery. | Real-time ONLY for: conversations/messages, feed (new photos from friends), friend requests, streaks. Everything else uses REST with TanStack Query background refetch. |
| **Server-side rendering or edge functions** | Mobile app has no HTML to render. Edge functions add deployment complexity. | Standard server deployment. Cloud functions/serverless for scheduled jobs. |
| **Database-level row-level security (RLS)** | Supabase RLS is powerful but adds complexity to every query. For a small team, API-level authorization is simpler to reason about and debug. | Middleware-based auth checks in API layer. Service-level authorization. |
| **Microservices architecture** | App has ~75K LOC total. Microservices are for teams of 50+. Adds network hops, deployment complexity, observability burden. | Modular monolith: single deployable with clear module boundaries (auth, photos, messaging, social, notifications). Can extract later if needed. |
| **Custom CDN for images** | Premature optimization. S3/Supabase Storage with presigned URLs is sufficient at current scale. | Use storage provider's built-in CDN (Supabase Storage has CDN, S3 + CloudFront is one toggle). Revisit when serving 1M+ images/day. |

---

## Feature Dependencies

```
Phone Auth Migration ──┐
                       ├──> User Profiles Migration ──> All Other Features
FCM Token Storage ─────┘

Storage Migration (photos/snaps) ──> Photo Service ──> Feed Service
                                                   ──> Darkroom Service
                                                   ──> Album Service

User Profiles ──> Friendship Service ──> Feed Service (friend filtering)
                                     ──> Message Service (friend-only DMs)
                                     ──> Streak Service
                                     ──> Contact Sync

Message Service ──> Snap Service (snap messages are message type)
               ──> Streak Service (streak updates on snap send)

TanStack Query Setup ──> All client-side hooks rewrite
                     ──> Optimistic updates
                     ──> Offline cache persistence
                     ──> Skeleton screens (need loading/success states from queries)

TypeScript Migration ──> Runs in parallel with service rewrites
                     ──> Each service file converted as it's touched
```

## Migration Sequencing Constraints

1. **Auth MUST migrate first** -- every other operation requires an authenticated user
2. **Storage MUST migrate before photos** -- photo upload/download depends on storage provider
3. **Users + Friendships MUST migrate before feed** -- feed queries filter by friend list
4. **Messages MUST migrate before snaps/streaks** -- snaps are a message type, streaks trigger on snap send
5. **TanStack Query MUST be set up before hook rewrites** -- otherwise you're rewriting hooks twice
6. **Scheduled jobs can migrate last** -- they're background processes, not user-facing

---

## MVP Recommendation (Migration Phases)

### Phase 1: Foundation
Prioritize:
1. **TanStack Query setup** -- install, configure, create query client with persistence
2. **Auth migration** -- phone OTP with new backend, user profile CRUD
3. **Storage migration** -- photo/video upload to new storage, signed URL generation
4. **TypeScript setup** -- tsconfig, path aliases, start converting shared types

### Phase 2: Core Social
Prioritize:
1. **Photo service migration** -- CRUD, darkroom, reveal, triage
2. **Feed service migration** -- with server-side joins (biggest perf win)
3. **Friendship service migration** -- requests, accept/decline, friend list
4. **Skeleton screens + BlurHash** -- every list gets skeleton loading

### Phase 3: Messaging
Prioritize:
1. **Conversation + message service migration** -- real-time subscriptions
2. **Snap service migration** -- ephemeral photos, view-once, cleanup
3. **Streak service migration** -- server-authoritative streak logic
4. **Optimistic updates** -- messages, reactions, triage

### Phase 4: Background & Cleanup
Prioritize:
1. **Scheduled job migration** -- darkroom reveals, streak expiry, cleanup jobs
2. **Notification service migration** -- push notification sending from new backend
3. **Account deletion cascade** -- full user data cleanup
4. **Dead Firebase dependency removal** -- remove all @react-native-firebase packages

Defer:
- **Comment service**: Low complexity, can migrate in Phase 2 or 3 as capacity allows
- **Album service**: Read-heavy, low priority, can use REST without real-time
- **Block/report services**: Simple CRUD, migrate whenever
- **IAP service**: Independent of backend, no migration needed
- **Performance monitoring**: Replace Firebase Performance with custom traces or drop

---

## Sources

- Project codebase: `functions/index.js` (30 Cloud Functions), `src/services/` (23 service files)
- [TanStack Query Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) -- HIGH confidence
- [TanStack Query Offline with AsyncStorage](https://www.benoitpaul.com/blog/react-native/offline-first-tanstack-query/) -- MEDIUM confidence
- [Supabase Firebase Migration Guide](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data) -- HIGH confidence
- [BlurHash](https://blurha.sh/) -- HIGH confidence
- [React Native Skeleton Loading Patterns](https://dev.to/amitkumar13/adding-a-shimmer-effect-in-react-native-fe2) -- MEDIUM confidence
- [Callstack Shimmer Performance](https://www.callstack.com/blog/performant-and-cross-platform-shimmers-in-react-native-apps) -- MEDIUM confidence
- [Whitespectre: Offline-First React Native with React Query](https://www.whitespectre.com/ideas/how-to-build-offline-first-react-native-apps-with-react-query-and-typescript/) -- MEDIUM confidence
- [Social Media Platform Scaling Patterns](https://tech-stack.com/blog/social-media-platform-development/) -- LOW confidence (general guidance)
