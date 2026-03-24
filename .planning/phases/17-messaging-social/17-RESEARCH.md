# Phase 17: Messaging & Social - Research

**Researched:** 2026-03-24
**Domain:** Messaging system migration (Firebase Firestore/Cloud Functions to Supabase/PostgreSQL)
**Confidence:** HIGH

## Summary

Phase 17 rewrites the entire messaging system from Firebase to Supabase. This includes 3 services (messageService, snapService, streakService), 3 hooks (useMessages, useConversation, useStreaks), multiple PostgreSQL triggers, a `message_deletions` migration, an Edge Function for snap cleanup, and screen-level integration rewiring. The existing code totals ~2,330 lines across services/hooks, and the replacement will be TypeScript throughout.

The database schema is already in place (Phase 12 migration `20260323000004_create_conversations.sql`), RLS policies are deployed (Phase 12 Plan 03), and PowerSync publication includes `conversations` and `streaks` tables. The data flow is hybrid: conversations and streaks are PowerSync-synced (local SQLite reads), while messages use TanStack `useInfiniteQuery` with Supabase Realtime for live updates.

**Primary recommendation:** Build bottom-up -- migrations and triggers first, then services, then hooks, then screen integration. Each layer depends on the one below it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Messages fetched via TanStack useInfiniteQuery with cursor-based pagination (not PowerSync-synced). Messages table is too large to sync locally
- Supabase Realtime channel per active conversation pushes new messages and invalidates TanStack cache
- Conversations table IS PowerSync-synced. Conversation list reads from local SQLite -- instant, no separate Realtime channel needed
- PostgreSQL AFTER INSERT trigger on messages table updates conversations.last_message_*, increments unread_count. Push notification delivery is Phase 18 scope
- New conversation creation: direct Supabase insert with deterministic ID (CHECK participant1_id < participant2_id). PowerSync syncs to both participants
- Read receipts: Direct client write to conversations.last_read_at_p1/p2 via Supabase. Privacy toggle check stays client-side
- Snap lifecycle: WebP 0.9 at 1080px, base64-arraybuffer decode, standalone upload with 3-attempt retry, client-side signed URLs (5-min expiry), view-once cleanup via PG trigger + pg_net + Edge Function
- Streak engine: PostgreSQL AFTER INSERT trigger on messages WHERE type='snap' calls SQL function. All streak write logic in SQL. Client-side deriveStreakState() preserved, rewritten in TypeScript
- Reactions stay as type='reaction' message documents. Double-tap heart and 6-emoji picker UI unchanged
- Message unsend: Direct client write sets messages.unsent_at via Supabase. RLS ensures only sender can update
- Delete-for-me: New message_deletions junction table. Client inserts row to hide message for themselves
- Screenshot detection: Client detects, inserts notification record. Push delivery is Phase 18
- Tagged photo pipeline: Auto-send as type='tagged_photo' message with tagged_photo_id referencing photos table

### Claude's Discretion
- Exact SQL for messages INSERT trigger (conversation metadata update logic)
- Exact SQL for snap-related streak update function
- Edge Function implementation for snap storage cleanup (pg_net invocation pattern)
- message_deletions migration SQL and RLS policies
- Hook API surfaces and return types for rewritten hooks
- Whether reaction target uses reply_to_id column or needs dedicated target_message_id column
- Test structure and mock patterns for new services
- Supabase Realtime channel lifecycle management in hooks

### Deferred Ideas (OUT OF SCOPE)
- Streak expiry pg_cron job -- Phase 18
- Streak warning push notifications -- Phase 18
- Snap orphan cleanup (unviewed snaps) -- Phase 18
- Push notification delivery for new messages -- Phase 18
- Notification batching/debouncing for reactions -- Phase 18
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MSG-01 | Conversation service rewritten -- list, create, soft delete, unread counts | PowerSync local reads for list, Supabase insert for create, direct field update for soft delete. PG trigger maintains unread counts |
| MSG-02 | Message service rewritten -- send, paginate, real-time subscription | TanStack useInfiniteQuery for pagination, Supabase Realtime channel per conversation for live updates |
| MSG-03 | All 5 message types work identically | Schema supports all types via `type` column. Reaction uses reply_to_id for target (recommendation below) |
| MSG-04 | Snap lifecycle rewritten | WebP upload to Supabase Storage, client-side signed URLs, PG trigger on snap_viewed_at fires pg_net to Edge Function for cleanup |
| MSG-05 | Streak engine rewritten | PG trigger on snap message INSERT updates streaks table. deriveStreakState() TypeScript pure function reads from PowerSync |
| MSG-06 | Read receipts with privacy toggle | Direct write to conversations.last_read_at_p1/p2. Schema needs columns added (not in current migration). Privacy toggle client-side |
| MSG-07 | Message reactions work | Reaction messages with type='reaction', reply_to_id as target reference. reactionMap aggregation preserved |
| MSG-08 | Swipe-to-reply works | Reply messages with type='reply', reply_to_id references original message. Denormalized reply preview in JSONB or separate columns |
| MSG-09 | Message deletion (unsend) and delete-for-me | Unsend via unsent_at column (already in schema). Delete-for-me via new message_deletions junction table |
| MSG-10 | Screenshot detection and notification | Client inserts notification record directly. Display unchanged. Push delivery Phase 18 |
| MSG-11 | Tagged photo DM pipeline | type='tagged_photo' message with tagged_photo_id (column exists in schema). Add-to-feed resharing creates new photo record |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| `@supabase/supabase-js` | Supabase client, Realtime, Storage | Project standard (Phase 13) |
| `@powersync/react-native` | Local SQLite for conversations/streaks | Project standard (Phase 14) |
| `@tanstack/react-query` | Data fetching, caching, infinite queries | Project standard (Phase 14) |
| `expo-image-manipulator` | WebP compression for snaps | Already used in storageService |
| `base64-arraybuffer` | Binary upload to Supabase Storage | Already used in storageService |
| `expo-file-system/legacy` | Read files as base64 | Already used in storageService |

### Supporting (Already Installed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `expo-notifications` | Dismiss conversation notifications | Already used in useConversation |
| `react-native` AppState | Foreground detection for read receipts | Already used in useConversation |

### No New Dependencies Required
This phase requires zero new npm packages. All functionality is built on the existing Supabase + PowerSync + TanStack stack.

## Architecture Patterns

### Recommended Project Structure
```
src/services/supabase/
  messageService.ts        # Conversation CRUD, message send, paginate, unsend, delete-for-me
  snapService.ts           # Snap upload, send, mark viewed, signed URL
  streakService.ts         # deriveStreakState(), getStreakColor(), generateStreakId() (pure functions)

src/hooks/
  useMessages.ts           # Conversation list from PowerSync, friend profiles, streak merge
  useConversation.ts       # Messages via TanStack useInfiniteQuery, Realtime, reactions, actions
  useStreaks.ts             # useStreak (single) and useStreakMap (batch) from PowerSync

supabase/migrations/
  2026XXXX_add_message_deletions.sql       # message_deletions table + RLS
  2026XXXX_add_read_receipt_columns.sql     # last_read_at_p1/p2 on conversations
  2026XXXX_create_message_triggers.sql      # AFTER INSERT trigger, streak update function
  2026XXXX_create_snap_cleanup_trigger.sql  # AFTER UPDATE trigger for snap_viewed_at

supabase/functions/
  snap-cleanup/index.ts    # Edge Function to delete snap file from Storage
```

### Pattern 1: PowerSync Local Reads for Conversation List (MSG-01)
**What:** Conversations table is PowerSync-synced. The conversation list reads directly from local SQLite -- zero network latency. No Supabase Realtime channel needed for the list.
**When to use:** MessagesList screen, unread count badge.
**Example:**
```typescript
// useMessages reads from PowerSync local DB
import { usePowerSync } from '@powersync/react-native';

const useMessages = (userId: string) => {
  const powersync = usePowerSync();

  // Query local SQLite for conversations where user is participant
  // PowerSync handles sync automatically
  const conversations = powersync.watch(
    `SELECT * FROM conversations
     WHERE participant1_id = ? OR participant2_id = ?
     ORDER BY last_message_at DESC`,
    [userId, userId]
  );
  // ...
};
```

### Pattern 2: TanStack useInfiniteQuery for Messages (MSG-02)
**What:** Messages are NOT PowerSync-synced (table too large). Use TanStack's `useInfiniteQuery` with cursor-based pagination.
**When to use:** ConversationScreen message list.
**Example:**
```typescript
const useConversationMessages = (conversationId: string) => {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(25)
        .lt('created_at', pageParam || new Date().toISOString());

      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < 25) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    },
    initialPageParam: null,
  });
};
```

### Pattern 3: Supabase Realtime Channel per Conversation (MSG-02)
**What:** When a conversation is open, subscribe to a Realtime channel for that conversation. New messages invalidate the TanStack cache.
**When to use:** Active conversation only (subscribe on mount, unsubscribe on unmount).
**Example:**
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        // Invalidate TanStack cache to refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messages(conversationId),
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        // Handle unsend updates
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messages(conversationId),
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [conversationId]);
```

### Pattern 4: PostgreSQL Trigger for Conversation Metadata (MSG-01)
**What:** AFTER INSERT trigger on messages updates conversations table atomically: last_message_text, last_message_at, last_message_type, last_message_sender_id, unread_count increment.
**When to use:** Automatic -- fires on every message insert.
**Example SQL:**
```sql
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
  preview_text TEXT;
BEGIN
  SELECT * INTO conv FROM conversations WHERE id = NEW.conversation_id;

  -- Determine preview text
  preview_text := CASE
    WHEN NEW.type = 'snap' THEN 'Snap'
    WHEN NEW.type = 'reaction' THEN 'Reacted'
    WHEN NEW.type = 'tagged_photo' THEN 'Tagged you in a photo'
    ELSE COALESCE(LEFT(NEW.text, 100), '')
  END;

  -- Update conversation metadata
  -- Reactions don't increment unread count (matches Firebase behavior)
  IF conv.participant1_id = NEW.sender_id THEN
    UPDATE conversations SET
      last_message_text = preview_text,
      last_message_at = NEW.created_at,
      last_message_type = NEW.type,
      last_message_sender_id = NEW.sender_id,
      unread_count_p2 = CASE
        WHEN NEW.type NOT IN ('reaction') THEN unread_count_p2 + 1
        ELSE unread_count_p2
      END
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE conversations SET
      last_message_text = preview_text,
      last_message_at = NEW.created_at,
      last_message_type = NEW.type,
      last_message_sender_id = NEW.sender_id,
      unread_count_p1 = CASE
        WHEN NEW.type NOT IN ('reaction') THEN unread_count_p1 + 1
        ELSE unread_count_p1
      END
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();
```

### Pattern 5: Streak Update via PostgreSQL Trigger (MSG-05)
**What:** AFTER INSERT trigger on messages WHERE type='snap' updates the streaks table. Server-authoritative, zero client involvement.
**Key logic:**
- Find or create streak record for the two participants
- Update `last_snap_at_user1` or `last_snap_at_user2` based on sender
- Check if both users have snapped within the current day window
- If mutual, increment `day_count`, set `last_mutual_at`, recalculate `expires_at`
- 3-day activation threshold for visible streak
- Tiered expiry windows based on day_count

### Pattern 6: Snap Cleanup Chain (MSG-04)
**What:** When client sets `snap_viewed_at`, a PG trigger fires `pg_net` to invoke an Edge Function that deletes the file from Supabase Storage.
**Chain:** Client UPDATE -> PG trigger -> pg_net HTTP POST -> Edge Function -> Storage.remove()
```sql
-- Trigger detects snap_viewed_at transition from NULL to timestamp
CREATE OR REPLACE FUNCTION handle_snap_viewed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.snap_viewed_at IS NULL AND NEW.snap_viewed_at IS NOT NULL
     AND NEW.type = 'snap' AND NEW.snap_storage_path IS NOT NULL THEN
    -- Call Edge Function via pg_net
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/snap-cleanup',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('storage_path', NEW.snap_storage_path)
    );
  END IF;
  RETURN NEW;
END;
$$;
```

### Pattern 7: message_deletions Junction Table (MSG-09)
**What:** New table for delete-for-me. Client inserts a row to hide a message for themselves only.
```sql
CREATE TABLE message_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own deletions
CREATE POLICY "message_deletions_insert" ON message_deletions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only read their own deletions
CREATE POLICY "message_deletions_select" ON message_deletions FOR SELECT
  USING (user_id = auth.uid());
```

### Recommendation: Reaction Target Column
**Decision:** Use `reply_to_id` for reaction targets (do NOT add a separate `target_message_id` column).

**Rationale:**
- The `reply_to_id` column already exists as `UUID REFERENCES messages(id)` in the schema
- For `type='reaction'` messages, `reply_to_id` semantically means "this reaction targets that message"
- For `type='reply'` messages, `reply_to_id` means "this reply is to that message"
- Both are "pointing at another message" -- same FK, different semantic context based on `type`
- Avoids a migration for a redundant column
- The existing Firebase code uses `targetMessageId` for reactions and `replyTo.messageId` for replies -- both map cleanly to `reply_to_id`

### Schema Additions Needed
The current migration is missing two columns for read receipts:
```sql
ALTER TABLE conversations ADD COLUMN last_read_at_p1 TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN last_read_at_p2 TIMESTAMPTZ;
```

Also need an `emoji` column on messages for reaction messages:
```sql
ALTER TABLE messages ADD COLUMN emoji TEXT;  -- 'heart', 'laugh', 'surprise', 'sad', 'angry', 'thumbs_up'
```

And a `reply_preview` JSONB column for denormalized reply context:
```sql
ALTER TABLE messages ADD COLUMN reply_preview JSONB;
-- Shape: { "sender_id": "uuid", "type": "text", "text": "first 100 chars" }
```

### Anti-Patterns to Avoid
- **Subscribing to Realtime for conversation list:** Conversations are PowerSync-synced. Adding a Realtime channel is redundant and wastes connections.
- **Fetching messages via PowerSync:** Messages table is too large to sync. Use TanStack + Supabase REST.
- **Client-side streak writes:** Streak updates are server-authoritative via PG triggers. Client only reads.
- **Deleting message rows for unsend:** Set `unsent_at` timestamp instead. Messages are retained for moderation.
- **Using `{success, error}` return pattern for new services:** Phase 15 established throw-on-error pattern. New services throw, TanStack catches.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message pagination | Custom cursor tracking | TanStack `useInfiniteQuery` | Built-in cursor management, caching, dedup |
| Conversation list sync | Realtime subscription + local state | PowerSync local SQLite | Already synced, instant reads, offline capable |
| Streak expiry countdown | Server polling | Local timer + PowerSync data | `useStreak` already has countdown logic, just read from PowerSync instead of Firestore |
| Reaction aggregation | Server-side aggregation | Client-side `reactionMap` computation | Existing pattern works, reactions are inline messages |
| Snap URL generation | Edge Function for signed URLs | `supabase.storage.from('snaps').createSignedUrl()` | Client-side, 5-min expiry, no function needed |
| Message deduplication | Custom dedup logic | TanStack Query cache key structure | `useInfiniteQuery` handles page-level dedup |

## Common Pitfalls

### Pitfall 1: PowerSync Column Name Mismatch
**What goes wrong:** PowerSync syncs snake_case columns from PostgreSQL. TypeScript code uses camelCase. Forgetting to map causes runtime errors.
**Why it happens:** PowerSync does NOT auto-transform column names.
**How to avoid:** Map in the service layer: `const unreadCount = row.unread_count_p1;`. Use TypeScript types to enforce.
**Warning signs:** `undefined` values when reading PowerSync data.

### Pitfall 2: Realtime Channel Leak
**What goes wrong:** Subscribing to a Realtime channel in `useEffect` without proper cleanup leaks channels. Supabase has a per-connection channel limit.
**Why it happens:** Not calling `supabase.removeChannel(channel)` in the cleanup function.
**How to avoid:** Always return cleanup: `return () => { supabase.removeChannel(channel); };`
**Warning signs:** Multiple channels for the same conversation, increasing memory usage.

### Pitfall 3: Conversation ID Generation Mismatch
**What goes wrong:** Firebase used string-sorted UIDs (`${lower}_${higher}`). Supabase uses UUID comparison with `CHECK(participant1_id < participant2_id)`.
**Why it happens:** UUID comparison is lexicographic on the string representation, which matches the Firebase pattern. But the column names changed from `participants[]` array to `participant1_id` / `participant2_id`.
**How to avoid:** `generateConversationId` must sort UUIDs the same way the CHECK constraint does. Use simple string comparison (`<`) which works for UUIDs.

### Pitfall 4: Read Receipt Column Participant Mapping
**What goes wrong:** Writing read receipt to wrong participant column (p1 vs p2).
**Why it happens:** Need to determine if current user is participant1 or participant2 in the conversation.
**How to avoid:** Helper function: `const isP1 = conversation.participant1_id === currentUserId;` then write to `last_read_at_p1` or `last_read_at_p2` accordingly. Same pattern for `unread_count_p1` / `unread_count_p2`.

### Pitfall 5: Snap Upload Content Type
**What goes wrong:** Uploading WebP to Supabase Storage with wrong content type breaks signed URL delivery.
**Why it happens:** Phase 13 pattern uses `image/webp`. Snaps currently use `image/jpeg` in Firebase. New snaps should use WebP per CONTEXT.md decision.
**How to avoid:** Use `contentType: 'image/webp'` and `.webp` extension. Update compression to use `SaveFormat.WEBP` instead of `SaveFormat.JPEG`.

### Pitfall 6: pg_net Extension Not Enabled
**What goes wrong:** `net.http_post()` call in PG trigger fails because `pg_net` extension is not enabled.
**Why it happens:** Supabase projects need `pg_net` explicitly enabled.
**How to avoid:** Include `CREATE EXTENSION IF NOT EXISTS pg_net;` in the migration. Verify via Supabase dashboard.

### Pitfall 7: Supabase Realtime Filter Syntax
**What goes wrong:** Realtime postgres_changes filter doesn't work as expected.
**Why it happens:** Supabase Realtime filters use `=eq.` syntax (not SQL WHERE). Complex filters are not supported -- only simple equality.
**How to avoid:** Filter by `conversation_id=eq.${conversationId}` for messages. Do additional filtering client-side if needed.

### Pitfall 8: TanStack Infinite Query Page Merging
**What goes wrong:** Duplicate messages appear when Realtime invalidation refetches pages.
**Why it happens:** `useInfiniteQuery` refetches all pages on invalidation. If new messages shifted the cursor boundaries, the same message can appear in two pages.
**How to avoid:** Use the `messages` useMemo pattern from existing `useConversation` -- deduplicate via Map keyed by message ID before rendering.

### Pitfall 9: Unsend RLS Policy Gap
**What goes wrong:** Sender can update any field on their messages, not just `unsent_at`.
**Why it happens:** Current RLS policy is `USING (sender_id = auth.uid())` for UPDATE -- allows updating any column.
**How to avoid:** Consider a more restrictive UPDATE policy or accept the trade-off (client code only updates `unsent_at`, RLS prevents non-senders). For Phase 17, the existing policy is sufficient since the client controls what gets updated.

## Code Examples

### Message Service: Send Message
```typescript
// src/services/supabase/messageService.ts
import { supabase } from '@/lib/supabase';
import logger from '../../utils/logger';

export interface SendMessageParams {
  conversationId: string;
  senderId: string;
  text?: string | null;
  gifUrl?: string | null;
  type?: 'text' | 'reaction' | 'reply' | 'snap' | 'tagged_photo';
  replyToId?: string | null;
  emoji?: string | null;
  replyPreview?: { sender_id: string; type: string; text: string | null } | null;
  taggedPhotoId?: string | null;
}

export const sendMessage = async (params: SendMessageParams): Promise<{ messageId: string }> => {
  const { conversationId, senderId, text, gifUrl, type = 'text', replyToId, emoji, replyPreview, taggedPhotoId } = params;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      type,
      text: text || null,
      gif_url: gifUrl || null,
      reply_to_id: replyToId || null,
      emoji: emoji || null,
      reply_preview: replyPreview || null,
      tagged_photo_id: taggedPhotoId || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  logger.info('messageService.sendMessage: Success', { conversationId, messageId: data.id, type });
  return { messageId: data.id };
};
```

### Snap Service: Upload and Send
```typescript
// src/services/supabase/snapService.ts
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';
import { sendMessage } from './messageService';
import logger from '../../utils/logger';

const MAX_RETRIES = 3;
const BACKOFF_DELAYS = [1000, 2000, 4000];

export const uploadAndSendSnap = async (
  conversationId: string,
  senderId: string,
  localUri: string,
  caption?: string | null
): Promise<{ messageId: string }> => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Compress to WebP
      const compressed = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.WEBP }
      );

      // Read as ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      // Upload to snaps bucket
      const snapId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const storagePath = `${senderId}/${snapId}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('snaps')
        .upload(storagePath, arrayBuffer, {
          contentType: 'image/webp',
          cacheControl: 'no-store',
        });

      if (uploadError) throw uploadError;

      // Create snap message
      const result = await sendMessage({
        conversationId,
        senderId,
        type: 'snap',
        text: caption ? caption.substring(0, 150) : null,
      });

      // Update the message with snap_storage_path (insert doesn't include it above)
      await supabase
        .from('messages')
        .update({ snap_storage_path: storagePath })
        .eq('id', result.messageId);

      return result;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, BACKOFF_DELAYS[attempt - 1]));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Unreachable');
};
```

### Streak Service: Pure Functions (TypeScript)
```typescript
// src/services/supabase/streakService.ts
import { colors } from '../../constants/colors';

export type StreakState = 'default' | 'building' | 'pending' | 'active' | 'warning';

export interface StreakData {
  id: string;
  user1_id: string;
  user2_id: string;
  day_count: number;
  last_snap_at_user1: string | null;
  last_snap_at_user2: string | null;
  last_mutual_at: string | null;
  expires_at: string | null;
  warning_sent: number; // SQLite boolean (0/1)
}

export const generateStreakId = (userId1: string, userId2: string): string => {
  const [lower, higher] = [userId1, userId2].sort();
  return `${lower}_${higher}`;
};

export const deriveStreakState = (streak: StreakData | null, currentUserId: string): StreakState => {
  if (!streak) return 'default';

  if (!streak.expires_at) {
    const isUser1 = streak.user1_id === currentUserId;
    const mySnap = isUser1 ? streak.last_snap_at_user1 : streak.last_snap_at_user2;
    const theirSnap = isUser1 ? streak.last_snap_at_user2 : streak.last_snap_at_user1;
    if (mySnap && !theirSnap) return 'pending';
    if (mySnap || theirSnap) return 'building';
    return 'default';
  }

  if (streak.warning_sent) return 'warning';
  if (streak.day_count >= 3) return 'active';

  const isUser1 = streak.user1_id === currentUserId;
  const mySnap = isUser1 ? streak.last_snap_at_user1 : streak.last_snap_at_user2;
  const theirSnap = isUser1 ? streak.last_snap_at_user2 : streak.last_snap_at_user1;
  if (mySnap && !theirSnap) return 'pending';
  return 'building';
};

export const getStreakColor = (streakState: StreakState, dayCount: number): string => {
  if (streakState === 'warning') return colors.streak.warning;
  if (streakState === 'active') {
    if (dayCount >= 50) return colors.streak.activeTier3;
    if (dayCount >= 10) return colors.streak.activeTier2;
    return colors.streak.activeTier1;
  }
  if (streakState === 'pending') return colors.streak.pending;
  if (streakState === 'building') return colors.streak.building;
  return colors.streak.default;
};
```

### Edge Function: Snap Cleanup
```typescript
// supabase/functions/snap-cleanup/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { storage_path } = await req.json();
  if (!storage_path) {
    return new Response('Missing storage_path', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { error } = await supabase.storage.from('snaps').remove([storage_path]);

  if (error) {
    console.error('Snap cleanup failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: storage_path }), { status: 200 });
});
```

## State of the Art

| Old Approach (Firebase) | New Approach (Supabase) | Impact |
|------------------------|------------------------|--------|
| Firestore subcollections for messages | PostgreSQL messages table with FK to conversations | Single table, proper JOINs, cursor pagination |
| Cloud Function onNewMessage trigger | PostgreSQL AFTER INSERT trigger | Zero latency (in-database), no cold starts |
| Cloud Function for snap cleanup | pg_net + Edge Function | Asynchronous, server-authoritative |
| Firestore real-time listeners (onSnapshot) | Supabase Realtime postgres_changes | Channel-based, filter by conversation_id |
| Array-based deletedMessages in Firestore | Junction table message_deletions | Proper relational modeling, RLS per-row |
| Client polls/subscribes for conversation list | PowerSync local SQLite | Instant reads, offline capable |

## Open Questions

1. **pg_net availability**
   - What we know: Supabase projects include pg_net but it may need explicit enabling
   - What's unclear: Whether the project's Supabase instance has pg_net enabled
   - Recommendation: Include `CREATE EXTENSION IF NOT EXISTS pg_net;` in migration. Test in Supabase dashboard before deploying

2. **Supabase Realtime connection limits**
   - What we know: Supabase Free tier allows 200 concurrent Realtime connections. Pro tier allows 500.
   - What's unclear: The project's tier and expected concurrent conversation opens
   - Recommendation: Only subscribe to Realtime when a conversation is actively open. Unsubscribe on unmount. One channel per conversation is fine.

3. **PowerSync sync latency for conversations**
   - What we know: PowerSync syncs via logical replication. Typical latency is <1 second.
   - What's unclear: Whether conversation metadata updates (from PG trigger) propagate fast enough for the sending user to see their own message in the list immediately
   - Recommendation: Use optimistic updates for the sending user's conversation list. PowerSync sync will confirm.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- --testPathPattern="__tests__/services/(message\|snap\|streak)Service"` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSG-01 | Conversation CRUD, unread counts | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |
| MSG-02 | Message send, paginate, realtime | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |
| MSG-03 | All 5 message types | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |
| MSG-04 | Snap lifecycle | unit | `npm test -- __tests__/services/snapService.test.ts` | Wave 0 |
| MSG-05 | Streak derivation | unit | `npm test -- __tests__/services/streakService.test.ts` | Wave 0 |
| MSG-06 | Read receipts | unit | `npm test -- __tests__/hooks/useConversation.test.ts` | Wave 0 |
| MSG-07 | Reactions | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |
| MSG-08 | Swipe-to-reply | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |
| MSG-09 | Unsend + delete-for-me | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |
| MSG-10 | Screenshot detection | unit | `npm test -- __tests__/services/screenshotService.test.js` | Exists (may need update) |
| MSG-11 | Tagged photo pipeline | unit | `npm test -- __tests__/services/messageService.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="__tests__/services/(message|snap|streak)Service"`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/services/messageService.test.ts` -- new Supabase version (existing .js version tests Firebase)
- [ ] `__tests__/services/snapService.test.ts` -- new Supabase version (existing .js tests Firebase)
- [ ] `__tests__/services/streakService.test.ts` -- new Supabase version (existing .js tests Firebase)
- [ ] `__tests__/hooks/useMessages.test.ts` -- new version with PowerSync mocks
- [ ] `__tests__/hooks/useConversation.test.ts` -- new version with TanStack + Realtime mocks
- [ ] `__tests__/hooks/useStreaks.test.ts` -- new version with PowerSync mocks
- [ ] Supabase mock setup for `__supabaseMocks` pattern (extends existing from Phase 13)

## Sources

### Primary (HIGH confidence)
- Project codebase: existing Firebase services (messageService.js, snapService.js, streakService.js) -- 1,352 lines total
- Project codebase: existing hooks (useMessages.js, useConversation.js, useStreaks.js) -- 979 lines total
- Project codebase: database migration `20260323000004_create_conversations.sql` -- schema definitions
- Project codebase: RLS policies `20260323000007_create_rls_policies.sql` -- access control
- Project codebase: PowerSync publication `20260323000008_create_powersync_publication.sql` -- sync scope
- Phase 14 queryKeys.ts -- existing query key factory with conversations namespace
- Phase 13 storageService.ts -- established WebP upload pattern with base64-arraybuffer
- Phase 13 signedUrlService.ts -- existing client-side signed URL pattern for snaps

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions from `/gsd:discuss-phase` session -- locked architectural choices
- Prior phase CONTEXT.md files (12, 13, 14, 15, 16) -- established patterns

### Tertiary (LOW confidence)
- pg_net invocation pattern for Edge Functions -- based on Supabase documentation patterns, needs validation against actual project Supabase instance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in prior phases
- Architecture: HIGH -- patterns established in Phases 14-16, database schema exists
- Pitfalls: HIGH -- based on direct code analysis and prior phase learnings
- PostgreSQL triggers: MEDIUM -- SQL patterns are standard but need testing against actual schema
- pg_net + Edge Function chain: MEDIUM -- pattern is documented but untested in this project

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- project stack is locked, no fast-moving dependencies)
