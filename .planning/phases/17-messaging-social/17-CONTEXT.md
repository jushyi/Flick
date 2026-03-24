# Phase 17: Messaging & Social - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the entire messaging system for Supabase: conversations, all 5 message types (text, reaction, reply, snap, tagged_photo), snap lifecycle, streaks, read receipts, reactions, replies, screenshot detection, message unsend, delete-for-me, and tagged photo pipeline. All behavior is functionally identical to current Firebase implementation. Services, hooks, and their consuming screen integrations are all in scope. No new features. Streak expiry/warning jobs and push notification delivery are Phase 18 scope.

</domain>

<decisions>
## Implementation Decisions

### Message data flow
- Messages fetched via TanStack useInfiniteQuery with cursor-based pagination (not PowerSync-synced). Messages table is too large to sync locally
- Supabase Realtime channel per active conversation pushes new messages and invalidates TanStack cache
- Conversations table IS PowerSync-synced (Phase 12 decision). Conversation list reads from local SQLite -- instant, no separate Realtime channel needed
- PostgreSQL AFTER INSERT trigger on messages table updates conversations.last_message_*, increments unread_count. Push notification delivery is Phase 18 scope
- New conversation creation: direct Supabase insert with deterministic ID (CHECK participant1_id < participant2_id). PowerSync syncs to both participants

### Read receipts
- Direct client write to conversations.last_read_at_p1/p2 via Supabase. PowerSync syncs the change
- Privacy toggle check stays client-side (don't write if mutual opt-out)
- No Edge Function needed -- simple field update on a PowerSync-synced table

### Snap lifecycle
- WebP format at 0.9 compression, 1080px (Phase 13 pattern). Uses base64-arraybuffer decode pattern for Supabase Storage upload
- Standalone upload with inline 3-attempt exponential retry (not routed through upload queue). Snaps are one-off sends, not queued
- Snap signed URLs generated client-side: supabase.storage.from('snap-photos').createSignedUrl(path, 300) -- 5-minute expiry, no Edge Function
- View-once cleanup: PostgreSQL trigger fires on messages.snap_viewed_at UPDATE, calls pg_net to invoke Edge Function that deletes file from Supabase Storage. Server-authoritative cleanup
- Orphan cleanup (snaps never viewed) deferred to Phase 18 pg_cron job

### Streak engine
- PostgreSQL AFTER INSERT trigger on messages WHERE type='snap' calls SQL function to update streaks table (day_count, expires_at, last_snap_at_user1/user2, last_mutual_at, warning_sent)
- All streak write logic in SQL (server-authoritative, zero client involvement)
- Client-side deriveStreakState() pure function preserved, rewritten in TypeScript. Reads streak data from PowerSync local SQLite (streaks table is PowerSync-synced)
- Color mapping and 5-state visual indicators stay client-side
- Streak expiry processing and warning push notifications deferred to Phase 18 (pg_cron + Edge Function)

### Reactions
- Reactions stay as type='reaction' message documents. Preserves inline display in message thread and polymorphic rendering
- Double-tap heart and 6-emoji picker UI unchanged. Reaction message includes target_message_id (reply_to_id column reused or separate column)

### Message unsend
- Direct client write: sets messages.unsent_at timestamp via Supabase
- RLS policy ensures only sender can update unsent_at on their own messages
- Supabase Realtime broadcasts the change to the other participant via the conversation channel

### Delete-for-me
- New message_deletions junction table (message_id UUID, user_id UUID, created_at). Schema migration needed
- Client inserts a row to hide the message for themselves only
- Message query filters: WHERE NOT EXISTS (SELECT 1 FROM message_deletions WHERE message_id = m.id AND user_id = $current_user)
- RLS: users can only insert their own deletions and only read their own

### Screenshot detection
- Client detects screenshots (existing behavior)
- Client inserts notification record into notifications table directly
- Actual push notification delivery handled by Phase 18 Edge Function
- Screenshot notification display in conversation header unchanged

### Tagged photo pipeline
- Tagged photos auto-sent as type='tagged_photo' message with tagged_photo_id referencing photos table
- Add-to-feed resharing with "Photo by @username" attribution -- client creates a new photo record referencing original
- Same flow, just Supabase writes instead of Firestore

### Claude's Discretion
- Exact SQL for the messages INSERT trigger (conversation metadata update logic)
- Exact SQL for the snap-related streak update function
- Edge Function implementation for snap storage cleanup (pg_net invocation pattern)
- message_deletions migration SQL and RLS policies
- Hook API surfaces and return types for rewritten hooks (useMessages, useConversation, useStreaks)
- Whether reaction target uses reply_to_id column or needs a dedicated target_message_id column
- Test structure and mock patterns for new services
- Supabase Realtime channel lifecycle management in hooks (subscribe/unsubscribe)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Supabase, PowerSync, TanStack Query package versions and integration patterns
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig migration pattern, service layer restructuring, data flow changes

### Prior phase context (prerequisites)
- `.planning/phases/12-schema-infrastructure-foundation/12-CONTEXT.md` -- Schema design (snake_case, UUID PKs, CHECK constraints on pair tables), PowerSync sync scope (conversations and streaks synced, messages NOT synced), RLS policies
- `.planning/phases/13-auth-storage-migration/13-CONTEXT.md` -- WebP compression, base64-arraybuffer upload pattern, signed URL service, storage paths
- `.planning/phases/14-data-layer-caching-foundation/14-CONTEXT.md` -- PowerSync for synced tables, TanStack for non-synced, Realtime invalidates TanStack cache, query key factory, staleTime 30s, gcTime 10min
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` -- Throw-on-error pattern, services in src/services/supabase/, PowerSync local writes, TanStack mutations
- `.planning/phases/16-core-services-social-albums/16-CONTEXT.md` -- Realtime channel per entity, PostgreSQL triggers for count maintenance, friendship PowerSync pattern

### Database schema
- `supabase/migrations/20260323000004_create_conversations.sql` -- Conversations, messages, and streaks table definitions with indexes and RLS enabled

### Requirements
- `.planning/REQUIREMENTS.md` -- MSG-01 through MSG-11 (all messaging requirements)
- `.planning/ROADMAP.md` -- Phase 17 success criteria (5 items)

### Existing services being replaced
- `src/services/firebase/messageService.js` (838 lines) -- Conversation CRUD, message send/paginate, real-time subscriptions, read receipts, soft delete
- `src/services/firebase/snapService.js` (334 lines) -- Snap upload, compress, send, view-once, signed URL fetch
- `src/services/firebase/streakService.js` (179 lines) -- Streak ID generation, state derivation, color mapping, Firestore subscriptions
- `src/hooks/useMessages.js` (295 lines) -- Conversation list subscription, friend data joining, unread count aggregation
- `src/hooks/useConversation.js` (465 lines) -- Individual conversation messages, cursor pagination, send, read tracking
- `src/hooks/useStreaks.js` (219 lines) -- Multi-streak subscriptions, state derivation for UI indicators

### Cloud Functions being replaced
- `functions/index.js` -- onNewMessage (metadata updates, push notifications, streak updates), onSnapViewed (storage cleanup), onMessageDeleted (unsend), screenshot notification

### Project context
- `.planning/PROJECT.md` -- Constraints (dev-first migration, functionally identical, offline media capture non-negotiable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts` -- Supabase client (Phase 13)
- `src/lib/queryKeys.ts` -- Query key factory (Phase 14). Extend with: queryKeys.conversations, queryKeys.messages, queryKeys.streaks
- PowerSync database and connector (Phase 14) -- local SQLite for conversations and streaks
- `src/services/supabase/` -- New service directory (Phase 15)
- Phase 13 WebP upload pattern (base64-arraybuffer, 0.9 compression, 1080px)
- Phase 13 signedUrlService -- client-side signed URL generation pattern

### Established Patterns
- New services throw on error (TanStack catches) -- Phase 15 pattern
- PowerSync local writes for synced tables (conversations, streaks) -- instant UI
- TanStack useInfiniteQuery for paginated data (messages) with cursor-based pagination
- Supabase Realtime channel per entity for live updates -- invalidates TanStack cache
- PostgreSQL triggers for server-side side effects (count maintenance, metadata updates)
- snake_case in DB, camelCase in TypeScript (service layer mapping)
- Deterministic pair IDs with CHECK(user1_id < user2_id) on conversations and streaks

### Integration Points
- MessagesStackNavigator screens (MessagesList, Conversation, NewMessage)
- CameraScreen (mode='snap') -- snap capture and send
- ConversationScreen -- message rendering, reactions, replies, read receipts
- Snap viewer (Polaroid frame) -- view-once + cleanup trigger
- Streak visual indicators on snap button, conversation header, message input
- PhotoDetail tagged photo pipeline -- auto-send DM on tag

</code_context>

<specifics>
## Specific Ideas

- Message metadata (lastMessage, unreadCount) updates via PostgreSQL trigger keeps it server-authoritative -- same reliability as current Cloud Function but zero latency
- Snap cleanup chain: client marks viewed -> PG trigger fires -> pg_net calls Edge Function -> Storage file deleted. Fully automated, no client involvement after view
- Streaks update atomically with snap sends (same transaction via PG trigger). No race conditions between snap send and streak update
- delete-for-me via junction table is cleaner than Firestore's array approach and plays well with RLS

</specifics>

<deferred>
## Deferred Ideas

- Streak expiry pg_cron job -- Phase 18 (background jobs)
- Streak warning push notifications -- Phase 18 (push notification delivery)
- Snap orphan cleanup (unviewed snaps) -- Phase 18 (pg_cron job)
- Push notification delivery for new messages -- Phase 18 (Edge Functions)
- Notification batching/debouncing for reactions -- Phase 18

</deferred>

---

*Phase: 17-messaging-social*
*Context gathered: 2026-03-24*
