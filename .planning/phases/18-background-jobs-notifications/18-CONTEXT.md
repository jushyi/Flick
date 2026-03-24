# Phase 18: Background Jobs & Notifications - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Port all server-side automation from Firebase Cloud Functions to Supabase infrastructure: pg_cron scheduled jobs, Edge Functions for push notifications, PostgreSQL triggers for data cascades, and Live Activity APNS infrastructure migration. All behavior is functionally identical to current Cloud Functions. No new features -- same darkroom reveals, streak processing, push notifications, snap cleanup, account deletion, and notification lifecycle. Push-to-start Live Activity debugging gets a dedicated plan requiring Mac/Xcode access.

</domain>

<decisions>
## Implementation Decisions

### Push notification delivery
- Single `send-push-notification` Edge Function handles ALL notification types (messages, friend requests, photo reveals, snaps, streaks, tags, screenshots, pinned snaps)
- Edge Function accepts event type + payload (user_id, event data). It looks up expo_push_token (and push_to_start_token for Live Activities) from users table itself -- callers just pass user_id
- Uses Expo Server SDK for push delivery (Deno-compatible). Randomized human-sounding templates preserved from current Cloud Functions
- Push receipt checking ported as pg_cron job (every 5 minutes). Calls Edge Function to check Expo receipts and null out invalid tokens on users table

### Notification batching/debouncing
- Reactions and tags write to a `pending_notifications` table (not sent immediately)
- pg_cron job runs every 30-60 seconds, groups pending entries by target user, sends batched notifications via the send-push-notification Edge Function
- Replaces Cloud Tasks 30-second debounce window with pg_cron micro-batch pattern

### Scheduled job strategy
- Individual SQL functions per job, each with its own pg_cron schedule:
  - `process_darkroom_reveals()` -- every 2 minutes
  - `process_streak_expiry()` -- every 15 minutes
  - `cleanup_expired_snaps()` -- schedule TBD (matches current)
  - `cleanup_old_notifications()` -- daily or similar
  - `process_scheduled_deletions()` -- daily
  - `expire_pinned_snap_notifications()` -- matches current schedule
  - `process_pending_notifications()` -- every 30-60 seconds (batching)
  - `check_push_receipts()` -- every 5 minutes (calls Edge Function)
- Clean separation per job for individual monitoring and debugging

### Darkroom reveals
- SQL function reveals photos (UPDATE status from 'developing' to 'revealed' WHERE reveal_at <= now())
- Same function uses pg_net to call send-push-notification Edge Function for each user who had photos revealed
- All-in-one: reveal + notify in same cron cycle

### Streak expiry
- pg_cron every 15 minutes (same proven cadence)
- SQL function checks expires_at, updates expired streaks to day_count=0
- Sends 4-hour warning push notifications via pg_net for streaks within 4h of expiry (warning_sent flag prevents duplicates)

### Account deletion cascade
- Two-step: SQL function handles all database deletions (photos, conversations, messages, friendships, albums, notifications, blocks, reports -- CASCADE or explicit DELETE)
- SQL function then calls Edge Function via pg_net for external cleanup: Supabase Storage file deletion and Supabase Auth account removal (requires service_role)

### PostgreSQL triggers scope
- **Triggers for data operations:** friend count maintenance (Phase 16), photo soft-delete cascade (remove from albums, clean up reactions/comments/tags), conversation metadata updates
- **Edge Functions for external operations:** push notifications, storage file deletion, APNS calls
- Photo soft-delete cascade: AFTER UPDATE trigger fires when deleted_at changes from NULL to timestamp. Removes album_photos entries, cleans up photo_reactions, photo_tags, and marks/deletes orphaned comments
- New message notification: the existing Phase 17 messages INSERT trigger (metadata update) gets a pg_net call added to invoke send-push-notification Edge Function. Single trigger handles both metadata + push notification

### Live Activity APNS
- Dedicated `send-live-activity` Edge Function for APNS JWT signing, HTTP/2 to Apple, push-to-start token handling
- Called by send-push-notification Edge Function when event type is 'pinned_snap'
- push_to_start_token stored as column on users table (alongside expo_push_token). Client updates via supabase.from('users').update()
- APNS secrets (APNS_KEY_ID, APNS_TEAM_ID, APNS_AUTH_KEY_P8) stored as Supabase Edge Function secrets via `supabase secrets set`
- LIVE-01 marked as partial: infrastructure ported, push-to-start debugging deferred to a dedicated plan requiring Mac/Xcode access
- Dedicated debugging plan: TestFlight/production APNS testing, sandbox vs production token validation, Xcode console diagnostics. Standalone session that can happen when Mac access is available

### Claude's Discretion
- Exact SQL for each pg_cron function body
- pg_net invocation patterns (HTTP POST to Edge Function URL)
- pending_notifications table schema and batching query
- Exact cron schedules for cleanup jobs (snap cleanup, notification TTL, pinned snap expiry)
- Edge Function internal structure (shared utilities, error handling)
- Migration SQL for new columns (push_to_start_token on users) and new tables (pending_notifications)
- Test structure for Edge Functions and SQL functions
- Whether photo soft-delete cascade runs in same transaction or deferred

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- Supabase, PowerSync, TanStack Query package versions and integration patterns
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig migration pattern, Cloud Functions replacement map, Edge Function patterns

### Prior phase context (prerequisites)
- `.planning/phases/12-schema-infrastructure-foundation/12-CONTEXT.md` -- Schema design (snake_case, UUID PKs), PowerSync sync scope, RLS policies, pg_cron mentioned as background catch-all
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` -- Darkroom reveal flow (client-side triggers, pg_cron catch-all deferred to Phase 18), photo lifecycle
- `.planning/phases/16-core-services-social-albums/16-CONTEXT.md` -- Friend count triggers (created in Phase 16), block cleanup patterns
- `.planning/phases/17-messaging-social/17-CONTEXT.md` -- Messages INSERT trigger (metadata + streak update), snap view-once cleanup chain (pg_net -> Edge Function), streak engine SQL, deferred items list (streak expiry, snap orphan cleanup, push notifications, notification batching)

### Database schema
- `supabase/migrations/` -- All existing table definitions (photos, conversations, messages, streaks, notifications, users, friendships, etc.)

### Cloud Functions being replaced
- `functions/index.js` -- ALL 25+ Cloud Function exports. Key functions: processDarkroomReveals, processStreakExpiry, onNewMessage, sendPhotoRevealNotification, sendFriendRequestNotification, sendReactionNotification, sendTaggedPhotoNotification, sendCommentNotification, cleanupExpiredSnaps, cleanupOldNotifications, processScheduledDeletions, processScheduledPhotoDeletions, expirePinnedSnapNotifications, checkPushReceipts, sendDeletionReminderNotification, onPhotoSoftDeleted, incrementFriendCountOnAccept, decrementFriendCountOnRemove
- `functions/notifications/sender.js` -- Expo push notification sending logic
- `functions/notifications/batching.js` -- Reaction debouncing/batching
- `functions/notifications/liveActivitySender.js` -- APNS JWT signing, HTTP/2, dual-environment fallback
- `functions/tasks/sendBatchedNotification.js` -- Cloud Tasks handler for batched notifications

### Live Activity infrastructure
- `modules/live-activity-manager/src/LiveActivityManagerModule.swift` -- Native module with pushType: .token, diagnostics
- `src/services/liveActivityService.js` -- JS bridge with polling for push-to-start token
- `targets/FlickNotificationService/NotificationService.swift` -- NSE (thumbnail only)
- `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` -- Live Activity widget

### Existing Edge Functions
- `supabase/functions/migrate-firebase-auth/` -- Existing Edge Function pattern (Deno runtime, service_role usage)

### Requirements
- `.planning/REQUIREMENTS.md` -- JOBS-01 through JOBS-10 (all background job requirements) + LIVE-01 (push-to-start fix)
- `.planning/ROADMAP.md` -- Phase 18 success criteria (6 items)

### Project context
- `.planning/PROJECT.md` -- Constraints (dev-first migration, functionally identical)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase.ts` -- Supabase client (Phase 13)
- `supabase/functions/migrate-firebase-auth/` -- Edge Function pattern (Deno, imports, service_role)
- `functions/notifications/sender.js` -- Expo push notification logic to port (sendPushNotification, ticket management)
- `functions/notifications/liveActivitySender.js` -- APNS sender logic to port (JWT, HTTP/2, token types)
- `functions/notifications/batching.js` -- Reaction batching logic to port
- `src/services/liveActivityService.js` -- Client-side Live Activity service (token polling, activity management)
- `src/services/firebase/notificationService.js` -- Client-side notification registration and token storage

### Established Patterns
- Edge Function: Deno runtime, import from supabase-js, service_role for admin operations
- pg_net for HTTP calls from SQL functions to Edge Functions
- PostgreSQL triggers for data-level side effects (friend count, conversation metadata, streak updates)
- snake_case in DB, camelCase in TypeScript
- Expo Server SDK for push notifications (already used in Cloud Functions)

### Integration Points
- Phase 17 messages INSERT trigger needs pg_net call added for push notifications
- Phase 17 snap view-once trigger already calls Edge Function via pg_net
- users table needs push_to_start_token column added
- New pending_notifications table for reaction/tag batching
- Client-side liveActivityService needs to update token storage from Firestore to Supabase
- Client-side notificationService needs to store expo_push_token in Supabase users table (may already be done in Phase 15/16)

</code_context>

<specifics>
## Specific Ideas

- Darkroom reveals should be all-in-one: reveal photos + send push notifications in the same pg_cron cycle. No waiting for a separate notification pass
- Account deletion is two-step by necessity: SQL handles the relational cascade efficiently in one transaction, Edge Function handles external cleanup (storage files, auth account)
- The Live Activity debugging plan is explicitly a standalone Mac/Xcode session. Port the infrastructure now, debug the token issue separately with proper native tooling
- Notification batching via pg_cron micro-batch is simpler than Cloud Tasks -- pending_notifications table acts as the queue, cron drains it every 30-60 seconds

</specifics>

<deferred>
## Deferred Ideas

- Live Activity push-to-start debugging requires Mac/Xcode access -- dedicated plan within this phase but may need to be done in a separate session
- Advanced notification analytics (delivery rates, open rates) -- future phase
- Notification preferences per type (mute specific notification categories) -- future phase

</deferred>

---

*Phase: 18-background-jobs-notifications*
*Context gathered: 2026-03-24*
