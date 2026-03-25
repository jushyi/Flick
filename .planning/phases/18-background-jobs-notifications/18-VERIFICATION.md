---
phase: 18-background-jobs-notifications
verified: 2026-03-25T16:00:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "Push notifications deliver for all event types via Edge Functions using Expo Server SDK — streak warning partner name key mismatch fixed (other_name -> otherName in supabase/migrations/20260324100002_phase18_cron_jobs.sql lines 121 and 139)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Push-to-start Live Activity from killed state"
    expected: "APNS accepts push_to_start_token and starts Live Activity on lock screen"
    why_human: "Requires physical iOS device + APNS secrets configured in Supabase. CONTEXT.md notes this was deferred to a Mac/Xcode session. MEMORY.md documents the issue as previously blocked on BadDeviceToken — infrastructure is built but fix effectiveness is unconfirmed."
---

# Phase 18: Background Jobs & Notifications Verification Report

**Phase Goal:** All server-side automation runs on Supabase infrastructure -- scheduled jobs via pg_cron, event-driven Edge Functions, PostgreSQL triggers, and push notifications all replace Cloud Functions with identical behavior

**Verified:** 2026-03-25T16:00:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (other_name -> otherName key mismatch fix)

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Darkroom reveals process every 2 minutes via pg_cron and photos transition from developing to revealed | VERIFIED | `process_darkroom_reveals()` in 20260324100002_phase18_cron_jobs.sql: UPDATE photos WHERE status='developing' AND reveal_at<=NOW(), scheduled `*/2 * * * *` with LIMIT 500 safety guard |
| 2 | Streak expiry checks run on schedule, expire stale streaks, and send 4-hour warning push notifications | VERIFIED | Function exists and is scheduled (*/15), both phases implemented, pg_net calls present. Key mismatch fixed: lines 121 and 139 now send `'otherName'` matching template `data.otherName` |
| 3 | Push notifications deliver for all event types via Edge Functions using Expo Server SDK | VERIFIED | send-push-notification Edge Function handles all 14 types, wired to Expo direct-fetch API. streak_warning data key mismatch resolved -- cron sends `otherName`, template reads `data.otherName` |
| 4 | Snap cleanup, notification TTL, and account deletion cascade all run on schedule without manual intervention | VERIFIED | cleanup_expired_snaps (*/2h), cleanup_old_notifications (daily 2am), process_scheduled_deletions (daily 3am) all present with correct schedules |
| 5 | Friend count and photo soft-delete cascades execute via PostgreSQL triggers | VERIFIED | handle_photo_soft_delete trigger + increment/decrement_friend_count_on_accept/remove triggers all exist in 20260324100003_phase18_triggers_and_cascades.sql with SECURITY DEFINER |
| 6 | Push-to-start Live Activities work from background/killed state | UNCERTAIN | send-live-activity Edge Function with HTTP/2 + JWT signing exists and is wired. Cannot verify APNS token acceptance programmatically -- requires human testing on device |

**Score:** 6/6 truths have implementation evidence (Truth 6 needs human confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260324100001_phase18_schema_additions.sql` | pending_notifications, push_receipts tables, push_to_start_token, notification_preferences | VERIFIED | All 4 schema additions present, RLS enabled on both tables |
| `supabase/migrations/20260324100002_phase18_cron_jobs.sql` | 5 pg_cron functions + 5 schedules | VERIFIED | All 5 functions and 5 cron.schedule calls present. Lines 121 and 139 now use `'otherName'` (camelCase) -- key mismatch gap closed |
| `supabase/migrations/20260324100003_phase18_triggers_and_cascades.sql` | Photo soft-delete trigger, friend count triggers, new message trigger, account deletion, snap cleanup | VERIFIED | All functions and triggers present |
| `supabase/migrations/20260324100004_phase18_notification_batching.sql` | process_pending_notifications drain + receipt cron | VERIFIED | Batching drain and receipt schedule both present |
| `supabase/functions/send-push-notification/index.ts` | Central push dispatcher handling all 14 types | VERIFIED | 232 lines, all 14 types, Expo direct-fetch, receipt storage wired |
| `supabase/functions/_shared/notification-templates.ts` | All 14 notification templates | VERIFIED | All cases present including all 5 tag templates, 3 streak templates. `data.otherName` (camelCase) on lines 116-118 now matches cron payload |
| `supabase/functions/_shared/expo-push.ts` | sendExpoPush, checkExpoPushReceipts, isValidExpoPushToken | VERIFIED | All 3 functions present, direct fetch to exp.host |
| `supabase/functions/cleanup-storage/index.ts` | expired_snaps + user_deletion handlers | VERIFIED | Both types handled, auth.admin.deleteUser wired, bucket grouping implemented |
| `supabase/functions/check-push-receipts/index.ts` | Receipt checker with DeviceNotRegistered token invalidation | VERIFIED | checkExpoPushReceipts imported, DeviceNotRegistered handled, token nulled in users table |
| `supabase/functions/send-live-activity/index.ts` | APNS HTTP/2 with ES256 JWT signing and dual-environment fallback | VERIFIED | node:http2 + node:crypto imported, JWT cached 50min, BadDeviceToken fallback to sandbox present |
| `src/services/liveActivityService.js` | push_to_start_token stored in Supabase | VERIFIED | supabase imported, push_to_start_token written via supabase.from('users').update() on lines 265-270 and 304-313 |
| `src/services/firebase/notificationService.js` | push_token stored in Supabase | VERIFIED | storeNotificationToken function (lines 184-188) uses supabase.from('users').update({ push_token: token }) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| process_darkroom_reveals() | send-push-notification Edge Function | net.http_post | WIRED | Uses app.settings.edge_function_url + '/send-push-notification' |
| process_streak_expiry() | send-push-notification Edge Function | net.http_post | WIRED | Call is wired. Data payload now sends `otherName` (camelCase) -- template reads `data.otherName`. Key mismatch gap closed. |
| handle_photo_soft_delete trigger | album_photos, photo_reactions, photo_tags, notifications, pending_notifications | DELETE FROM | WIRED | All 5 cascade deletes present in trigger body |
| notify_new_message trigger | send-push-notification Edge Function | net.http_post | WIRED | Uses app.settings.supabase_url + '/functions/v1/send-push-notification'. Different setting key from 18-02 (documented decision in 18-03 SUMMARY) |
| process_scheduled_deletions() | cleanup-storage Edge Function | net.http_post | WIRED | Both branches (with/without storage paths) call cleanup-storage with type 'user_deletion' |
| cleanup_expired_snaps() | cleanup-storage Edge Function | net.http_post | WIRED | Calls with type 'expired_snaps' + collected paths |
| process_pending_notifications() | send-push-notification Edge Function | net.http_post | WIRED | Uses app.settings.edge_function_url + '/send-push-notification', CASE maps reaction->reaction_batch, tag->tag/tag_batch |
| check-push-receipts cron | check-push-receipts Edge Function | net.http_post | WIRED | Scheduled at */5 * * * *, calls Edge Function |
| check-push-receipts Edge Function | expo-push.ts | import checkExpoPushReceipts | WIRED | Line 14: `import { checkExpoPushReceipts } from '../_shared/expo-push.ts'` |
| send-push-notification Edge Function | send-live-activity Edge Function | fetch forward | WIRED | Lines 194-214: for pinned_snap type, forwards to /functions/v1/send-live-activity |
| liveActivityService.js | Supabase users table | supabase.from('users').update | WIRED | push_to_start_token written on event (line 265) and via poll (line 304) |
| notificationService.js | Supabase users table | supabase.from('users').update | WIRED | push_token written in storeNotificationToken (line 187) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| send-push-notification/index.ts | targetUser.push_token | supabase.from('users').select('push_token,...') | Yes -- DB query | FLOWING |
| send-push-notification/index.ts | senderName | supabase.from('users').select('display_name, username') for source_user_id | Yes -- DB query | FLOWING |
| process_streak_expiry() SQL | user2_name / user1_name for streak_warning | JOIN users ON id = user1_id/user2_id | Yes -- DB JOIN. Key now matches template (otherName) | FLOWING |
| check-push-receipts/index.ts | receipts | supabase.from('push_receipts').select() | Yes -- DB query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED -- artifacts are database migrations and Deno Edge Functions, not runnable locally without Supabase infrastructure. No local entry points to execute.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| JOBS-01 | 18-02 | Darkroom reveal processing runs every 2 minutes via pg_cron | SATISFIED | process_darkroom_reveals() scheduled `*/2 * * * *` |
| JOBS-02 | 18-02 | Streak expiry checks active streaks, expires stale, sends 4h warning | SATISFIED | process_streak_expiry() scheduled `*/15 * * * *` with both phases. Warning push call and partner name data key now aligned (otherName) -- gap closed |
| JOBS-03 | 18-03 | Snap cleanup deletes expired snap photos from storage | SATISFIED | cleanup_expired_snaps() scheduled `0 */2 * * *`, delegates to cleanup-storage Edge Function |
| JOBS-04 | 18-02 | Notification TTL cleanup deletes notifications older than 30 days | SATISFIED | cleanup_old_notifications() scheduled `0 2 * * *`, DELETEs from notifications (>30d) and reaction_batches (>7d) |
| JOBS-05 | 18-03 | Account deletion cascade executes scheduled deletions with full data cleanup | SATISFIED | process_scheduled_deletions() scheduled `0 3 * * *`, cascades all 12+ tables then calls cleanup-storage for storage+auth |
| JOBS-06 | 18-01, 18-03 | Push notifications sent via Edge Functions using Expo Server SDK (all types ported) | SATISFIED | send-push-notification Edge Function handles 14 types. messages_notify_new trigger fires on INSERT for new_message push |
| JOBS-07 | 18-01, 18-04 | Notification debouncing/batching for reactions and tags | SATISFIED | pending_notifications table + process_pending_notifications() every 30s groups by target+source+type |
| JOBS-08 | 18-03 | Friend count maintenance via PostgreSQL triggers | SATISFIED | increment/decrement_friend_count_on_accept/remove triggers created with CREATE OR REPLACE |
| JOBS-09 | 18-03 | Photo soft-delete cascade via PostgreSQL triggers | SATISFIED | handle_photo_soft_delete trigger cascades to 5 tables (album_photos, photo_reactions, photo_tags, notifications, pending_notifications) |
| JOBS-10 | 18-02 | Pinned snap notification expiry processing (48h auto-dismiss) | SATISFIED | expire_pinned_snap_notifications() scheduled `0 */2 * * *`, clears pinned_snap_data and sends cancel_pinned_snap push |
| LIVE-01 | 18-05 | Push-to-start Live Activities work from background/killed state | NEEDS HUMAN | send-live-activity Edge Function with correct APNS HTTP/2 + JWT signing + dual-environment fallback is present. Infrastructure is ported. Actual BadDeviceToken fix requires device testing -- requires human verification |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/services/firebase/notificationService.js | 21-37, 582-723 | Firebase Firestore still imported and used for markNotificationsAsRead, markSingleNotificationAsRead, markNotificationReadFromPushData, markNotificationPermissionCompleted | Warning | Not a phase 18 gap -- PLAN acceptance criterion explicitly scoped to "token storage" only. Full Firebase removal is Phase 20. Noted for awareness. |
| supabase/migrations/20260324100002_phase18_cron_jobs.sql vs 20260324100003_phase18_triggers_and_cascades.sql | various | Inconsistent pg_net URL setting: cron jobs use `app.settings.edge_function_url`, triggers use `app.settings.supabase_url` + path | Warning | Both require separate Supabase config settings. Documented in 18-03 SUMMARY as deliberate (matches existing pattern). Ops must configure both settings. |

No blocker anti-patterns remain. The previous blocker (other_name vs otherName key mismatch) has been resolved.

---

### Human Verification Required

#### 1. Push-to-Start Live Activity (LIVE-01)

**Test:** On a physical iOS device with a production or sandbox build, send a pinned snap from one account to another. Verify the Live Activity appears on the recipient's lock screen when the app is in background or killed state.

**Expected:** The lock screen shows the Flick Live Activity with sender name and snap thumbnail. The `push_to_start_token` stored in Supabase is accepted by APNS without a `BadDeviceToken` error.

**Why human:** Requires physical iOS device, APNS secrets configured in Supabase (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY_P8`), and a deployed Edge Function. CONTEXT.md explicitly notes "push-to-start debugging deferred to a dedicated Mac/Xcode session." The MEMORY.md also documents this as "blocked on BadDeviceToken" -- the infrastructure is built but the fix effectiveness is unconfirmed.

---

### Gap Closure Summary

**Gap closed:** The `other_name` vs `otherName` key mismatch in `process_streak_expiry()` has been resolved. Both occurrences at lines 121 and 139 of `supabase/migrations/20260324100002_phase18_cron_jobs.sql` now use `'otherName'` (camelCase), matching the `data.otherName` reads in `supabase/functions/_shared/notification-templates.ts` lines 116-118. Streak warning notifications will now render the partner name correctly.

**Remaining deferred item:** LIVE-01 push-to-start functionality requires device testing with APNS credentials. The infrastructure (Edge Function, JWT signing, HTTP/2, dual-environment fallback) is fully implemented and wired. Whether the BadDeviceToken issue documented in MEMORY.md is resolved cannot be confirmed without a device test. This is unchanged from the initial verification.

---

_Verified: 2026-03-25T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
