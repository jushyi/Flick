# Firebase → Supabase Migration Analysis

> Research conducted 2026-03-18. Full codebase audit of Firebase integration depth, migration feasibility, risks, and strategy.

---

## Current Firebase Integration Depth

### Services in Use

| Service | Usage | Key Files |
|---------|-------|-----------|
| Firestore | 11 collections, 2 subcollections, ~7,800 lines across 20 service files | `src/services/firebase/*.js` |
| Firebase Auth | Phone auth (SMS + reCAPTCHA), primary auth method | `phoneAuthService.js`, `AuthContext.js` |
| Firebase Storage | Photos, profiles, comment images, 4 bucket paths | `storageService.js`, `uploadQueueService.js` |
| Cloud Functions | 14+ functions, 7 scheduled jobs, 2,600 lines | `functions/index.js` |
| Realtime Listeners | 6 onSnapshot listeners (feed, comments, activity, friendships, photos) | `feedService.js`, `commentService.js`, etc. |
| Cloud Tasks | Notification batching with 30-second windows | `functions/notifications/batching.js` |
| Performance Monitoring | Custom traces for feed, uploads, queries | `performanceService.js` |
| Security Rules | 389 lines Firestore rules + 53 lines Storage rules | `firestore.rules`, `storage.rules` |

### Firestore Collections

**Top-level:** `users`, `photos`, `darkrooms`, `albums`, `friendships`, `blocks`, `notifications`, `reports`, `supportRequests`, `reactionBatches`, `pendingReceipts`

**Subcollections:**
- `photos/{photoId}/comments/{commentId}`
- `photos/{photoId}/comments/{commentId}/likes/{likeId}`
- `users/{userId}/viewedPhotos/{photoId}`

### Cloud Functions Breakdown

| Type | Count | Examples |
|------|-------|---------|
| Callable (httpsCallable) | 7 | `getSignedPhotoUrl`, `deleteUserAccount`, `getMutualFriendSuggestions` |
| Firestore triggers | 11 | `onReportCreated`, `sendReactionNotification`, `incrementFriendCountOnAccept` |
| Scheduled | 7 | `processDarkroomReveals` (2min), `cleanupOldNotifications`, `processScheduledDeletions` |

### Google API Dependencies (Non-Firebase)

- **Google Cloud Tasks** (`@google-cloud/tasks`) — notification batching. Needs replacement.
- **Google Fonts** (via Expo) — unaffected by migration.
- **Gmail SMTP** (via Nodemailer) — unaffected by migration.
- No Google Maps, Places, Vision, Analytics, AdMob, or Google Sign-In used.

---

## Why Migrate to Supabase

### Performance Benefits

| Area | Supabase Win | Firebase Limitation |
|------|-------------|-------------------|
| Feed queries | Single SQL JOIN | Chunked `in` queries (30-ID max per chunk) |
| Complex queries | SQL joins, aggregations, GROUP BY | No joins, limited aggregation |
| Search | `ILIKE` / full-text search built-in | Requires Algolia or client-side filtering |
| Cold starts | Edge Functions: sub-50ms | Cloud Functions: 1-3 second cold starts |
| Counting | `COUNT(*)` | `getCountFromServer()` or denormalized counters |
| Cost at scale | Pay by compute/storage | Pay per document read/write/delete |

### Development Velocity

- SQL makes messaging, read receipts, unread counts, and search trivial
- Database triggers replace Cloud Functions for simple operations (no cold start, no deployment)
- One dashboard for all projects (user already has other projects on Supabase)
- Simpler auth flow — Supabase phone auth via Twilio, no reCAPTCHA/APNs complexity

### Where Supabase Loses

- **No built-in offline persistence** (Firestore caches automatically) — solved with PowerSync
- **No native SDK** — pure JS over HTTP vs Firebase's native iOS/Android modules
- **Younger platform** — 4 years vs Firebase's 12+ years
- **File upload resumption** — less battle-tested than Firebase Storage

---

## Offline Persistence Strategy: PowerSync

**Cost:** $49/mo starter plan

PowerSync provides a local SQLite database on device that syncs bidirectionally with Supabase PostgreSQL. This replaces Firestore's automatic offline caching with something arguably better (full SQL locally).

### Sync Rules (what data lives on device)

```yaml
bucket_definitions:
  user_data:
    parameters: SELECT auth.uid() as user_id
    data:
      - SELECT * FROM photos WHERE user_id = :user_id
      - SELECT * FROM darkrooms WHERE user_id = :user_id
      - SELECT * FROM albums WHERE user_id = :user_id

  feed_data:
    parameters: |
      SELECT friend_id FROM (
        SELECT user2_id as friend_id FROM friendships WHERE user1_id = auth.uid() AND status = 'accepted'
        UNION
        SELECT user1_id FROM friendships WHERE user2_id = auth.uid() AND status = 'accepted'
      )
    data:
      - SELECT * FROM photos WHERE user_id = :friend_id AND photo_state = 'journal'
```

### Offline Photo Capture Flow (improved over current)

```
Camera capture
    → Save JPEG to FileSystem.documentDirectory (persistent, survives app kill)
    → Write photo record to PowerSync local DB:
        { id, user_id, status: 'developing', local_uri, image_url: null }
    → Photo immediately visible in YOUR darkroom (offline, instant)
    → Background upload detects items with local_uri but no image_url
    → When online: upload JPEG → get URL → update record with image_url
    → PowerSync syncs to Supabase → photo now visible to friends
```

**Improvements over current system:**
- Photos taken offline show in darkroom immediately (currently they don't)
- Triage decisions (journal/archive/delete) work offline
- No silent photo loss (current system discards after 3 retries)
- SQLite persistence more reliable than AsyncStorage

---

## Migration Strategy

### Approach: Dev-first, then prod + messaging together

1. Migrate dev database (`re-lapse-fa89b`) first
2. Deep test everything, anticipate prod issues
3. Migrate prod (`flick-prod-49615`) alongside messaging feature release
4. This way prod never breaks and messaging ships on Supabase from day one

### Schema Normalization Required

| Firestore Pattern | PostgreSQL Equivalent |
|------------------|----------------------|
| `photos.reactions` (nested map: `{ [userId]: { [emoji]: count } }`) | `photo_reactions` table (photo_id, user_id, emoji, count) |
| `albums.photoIds` (array) | `album_photos` junction table |
| `photos.taggedUserIds` (array) | `photo_tags` junction table |
| `photos/{id}/comments` (subcollection) | `comments` table with `photo_id` FK |
| `photos/{id}/comments/{id}/likes` (nested subcollection) | `comment_likes` table |
| `users/{id}/viewedPhotos` (subcollection) | `viewed_photos` table |

### Phase Breakdown

| Phase | Scope | Days |
|-------|-------|------|
| 1. Supabase schema & RLS policies | Design PostgreSQL tables, indexes, RLS rules | 3-4 |
| 2. Auth migration | Phone auth via Twilio, rewrite auth services | 2-3 |
| 3. Storage migration | Supabase Storage buckets, rewrite upload/download | 2-3 |
| 4. Service file rewrites | All 20 service files (~7,800 lines) | 8-10 |
| 5. Cloud Functions → Edge Functions + DB triggers | 14+ functions, 7 scheduled jobs | 5-7 |
| 6. PowerSync integration | Offline sync setup, sync rules, client swap | 4-5 |
| 7. Offline photo capture | Rewrite upload queue for PowerSync + local persistence | 3-4 |
| 8. Data migration script | Export Firestore → transform → import PostgreSQL + storage files | 3-4 |
| 9. Testing & stabilization | Every screen, offline scenarios, realtime, push notifications | 5-7 |
| **Total** | | **35-47 days** |

---

## Risk Assessment

### High Risk

1. **Auth UID mismatch** — Every FK references Firebase Auth UIDs. Must import users with same UIDs via Supabase Admin API or update all FKs. Getting this wrong breaks everything.

2. **Realtime subscription reliability** — Supabase Realtime is younger than Firestore's onSnapshot. Need reconnection logic and possibly polling fallback for the 6 listener locations.

3. **Photo upload race condition** — With PowerSync, metadata writes are instant (local) but file uploads are async. Friends could see a photo record with no image_url if PowerSync syncs before upload completes. Must handle this state in UI.

4. **Notification batching replacement** — Cloud Tasks 30-second batching windows are sophisticated. pg_cron or Edge Functions alternative could introduce timing bugs, duplicates, or missed batches.

5. **Batch write restructuring** — Firestore batch writes (500 ops max) used for reveals, notification cleanup, etc. PostgreSQL transactions work differently; code patterns need restructuring.

### Medium Risk

6. **Timestamp precision / clock skew** — Firestore `serverTimestamp()` resolves on server. PowerSync local writes use device clock. Could cause ordering bugs in feed, comments, darkroom reveals.

7. **Security rule translation gaps** — 389 lines of Firestore rules → RLS policies isn't 1:1. Missing a rule = data leak. Needs thorough audit.

8. **PowerSync sync conflicts** — Two devices updating same photo (e.g., triage on phone + tablet). Default last-write-wins may not be correct for reactions/comments.

9. **Feed pagination change** — Firestore cursor-based (`startAfter`) → Supabase keyset or offset pagination. Could cause duplicate/missing items during scroll.

10. **Comment threading** — Subcollection with `parentId` → flat table with self-referential FK. Query patterns change; need to test deeply nested reply chains.

### Lower Risk

11. **Push token migration** — Straightforward but silent failure if tokens missed = users stop getting notifications.

12. **Darkroom scheduling** — `processDarkroomReveals` every 2min via Firebase scheduler → pg_cron. Timing drift or missed runs could delay reveals.

13. **Mixed image URL formats** — Old URLs point to `firebasestorage.googleapis.com`, new to Supabase Storage. Old cached URLs still work but database has mixed formats.

14. **IAP records** — `contributions` collection tracks purchases. Losing records would be very bad. Needs careful migration verification.

---

## Key Files Reference

### Firebase Services (to be rewritten)
```
src/services/firebase/
├── photoService.js        (1,486 lines) — Photo CRUD, status management
├── feedService.js         (989 lines)   — Feed queries, realtime listeners
├── commentService.js      (794 lines)   — Comments, replies, likes
├── notificationService.js (600 lines)   — Push tokens, notification CRUD
├── friendshipService.js   (583 lines)   — Friend requests, queries
├── contactSyncService.js  (509 lines)   — Contact matching
├── albumService.js        (420 lines)   — Album CRUD
├── userService.js         (348 lines)   — User profiles
├── darkroomService.js     (339 lines)   — Reveal timing
├── blockService.js        (335 lines)   — User blocking
├── storageService.js      (284 lines)   — File uploads/downloads
├── phoneAuthService.js    (260 lines)   — Phone auth
├── accountService.js      (194 lines)   — Account deletion
├── monthlyAlbumService.js (187 lines)   — Monthly queries
├── viewedStoriesService.js(131 lines)   — Story tracking
├── reportService.js       (103 lines)   — Report submission
├── signedUrlService.js    (71 lines)    — Signed URL generation
├── mentionService.js      (51 lines)    — Mutual friend mentions
├── supportService.js      (47 lines)    — Support requests
└── performanceService.js  (45 lines)    — Performance monitoring
```

### Cloud Functions (to be replaced)
```
functions/
├── index.js                          (2,616 lines) — All functions
├── logger.js                         (162 lines)
├── validation.js                     (125 lines)
├── notifications/sender.js           (141 lines)
├── notifications/batching.js         (196 lines) — Cloud Tasks integration
├── notifications/receipts.js         (103 lines)
└── tasks/sendBatchedNotification.js  (298 lines)
```

### Upload Pipeline (to be reworked for PowerSync)
```
src/services/uploadQueueService.js    (389 lines) — Queue with AsyncStorage persistence
src/hooks/useCameraBase.js            — Capture → queue integration
```

### Config Files (to be replaced/removed)
```
firebase.json
firestore.rules                       (389 lines)
firestore.indexes.json
storage.rules                         (53 lines)
GoogleService-Info.plist / google-services.json (dev)
GoogleService-Info-prod.plist / google-services-prod.json (prod)
```

### Firebase Projects
- **Dev:** `re-lapse-fa89b` (project number: 958995611148)
- **Prod:** `flick-prod-49615` (project number: 904439256658)
