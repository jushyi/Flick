# Phase 18: Background Jobs & Notifications - Research

**Researched:** 2026-03-24
**Domain:** Supabase pg_cron, pg_net, Edge Functions (Deno), PostgreSQL triggers, Expo push notifications, APNS Live Activities
**Confidence:** HIGH

## Summary

Phase 18 ports all server-side automation from Firebase Cloud Functions to Supabase infrastructure. The existing `functions/index.js` contains 25+ exports covering scheduled jobs (darkroom reveals, streak expiry, snap cleanup, notification TTL, account deletion, pinned snap expiry), event-driven notifications (friend requests, reactions, comments, tags, messages, screenshots), and data cascades (friend count, photo soft-delete). These map cleanly to three Supabase primitives: pg_cron for scheduled SQL functions, PostgreSQL triggers for data cascades, and Edge Functions (Deno) for external operations (push notifications, APNS, storage cleanup).

The Expo push notification delivery pattern is well-supported in Supabase Edge Functions. Supabase's official docs recommend using direct `fetch()` to `https://exp.host/--/api/v2/push/send` with an `EXPO_ACCESS_TOKEN` rather than importing the full `expo-server-sdk` npm package. This is simpler, has no dependency compatibility concerns, and matches the existing Cloud Functions behavior. For APNS Live Activity delivery, Deno supports `node:http2` for HTTP/2 client connections needed by Apple Push Notification Service.

**Primary recommendation:** Use pg_cron + SQL functions for all scheduled jobs, pg_net to invoke a single `send-push-notification` Edge Function from SQL, PostgreSQL triggers for data cascades, and a separate `send-live-activity` Edge Function for APNS HTTP/2 delivery.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single `send-push-notification` Edge Function handles ALL notification types (messages, friend requests, photo reveals, snaps, streaks, tags, screenshots, pinned snaps)
- Edge Function accepts event type + payload (user_id, event data). It looks up expo_push_token (and push_to_start_token for Live Activities) from users table itself -- callers just pass user_id
- Uses Expo Server SDK for push delivery (Deno-compatible). Randomized human-sounding templates preserved from current Cloud Functions
- Push receipt checking ported as pg_cron job (every 5 minutes). Calls Edge Function to check Expo receipts and null out invalid tokens on users table
- Reactions and tags write to a `pending_notifications` table (not sent immediately)
- pg_cron job runs every 30-60 seconds, groups pending entries by target user, sends batched notifications via the send-push-notification Edge Function
- Individual SQL functions per job, each with its own pg_cron schedule
- Darkroom: SQL function reveals photos + uses pg_net to call send-push-notification Edge Function for each user who had photos revealed
- Streak expiry: pg_cron every 15 minutes, SQL checks expires_at, sends 4-hour warning push notifications via pg_net
- Account deletion: Two-step -- SQL handles database CASCADE, then calls Edge Function via pg_net for storage/auth cleanup
- PostgreSQL triggers for: friend count maintenance, photo soft-delete cascade, conversation metadata updates
- Photo soft-delete cascade: AFTER UPDATE trigger fires when deleted_at changes from NULL to timestamp
- New message notification: Phase 17 messages INSERT trigger gets pg_net call added for push notifications
- Dedicated `send-live-activity` Edge Function for APNS JWT signing, HTTP/2 to Apple, push-to-start token handling
- push_to_start_token stored as column on users table
- APNS secrets stored as Supabase Edge Function secrets
- LIVE-01 marked as partial: infrastructure ported, push-to-start debugging deferred to dedicated Mac/Xcode plan

### Claude's Discretion
- Exact SQL for each pg_cron function body
- pg_net invocation patterns (HTTP POST to Edge Function URL)
- pending_notifications table schema and batching query
- Exact cron schedules for cleanup jobs (snap cleanup, notification TTL, pinned snap expiry)
- Edge Function internal structure (shared utilities, error handling)
- Migration SQL for new columns (push_to_start_token on users) and new tables (pending_notifications)
- Test structure for Edge Functions and SQL functions
- Whether photo soft-delete cascade runs in same transaction or deferred

### Deferred Ideas (OUT OF SCOPE)
- Live Activity push-to-start debugging requires Mac/Xcode access -- dedicated plan within this phase but may need to be done in a separate session
- Advanced notification analytics (delivery rates, open rates) -- future phase
- Notification preferences per type (mute specific notification categories) -- future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JOBS-01 | Darkroom reveal processing runs every 2 minutes via pg_cron | pg_cron `*/2 * * * *` schedule + `process_darkroom_reveals()` SQL function; reveal photos WHERE reveal_at <= now(), call Edge Function via pg_net |
| JOBS-02 | Streak expiry processing checks all active streaks, expires stale ones, sends 4h warning notifications | pg_cron `*/15 * * * *` + `process_streak_expiry()` SQL; tiered expiry windows (36h/48h/72h), warning_sent flag prevents duplicates |
| JOBS-03 | Snap cleanup deletes expired snap photos from storage | pg_cron `0 */2 * * *` + Edge Function for storage deletion (pg_net call from SQL function) |
| JOBS-04 | Notification TTL cleanup deletes notifications older than 30 days | pg_cron `0 2 * * *` + simple SQL DELETE; also cleans reaction_batches older than 7 days |
| JOBS-05 | Account deletion cascade executes scheduled deletions with full data cleanup | pg_cron `0 3 * * *` + two-step: SQL CASCADE delete + Edge Function for storage/auth cleanup via pg_net |
| JOBS-06 | Push notifications sent via Edge Functions using Expo Server SDK (all notification types ported) | Single `send-push-notification` Edge Function using direct fetch to Expo API; 8+ notification types with randomized templates |
| JOBS-07 | Notification debouncing/batching for reactions and tags | `pending_notifications` table + pg_cron every 30-60 seconds drains queue; replaces Cloud Tasks 30s debounce |
| JOBS-08 | Friend count maintenance via PostgreSQL triggers | Already created in Phase 16 per CONTEXT.md; verify triggers exist and work |
| JOBS-09 | Photo soft-delete cascade via PostgreSQL triggers | AFTER UPDATE trigger on photos when deleted_at transitions NULL to non-NULL; cascade to album_photos, photo_reactions, photo_tags, notifications |
| JOBS-10 | Pinned snap notification expiry processing (48h auto-dismiss) | pg_cron `0 */2 * * *` + SQL function finds old pinned snaps, calls Edge Function to send cancel_pinned_snap push |
| LIVE-01 | Push-to-start Live Activities work from background/killed state | Edge Function `send-live-activity` with APNS JWT + HTTP/2 via `node:http2`; push_to_start_token column on users; infrastructure only (debugging deferred) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg_cron | built-in (Supabase) | Scheduled job execution | Native PostgreSQL extension, zero network latency for SQL jobs |
| pg_net | built-in (Supabase) | Async HTTP from SQL | Only way to call Edge Functions from triggers/cron; non-blocking |
| Supabase Edge Functions | Deno 2.x runtime | Push notification delivery, storage cleanup, APNS | Official Supabase server-side compute |
| @supabase/supabase-js | 2.x | Database access from Edge Functions | Official client with service_role support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-server-sdk (direct API) | N/A | Expo push notification delivery | Used as direct fetch() to Expo API, not npm import |
| node:http2 (Deno built-in) | N/A | APNS HTTP/2 client connections | Live Activity push-to-start delivery |
| node:crypto (Deno built-in) | N/A | APNS JWT signing (ES256) | JWT token generation for Apple auth |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Expo API fetch | `npm:expo-server-sdk` | Direct fetch is simpler, no dependency risk, Supabase docs recommend it |
| `expo_server_sdk_deno` (deno.land/x) | Direct Expo API fetch | Stale (3+ years old), incomplete port, no tests -- avoid |
| pg_net async | pgsql-http sync | pg_net is non-blocking (critical for triggers), pgsql-http blocks |

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  functions/
    send-push-notification/    # Single Edge Function for ALL push types
      index.ts                 # Main handler
    send-live-activity/        # APNS HTTP/2 for Live Activities
      index.ts
    cleanup-storage/           # Storage file deletion (called by cron)
      index.ts
    check-push-receipts/       # Expo receipt checking (called by cron)
      index.ts
    _shared/                   # Shared utilities
      cors.ts                  # CORS headers
      notification-templates.ts # Randomized templates
      expo-push.ts             # Expo API wrapper (fetch-based)
      apns.ts                  # APNS JWT + HTTP/2 (if shared)
  migrations/
    YYYYMMDDHHMMSS_create_pending_notifications.sql
    YYYYMMDDHHMMSS_add_push_to_start_token.sql
    YYYYMMDDHHMMSS_create_cron_jobs.sql
    YYYYMMDDHHMMSS_create_photo_soft_delete_trigger.sql
    YYYYMMDDHHMMSS_create_notification_triggers.sql
```

### Pattern 1: pg_cron SQL Function + pg_net Edge Function Call
**What:** Scheduled SQL function does database work, then calls Edge Function via pg_net for external operations
**When to use:** Any job that combines database mutations with external side effects (push notifications, storage cleanup)
**Example:**
```sql
-- Source: Supabase pg_cron + pg_net docs
CREATE OR REPLACE FUNCTION process_darkroom_reveals()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  revealed_user RECORD;
BEGIN
  -- Reveal photos whose reveal_at has passed
  UPDATE photos
  SET status = 'revealed', updated_at = NOW()
  WHERE status = 'developing'
    AND reveal_at <= NOW()
    AND deleted_at IS NULL;

  -- For each user who had photos revealed, notify via Edge Function
  FOR revealed_user IN
    SELECT DISTINCT user_id
    FROM photos
    WHERE status = 'revealed'
      AND updated_at >= NOW() - INTERVAL '3 minutes'
      AND deleted_at IS NULL
  LOOP
    PERFORM net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'photo_reveal',
        'user_id', revealed_user.user_id
      ),
      timeout_milliseconds := 5000
    );
  END LOOP;
END;
$$;

-- Schedule: every 2 minutes
SELECT cron.schedule('process-darkroom-reveals', '*/2 * * * *', 'SELECT process_darkroom_reveals()');
```

### Pattern 2: PostgreSQL Trigger + pg_net
**What:** Database trigger fires on data change, calls Edge Function asynchronously
**When to use:** Event-driven notifications (new message, friend request, etc.)
**Example:**
```sql
-- Photo soft-delete cascade trigger
CREATE OR REPLACE FUNCTION handle_photo_soft_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only fire when deleted_at transitions from NULL to non-NULL
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Remove from albums
    DELETE FROM album_photos WHERE photo_id = NEW.id;
    -- Clean up reactions
    DELETE FROM photo_reactions WHERE photo_id = NEW.id;
    -- Clean up tags
    DELETE FROM photo_tags WHERE photo_id = NEW.id;
    -- Clean up notifications referencing this photo
    DELETE FROM notifications WHERE (data->>'photoId')::uuid = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER photo_soft_delete_cascade
  AFTER UPDATE OF deleted_at ON photos
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION handle_photo_soft_delete();
```

### Pattern 3: Edge Function with Direct Expo API
**What:** Edge Function receives event type + user_id, looks up token, sends push via Expo HTTP API
**When to use:** All push notification delivery
**Example:**
```typescript
// Source: Supabase official push notification docs
// supabase/functions/send-push-notification/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const { type, user_id, data } = await req.json()

  // Look up user's push token
  const { data: user } = await supabase
    .from('users')
    .select('push_token, display_name, notification_preferences')
    .eq('id', user_id)
    .single()

  if (!user?.push_token) {
    return new Response(JSON.stringify({ error: 'No push token' }), { status: 200 })
  }

  // Check notification preferences
  const prefs = user.notification_preferences ?? {}
  if (prefs.enabled === false) {
    return new Response(JSON.stringify({ skipped: 'disabled' }), { status: 200 })
  }

  // Build notification from type + data
  const { title, body } = buildNotification(type, data)

  // Send via Expo Push API
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`,
    },
    body: JSON.stringify({
      to: user.push_token,
      title,
      body,
      sound: 'default',
      data: { type, ...data },
      priority: 'high',
      channelId: data.channelId ?? 'default',
    }),
  })

  const result = await res.json()

  // Store receipt for later checking
  if (result.data?.[0]?.id) {
    await supabase.from('push_receipts').insert({
      ticket_id: result.data[0].id,
      user_id,
      push_token: user.push_token,
    })
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Pattern 4: pending_notifications Table for Batching
**What:** Queue table with pg_cron drain replaces Cloud Tasks debouncing
**When to use:** Reactions and tags that should be batched within a time window
**Example:**
```sql
-- pending_notifications table schema
CREATE TABLE pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,             -- 'reaction', 'tag'
  source_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}'::jsonb,  -- {emoji: count} for reactions, {photoIds: [...]} for tags
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_notifications_target
  ON pending_notifications(target_user_id, type);

-- Drain function: called by pg_cron every 30-60 seconds
CREATE OR REPLACE FUNCTION process_pending_notifications()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  batch RECORD;
BEGIN
  -- Group by target_user_id + source_user_id + type
  FOR batch IN
    SELECT
      target_user_id,
      source_user_id,
      type,
      jsonb_agg(payload) AS payloads,
      array_agg(id) AS ids
    FROM pending_notifications
    WHERE created_at <= NOW() - INTERVAL '30 seconds'
    GROUP BY target_user_id, source_user_id, type
  LOOP
    -- Call Edge Function with batched data
    PERFORM net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', batch.type || '_batch',
        'user_id', batch.target_user_id,
        'data', jsonb_build_object(
          'source_user_id', batch.source_user_id,
          'payloads', batch.payloads
        )
      ),
      timeout_milliseconds := 5000
    );

    -- Delete processed entries
    DELETE FROM pending_notifications WHERE id = ANY(batch.ids);
  END LOOP;
END;
$$;

SELECT cron.schedule('process-pending-notifications', '30 seconds', 'SELECT process_pending_notifications()');
```

### Anti-Patterns to Avoid
- **Synchronous HTTP in triggers:** Never use `pgsql-http` (synchronous) in triggers -- it blocks the transaction. Always use `pg_net` (async).
- **Fat SQL functions:** Don't put notification template logic in SQL. Keep templates in the Edge Function where TypeScript handles string manipulation naturally.
- **Importing expo-server-sdk in Deno:** The Deno port (`expo_server_sdk_deno`) is stale and untested. Use direct `fetch()` to `https://exp.host/--/api/v2/push/send` as Supabase docs recommend.
- **Calling Edge Functions without Authorization header:** pg_net calls to Edge Functions MUST include the service_role key in the Authorization header or they will be rejected by Supabase's API gateway.
- **More than 8 concurrent pg_cron jobs:** Supabase recommends max 8 concurrent jobs. Stagger schedules to avoid overlap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push notification delivery | Custom APNS/FCM integration | Expo Push API (`exp.host`) | Handles device routing, token management, rate limiting |
| Job scheduling | Custom polling/timer system | pg_cron | Native PostgreSQL, no external service, sub-minute support |
| Async HTTP from SQL | Custom queue table + worker | pg_net | Non-blocking, automatic retry tracking, built into Supabase |
| Notification batching | In-memory debounce (Cloud Tasks) | pending_notifications table + pg_cron | Stateless, survives restarts, simpler than task queues |
| JWT for APNS | External auth service | `node:crypto` in Deno Edge Function | ES256 signing built into Deno runtime |
| Receipt ID chunking | Manual array splitting | Expo API handles chunks of up to 1000 receipts | Match current behavior from expo-server-sdk |

**Key insight:** The existing Cloud Functions architecture is already well-decomposed. Each function maps 1:1 to a Supabase equivalent. The migration is a port, not a redesign.

## Common Pitfalls

### Pitfall 1: pg_net requests not sent until transaction commits
**What goes wrong:** pg_net HTTP requests are queued, not executed immediately. They only fire after the enclosing transaction commits.
**Why it happens:** pg_net is asynchronous by design to avoid blocking transactions.
**How to avoid:** This is actually desirable -- it means failed transactions don't send spurious notifications. But be aware that in long transactions, notifications are delayed until commit.
**Warning signs:** Notifications seem delayed or missing after trigger fires.

### Pitfall 2: Service role key exposure in pg_net calls
**What goes wrong:** Hardcoding the service_role key in SQL functions creates a security risk if migration files are committed to git.
**Why it happens:** pg_net needs an Authorization header to call Edge Functions.
**How to avoid:** Use `current_setting('app.settings.service_role_key')` or store in a Supabase Vault secret. Set the key via dashboard, not in migration SQL.
**Warning signs:** Service role key visible in `cron.job` table or migration files.

### Pitfall 3: pg_cron job name collisions
**What goes wrong:** Creating a job with the same name overwrites the previous job silently.
**Why it happens:** `cron.schedule()` uses name as unique identifier and performs upsert.
**How to avoid:** Use descriptive, unique names for each job. Check `cron.job` table before creating.
**Warning signs:** A job stops running after deploying a new migration.

### Pitfall 4: Expo push token format (ExponentPushToken vs ExpoPushToken)
**What goes wrong:** Push notifications fail silently if token format is not validated.
**Why it happens:** Expo tokens can be `ExponentPushToken[xxx]` or `ExpoPushToken[xxx]` format.
**How to avoid:** Validate token format in the Edge Function before sending. Match regex: `/^Expo(nent)?PushToken\[.+\]$/`.
**Warning signs:** Expo API returns `PUSH_TOO_MANY_EXPERIENCE_IDS` or `InvalidCredentials`.

### Pitfall 5: Stale notification preferences
**What goes wrong:** User disables notifications but still receives them.
**Why it happens:** SQL cron function doesn't check preferences; only the Edge Function does.
**How to avoid:** The Edge Function MUST look up the user's `notification_preferences` JSONB column and check both `enabled` (master) and the type-specific flag before sending.
**Warning signs:** Users complain about receiving notifications they disabled.

### Pitfall 6: APNS sandbox vs production token mismatch
**What goes wrong:** Push-to-start Live Activity tokens generated in dev/TestFlight are rejected by production APNS, and vice versa.
**Why it happens:** Apple issues different tokens for sandbox and production environments. The current Cloud Functions code already has dual-environment fallback.
**How to avoid:** Port the existing dual-environment retry pattern from `liveActivitySender.js`. Try primary host first, fall back to alternate on `BadDeviceToken`.
**Warning signs:** `BadDeviceToken` error from APNS.

### Pitfall 7: Missing notification_preferences column
**What goes wrong:** Edge Function tries to read notification preferences but the column doesn't exist or has unexpected schema.
**Why it happens:** The current Firebase users collection stores preferences as a nested object. The Supabase schema may not have this column yet.
**How to avoid:** Verify the users table has a `notification_preferences JSONB` column. If missing, add it in the migration. Check the current schema.
**Warning signs:** Edge Function errors on `user.notification_preferences`.

## Code Examples

### Edge Function: APNS JWT Signing (Live Activity)
```typescript
// Source: Ported from functions/notifications/liveActivitySender.js
// supabase/functions/send-live-activity/index.ts
import { connect } from 'node:http2'
import { createSign } from 'node:crypto'

const IOS_BUNDLE_ID = 'com.spoodsjs.flick'

let cachedJwt: string | null = null
let cachedJwtExpiry = 0

function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000)
  if (cachedJwt && now < cachedJwtExpiry - 300) return cachedJwt

  const keyId = Deno.env.get('APNS_KEY_ID')!
  const teamId = Deno.env.get('APNS_TEAM_ID')!
  const authKey = Deno.env.get('APNS_AUTH_KEY_P8')!

  const header = btoa(JSON.stringify({ alg: 'ES256', kid: keyId }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const claims = btoa(JSON.stringify({ iss: teamId, iat: now }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  // Normalize PEM key
  const rawKey = authKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\s\n\r\\n]/g, '')
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----\n`

  const sign = createSign('SHA256')
  sign.update(`${header}.${claims}`)
  const signature = sign.sign(keyPem, 'base64url')

  cachedJwt = `${header}.${claims}.${signature}`
  cachedJwtExpiry = now + 3600
  return cachedJwt
}
```

### pg_cron: Streak Expiry Processing
```sql
-- Source: Ported from exports.processStreakExpiry in functions/index.js
CREATE OR REPLACE FUNCTION process_streak_expiry()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  warning_streak RECORD;
BEGIN
  -- Phase 1: Send warnings for streaks within 4 hours of expiry
  FOR warning_streak IN
    SELECT s.id, s.user1_id, s.user2_id, s.expires_at,
           u1.display_name AS name1, u2.display_name AS name2
    FROM streaks s
    JOIN users u1 ON u1.id = s.user1_id
    JOIN users u2 ON u2.id = s.user2_id
    WHERE s.expires_at IS NOT NULL
      AND s.expires_at <= NOW() + INTERVAL '4 hours'
      AND s.expires_at > NOW()
      AND s.warning_sent = FALSE
      AND s.day_count > 0
    LIMIT 200
  LOOP
    UPDATE streaks SET warning_sent = TRUE WHERE id = warning_streak.id;

    -- Notify user1 about user2
    PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'streak_warning',
        'user_id', warning_streak.user1_id,
        'data', jsonb_build_object('other_name', warning_streak.name2)
      )
    );
    -- Notify user2 about user1
    PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'type', 'streak_warning',
        'user_id', warning_streak.user2_id,
        'data', jsonb_build_object('other_name', warning_streak.name1)
      )
    );
  END LOOP;

  -- Phase 2: Expire streaks past their expiry time
  UPDATE streaks
  SET day_count = 0,
      last_mutual_at = NULL,
      expires_at = NULL,
      warning_sent = FALSE,
      last_snap_at_user1 = NULL,
      last_snap_at_user2 = NULL
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND day_count > 0;
END;
$$;

SELECT cron.schedule('process-streak-expiry', '*/15 * * * *', 'SELECT process_streak_expiry()');
```

### Complete pg_cron Job Schedule
```sql
-- All scheduled jobs for Phase 18
SELECT cron.schedule('process-darkroom-reveals',      '*/2 * * * *',    'SELECT process_darkroom_reveals()');
SELECT cron.schedule('process-streak-expiry',         '*/15 * * * *',   'SELECT process_streak_expiry()');
SELECT cron.schedule('process-pending-notifications', '30 seconds',     'SELECT process_pending_notifications()');
SELECT cron.schedule('check-push-receipts',           '*/5 * * * *',    $$SELECT net.http_post(
  url := current_setting('app.settings.edge_function_url') || '/check-push-receipts',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
  body := '{}'::jsonb
)$$);
SELECT cron.schedule('cleanup-expired-snaps',         '0 */2 * * *',    $$SELECT net.http_post(
  url := current_setting('app.settings.edge_function_url') || '/cleanup-storage',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
  body := '{"type":"expired_snaps"}'::jsonb
)$$);
SELECT cron.schedule('cleanup-old-notifications',     '0 2 * * *',      'SELECT cleanup_old_notifications()');
SELECT cron.schedule('process-scheduled-deletions',   '0 3 * * *',      'SELECT process_scheduled_deletions()');
SELECT cron.schedule('expire-pinned-snap-notifs',     '0 */2 * * *',    'SELECT expire_pinned_snap_notifications()');
SELECT cron.schedule('send-deletion-reminders',       '0 9 * * *',      'SELECT send_deletion_reminders()');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cloud Tasks for debouncing | pg_cron micro-batch + queue table | Phase 18 | Simpler, stateless, no external task queue service |
| Firestore onWrite triggers | PostgreSQL AFTER UPDATE triggers | Phase 18 | Synchronous within transaction, more predictable |
| onSchedule Cloud Functions | pg_cron SQL functions | Phase 18 | Zero cold start, direct database access, sub-minute support |
| expo-server-sdk Node package | Direct Expo Push API via fetch | Phase 18 | Supabase docs recommend this; no npm dependency issues |
| In-memory pendingTags debounce | pending_notifications table | Phase 18 | Survives function restarts, distributed-safe |

## Open Questions

1. **notification_preferences column on users table**
   - What we know: Firebase stores `notificationPreferences` as a nested object on user documents. The Supabase users table migration (000001) does not include this column.
   - What's unclear: Was it added in a later migration or does it need to be created in Phase 18?
   - Recommendation: Check existing migrations; if missing, add `notification_preferences JSONB DEFAULT '{}'::jsonb` to users table in Phase 18 migration.

2. **Service role key access from SQL functions**
   - What we know: pg_net calls need the service_role key in Authorization headers. Supabase provides `current_setting('app.settings.service_role_key')` but this must be configured.
   - What's unclear: Whether the setting is auto-available or needs explicit configuration in the Supabase dashboard.
   - Recommendation: Use Supabase Vault or set via `ALTER DATABASE postgres SET app.settings.service_role_key = 'xxx'` in a secured migration (not committed to git). Alternatively, create a wrapper function that reads from vault.

3. **push_receipts table vs pending_receipts**
   - What we know: Current Firebase uses a `pendingReceipts` collection. Supabase schema does not have an equivalent table yet.
   - What's unclear: Whether to create a new `push_receipts` table or reuse an existing structure.
   - Recommendation: Create `push_receipts` table with `ticket_id`, `user_id`, `push_token`, `created_at` columns. The check-push-receipts Edge Function processes and deletes them.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Edge Function deployment | No (not installed locally) | -- | Deploy via Supabase Dashboard or install CLI |
| Deno | Local Edge Function testing | No (not installed locally) | -- | Test via `supabase functions serve` (requires CLI) or deploy and test remotely |
| pg_cron extension | All scheduled jobs | Yes (built into Supabase hosted) | -- | N/A - native extension |
| pg_net extension | HTTP calls from SQL | Yes (built into Supabase hosted) | -- | N/A - native extension |
| Node.js | Jest tests | Yes | (available in project) | -- |

**Missing dependencies with no fallback:**
- None that block implementation. All critical infrastructure (pg_cron, pg_net, Edge Functions) runs on Supabase's hosted platform, not locally.

**Missing dependencies with fallback:**
- Supabase CLI: Not installed locally but Edge Functions can be deployed via Dashboard or CI/CD. For local testing, install via `npm install -g supabase` or use `npx supabase`.
- Deno: Not installed locally but Edge Functions are developed as standalone files and tested after deployment. SQL functions are tested via migration application.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `package.json` jest config section |
| Quick run command | `npm test -- --testPathPattern="phase18" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JOBS-01 | Darkroom reveals SQL function | integration (SQL) | Manual: apply migration, verify via SQL queries | No - Wave 0 |
| JOBS-02 | Streak expiry SQL function | integration (SQL) | Manual: apply migration, verify via SQL queries | No - Wave 0 |
| JOBS-03 | Snap cleanup Edge Function | integration | `supabase functions serve` + curl test | No - Wave 0 |
| JOBS-04 | Notification TTL cleanup SQL | unit (SQL) | Manual: apply migration, verify DELETE query | No - Wave 0 |
| JOBS-05 | Account deletion cascade | integration (SQL + Edge) | Manual: multi-step verification | No - Wave 0 |
| JOBS-06 | Push notification Edge Function | unit | `npm test -- --testPathPattern="sendPushNotification"` | No - Wave 0 |
| JOBS-07 | Notification batching SQL + Edge | integration | Manual: insert pending, run drain, verify | No - Wave 0 |
| JOBS-08 | Friend count triggers | unit (SQL) | Manual: verify trigger exists (Phase 16) | Existing (Phase 16) |
| JOBS-09 | Photo soft-delete cascade | unit (SQL) | Manual: apply migration, test trigger | No - Wave 0 |
| JOBS-10 | Pinned snap expiry | integration | Manual: apply migration, verify | No - Wave 0 |
| LIVE-01 | Live Activity APNS Edge Function | unit | `npm test -- --testPathPattern="liveActivity"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** Verify migration applies cleanly; check SQL function exists
- **Per wave merge:** Full test suite `npm test`
- **Phase gate:** All cron jobs registered, Edge Functions deployed, trigger functions created

### Wave 0 Gaps
- [ ] SQL function tests: verification queries for each pg_cron function
- [ ] Edge Function mock tests: Jest tests for notification template logic
- [ ] Migration verification: script to check all cron jobs are registered in `cron.job`

## Project Constraints (from CLAUDE.md)

- **Logging:** Never use `console.log()` directly in client code. Edge Functions may use `console.log/error` per Deno convention.
- **Import organization:** React code follows 6-group import order. Edge Functions follow Deno conventions (`npm:`, `jsr:`, `node:` prefixes).
- **Service layer pattern:** All services return `{ success, error }` objects. Edge Functions return JSON responses with appropriate HTTP status codes.
- **Commit messages:** `type(scope): description` format. After each plan, commit changes.
- **Production build:** Changes to Edge Functions are deployed via `supabase functions deploy`. Remind user to deploy after changes.
- **snake_case in DB, camelCase in TypeScript:** All SQL uses snake_case. Edge Function TypeScript uses camelCase for variables.
- **Phone auth is phone-only:** No email auth. Relevant for account deletion cascade (Supabase Auth user deletion).
- **Pre-commit hooks:** Husky + lint-staged. Will run on JS/TS files but not on SQL migrations.

## Sources

### Primary (HIGH confidence)
- [Supabase pg_cron docs](https://supabase.com/docs/guides/database/extensions/pg_cron) - Scheduling syntax, job management, sub-minute support
- [Supabase pg_net docs](https://supabase.com/docs/guides/database/extensions/pg_net) - Async HTTP from SQL, net.http_post API, trigger integration
- [Supabase Cron Quickstart](https://supabase.com/docs/guides/cron/quickstart) - cron.schedule API, Edge Function invocation pattern
- [Supabase Push Notifications Guide](https://supabase.com/docs/guides/functions/examples/push-notifications) - Official Expo push notification Edge Function pattern
- [Supabase Edge Functions Dependencies](https://supabase.com/docs/guides/functions/dependencies) - npm: prefix imports, Node built-in APIs in Deno
- [Deno node:http2 docs](https://docs.deno.com/api/node/http2/) - HTTP/2 client support for APNS

### Secondary (MEDIUM confidence)
- [Supabase Edge Functions npm compatibility blog](https://supabase.com/blog/edge-functions-node-npm) - Native npm + Node.js API support confirmed
- [expo_server_sdk_deno@1.0.4](https://deno.land/x/expo_server_sdk_deno@1.0.4) - Deno port exists but stale; confirmed direct API is better

### Tertiary (LOW confidence)
- [GitHub Discussion: Calling Edge Functions from postgres](https://github.com/orgs/supabase/discussions/28341) - Community patterns for pg_net -> Edge Function calls
- [GitHub Discussion: pg_net silent failures](https://github.com/orgs/supabase/discussions/37591) - Known issue with pg_net failing silently from triggers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pg_cron, pg_net, Edge Functions are all official Supabase primitives with strong documentation
- Architecture: HIGH - Direct 1:1 mapping from Cloud Functions; patterns verified against official docs
- Pitfalls: HIGH - Known issues documented from official sources and community discussions
- Edge Function Deno compatibility: MEDIUM - node:http2 for APNS confirmed in Deno docs but not tested in Supabase Edge Functions specifically
- Expo push via direct fetch: HIGH - Supabase official docs recommend this exact pattern

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable infrastructure, 30-day validity)
