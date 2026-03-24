# Phase 16: Core Services -- Social & Albums - Research

**Researched:** 2026-03-24
**Domain:** Supabase services for friendships, comments, albums, blocking, reporting, contact sync
**Confidence:** HIGH

## Summary

Phase 16 rewrites six Firebase services (friendship, comment, album, monthlyAlbum, block, report) and one contact sync service to use Supabase + PowerSync + TanStack Query. The decisions from CONTEXT.md are clear and well-scoped: friendships use PowerSync local writes for instant UI, comments use TanStack + Supabase Realtime, albums use TanStack mutations against a junction table, blocks/reports are simple Supabase inserts, and contact sync replaces batched Firestore queries with a single RPC call.

The key architectural distinction in this phase is the split between PowerSync-synced data (friendships) and non-synced data (comments, albums, blocks, reports). Friendships are in the PowerSync publication and use local SQLite writes for instant updates. Everything else goes through TanStack Query with direct Supabase calls. This split is already established from Phase 12/14 decisions and must be followed precisely.

The phase also introduces PostgreSQL triggers for friend_count and comment_count maintenance -- replacing Firebase Cloud Function triggers. These are database-level concerns that run automatically on INSERT/DELETE, removing the need for client-side count management.

**Primary recommendation:** Build services in dependency order: friendship first (foundational for mention autocomplete and contact sync filtering), then comments (depends on friendship for mentions), then albums, then block/report (simple), then contact sync (depends on friendship queries). Create PostgreSQL triggers alongside their respective services.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Friendships: PowerSync local writes for all operations (send, accept, decline, unfriend). Instant UI via local SQLite, PowerSync syncs to Supabase automatically. Keep deterministic ID with CHECK(user1_id < user2_id). Friend count via DB triggers.
- Comments: TanStack useQuery for fetching + Supabase Realtime channel filtered by photo_id for live updates. Realtime INSERT events trigger TanStack cache invalidation. Flat threading model with parent_id and mentioned_comment_id. @mention autocomplete queries PowerSync local SQLite for accepted friends. Comment count via PostgreSQL trigger. Comment likes via TanStack mutations.
- Albums: Junction table (album_photos) for photo-album relationships. TanStack useMutation for all CRUD with optimistic updates. Albums NOT PowerSync-synced. Monthly albums are client-side query (photos grouped by month via Supabase RPC, no stored records).
- Blocks: Direct Supabase insert/delete via TanStack mutations. RLS policies enforce block visibility. Cleanup of blocked user content via PostgreSQL trigger or Edge Function.
- Reports: Direct Supabase insert via TanStack mutation. Simple write.
- Contact sync: Single Supabase RPC call with ANY() for phone number lookup. Server-side filtering in RPC excludes existing friends and pending requests. Client-side E.164 normalization via libphonenumber-js.
- Real-time: PowerSync sync for friendships, Supabase Realtime per photo_id for comments, no Realtime for albums or blocks.

### Claude's Discretion
- Exact Supabase RPC SQL for contact sync (phone lookup with friendship filtering)
- PostgreSQL trigger implementation for comment_count and friend_count
- Supabase Realtime channel subscription management (connect/disconnect lifecycle in hooks)
- Hook API surface and return types for new hooks
- Block cleanup logic (trigger vs Edge Function for removing blocked user's content)
- Test structure and mock patterns for new services
- Whether monthly album query uses an RPC function or a database view

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-04 | Friendship service rewritten -- send/accept/decline requests, friend list, mutual friends all functional | PowerSync local writes for friendships table, deterministic ID ordering via CHECK constraint, friend_count PostgreSQL trigger, PowerSync sync provides real-time updates |
| CORE-05 | Comment service rewritten -- CRUD, real-time subscriptions, @mention parsing all functional | TanStack Query for comment fetching, Supabase Realtime channel per photo_id, comment_count PostgreSQL trigger, PowerSync local query for @mention autocomplete |
| CORE-06 | Album and monthly album services rewritten for Supabase | Junction table album_photos for relational model, TanStack mutations with optimistic updates, monthly albums as Supabase RPC query grouped by date |
| CORE-08 | Block and report services rewritten for Supabase | Direct Supabase insert/delete, RLS policies already enforce block visibility, cleanup trigger for blocked user content |
| CORE-09 | Contact sync service works against new user lookup endpoints | Single RPC with ANY() operator on users.phone, server-side exclusion of existing relationships, libphonenumber-js for E.164 normalization |
| CORE-10 | Real-time subscriptions work for feed, friend requests, and notifications via Supabase Realtime | PowerSync sync for friendships (automatic), Supabase Realtime postgres_changes for comments, TanStack cache invalidation pattern |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.3 | Database client for comments, albums, blocks, reports, contact sync RPC | Already installed (Phase 13). All non-PowerSync data access goes through this |
| `@powersync/react-native` | ^1.29.0 | Local SQLite for friendship reads/writes | Already installed (Phase 14). Friendships are in PowerSync publication |
| `@powersync/react` | ^1.11.0 | React hooks for PowerSync queries | Already installed (Phase 14). useQuery() for reading friendships from local SQLite |
| `@tanstack/react-query` | ^5.x | Server state caching for comments, albums, blocks | Already installed (Phase 14). useMutation + useQuery for non-synced data |
| `libphonenumber-js` | Already installed | E.164 phone normalization | Already used in existing contactSyncService.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-contacts` | Already installed | Device contacts access | Contact sync flow -- permission request, paginated contact fetching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL trigger for block cleanup | Edge Function | Trigger is simpler (no HTTP roundtrip), runs synchronously in same transaction. Edge Function better if cleanup is heavy/slow. Recommend trigger since cleanup is just DELETE queries |
| Supabase RPC for monthly albums | Database view | RPC is more flexible (can accept parameters), view is simpler. Recommend RPC since it needs userId parameter |

## Architecture Patterns

### Recommended Service Structure
```
src/services/supabase/
  friendshipService.ts    # NEW - PowerSync local writes
  commentService.ts       # NEW - TanStack + Supabase direct
  albumService.ts         # NEW - TanStack + Supabase direct
  blockService.ts         # NEW - TanStack + Supabase direct
  reportService.ts        # NEW - TanStack + Supabase direct
  contactSyncService.ts   # NEW - Supabase RPC + expo-contacts

src/hooks/
  useFriendships.ts       # NEW - PowerSync useQuery for friendship list
  useFriendRequests.ts    # NEW - PowerSync useQuery for pending requests
  useComments.ts          # NEW - TanStack + Realtime subscription
  useMentionSuggestions.ts # NEW - PowerSync local query for friend autocomplete
  useAlbums.ts            # NEW - TanStack useQuery + useMutation
  useMonthlyAlbums.ts     # NEW - TanStack useQuery wrapping RPC
  useBlocks.ts            # NEW - TanStack useQuery + useMutation
  useContactSync.ts       # NEW - TanStack useMutation wrapping sync flow

src/lib/queryKeys.ts      # EXTEND - Add friendship, comment, album, block, contact keys

supabase/migrations/
  YYYYMMDD_create_social_triggers.sql  # friend_count, comment_count triggers
  YYYYMMDD_create_contact_sync_rpc.sql # find_users_by_phone RPC
  YYYYMMDD_create_monthly_photos_rpc.sql # get_monthly_photos RPC
  YYYYMMDD_create_block_cleanup_trigger.sql # cleanup blocked user content
```

### Pattern 1: PowerSync Local Write (Friendships)
**What:** Write directly to local SQLite, PowerSync syncs to Supabase automatically
**When to use:** Friendships table (PowerSync-synced)
**Example:**
```typescript
// Service layer - friendshipService.ts
import { getPowerSyncDb } from '@/lib/powersync';

export const sendFriendRequest = async (fromUserId: string, toUserId: string) => {
  const db = getPowerSyncDb();
  const [user1Id, user2Id] = [fromUserId, toUserId].sort();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO friendships (id, user1_id, user2_id, status, initiated_by, created_at)
     VALUES (?, ?, ?, 'pending', ?, datetime('now'))`,
    [id, user1Id, user2Id, fromUserId]
  );

  return { id, user1Id, user2Id, status: 'pending' as const, initiatedBy: fromUserId };
};

export const acceptFriendRequest = async (friendshipId: string) => {
  const db = getPowerSyncDb();
  await db.execute(
    `UPDATE friendships SET status = 'accepted' WHERE id = ?`,
    [friendshipId]
  );
};

export const declineFriendRequest = async (friendshipId: string) => {
  const db = getPowerSyncDb();
  await db.execute(`DELETE FROM friendships WHERE id = ?`, [friendshipId]);
};
```

### Pattern 2: TanStack + Supabase Realtime (Comments)
**What:** TanStack Query for data fetching, Supabase Realtime for live updates that invalidate cache
**When to use:** Comments (not PowerSync-synced, needs real-time updates)
**Example:**
```typescript
// Hook - useComments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryKeys';

export const useComments = (photoId: string) => {
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments.list(photoId),
    queryFn: () => commentService.getComments(photoId),
    enabled: !!photoId,
  });

  // Supabase Realtime subscription for live comment updates
  useEffect(() => {
    if (!photoId) return;

    const channel = supabase
      .channel(`comments:${photoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `photo_id=eq.${photoId}`,
        },
        () => {
          // Invalidate cache on any comment change
          queryClient.invalidateQueries({ queryKey: queryKeys.comments.list(photoId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [photoId, queryClient]);

  return commentsQuery;
};
```

### Pattern 3: TanStack Mutation with Optimistic Update (Albums)
**What:** Optimistic cache update on mutation, rollback on error
**When to use:** Album CRUD, block/unblock, comment likes
**Example:**
```typescript
// Hook - useAlbums.ts
export const useAddPhotosToAlbum = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ albumId, photoIds }: { albumId: string; photoIds: string[] }) =>
      albumService.addPhotosToAlbum(albumId, photoIds),
    onMutate: async ({ albumId, photoIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.albums.detail(albumId) });
      const previous = queryClient.getQueryData(queryKeys.albums.detail(albumId));
      // Optimistic update
      queryClient.setQueryData(queryKeys.albums.detail(albumId), (old: any) => ({
        ...old,
        photos: [...(old?.photos ?? []), ...photoIds.map(id => ({ id }))],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.albums.detail(_vars.albumId), context.previous);
      }
    },
    onSettled: (_data, _err, { albumId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.albums.detail(albumId) });
    },
  });
};
```

### Pattern 4: PowerSync Local Query for Mention Autocomplete
**What:** Query local SQLite for accepted friends to provide instant @mention suggestions
**When to use:** Comment input with @mention detection
**Example:**
```typescript
// Hook - useMentionSuggestions.ts
import { useQuery } from '@powersync/react';

export const useMentionSuggestions = (searchText: string) => {
  // PowerSync local query - instant, offline-capable
  const { data: friends } = useQuery(
    `SELECT u.id, u.username, u.display_name, u.profile_photo_path
     FROM friendships f
     JOIN users u ON (
       CASE WHEN f.user1_id = ? THEN f.user2_id ELSE f.user1_id END = u.id
     )
     WHERE f.status = 'accepted'
     AND (f.user1_id = ? OR f.user2_id = ?)
     AND (u.username LIKE ? OR u.display_name LIKE ?)`,
    [currentUserId, currentUserId, currentUserId, `${searchText}%`, `${searchText}%`]
  );

  return friends ?? [];
};
```

**Note on PowerSync join limitations:** PowerSync's local SQLite only contains tables in the publication (photos, conversations, friendships, streaks). The `users` table is NOT synced locally. The mention autocomplete will need a different approach -- either:
1. Query friendships from PowerSync to get friend IDs, then batch-fetch user profiles from TanStack Query cache
2. Use a Supabase RPC that joins friendships + users server-side

Recommend option 1: get friend IDs from local PowerSync, then look up cached user profiles from TanStack. This keeps the autocomplete working with cached data while being accurate.

### Anti-Patterns to Avoid
- **Using Supabase direct calls for friendships:** Friendships are PowerSync-synced. Always use PowerSync local SQLite for reads/writes. Going through Supabase directly bypasses the sync and creates inconsistency.
- **Manual count maintenance in service layer:** Use PostgreSQL triggers for comment_count and friend_count. Do NOT increment/decrement in application code -- it's error-prone and creates race conditions.
- **Realtime channels for low-frequency data:** Albums, blocks, and reports do not need Realtime channels. TanStack refetch-on-focus is sufficient. Adding unnecessary channels wastes connection resources.
- **Storing monthly albums as records:** Monthly albums are a query, not stored data. The old Firebase approach queries photos grouped by month. The new Supabase approach should do the same via RPC -- no need for album records with type='monthly'.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Friend count maintenance | Manual increment/decrement in service code | PostgreSQL trigger on friendships table | Trigger runs atomically with the INSERT/DELETE, no race conditions, no missed updates |
| Comment count maintenance | Manual increment/decrement in service code | PostgreSQL trigger on comments table | Same reason as friend count -- atomicity |
| Block visibility enforcement | Client-side filtering of blocked users | RLS policies (already created in Phase 12) | is_blocked() helper function in RLS. Server enforces, client never sees blocked content |
| Phone number batching | Splitting arrays into batches of 30 | PostgreSQL ANY() operator in RPC | Single query handles unlimited phone numbers. Firestore's 10/30-item IN limit doesn't exist in PostgreSQL |
| Realtime subscription management | Manual WebSocket connections | Supabase channel API (supabase.channel().on().subscribe()) | Handles reconnection, auth token refresh, multiplexing automatically |
| Deterministic friendship IDs | Custom ID generation function | CHECK(user1_id < user2_id) constraint + UNIQUE(user1_id, user2_id) | Database enforces ordering. Service just sorts the two IDs before INSERT |

**Key insight:** PostgreSQL triggers replace three separate categories of Firebase Cloud Function triggers (friend count, comment count, block cleanup). These run in-database with zero network latency and transactional guarantees.

## Common Pitfalls

### Pitfall 1: PowerSync Local SQLite Column Naming
**What goes wrong:** PowerSync uses the PostgreSQL column names (snake_case) in local SQLite. Writing `userId` instead of `user_id` in SQL queries silently returns no results.
**Why it happens:** The codebase convention is camelCase in TypeScript but snake_case in DB. Easy to forget when writing raw SQL.
**How to avoid:** Always use snake_case in PowerSync SQL queries. Map to camelCase in the service layer return types.
**Warning signs:** Queries returning empty arrays when data should exist.

### Pitfall 2: Supabase Realtime Channel Cleanup
**What goes wrong:** Memory leak and stale subscriptions if channels aren't removed on component unmount or photo change.
**Why it happens:** Each `supabase.channel()` call creates a new WebSocket subscription. Without cleanup, old subscriptions accumulate.
**How to avoid:** Always return a cleanup function from useEffect that calls `supabase.removeChannel(channel)`. Include the channel ID (e.g., `comments:${photoId}`) to ensure unique channels per photo.
**Warning signs:** Multiple Realtime connections in Supabase dashboard, duplicate comment notifications.

### Pitfall 3: Friendship CHECK Constraint Violation
**What goes wrong:** INSERT fails with CHECK constraint violation if user1_id >= user2_id.
**Why it happens:** The friendships table has CHECK(user1_id < user2_id). If the service doesn't sort the IDs before insert, UUID ordering may violate this.
**How to avoid:** Always sort the two user IDs before constructing the INSERT: `const [user1Id, user2Id] = [fromUserId, toUserId].sort()`.
**Warning signs:** "new row violates check constraint" PostgreSQL error.

### Pitfall 4: Comment Flat Threading Parent Resolution
**What goes wrong:** Reply-to-reply creates deeply nested thread instead of flat structure.
**Why it happens:** When replying to a reply, the parent_id must be set to the ORIGINAL top-level comment's ID, not the reply's ID. The mentioned_comment_id tracks which specific comment was replied to.
**How to avoid:** Before inserting a reply, check if the target comment has a parent_id. If yes, use target's parent_id as the new comment's parent_id (flatten). Set mentioned_comment_id to the target comment's ID.
**Warning signs:** Comments rendering in wrong thread groups.

### Pitfall 5: Optimistic Update Shape Mismatch
**What goes wrong:** Optimistic update sets data in a different shape than what the server returns, causing a flash when the real data arrives.
**Why it happens:** TanStack cache is updated optimistically with client-shaped data, then invalidation fetches server-shaped data. If snake_case/camelCase mapping differs, UI flickers.
**How to avoid:** Ensure optimistic update data matches the exact shape that the query function returns after the service layer's snake_case -> camelCase mapping.
**Warning signs:** Brief UI flicker after mutation completes.

### Pitfall 6: Users Table Not in PowerSync
**What goes wrong:** Attempting to JOIN friendships with users in PowerSync local SQLite fails because users table isn't synced.
**Why it happens:** Only 4 tables are in the PowerSync publication: photos, conversations, friendships, streaks. Users table is NOT synced.
**How to avoid:** For friend list with profile data: query friendships from PowerSync to get IDs, then fetch user profiles from TanStack Query cache or Supabase. For mention autocomplete: same two-step approach.
**Warning signs:** "no such table: users" SQLite error.

### Pitfall 7: Block Cleanup Race Condition
**What goes wrong:** Block is inserted but cleanup of blocked user's content fails or runs after the user sees the content.
**Why it happens:** If cleanup is done client-side after the INSERT, there's a window where blocked content is visible.
**How to avoid:** Use a PostgreSQL AFTER INSERT trigger on the blocks table. The trigger runs server-side immediately after the block is created, ensuring cleanup happens atomically. Alternatively, an Edge Function triggered by database webhook.
**Warning signs:** Blocked user's comments still visible briefly after blocking.

## Code Examples

### PostgreSQL Trigger: Friend Count Maintenance
```sql
-- Trigger function for friend_count on users table
CREATE OR REPLACE FUNCTION update_friend_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user1_id;
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user2_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user1_id;
    UPDATE users SET friend_count = friend_count + 1 WHERE id = NEW.user2_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    UPDATE users SET friend_count = GREATEST(friend_count - 1, 0) WHERE id = OLD.user1_id;
    UPDATE users SET friend_count = GREATEST(friend_count - 1, 0) WHERE id = OLD.user2_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER friendships_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_friend_count();
```

### PostgreSQL Trigger: Comment Count Maintenance
```sql
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE photos SET comment_count = comment_count + 1 WHERE id = NEW.photo_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE photos SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.photo_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();
```

### Supabase RPC: Contact Sync Phone Lookup
```sql
-- RPC function for finding users by phone numbers, excluding existing relationships
CREATE OR REPLACE FUNCTION find_contacts_on_app(
  phone_numbers TEXT[],
  requesting_user_id UUID
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  profile_photo_path TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.username, u.display_name, u.profile_photo_path
  FROM users u
  WHERE u.phone = ANY(phone_numbers)
    AND u.id != requesting_user_id
    AND u.profile_setup_completed = true
    AND NOT EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user1_id = requesting_user_id AND f.user2_id = u.id)
         OR (f.user1_id = u.id AND f.user2_id = requesting_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = requesting_user_id AND b.blocked_id = u.id)
         OR (b.blocker_id = u.id AND b.blocked_id = requesting_user_id)
    );
$$;
```

### Supabase RPC: Monthly Photos Grouped by Month
```sql
-- RPC function for monthly album data
CREATE OR REPLACE FUNCTION get_monthly_photos(target_user_id UUID)
RETURNS TABLE (
  month_key TEXT,
  photo_count BIGINT,
  photos JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at, 'YYYY-MM') AS month_key,
    COUNT(*) AS photo_count,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'image_url', image_url,
        'created_at', created_at,
        'photo_state', photo_state
      ) ORDER BY created_at DESC
    ) AS photos
  FROM photos
  WHERE user_id = target_user_id
    AND status = 'revealed'
    AND photo_state IN ('journal', 'archive')
    AND deleted_at IS NULL
  GROUP BY to_char(created_at, 'YYYY-MM')
  ORDER BY month_key DESC;
$$;
```

### Block Cleanup Trigger
```sql
-- Trigger to clean up blocked user's content when a block is created
CREATE OR REPLACE FUNCTION cleanup_blocked_user_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete blocked user's comments on blocker's photos
  DELETE FROM comments
  WHERE user_id = NEW.blocked_id
    AND photo_id IN (SELECT id FROM photos WHERE user_id = NEW.blocker_id);

  -- Delete blocked user's reactions on blocker's photos
  DELETE FROM photo_reactions
  WHERE user_id = NEW.blocked_id
    AND photo_id IN (SELECT id FROM photos WHERE user_id = NEW.blocker_id);

  -- Delete blocked user's comment likes on blocker's photo comments
  DELETE FROM comment_likes
  WHERE user_id = NEW.blocked_id
    AND comment_id IN (
      SELECT c.id FROM comments c
      JOIN photos p ON p.id = c.photo_id
      WHERE p.user_id = NEW.blocker_id
    );

  -- Remove friendship if exists
  DELETE FROM friendships
  WHERE (user1_id = NEW.blocker_id AND user2_id = NEW.blocked_id)
     OR (user1_id = NEW.blocked_id AND user2_id = NEW.blocker_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER blocks_cleanup_trigger
  AFTER INSERT ON blocks
  FOR EACH ROW EXECUTE FUNCTION cleanup_blocked_user_content();
```

### Query Key Factory Extension
```typescript
// Addition to src/lib/queryKeys.ts
export const queryKeys = {
  // ... existing keys from Phase 14/15
  friendships: {
    all: ['friendships'] as const,
    list: (userId: string) => ['friendships', 'list', userId] as const,
    pending: (userId: string) => ['friendships', 'pending', userId] as const,
    sent: (userId: string) => ['friendships', 'sent', userId] as const,
    status: (userId1: string, userId2: string) => ['friendships', 'status', userId1, userId2] as const,
  },
  comments: {
    all: ['comments'] as const,
    list: (photoId: string) => ['comments', 'list', photoId] as const,
    likes: (photoId: string) => ['comments', 'likes', photoId] as const,
  },
  albums: {
    all: ['albums'] as const,
    list: (userId: string) => ['albums', 'list', userId] as const,
    detail: (albumId: string) => ['albums', 'detail', albumId] as const,
    monthly: (userId: string) => ['albums', 'monthly', userId] as const,
  },
  blocks: {
    all: ['blocks'] as const,
    list: (userId: string) => ['blocks', 'list', userId] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    suggestions: (userId: string) => ['contacts', 'suggestions', userId] as const,
  },
};
```

## State of the Art

| Old Approach (Firebase) | New Approach (Supabase) | Impact |
|------------------------|------------------------|--------|
| Firestore `onSnapshot` for friendship real-time | PowerSync sync cycle (automatic) | No manual subscription management needed for friendships |
| Firestore `in` query with 30-item batch limit | PostgreSQL `ANY()` operator, unlimited | Single query for contact sync regardless of phone count |
| Firestore subcollection `photos/{id}/comments/` | Flat `comments` table with `photo_id` FK | Standard relational JOIN, PostgreSQL indexes, RLS policies |
| Client-side `increment(1)` for comment count | PostgreSQL trigger on INSERT/DELETE | Atomic, no race conditions, server-authoritative |
| Cloud Function `getMutualFriendsForComments` | PowerSync local query + TanStack cache lookup | Instant offline-capable autocomplete, no network call |
| Array field `photoIds` on album document | Junction table `album_photos` | Standard relational pattern, no array mutation limits |
| Client-side monthly grouping of all photos | Server-side `GROUP BY to_char(created_at, 'YYYY-MM')` | Less data transfer, database does the heavy lifting |

**Deprecated/outdated:**
- Firebase `arrayUnion` for adding photos to albums: replaced by junction table INSERT
- Firebase `increment()` for count maintenance: replaced by PostgreSQL triggers
- Cloud Function for mutual friends: replaced by local PowerSync query

## Open Questions

1. **Comment `like_count` column**
   - What we know: The comments table schema does not include a `like_count` column. The existing Firebase comment has `likeCount`.
   - What's unclear: Whether to add a `like_count` column with a trigger, or compute it from `comment_likes` table with COUNT.
   - Recommendation: Add a `like_count` column to comments table via migration, with a PostgreSQL trigger on `comment_likes` INSERT/DELETE. This matches the comment_count pattern and avoids expensive COUNT queries on every comment render.

2. **Comment `media_url` and `media_type` columns**
   - What we know: The existing Firebase comment model supports `mediaUrl` (image/GIF attachments) and `mediaType`. The new comments table schema only has `text` and `mentions`.
   - What's unclear: Whether media attachments on comments are still needed.
   - Recommendation: Add `media_url TEXT` and `media_type TEXT` columns to comments table via migration, preserving feature parity. These are nullable.

3. **Comment `mentioned_comment_id` column**
   - What we know: The existing Firebase model uses `mentionedCommentId` to track reply-to-reply targeting. The new schema only has `parent_id`.
   - What's unclear: Whether the flat threading model needs this extra column.
   - Recommendation: Add `mentioned_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL` to the comments table. This is essential for the reply-to-reply scroll-to behavior.

4. **Photos table `comment_count` column**
   - What we know: The photos migration does not show a `comment_count` column explicitly.
   - What's unclear: Whether it exists or needs to be added.
   - Recommendation: Verify the photos table schema. If `comment_count` doesn't exist, add it via migration before creating the trigger.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with jest-expo preset |
| Config file | `package.json` jest section + `__tests__/setup/jest.setup.js` |
| Quick run command | `npm test -- --testPathPattern="services/(friendshipService\|commentService\|albumService\|blockService\|reportService\|contactSyncService)" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-04 | Send/accept/decline friend request via PowerSync | unit | `npm test -- __tests__/services/friendshipService.test.ts -x` | New (replace .js) |
| CORE-04 | Friend list query from PowerSync local SQLite | unit | `npm test -- __tests__/services/friendshipService.test.ts -x` | New |
| CORE-05 | Add/delete comment via Supabase | unit | `npm test -- __tests__/services/commentService.test.ts -x` | New (replace .js) |
| CORE-05 | Comment Realtime subscription invalidates cache | unit | `npm test -- __tests__/hooks/useComments.test.ts -x` | New |
| CORE-05 | @mention autocomplete from cached friends | unit | `npm test -- __tests__/hooks/useMentionSuggestions.test.ts -x` | New |
| CORE-06 | Album CRUD with junction table | unit | `npm test -- __tests__/services/albumService.test.ts -x` | New (replace .js) |
| CORE-06 | Monthly album RPC query | unit | `npm test -- __tests__/services/albumService.test.ts -x` | New |
| CORE-08 | Block/unblock user | unit | `npm test -- __tests__/services/blockService.test.ts -x` | New (replace .js) |
| CORE-08 | Report submission | unit | `npm test -- __tests__/services/reportService.test.ts -x` | New (replace .js) |
| CORE-09 | Contact sync phone lookup via RPC | unit | `npm test -- __tests__/services/contactSyncService.test.ts -x` | New (replace .js) |
| CORE-10 | Realtime comment channel lifecycle | unit | `npm test -- __tests__/hooks/useComments.test.ts -x` | New |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="services/(friendshipService|commentService|albumService|blockService|reportService|contactSyncService)" --no-coverage`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/services/friendshipService.test.ts` -- replace existing .js with Supabase/PowerSync mocks (covers CORE-04)
- [ ] `__tests__/services/commentService.test.ts` -- replace existing .js with Supabase mocks (covers CORE-05)
- [ ] `__tests__/services/albumService.test.ts` -- replace existing .js with Supabase mocks (covers CORE-06)
- [ ] `__tests__/services/blockService.test.ts` -- replace existing .js with Supabase mocks (covers CORE-08)
- [ ] `__tests__/services/reportService.test.ts` -- replace existing .js with Supabase mocks (covers CORE-08)
- [ ] `__tests__/services/contactSyncService.test.ts` -- replace existing .js with Supabase RPC mocks (covers CORE-09)
- [ ] `__tests__/hooks/useComments.test.ts` -- new test for Realtime + TanStack (covers CORE-05, CORE-10)
- [ ] `__tests__/hooks/useMentionSuggestions.test.ts` -- new test for PowerSync-based autocomplete (covers CORE-05)
- [ ] Supabase mock pattern from Phase 13 (`global.__supabaseMocks`) -- extend for channel/Realtime mocking

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260323000003_create_social.sql` -- friendships, blocks, reports table definitions
- `supabase/migrations/20260323000005_create_content.sql` -- comments, comment_likes, albums, album_photos table definitions
- `supabase/migrations/20260323000006_create_rls_helpers.sql` -- is_friend(), is_blocked() helper functions
- `supabase/migrations/20260323000007_create_rls_policies.sql` -- All RLS policies for social tables
- `supabase/migrations/20260323000008_create_powersync_publication.sql` -- PowerSync publication (photos, conversations, friendships, streaks)
- `supabase/migrations/20260323000001_create_users.sql` -- Users table with phone column for contact sync
- Existing Firebase services (friendshipService.js, commentService.js, albumService.js, monthlyAlbumService.js, blockService.js, reportService.js, contactSyncService.js) -- complete API surface being replaced

### Secondary (MEDIUM confidence)
- `.planning/phases/14-data-layer-caching-foundation/14-CONTEXT.md` -- TanStack Query configuration, PowerSync boundary decisions
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` -- Throw-on-error pattern, service directory structure
- `.planning/research/STACK.md` -- Package versions and rationale

### Tertiary (LOW confidence)
- PostgreSQL trigger patterns for count maintenance -- based on standard PostgreSQL patterns, not project-specific verification. Should be tested against actual schema.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already installed, versions confirmed from STACK.md
- Architecture: HIGH - patterns established in Phase 14/15, extended here with clear CONTEXT.md decisions
- Pitfalls: HIGH - derived from direct code analysis of existing services and schema
- PostgreSQL triggers: MEDIUM - standard patterns but need to verify exact column names match schema
- Schema gaps (like_count, media_url, mentioned_comment_id): MEDIUM - identified from comparing Firebase model to PostgreSQL schema

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- all dependencies already installed, schema defined)
