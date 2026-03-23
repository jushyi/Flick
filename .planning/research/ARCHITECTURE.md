# Architecture Patterns

**Domain:** Firebase-to-Supabase migration for React Native social media app
**Researched:** 2026-03-23

## Recommended Architecture

### Dual-Backend Coexistence Pattern (Strangler Fig)

The migration uses a **Strangler Fig** pattern: new Supabase services wrap the existing Firebase services, replacing them one-by-one while both backends run simultaneously. No big-bang cutover. Each service is migrated, tested, and shipped independently.

```
                    BEFORE                              AFTER
                    ------                              -----
  Hook/Screen                                Hook/Screen
      |                                          |
  firebaseService.js              supabaseService.ts (new interface, same shape)
      |                                          |
  Firestore/Storage               Supabase Postgres / Storage / PowerSync
```

The critical insight: **hooks and screens never import from Firebase directly** -- they go through the service layer in `src/services/firebase/`. This existing abstraction is the migration's greatest asset. Hooks call `feedService.getFeedPhotos()`, not `getDocs(query(...))`. Replace the service implementation, hooks stay unchanged.

### Architecture Layers (Post-Migration)

```
+-----------------------------------------------------------+
|                    Screens / Components                     |
+-----------------------------------------------------------+
|                    Custom Hooks Layer                       |
|  (useCamera, useDarkroom, useFeedPhotos, useMessages...)   |
+-----------------------------------------------------------+
|                    Context Providers                        |
|  (AuthContext, PhotoDetailContext, PhoneAuthContext)         |
+-----------------------------------------------------------+
|                Service Layer (NEW: TypeScript)              |
|  src/services/supabase/*.ts  (same export signatures)      |
+-----------------------------------------------------------+
|              Data Access / Sync Layer                       |
|  PowerSync (local SQLite) <-> Supabase Postgres            |
|  Supabase Storage (photos, snaps, profiles)                |
|  Supabase Auth (phone OTP via Twilio)                      |
+-----------------------------------------------------------+
|              Server-Side Logic                              |
|  Supabase Edge Functions (Deno) + DB triggers + pg_cron    |
+-----------------------------------------------------------+
```

## Component Boundaries

### What Changes

| Component | Current | New | Migration Effort |
|-----------|---------|-----|-----------------|
| **Service layer** | `src/services/firebase/*.js` (20 files, ~7,800 LOC) | `src/services/supabase/*.ts` (same exports, SQL-backed) | HIGH -- complete rewrite of internals |
| **Auth context** | `AuthContext.js` using RN Firebase Auth | `AuthContext.ts` using `@supabase/supabase-js` auth | HIGH -- different auth state model |
| **Upload queue** | `uploadQueueService.js` using AsyncStorage + Firebase Storage | `uploadQueueService.ts` using PowerSync local DB + Supabase Storage | HIGH -- fundamental storage change |
| **Cloud Functions** | `functions/index.js` (2,616 LOC, 25+ exports) | Edge Functions + DB triggers + pg_cron | HIGH -- complete rewrite |
| **Realtime listeners** | Firestore `onSnapshot` (8 listener locations) | Supabase Realtime channels OR PowerSync reactive queries | MEDIUM -- different subscription API |
| **Storage service** | Firebase Storage with signed URLs | Supabase Storage with signed URLs | MEDIUM -- similar concepts, different API |
| **Phone auth** | RN Firebase Auth (native SDK, reCAPTCHA) | Supabase Auth phone OTP (JS SDK, Twilio) | MEDIUM -- simpler flow actually |

### What Stays Unchanged

| Component | Why It Stays |
|-----------|-------------|
| **Custom hooks** (`src/hooks/*.js`) | Consume service layer; no direct Firebase imports (except two leaks noted below) |
| **Screens** (`src/screens/*.js`) | Consume hooks and context; zero Firebase coupling |
| **Components** (`src/components/*.js`) | Pure UI; no data layer coupling |
| **Navigation structure** | Completely independent of backend |
| **Non-Firebase services** | `iapService`, `audioPlayer`, `iTunesService`, `liveActivityService`, `secureStorageService` -- untouched |
| **Context providers** (mostly) | `PhotoDetailContext`, `ThemeContext`, `VideoMuteContext` -- no Firebase dependency |

### Hooks With Firebase Leakage (Must Fix)

Two hooks import Firebase directly instead of going through the service layer. These must be refactored during migration:

1. **`useConversation.js` (line 19)** -- imports `onSnapshot` from `@react-native-firebase/firestore` directly for conversation document listening. Must move to service layer subscription.
2. **`useCameraBase.js`** -- imports Firestore directly for photo document creation. Must route through service layer.

## Service Layer Restructuring Strategy

### Phase 1: Create Adapter Interface

Before rewriting any service, establish a **TypeScript interface** that both Firebase and Supabase implementations can satisfy. This is the migration's foundation.

```typescript
// src/services/types/photoService.types.ts
export interface PhotoServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface IPhotoService {
  createPhoto(userId: string, photoUri: string, options?: CreatePhotoOptions): Promise<PhotoServiceResult<PhotoDoc>>;
  getUserPhotos(userId: string, options?: GetPhotosOptions): Promise<PhotoServiceResult<PhotoDoc[]>>;
  getDevelopingPhotos(userId: string): Promise<PhotoServiceResult<PhotoDoc[]>>;
  revealPhotos(userId: string): Promise<PhotoServiceResult<{ revealedCount: number }>>;
  triagePhoto(photoId: string, state: 'journal' | 'archive'): Promise<PhotoServiceResult>;
  // ... etc
}
```

### Phase 2: Re-Export Through Barrel

The barrel file `src/services/firebase/index.js` already exports all public functions. Create a parallel barrel:

```typescript
// src/services/index.ts -- THE NEW ENTRY POINT
// During migration, this switches between implementations:

// OPTION A: Firebase (current)
export { getFeedPhotos, subscribeFeedPhotos } from './firebase/feedService';

// OPTION B: Supabase (migrated)
// export { getFeedPhotos, subscribeFeedPhotos } from './supabase/feedService';
```

This lets you flip individual services without touching any consumers. Toggle one export line, the entire app uses the new backend for that feature.

### Phase 3: Implement Supabase Services

Each service file gets a TypeScript counterpart in `src/services/supabase/`:

```
src/services/
  firebase/           # Existing (untouched during migration)
    photoService.js
    feedService.js
    ...
  supabase/           # New (TypeScript from day one)
    photoService.ts
    feedService.ts
    ...
    client.ts         # Supabase client singleton
    powerSync.ts      # PowerSync setup & sync rules
  types/              # Shared interfaces
    photo.types.ts
    feed.types.ts
    ...
  index.ts            # Barrel that chooses implementation
```

### Phase 4: Swap One Service at a Time

For each service migration:
1. Write the Supabase implementation matching the existing export signatures
2. Update the barrel to point to the new implementation
3. Test the affected screens/hooks
4. Ship via OTA update
5. Monitor for 24-48 hours
6. Move to next service

## Data Flow Changes

### Current: Firestore-Centric

```
Camera Capture
  -> uploadQueueService (AsyncStorage persistence)
  -> storageService.uploadPhoto (Firebase Storage)
  -> photoService.createPhoto (Firestore doc)
  -> darkroomService.ensureDarkroomInitialized (Firestore doc)
  -> [Wait for reveal timer]
  -> processDarkroomReveals (Cloud Function, 2min cron)
  -> feedService.subscribeFeedPhotos (onSnapshot listener)
  -> FeedScreen renders
```

### New: Supabase + PowerSync

```
Camera Capture
  -> PowerSync local SQLite write (instant, offline-capable)
      { id, user_id, status: 'developing', local_uri, image_url: null }
  -> Photo visible in YOUR darkroom immediately (local query)
  -> Background upload: Supabase Storage (when online)
  -> Update record: image_url = uploaded URL
  -> PowerSync syncs to Supabase Postgres
  -> [Reveal timer via pg_cron or Edge Function]
  -> DB trigger updates status to 'revealed'
  -> PowerSync syncs revealed photos to friends' devices
  -> Feed renders from local SQLite (reactive query)
```

Key differences:
- **Offline-first**: Photos exist locally before upload. Current system loses photos after 3 retries.
- **No signed URL complexity**: Supabase Storage can use public buckets with UUID filenames (equally secure, simpler) or transform-based URLs.
- **No chunked queries**: SQL `WHERE user_id IN (...)` has no 30-item limit. Feed query goes from N Firestore chunks to 1 SQL query.
- **Server timestamps**: PowerSync local writes use device clock. Ordering must use server-assigned timestamps post-sync, not local timestamps.

### Realtime Subscription Changes

| Current (Firestore onSnapshot) | New (Options) |
|-------------------------------|---------------|
| `feedService.subscribeFeedPhotos` | PowerSync reactive query (preferred -- works offline) |
| `commentService.subscribeToComments` | Supabase Realtime channel on `comments` table |
| `messageService.subscribeToConversations` | Supabase Realtime channel on `conversations` table |
| `messageService.subscribeToMessages` | Supabase Realtime channel on `messages` table |
| `friendshipService` listener | PowerSync reactive query |
| `streakService.subscribeToStreak` | PowerSync reactive query |
| `photoService` listener (darkroom) | PowerSync reactive query (critical for offline darkroom) |

**Recommendation**: Use PowerSync reactive queries for data that benefits from offline access (feed, darkroom, friendships, streaks). Use Supabase Realtime channels for data that is inherently online-only (messages, comments -- you cannot comment offline anyway).

## Cloud Functions Replacement Map

### Firestore Triggers -> Database Triggers + Edge Functions

| Current Function | Trigger | Replacement | Rationale |
|-----------------|---------|-------------|-----------|
| `sendPhotoRevealNotification` | onDocumentWritten (photos) | DB trigger on `photos.status` update -> Edge Function webhook | DB trigger detects change, calls Edge Function for push |
| `sendFriendRequestNotification` | onDocumentCreated (friendships) | DB trigger on `friendships` INSERT | Same pattern |
| `sendFriendAcceptedNotification` | onDocumentWritten (friendships) | DB trigger on `friendships.status` UPDATE | Same pattern |
| `sendReactionNotification` | onDocumentWritten (photos) | DB trigger on `photo_reactions` INSERT -> Edge Function with batching | Needs batching logic in Edge Function |
| `sendTaggedPhotoNotification` | onDocumentWritten (photos) | DB trigger on `photo_tags` INSERT -> Edge Function with debounce | 30s debounce window |
| `sendCommentNotification` | onDocumentCreated (comments) | DB trigger on `comments` INSERT -> Edge Function | Straightforward |
| `incrementFriendCountOnAccept` | onDocumentWritten (friendships) | DB trigger with SQL UPDATE (no Edge Function needed) | SQL can do this atomically inline |
| `decrementFriendCountOnRemove` | onDocumentDeleted (friendships) | DB trigger with SQL UPDATE | Same -- pure SQL |
| `onReportCreated` | onDocumentCreated (reports) | DB trigger -> Edge Function (email via Nodemailer) | Needs network access for email |
| `onSupportRequestCreated` | onDocumentCreated (supportRequests) | DB trigger -> Edge Function (email) | Same |
| `onPhotoSoftDeleted` | onDocumentWritten (photos) | DB trigger on `photos.deleted_at` UPDATE | Clean up related data |
| `onNewMessage` | onDocumentCreated (messages) | DB trigger on `messages` INSERT -> Edge Function | Central routing hub -- most complex |
| `onSnapViewed` | onDocumentWritten (messages) | DB trigger on `messages.viewed_at` UPDATE -> Edge Function | Storage cleanup |

### Scheduled Functions -> pg_cron

| Current Function | Schedule | Replacement |
|-----------------|----------|-------------|
| `processDarkroomReveals` | Every 2 min | pg_cron calling a DB function that updates `photos.status` where `reveal_at <= now()` |
| `checkPushReceipts` | Every 5 min | pg_cron -> Edge Function (needs Expo Push API call) |
| `cleanupOldNotifications` | Daily | pg_cron DELETE with 30-day cutoff (pure SQL) |
| `sendDeletionReminderNotification` | Daily | pg_cron -> Edge Function |
| `processScheduledDeletions` | Daily | pg_cron -> Edge Function (cascading deletes + storage cleanup) |
| `processScheduledPhotoDeletions` | Daily | pg_cron -> Edge Function (storage cleanup) |
| `cleanupExpiredSnaps` | Every 15 min | pg_cron -> Edge Function (storage cleanup) |
| `expirePinnedSnapNotifications` | Every 5 min | pg_cron calling DB function (pure SQL update) |
| `processStreakExpiry` | Every hour | pg_cron -> Edge Function (needs push notification) |

### Callable Functions -> Edge Functions (HTTP)

| Current Function | Replacement |
|-----------------|-------------|
| `getSignedPhotoUrl` | Edge Function OR Supabase Storage `createSignedUrl` client-side (simpler) |
| `getSignedSnapUrl` | Edge Function OR client-side signed URL |
| `deleteUserAccount` | Edge Function (complex cascading delete) |
| `getMutualFriendSuggestions` | Edge Function OR DB function (SQL is actually better for this) |
| `getMutualFriendsForComments` | DB function (pure SQL join -- no Edge Function needed) |
| `scheduleUserAccountDeletion` | Edge Function |
| `cancelUserAccountDeletion` | Edge Function |
| `unsendMessage` | Edge Function (needs auth verification + cascade) |
| `addTaggedPhotoToFeed` | Edge Function |
| `backfillFriendCounts` | DB function (one-time admin operation) |
| `sendBatchedNotification` | Edge Function (called by pg_cron or DB trigger) |

## Migration Build Order

The order respects data dependencies: auth must exist before anything else, storage before photos, photos before feed.

### Phase 0: Foundation (no backend changes yet)
**Goal:** Set up infrastructure, create TypeScript interfaces, establish the barrel-switch pattern.

1. Set up Supabase project (dev)
2. Design PostgreSQL schema (normalize Firestore patterns)
3. Create TypeScript interfaces for all service contracts
4. Create `src/services/supabase/client.ts` (Supabase client singleton)
5. Create `src/services/index.ts` barrel that initially re-exports from `firebase/`
6. Update all consumer imports to use the new barrel (not `firebase/` directly)

**Dependency:** None. This is pure setup.

### Phase 1: Auth Migration
**Goal:** Users can sign in via Supabase Auth with phone OTP.

1. Configure Supabase Auth with Twilio phone provider
2. Write `src/services/supabase/phoneAuthService.ts`
3. Rewrite `AuthContext` to use Supabase session management
4. Handle auth state persistence (`@supabase/supabase-js` uses AsyncStorage by default)
5. Data migration: Import Firebase Auth users into Supabase Auth (preserve UIDs)

**Dependency:** Phase 0. Everything depends on auth.
**Risk:** UID preservation is non-negotiable. Supabase Admin API supports setting custom UUIDs during user import.

### Phase 2: Storage Migration
**Goal:** Photos upload to and serve from Supabase Storage.

1. Create Supabase Storage buckets: `photos`, `snaps`, `profiles`
2. Configure bucket policies (RLS or public with UUID paths)
3. Write `src/services/supabase/storageService.ts`
4. Migrate `signedUrlService` (may become unnecessary with public buckets + UUID paths)
5. Data migration: Copy files from Firebase Storage to Supabase Storage

**Dependency:** Phase 1 (auth required for RLS policies).
**Note:** Old Firebase Storage URLs continue working. No need to update existing photo URLs immediately. Can do lazy migration (re-upload on next access).

### Phase 3: Core Data Migration (Users, Photos, Darkroom)
**Goal:** Core data reads/writes go through Supabase.

1. Set up PowerSync with Supabase connector
2. Define sync rules (user data, photos, darkroom state)
3. Write `src/services/supabase/userService.ts`
4. Write `src/services/supabase/photoService.ts`
5. Write `src/services/supabase/darkroomService.ts`
6. Rewrite `uploadQueueService.ts` for PowerSync local writes + Supabase Storage uploads
7. Set up `processDarkroomReveals` as pg_cron job
8. Data migration: Export Firestore users/photos/darkrooms -> PostgreSQL

**Dependency:** Phase 1 + 2. Photos need auth + storage.
**Risk:** Photo upload race condition (metadata syncs before file upload). Handle with `image_url IS NULL` check in feed queries.

### Phase 4: Social Graph (Friendships, Blocks, Reports)
**Goal:** Friend relationships work on Supabase.

1. Write `src/services/supabase/friendshipService.ts`
2. Write `src/services/supabase/blockService.ts`
3. Write `src/services/supabase/reportService.ts`
4. Write `src/services/supabase/contactSyncService.ts`
5. Set up friend count triggers (pure SQL, no Edge Function needed)
6. Data migration: Export friendships/blocks/reports

**Dependency:** Phase 3 (friend queries join with users table).

### Phase 5: Feed + Comments + Albums
**Goal:** Feed renders from Supabase data.

1. Write `src/services/supabase/feedService.ts` (biggest win -- SQL JOINs replace chunked queries)
2. Write `src/services/supabase/commentService.ts`
3. Write `src/services/supabase/albumService.ts`
4. Write `src/services/supabase/monthlyAlbumService.ts`
5. Write `src/services/supabase/viewedStoriesService.ts`
6. Set up PowerSync reactive queries for feed/comments

**Dependency:** Phase 3 + 4 (feed needs photos + friendships).

### Phase 6: Messaging + Snaps + Streaks
**Goal:** DM system runs on Supabase.

1. Write `src/services/supabase/messageService.ts`
2. Write `src/services/supabase/snapService.ts`
3. Write `src/services/supabase/streakService.ts`
4. Write `src/services/supabase/photoTagService.ts`
5. Set up Supabase Realtime channels for message subscriptions
6. Set up streak expiry pg_cron job
7. Set up snap cleanup pg_cron job
8. Data migration: Export conversations/messages/streaks

**Dependency:** Phase 4 (messaging requires friendship data).

### Phase 7: Notifications + Edge Functions
**Goal:** Push notifications fire from Supabase backend.

1. Write notification Edge Functions (the `onNewMessage` hub is the most complex)
2. Set up DB triggers for all notification-producing events
3. Write `src/services/supabase/notificationService.ts`
4. Implement notification batching (replace Cloud Tasks with Edge Function + pg_cron)
5. Set up all remaining pg_cron jobs (cleanup, deletion processing, receipts)
6. Write account deletion Edge Functions

**Dependency:** Phase 3-6 (triggers depend on tables existing).

### Phase 8: Cleanup + TypeScript Sweep
**Goal:** Remove Firebase, complete TypeScript migration.

1. Remove all `@react-native-firebase/*` packages (requires new native build via EAS)
2. Remove `firebase-admin`, Cloud Functions code
3. Remove Firebase config files
4. Convert remaining JS files to TypeScript (hooks, contexts, components, screens)
5. Clean up dead code

**Dependency:** All phases complete.

## TypeScript Migration Strategy

TypeScript conversion happens **organically with each phase**, not as a separate effort:

- Service files are written in TypeScript from the start (Phase 0+)
- When a hook is touched to update its service imports, convert it to TypeScript
- When a context is rewritten (AuthContext in Phase 1), write it in TypeScript
- After all phases, do a sweep of remaining JS files (screens, components, utils)

Priority order for the sweep:
1. `src/services/` -- already done during migration
2. `src/context/` -- already done during migration
3. `src/hooks/` -- small files, high value
4. `src/utils/` -- small files, easy wins
5. `src/components/` -- larger effort, lower urgency
6. `src/screens/` -- largest files, last

## Patterns to Follow

### Pattern 1: Service Contract Preservation

**What:** New Supabase services must return the exact same `{ success, error, data }` shape as existing Firebase services.

**When:** Every service rewrite.

**Why:** This is what makes the barrel-switch pattern work. If the return shape changes, every consumer breaks.

```typescript
// src/services/supabase/photoService.ts
export const createPhoto = async (
  userId: string,
  photoUri: string,
  options: CreatePhotoOptions = {}
): Promise<{ success: boolean; error?: string; photoId?: string }> => {
  try {
    // Supabase implementation...
    const { data, error } = await supabase
      .from('photos')
      .insert({ user_id: userId, status: 'developing', /* ... */ })
      .select('id')
      .single();

    if (error) throw error;
    return { success: true, photoId: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

### Pattern 2: PowerSync Reactive Queries for Offline-Relevant Data

**What:** Use PowerSync's `useQuery` hook (or `watch()`) for data that should work offline. Use Supabase Realtime only for inherently-online data.

**When:** Feed, darkroom, user profiles, friendships, streaks.

```typescript
// In a hook, using PowerSync reactive query
import { useQuery } from '@powersync/react-native';

const useDarkroomPhotos = (userId: string) => {
  const { data: photos, isLoading } = useQuery(
    `SELECT * FROM photos WHERE user_id = ? AND status IN ('developing', 'revealed') ORDER BY created_at DESC`,
    [userId]
  );
  return { photos, isLoading };
};
```

### Pattern 3: PowerSync Upload Queue

**What:** Replace AsyncStorage-based upload queue with PowerSync local writes.

**When:** Photo capture, snap sending.

```typescript
// Camera capture -> immediate local write
const capturePhoto = async (userId: string, localUri: string) => {
  const photoId = generateUUID();

  // Write to local PowerSync DB (instant, works offline)
  await db.execute(
    `INSERT INTO photos (id, user_id, status, local_uri, image_url, created_at)
     VALUES (?, ?, 'developing', ?, NULL, datetime('now'))`,
    [photoId, userId, localUri]
  );

  // Queue background upload (PowerSync handles sync when online)
  backgroundUpload(photoId, localUri);
};
```

### Pattern 4: Edge Function Notification Hub

**What:** A single Edge Function that handles push notification dispatch, called by DB triggers via `pg_net`.

**When:** Any event that produces a push notification.

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { Expo } from 'expo-server-sdk';

serve(async (req) => {
  const { type, payload } = await req.json();

  switch (type) {
    case 'photo_reveal':
      return handlePhotoReveal(payload);
    case 'friend_request':
      return handleFriendRequest(payload);
    case 'new_message':
      return handleNewMessage(payload);
    // ... etc
  }
});
```

### Pattern 5: Dual-Backend Feature Flags (During Migration)

**What:** The barrel file acts as the migration switch, but for complex cases (e.g., auth), use a simple config flag.

**When:** During the transition period when some features run on Firebase and others on Supabase.

```typescript
// src/config/backend.ts
export const BACKEND = {
  auth: 'supabase',       // Phase 1 complete
  storage: 'supabase',    // Phase 2 complete
  photos: 'supabase',     // Phase 3 complete
  friendships: 'firebase', // Not yet migrated
  feed: 'firebase',       // Not yet migrated
  messages: 'firebase',   // Not yet migrated
} as const;
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Supabase Client in Components/Screens
**What:** Importing `supabase` client directly in screens or components.
**Why bad:** Couples UI to backend. Makes testing impossible. Breaks the service layer pattern that currently exists.
**Instead:** All Supabase calls go through `src/services/supabase/*.ts`. Screens/components only import from hooks and context.

### Anti-Pattern 2: Migrating Everything at Once
**What:** Rewriting all 20 service files before shipping any of them.
**Why bad:** 35-47 day timeline with no intermediate verification. Bugs compound. Impossible to bisect regressions.
**Instead:** Ship each service migration independently. Feed from Supabase while messaging still runs on Firebase. The barrel-switch pattern supports this.

### Anti-Pattern 3: Storing Supabase Storage URLs Directly
**What:** Saving the full `https://[project].supabase.co/storage/v1/...` URL in the database.
**Why bad:** If you change Supabase projects, custom domains, or CDN config, every URL breaks.
**Instead:** Store the storage path (`photos/userId/photoId.jpg`). Generate the full URL at read time using the Supabase client.

### Anti-Pattern 4: Using Supabase Realtime for Everything
**What:** Setting up Realtime channels for feed, darkroom, friendships, etc.
**Why bad:** Supabase Realtime has no offline support. PowerSync provides the same reactivity PLUS offline access. Using Realtime for feed means the feed is blank when offline.
**Instead:** PowerSync reactive queries for anything that should work offline. Supabase Realtime only for inherently-online features (active conversation messages).

### Anti-Pattern 5: Local Timestamps for Ordering
**What:** Using `Date.now()` or `new Date()` for `created_at` in PowerSync local writes.
**Why bad:** Device clocks can be wrong. Two users' photos could be misordered.
**Instead:** Use local timestamps for immediate display, but let the server assign authoritative timestamps via `DEFAULT NOW()`. PowerSync sync will update the record with the server timestamp. UI should re-sort after sync.

### Anti-Pattern 6: Removing Firebase Before Full Verification
**What:** Uninstalling `@react-native-firebase/*` packages as soon as Supabase services are written.
**Why bad:** Removing RN Firebase packages requires a new native build (EAS Build). If something breaks, you cannot roll back via OTA -- you need another native build.
**Instead:** Keep Firebase packages installed until ALL services are verified on Supabase. Do one final native build to remove them.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Feed query | Single SQL JOIN, <50ms | Add indexes on (user_id, status, created_at), still fast | Partition photos table by created_at month, connection pooling via PgBouncer |
| Photo storage | Single Supabase Storage bucket | CDN in front of storage (Supabase includes this) | Consider dedicated CDN (Cloudflare R2 or Bunny) |
| Realtime channels | Default Supabase plan handles easily | May need to upgrade Supabase plan for concurrent connections | Evaluate dedicated Realtime infra or polling fallback |
| PowerSync sync | Starter plan ($49/mo) handles easily | May need PowerSync growth plan | PowerSync scales horizontally; evaluate costs |
| Push notifications | Single Edge Function instance | Edge Function auto-scales | Add queue (Supabase Queues or BullMQ) to handle burst |
| pg_cron jobs | Fine as-is | Monitor execution time; batch operations | Split large batch jobs into chunked processing |

## PostgreSQL Schema Design (Key Tables)

```sql
-- Users (preserves Firebase Auth UIDs)
CREATE TABLE users (
  id UUID PRIMARY KEY,  -- Firebase Auth UID imported as-is
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  profile_photo_path TEXT,  -- Storage path, not URL
  name_color TEXT,
  friend_count INTEGER DEFAULT 0,
  daily_photo_count INTEGER DEFAULT 0,
  last_photo_date DATE,
  fcm_token TEXT,
  profile_setup_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos (denormalized from Firestore)
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT,          -- NULL until upload completes
  local_uri TEXT,          -- Client-side only (PowerSync)
  thumbnail_data_url TEXT, -- Base64 progressive loading placeholder
  status TEXT NOT NULL DEFAULT 'developing',  -- developing, revealed
  photo_state TEXT,        -- NULL, journal, archive
  reveal_at TIMESTAMPTZ,   -- When to reveal
  storage_path TEXT,       -- Supabase Storage path
  deleted_at TIMESTAMPTZ,  -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_photos_user_status ON photos(user_id, status);
CREATE INDEX idx_photos_reveal ON photos(status, reveal_at) WHERE status = 'developing';

-- Photo reactions (normalized from nested Firestore map)
CREATE TABLE photo_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, user_id, emoji)
);

-- Photo tags (normalized from array)
CREATE TABLE photo_tags (
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, user_id)
);

-- Comments (moved from subcollection to table)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_photo ON comments(photo_id, created_at);

-- Comment likes (was nested subcollection)
CREATE TABLE comment_likes (
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

-- Friendships
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);
CREATE INDEX idx_friendships_user1 ON friendships(user1_id, status);
CREATE INDEX idx_friendships_user2 ON friendships(user2_id, status);

-- Conversations (DMs)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  participant2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_type TEXT,
  unread_count_p1 INTEGER DEFAULT 0,
  unread_count_p2 INTEGER DEFAULT 0,
  deleted_at_p1 TIMESTAMPTZ,
  deleted_at_p2 TIMESTAMPTZ,
  UNIQUE(participant1_id, participant2_id),
  CHECK (participant1_id < participant2_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  gif_url TEXT,
  reply_to_id UUID REFERENCES messages(id),
  snap_storage_path TEXT,
  snap_viewed_at TIMESTAMPTZ,
  tagged_photo_id UUID REFERENCES photos(id),
  unsent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);

-- Streaks
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_count INTEGER DEFAULT 0,
  last_snap_at_user1 TIMESTAMPTZ,
  last_snap_at_user2 TIMESTAMPTZ,
  last_mutual_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  warning_sent BOOLEAN DEFAULT FALSE,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- Albums
CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_photo_id UUID REFERENCES photos(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Album photos (junction table, replaces photoIds array)
CREATE TABLE album_photos (
  album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (album_id, photo_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- Blocks
CREATE TABLE blocks (
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Viewed photos (was subcollection)
CREATE TABLE viewed_photos (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, photo_id)
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support requests
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Sources

- [Supabase + Expo React Native Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase Auth with React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [PowerSync + Supabase Integration Guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)
- [PowerSync React Native SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
- [Supabase Cron (pg_cron)](https://supabase.com/docs/guides/cron)
- [Supabase Edge Functions Scheduling](https://supabase.com/docs/guides/functions/schedule-functions)
- [Firebase to Supabase Migration (Official)](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data)
- [Firebase Auth to Supabase Migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth)
- [Firebase Storage to Supabase Migration](https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-storage)
- [PowerSync Offline-First Chat Demo](https://github.com/powersync-ja/powersync-js/blob/main/demos/react-native-supabase-group-chat/README.md)
- [Supabase React Native File Upload](https://supabase.com/blog/react-native-storage)
- [Supabase vs Firebase Realtime Comparison (Ably)](https://ably.com/compare/firebase-vs-supabase)
- [Firebase to Supabase Migration Playbook (2025)](https://the-expert-developer.medium.com/from-firebase-to-supabase-in-react-native-2025-a-zero-guesswork-copy-paste-migration-8998ba7cc81a)
- [supabase-community/firebase-to-supabase](https://github.com/supabase-community/firebase-to-supabase)
- [PowerSync + Supabase Offline-First Blog](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync)
