# Phase 15: Core Services -- Photos, Feed, Darkroom - Research

**Researched:** 2026-03-24
**Domain:** Photo lifecycle, feed queries, darkroom reveals, user profile CRUD -- all rewritten for Supabase + PowerSync + TanStack Query
**Confidence:** HIGH

## Summary

This phase rewrites four core service files (photoService, feedService, darkroomService, profileService) plus their consuming hooks (useFeedPhotos, useDarkroom) from Firebase to Supabase. The existing upload queue already uses PowerSync local SQLite and Supabase Storage (Phase 13), so the key new work is: (1) creating the photo record in local PowerSync SQLite at capture time instead of Firestore, (2) building the `get_feed` RPC function as a single SQL JOIN replacing chunked Firestore `in` queries, (3) rewriting darkroom reveal logic to use PowerSync local reads instead of a separate darkroom document, and (4) creating profileService.ts for user CRUD via TanStack Query.

The PowerSync schema already defines the `photos` table with all necessary columns (`status`, `photo_state`, `reveal_at`, `deleted_at`, `image_url`, `local_uri`, `storage_path`). The Supabase `photos` table has RLS policies, indexes, and soft-delete support. The upload queue service already uploads to Supabase Storage. The connector's `uploadData` method is a stub that needs implementation to handle PowerSync CRUD transaction syncing to Supabase.

**Primary recommendation:** Build services bottom-up: photoService (PowerSync local writes) -> darkroomService (reveal logic on local photos) -> feedService (RPC + TanStack) -> profileService (TanStack CRUD). Then rewrite hooks to consume new services. The upload queue's `processQueue` must be extended to update the photo record's `image_url` and `storage_path` after successful upload.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single file per service: photoService.ts, feedService.ts, darkroomService.ts, profileService.ts (replaces userService.js)
- New services live in `src/services/supabase/` -- parallel to existing `src/services/firebase/`. Both coexist during strangler fig migration
- Services AND their consuming hooks rewritten together in this phase (useFeedPhotos, useDarkroom, etc.). End-to-end: service talks to Supabase, hook uses TanStack/PowerSync, screens get data
- New services use throw-on-error pattern (TanStack Query catches errors automatically). Old `{ success, error }` pattern stays in unrewritten Firebase services only
- Feed loads via Supabase RPC database function (`get_feed`), not a PostgreSQL view. Single SQL JOIN replaces 30-ID chunking. Parameters: userId, cursor, limit
- TanStack useInfiniteQuery wraps the RPC call with cursor-based pagination (WHERE created_at < $cursor ORDER BY created_at DESC LIMIT 20)
- RPC returns flat list of photos with user data joined. useFeedPhotos hook groups by userId client-side (same as current stories-style grouping)
- Feed data is NOT PowerSync-synced (Phase 12 decision: only user's own photos sync). TanStack Query caches feed results with stale-while-revalidate
- No separate darkroom state table. reveal_at lives on each photo row. "Next reveal time" = MIN(reveal_at) from user's developing photos
- Batch reveal preserved (current behavior): all developing photos share one reveal_at. When a reveal fires, ALL current developing photos are revealed together. New photos captured after get a new batch reveal_at
- Two client-side reveal triggers: App.js foreground check and DarkroomScreen focus check. Client reads PowerSync local photos where status='developing' AND reveal_at <= now(). If found, updates locally
- Reveal writes go through PowerSync local SQLite (update status to 'revealed'). PowerSync syncs to Supabase. Instant UI update, works offline
- pg_cron background catch-all is Phase 18 scope -- not built here
- On capture: photo record inserted into PowerSync local SQLite immediately with status='developing', image_url=NULL, local_uri set. Appears in darkroom instantly. Upload queue fills in image_url and storage_path when upload completes
- reveal_at assigned at capture time: calculateNextRevealTime() returns a batch reveal time. If other developing photos exist, new photo gets their reveal_at. If none, generates new random 0-5min window
- Triage (journal/archive) and soft delete use PowerSync local writes. Update photo_state or deleted_at in local SQLite, synced to Supabase automatically. Instant UI response
- Batch triage also uses PowerSync local writes (multiple photo updates in local SQLite)
- Reactions use TanStack mutations (photo_reactions table is not PowerSync-synced). Optimistic cache update via TanStack Query
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-01 | Photo service rewritten for Supabase -- CRUD, reveal, triage, batch triage, soft delete all functional | photoService.ts with PowerSync local writes for all photo operations; uploadQueueService extended to update image_url post-upload |
| CORE-02 | Feed loads via single SQL JOIN query replacing chunked Firestore `in` queries (30-ID limit eliminated) | `get_feed` RPC function with friendships JOIN + block exclusion; TanStack useInfiniteQuery with cursor pagination |
| CORE-03 | Darkroom service rewritten -- developing/revealed state, reveal scheduling, countdown timer all functional | darkroomService.ts reads PowerSync local SQLite; reveal_at on photo rows replaces separate darkroom document; batch reveal via local UPDATE |
| CORE-07 | User profile service rewritten -- CRUD, search, friend count all functional | profileService.ts with TanStack Query for reads, TanStack mutations for writes; username availability via Supabase query |
</phase_requirements>

## Standard Stack

### Core (already installed from prior phases)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.3 | Database client, RPC calls, Storage | Already installed; Supabase client singleton in `src/lib/supabase.ts` |
| `@powersync/react-native` | ^1.29.0 | Local SQLite for photos table, offline writes | Already installed; schema in `src/lib/powersync/schema.ts` with photos table |
| `@powersync/react` | ^1.11.0 | `useQuery()` hook for reactive local reads | Already installed; provides reactive PowerSync queries |
| `@tanstack/react-query` | ^5.x | Server state management, caching, mutations | Phase 14 foundation; QueryClient configured with staleTime 30s, gcTime 10min |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` or inline generator | N/A | Generate photo IDs client-side | Already using inline `generateUUID()` in uploadQueueService.ts |

### No New Dependencies
This phase requires zero new npm packages. All infrastructure was installed in Phases 12-14.

## Architecture Patterns

### Recommended Project Structure
```
src/services/supabase/
  photoService.ts       # NEW: Photo CRUD, reveal, triage via PowerSync + Supabase
  feedService.ts        # NEW: Feed RPC query via TanStack
  darkroomService.ts    # NEW: Reveal logic via PowerSync local reads
  profileService.ts     # NEW: User CRUD via TanStack + Supabase
  storageService.ts     # EXISTS: Photo/video upload
  phoneAuthService.ts   # EXISTS: Auth
  signedUrlService.ts   # EXISTS: Signed URLs

src/hooks/
  useFeedPhotos.ts      # REWRITE: TanStack useInfiniteQuery + client-side grouping
  useDarkroom.ts        # REWRITE: PowerSync reactive queries + countdown timer

supabase/migrations/
  YYYYMMDD_create_get_feed_rpc.sql  # NEW: Feed RPC function
```

### Pattern 1: PowerSync Local Write for Photo Operations
**What:** All photo mutations (create, triage, reveal, soft-delete) write to local SQLite first. PowerSync syncs changes to Supabase automatically.
**When to use:** Any operation on the `photos` table (which is a PowerSync-synced table).
**Example:**
```typescript
// src/services/supabase/photoService.ts
import { getPowerSyncDb } from '@/lib/powersync/PowerSyncProvider';

export const createPhotoRecord = async (
  userId: string,
  photoId: string,
  localUri: string,
  revealAt: string,
  thumbnailDataUrl?: string | null,
): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) throw new Error('PowerSync not available');

  await db.execute(
    `INSERT INTO photos (id, user_id, status, photo_state, local_uri, image_url, storage_path, thumbnail_data_url, reveal_at, media_type, caption, comment_count, reaction_count, deleted_at, created_at)
     VALUES (?, ?, 'developing', NULL, ?, NULL, NULL, ?, ?, 'photo', NULL, 0, 0, NULL, ?)`,
    [photoId, userId, localUri, thumbnailDataUrl ?? null, revealAt, new Date().toISOString()]
  );
};

export const triagePhoto = async (photoId: string, action: 'journal' | 'archive'): Promise<void> => {
  const db = getPowerSyncDb();
  if (!db) throw new Error('PowerSync not available');

  await db.execute(
    'UPDATE photos SET photo_state = ? WHERE id = ?',
    [action, photoId]
  );
};
```

### Pattern 2: TanStack useInfiniteQuery for Feed
**What:** Feed data comes from Supabase RPC (not PowerSync), cached by TanStack Query with cursor pagination.
**When to use:** Feed screen, which shows friends' photos (not synced locally).
**Example:**
```typescript
// src/hooks/useFeedPhotos.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { getFeed } from '@/services/supabase/feedService';

export const useFeedPhotos = () => {
  return useInfiniteQuery({
    queryKey: ['feed', 'infinite'],
    queryFn: ({ pageParam }) => getFeed({ cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length === 20 ? lastPage[lastPage.length - 1].created_at : undefined,
  });
};
```

### Pattern 3: PowerSync Reactive Query for Darkroom
**What:** Darkroom reads developing photos from local SQLite via PowerSync's `useQuery()` hook. Reactive -- UI updates instantly when photo status changes locally.
**When to use:** DarkroomScreen, darkroom badge count, App.js foreground check.
**Example:**
```typescript
// In useDarkroom hook
import { useQuery } from '@powersync/react';

const { data: developingPhotos } = useQuery(
  `SELECT * FROM photos WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL ORDER BY created_at DESC`,
  [userId]
);
```

### Pattern 4: Throw-on-Error Service Pattern
**What:** New Supabase services throw errors instead of returning `{ success, error }`. TanStack Query's `onError` handles error display.
**When to use:** All new services in `src/services/supabase/`.
**Example:**
```typescript
// NEW pattern (Phase 15+)
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, username, bio, profile_photo_path, selects, song, friend_count, name_color')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return mapToUserProfile(data); // snake_case -> camelCase mapping
};
```

### Pattern 5: snake_case to camelCase Mapping in Service Layer
**What:** Database uses snake_case. TypeScript uses camelCase. Service layer maps between them.
**When to use:** Every service that reads from or writes to Supabase/PowerSync.
**Example:**
```typescript
const mapToPhoto = (row: any): Photo => ({
  id: row.id,
  userId: row.user_id,
  imageUrl: row.image_url,
  localUri: row.local_uri,
  thumbnailDataUrl: row.thumbnail_data_url,
  status: row.status,
  photoState: row.photo_state,
  mediaType: row.media_type,
  caption: row.caption,
  revealAt: row.reveal_at,
  storagePath: row.storage_path,
  commentCount: row.comment_count,
  reactionCount: row.reaction_count,
  deletedAt: row.deleted_at,
  createdAt: row.created_at,
});
```

### Anti-Patterns to Avoid
- **Direct Supabase calls in hooks/screens:** All calls go through service files. Hooks import from `src/services/supabase/`, never from `@supabase/supabase-js` directly.
- **Using PowerSync for feed queries:** Feed is friends' photos -- NOT synced locally. Use TanStack Query + Supabase RPC. Only user's OWN photos are in PowerSync.
- **Returning `{ success, error }` from new services:** New services throw. Only old Firebase services keep the `{ success, error }` pattern.
- **Using Supabase Realtime for darkroom updates:** PowerSync reactive queries provide the same reactivity PLUS offline support. No Realtime channels needed for photos.
- **Forgetting block filtering in feed RPC:** The `get_feed` RPC must exclude photos from blocked users. The RLS policy handles this for direct queries, but the RPC function runs with `SECURITY DEFINER` and must enforce blocks explicitly.
- **Updating reveal_at on existing developing photos when new photo is captured:** New photos should JOIN the existing batch (get the same reveal_at), not reset the timer for all photos.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feed pagination | Manual offset/limit tracking | TanStack `useInfiniteQuery` with cursor | Handles loading states, caching, deduplication, background refetch automatically |
| Optimistic reaction updates | Manual state rollback logic | TanStack `useMutation` with `onMutate`/`onError` rollback | Built-in optimistic update pattern with automatic rollback on failure |
| Photo record reactivity in darkroom | Manual polling or subscription | PowerSync `useQuery()` reactive hook | Automatically re-renders when local SQLite data changes |
| UUID generation | Custom random function | Existing `generateUUID()` in uploadQueueService | Already tested and used; consistent format |
| Cache invalidation after triage | Manual cache clearing | TanStack `queryClient.invalidateQueries()` | Invalidates feed cache after triage so feed reflects changes |

## Common Pitfalls

### Pitfall 1: Upload Queue Doesn't Update Photo Record
**What goes wrong:** Photos are created in local SQLite with `image_url=NULL`, upload completes in the queue, but nobody writes the URL back to the photo record.
**Why it happens:** The existing `uploadQueueService.ts` only uploads files to Supabase Storage. It doesn't update the `photos` table because the old Firebase flow had `createPhoto` do both upload + Firestore write atomically.
**How to avoid:** After successful upload in `processQueue`, update the photo record's `image_url` and `storage_path` via PowerSync local write: `UPDATE photos SET image_url = ?, storage_path = ? WHERE id = ?`.
**Warning signs:** Photos appear in darkroom with no image, or feed shows broken images.

### Pitfall 2: Batch Reveal Timing Coordination
**What goes wrong:** User captures 3 photos in sequence. Each gets a different `reveal_at` instead of sharing the same batch timer.
**Why it happens:** `calculateNextRevealTime()` is called independently for each capture without checking existing developing photos.
**How to avoid:** Before assigning `reveal_at`, query local SQLite: `SELECT MIN(reveal_at) FROM photos WHERE user_id = ? AND status = 'developing'`. If a result exists, use that timestamp. If not, generate a new random 0-5 minute window.
**Warning signs:** Photos reveal one-by-one instead of all at once.

### Pitfall 3: PowerSync Connector uploadData Not Implemented
**What goes wrong:** Photo records written to local SQLite never sync to Supabase because the `SupabaseConnector.uploadData()` method is a stub.
**Why it happens:** The connector in `src/lib/powersync/connector.ts` has a TODO comment and just completes the transaction without actually pushing to Supabase.
**How to avoid:** Implement `uploadData` to process CRUD entries: for each `CrudEntry`, map to the appropriate Supabase table operation (insert/update/delete via `supabase.from(table).upsert()/delete()`).
**Warning signs:** Local changes work but friends never see your photos in their feed.

### Pitfall 4: Feed RPC Security
**What goes wrong:** Feed RPC function returns photos from blocked users, or photos that aren't `status='revealed'` and `photo_state='journal'`.
**Why it happens:** RPC functions with `SECURITY DEFINER` bypass RLS. The function must enforce all access rules in its SQL.
**How to avoid:** The `get_feed` SQL must include: `WHERE p.status = 'revealed' AND p.photo_state = 'journal' AND p.deleted_at IS NULL AND f.status = 'accepted' AND NOT EXISTS (SELECT 1 FROM blocks ...)`.
**Warning signs:** Users see archived/developing photos from friends, or photos from blocked users.

### Pitfall 5: Timestamp Format Mismatch Between PowerSync and Supabase
**What goes wrong:** PowerSync stores timestamps as ISO strings in SQLite. Supabase uses TIMESTAMPTZ. Comparison operators behave differently.
**Why it happens:** The PowerSync schema defines `reveal_at` as `column.text`. SQLite string comparison of ISO timestamps works for ordering but is fragile.
**How to avoid:** Always use ISO 8601 format (`YYYY-MM-DDTHH:MM:SS.sssZ`) consistently. For reveal checks, compare: `reveal_at <= datetime('now')` in SQLite, or parse to Date in JS: `new Date(photo.reveal_at) <= new Date()`.
**Warning signs:** Reveals fire at wrong times, or never fire.

### Pitfall 6: Daily Photo Count Reset Race
**What goes wrong:** Two rapid captures both read `daily_photo_count = 35`, both increment to 36, user exceeds the 36/day limit.
**Why it happens:** The current Firebase implementation does a read-then-write without atomic increment.
**How to avoid:** Use Supabase's atomic increment: `supabase.rpc('increment_daily_photo_count', { user_id })` or a SQL function that does `UPDATE users SET daily_photo_count = daily_photo_count + 1 WHERE id = $1 AND (last_photo_date != CURRENT_DATE OR daily_photo_count < 36) RETURNING daily_photo_count`. Returns the new count atomically.
**Warning signs:** Users occasionally exceed 36 photos per day.

### Pitfall 7: Feed Grouping Logic Must Preserve Stories UX
**What goes wrong:** Feed renders as a flat list of photos instead of grouped by user (stories-style).
**Why it happens:** The RPC returns a flat list. The hook must group by userId client-side, matching the current `curateTopPhotosPerFriend` logic in the existing `useFeedPhotos.js`.
**How to avoid:** Port the existing grouping logic from `useFeedPhotos.js` (lines 31-60): group by userId, sort by reactionCount DESC within each group, take top N per friend.
**Warning signs:** Feed looks completely different from current behavior.

## Code Examples

### Feed RPC Function (SQL Migration)
```sql
-- Source: Designed based on schema + CONTEXT.md decisions
CREATE OR REPLACE FUNCTION get_feed(
  p_user_id UUID,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  image_url TEXT,
  thumbnail_data_url TEXT,
  status TEXT,
  photo_state TEXT,
  media_type TEXT,
  caption TEXT,
  storage_path TEXT,
  comment_count INTEGER,
  reaction_count INTEGER,
  created_at TIMESTAMPTZ,
  -- Joined user data
  username TEXT,
  display_name TEXT,
  profile_photo_path TEXT,
  name_color TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.user_id,
    p.image_url,
    p.thumbnail_data_url,
    p.status,
    p.photo_state,
    p.media_type,
    p.caption,
    p.storage_path,
    p.comment_count,
    p.reaction_count,
    p.created_at,
    u.username,
    u.display_name,
    u.profile_photo_path,
    u.name_color
  FROM photos p
  INNER JOIN users u ON u.id = p.user_id
  INNER JOIN friendships f ON (
    (f.user1_id = p_user_id AND f.user2_id = p.user_id)
    OR (f.user2_id = p_user_id AND f.user1_id = p.user_id)
  )
  WHERE f.status = 'accepted'
    AND p.status = 'revealed'
    AND p.photo_state = 'journal'
    AND p.deleted_at IS NULL
    AND p.image_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = p_user_id)
    )
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;
```

### PowerSync Connector uploadData Implementation
```typescript
// Source: PowerSync docs pattern + project schema
async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
  const transaction = await database.getNextCrudTransaction();
  if (!transaction) return;

  try {
    for (const op of transaction.crud) {
      const table = op.table;
      const id = op.id;

      if (op.op === 'PUT') {
        // Upsert to Supabase
        const { error } = await supabase
          .from(table)
          .upsert({ id, ...op.opData });
        if (error) throw error;
      } else if (op.op === 'PATCH') {
        const { error } = await supabase
          .from(table)
          .update(op.opData)
          .eq('id', id);
        if (error) throw error;
      } else if (op.op === 'DELETE') {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
    }
    await transaction.complete();
  } catch (error) {
    console.error('uploadData error:', error);
    throw error; // PowerSync will retry
  }
}
```

### Batch Reveal Logic
```typescript
// Source: Designed from CONTEXT.md + existing darkroomService.js pattern
export const checkAndRevealPhotos = async (userId: string): Promise<number> => {
  const db = getPowerSyncDb();
  if (!db) throw new Error('PowerSync not available');

  const now = new Date().toISOString();

  // Find developing photos past their reveal_at
  const readyPhotos = await db.getAll(
    `SELECT id FROM photos
     WHERE user_id = ? AND status = 'developing' AND reveal_at <= ? AND deleted_at IS NULL`,
    [userId, now]
  );

  if (readyPhotos.length === 0) return 0;

  // Batch update all ready photos to revealed
  const ids = readyPhotos.map((p: any) => p.id);
  for (const id of ids) {
    await db.execute(
      `UPDATE photos SET status = 'revealed' WHERE id = ?`,
      [id]
    );
  }

  return ids.length;
};

export const getNextRevealTime = async (userId: string): Promise<string | null> => {
  const db = getPowerSyncDb();
  if (!db) return null;

  const result = await db.get(
    `SELECT MIN(reveal_at) as next_reveal FROM photos
     WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL`,
    [userId]
  );

  return result?.next_reveal ?? null;
};
```

### calculateNextRevealTime with Batch Coordination
```typescript
export const calculateBatchRevealAt = async (userId: string): Promise<string> => {
  const db = getPowerSyncDb();
  if (!db) throw new Error('PowerSync not available');

  // Check if there are existing developing photos with a future reveal_at
  const existing = await db.get(
    `SELECT MIN(reveal_at) as batch_reveal_at FROM photos
     WHERE user_id = ? AND status = 'developing' AND deleted_at IS NULL AND reveal_at > ?`,
    [userId, new Date().toISOString()]
  );

  if (existing?.batch_reveal_at) {
    // Join the existing batch
    return existing.batch_reveal_at;
  }

  // No existing batch -- create new random 0-5 minute window
  const randomMs = Math.random() * 5 * 60 * 1000;
  const revealAt = new Date(Date.now() + randomMs);
  return revealAt.toISOString();
};
```

### Profile Service with TanStack Pattern
```typescript
// src/services/supabase/profileService.ts
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  profilePhotoPath: string | null;
  selects: string[];
  song: Record<string, any> | null;
  friendCount: number;
  nameColor: string | null;
  dailyPhotoCount: number;
  lastPhotoDate: string | null;
  profileSetupCompleted: boolean;
  createdAt: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    displayName: data.display_name,
    username: data.username,
    bio: data.bio,
    profilePhotoPath: data.profile_photo_path,
    selects: data.selects ?? [],
    song: data.song,
    friendCount: data.friend_count,
    nameColor: data.name_color,
    dailyPhotoCount: data.daily_photo_count,
    lastPhotoDate: data.last_photo_date,
    profileSetupCompleted: data.profile_setup_completed,
    createdAt: data.created_at,
  };
};

export const checkUsernameAvailability = async (
  username: string,
  currentUserId?: string,
): Promise<boolean> => {
  const normalized = username.toLowerCase().trim();

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', normalized)
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) return true;
  if (currentUserId && data[0].id === currentUserId) return true;
  return false;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `darkrooms/` Firestore collection | `reveal_at` column on `photos` table | Phase 15 (this phase) | Eliminates extra document reads; MIN(reveal_at) replaces darkroom document |
| Firestore `in` queries with 30-ID chunking | Single SQL JOIN via `get_feed` RPC | Phase 15 (this phase) | Feed loads in 1 query instead of N chunks; no friend count limit |
| `{ success, error }` return pattern | Throw-on-error (TanStack catches) | Phase 15 (this phase) | Cleaner code; TanStack Query handles error states automatically |
| Upload + Firestore write as atomic pair | PowerSync local write (instant) + async upload | Phase 13/15 | Photos appear in darkroom before upload completes; works offline |
| Firestore `onSnapshot` for real-time feed | PowerSync reactive queries (own photos) + TanStack SWR (feed) | Phase 15 (this phase) | Offline support for own photos; stale-while-revalidate for feed |

## Open Questions

1. **PowerSync uploadData implementation completeness**
   - What we know: The connector's `uploadData` in `connector.ts` is a stub. It must handle PUT/PATCH/DELETE operations for the `photos` table.
   - What's unclear: Whether Phase 14 was supposed to implement this or if it's Phase 15 scope. The stub just logs a warning and completes the transaction.
   - Recommendation: Implement `uploadData` as part of Phase 15 since photo writes are the first real use of PowerSync synced writes. Critical path.

2. **Reaction count increment strategy**
   - What we know: `photo_reactions` table is not PowerSync-synced. Reactions go via TanStack mutations. The `photos.reaction_count` column exists.
   - What's unclear: Whether to use a database trigger on `photo_reactions` INSERT/DELETE to auto-update `photos.reaction_count`, or handle it in the service layer with an explicit UPDATE.
   - Recommendation: Use a database trigger. It's atomic, handles concurrent reactions correctly, and doesn't require the client to know about the denormalized count. Create a migration: `CREATE TRIGGER update_reaction_count AFTER INSERT OR DELETE ON photo_reactions ...`.

3. **Query key factory pattern**
   - What we know: CONTEXT.md references `src/lib/queryKeys.ts` as a Phase 14 deliverable. But the file doesn't exist yet.
   - What's unclear: Whether Phase 14 has been implemented or if the query key factory needs to be created in Phase 15.
   - Recommendation: Create the query key factory as part of Phase 15 if it doesn't exist by the time this phase starts. Define keys for feed, photos, profile, reactions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + jest-expo 54.0.17 |
| Config file | `package.json` (jest config section) |
| Quick run command | `npm test -- --testPathPattern=services` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | Photo create via PowerSync local write | unit | `npm test -- __tests__/services/photoService.test.ts -t "createPhotoRecord"` | No - Wave 0 |
| CORE-01 | Photo triage (journal/archive) | unit | `npm test -- __tests__/services/photoService.test.ts -t "triagePhoto"` | No - Wave 0 |
| CORE-01 | Batch triage multiple photos | unit | `npm test -- __tests__/services/photoService.test.ts -t "batchTriage"` | No - Wave 0 |
| CORE-01 | Soft delete photo | unit | `npm test -- __tests__/services/photoService.test.ts -t "softDelete"` | No - Wave 0 |
| CORE-02 | Feed RPC returns joined photo+user data | unit | `npm test -- __tests__/services/feedService.test.ts -t "getFeed"` | No - Wave 0 |
| CORE-02 | Feed pagination with cursor | unit | `npm test -- __tests__/services/feedService.test.ts -t "pagination"` | No - Wave 0 |
| CORE-03 | Reveal check finds ready photos | unit | `npm test -- __tests__/services/darkroomService.test.ts -t "checkAndReveal"` | No - Wave 0 |
| CORE-03 | Batch reveal_at coordination | unit | `npm test -- __tests__/services/darkroomService.test.ts -t "calculateBatchRevealAt"` | No - Wave 0 |
| CORE-07 | Profile CRUD | unit | `npm test -- __tests__/services/profileService.test.ts -t "getUserProfile"` | No - Wave 0 |
| CORE-07 | Username availability check | unit | `npm test -- __tests__/services/profileService.test.ts -t "checkUsername"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=services/supabase`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/services/photoService.test.ts` -- covers CORE-01 (PowerSync mock needed)
- [ ] `__tests__/services/feedService.test.ts` -- covers CORE-02 (Supabase RPC mock needed)
- [ ] `__tests__/services/darkroomService.test.ts` -- covers CORE-03 (PowerSync mock needed)
- [ ] `__tests__/services/profileService.test.ts` -- covers CORE-07 (Supabase mock needed)
- [ ] PowerSync mock setup: `__tests__/setup/powersync.mock.ts` -- shared mock for `getPowerSyncDb()`
- [ ] Supabase mock update: Extend existing `__supabaseMocks` pattern for RPC calls

## Sources

### Primary (HIGH confidence)
- `src/lib/powersync/schema.ts` -- PowerSync photos table schema with all columns verified
- `src/lib/powersync/connector.ts` -- Connector stub confirmed (uploadData not implemented)
- `src/services/uploadQueueService.ts` -- Upload queue writes to PowerSync local-only table, uploads to Supabase Storage
- `supabase/migrations/20260323000002_create_photos.sql` -- Photos table DDL with indexes and RLS
- `supabase/migrations/20260323000001_create_users.sql` -- Users table DDL with all profile fields
- `supabase/migrations/20260323000007_create_rls_policies.sql` -- RLS policies for photos, reactions, users
- `src/services/firebase/photoService.js` -- 23 exports mapped for rewrite
- `src/services/firebase/feedService.js` -- 10 exports mapped for rewrite
- `src/services/firebase/darkroomService.js` -- 6 exports + calculateNextRevealTime logic
- `src/services/firebase/userService.js` -- 8 exports mapped for rewrite
- `src/hooks/useFeedPhotos.js` -- Stories-style grouping logic to preserve
- `src/hooks/useDarkroom.js` -- Countdown timer, reveal, triage logic to rewrite
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` -- All locked decisions

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` -- Package versions verified against npm
- `.planning/research/ARCHITECTURE.md` -- Strangler Fig pattern, data flow changes

### Tertiary (LOW confidence)
- PowerSync uploadData pattern -- based on PowerSync documentation patterns; exact error handling for production needs validation against PowerSync SDK behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already installed and versions verified in prior phases
- Architecture: HIGH - patterns directly derived from existing code + locked CONTEXT.md decisions
- Pitfalls: HIGH - identified from actual code gaps (connector stub, upload queue missing photo update)
- Feed RPC SQL: MEDIUM - SQL is well-understood but exact performance with block filtering subquery needs production validation

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no external dependencies changing)
