# Domain Pitfalls: v1.2 Speed & Scale

**Domain:** Backend migration (Firebase to new backend), TypeScript conversion, and performance overhaul for an existing production React Native + Expo social media app with ~75,700 LOC
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH (verified against official Firebase docs, Supabase migration docs, RxDB official docs, React Native performance docs, and community post-mortems)

---

## Critical Pitfalls

Mistakes that cause data loss, extended downtime, or force rewrites.

---

### Pitfall 1: Firebase Phone Auth Has No Password Hash to Export

**What goes wrong:**
You export users from Firebase Auth using `firebase auth:export` and attempt to recreate them in your new auth system. Phone-only auth users have no password hash, no OAuth token, and no transferable credential. The exported data contains UIDs and phone numbers, but nothing that lets your new backend authenticate those users without re-verification.

**Why it happens:**
Firebase phone auth works through OTP verification -- there is no persistent secret stored on the user record. Unlike email/password users (where you can export the password hash with the scrypt parameters), phone auth users are verified in-session only. The Firebase Auth export gives you `phoneNumber` and `uid` but no portable auth state.

**Consequences:**
- If you switch auth backends without a migration strategy, every user must re-verify their phone number on next launch
- Users who open the app after migration see a login screen instead of their feed -- they think the app is broken or their account is deleted
- If you create new user records in the new backend, UIDs will differ from Firestore UIDs, breaking all data relationships (photos, friendships, conversations, streaks)

**Prevention:**
1. **Keep Firebase Auth as the identity provider during migration.** Your new backend validates Firebase ID tokens (via Firebase Admin SDK `verifyIdToken()`) rather than replacing auth immediately. This is the only zero-downtime approach for phone auth.
2. **Map Firebase UIDs to new backend user IDs** in a lookup table. All new backend queries use the mapped ID, but the client continues authenticating through Firebase Auth.
3. **Migrate auth last**, not first. Move data and API layers first while Firebase Auth remains the source of truth. Only replace auth once the new backend is fully proven and you have a re-verification flow for users who need it.
4. **If you must replace auth:** Implement a "drip migration" where users re-verify their phone number on their next app open, and the new backend creates their account at that point. Show a one-time "Verify your number to continue" screen, not a full re-onboarding flow.

**Detection:**
- Auth export file shows no `passwordHash` or `providerUserInfo` with usable credentials for phone users
- Test: can a user authenticate on the new backend without re-entering their phone number? If no, you have this problem

**Phase to address:** Must be designed in the architecture phase. Auth migration order is the single most consequential architectural decision in this project.

---

### Pitfall 2: Firestore Real-Time Listeners Cannot Be Incrementally Migrated

**What goes wrong:**
You plan to migrate one service at a time -- move `feedService` to the new backend, then `messageService`, then `darkroomService`. But `feedService` uses `onSnapshot` for real-time feed updates, and `messageService` uses `onSnapshot` for real-time message delivery. Your new backend uses WebSockets or server-sent events instead. During the transition period, the app must maintain both Firestore listeners AND new backend subscriptions simultaneously, doubling connection overhead, battery drain, and complexity.

**Why it happens:**
Firestore's real-time listener model is deeply coupled to the SDK. Every `onSnapshot` call establishes a persistent connection to Firestore servers. You cannot redirect a Firestore listener to a non-Firestore backend. The only options are: (a) replace the entire real-time layer at once, or (b) run both systems in parallel during transition.

**Consequences:**
- Running dual real-time connections (Firestore + WebSocket) on mobile drains battery and increases data usage
- Data consistency issues: a message sent via the new backend might not appear in a Firestore listener, or vice versa
- The service layer abstraction (`src/services/firebase/`) makes this look easy to swap, but the real-time subscriptions in hooks (`useFeedPhotos`, `useConversation`, `useMessages`) are Firestore-specific in their snapshot handling, error recovery, and cursor pagination

**Prevention:**
1. **Design the service layer with an adapter pattern** before migrating any data. Create a common subscription interface that both Firestore and the new backend can implement:
   ```typescript
   interface SubscriptionAdapter<T> {
     subscribe(query: QueryParams, onData: (data: T[]) => void, onError: (err: Error) => void): Unsubscribe;
   }
   ```
2. **Migrate real-time features as a single unit**, not piecemeal. All real-time subscriptions (feed, messages, darkroom, conversations) should switch to the new backend together during a coordinated cutover.
3. **Use the existing service layer boundary** (`src/services/firebase/*.js`) as the swap point. Hooks should not import from `@react-native-firebase/firestore` directly -- they should only call service functions. Audit for any hook that imports Firestore directly.
4. **Implement a feature flag** (`useNewBackend: boolean`) that switches all subscriptions at once, not per-feature. This allows instant rollback.

**Detection:**
- Grep for `onSnapshot` imports outside of `src/services/firebase/` -- any direct usage in hooks or components is a migration blocker
- Count total active Firestore listeners in a typical session (likely 3-5 concurrent) to estimate new backend WebSocket load

**Phase to address:** Service layer adapter pattern must be built before any data migration begins. This is Phase 1 work.

---

### Pitfall 3: Firestore Document Structure Does Not Map to Relational Tables

**What goes wrong:**
You export Firestore collections and import them into PostgreSQL tables with a 1:1 mapping. The `photos` collection becomes a `photos` table, the `users` collection becomes a `users` table. But Firestore's denormalized structure means data is duplicated across documents (user display names embedded in photo documents, friend lists stored as arrays on user documents, `lastMessage` duplicated on conversation documents). Your relational database now has denormalized data that gets out of sync because you kept the Firestore data model instead of normalizing it.

**Why it happens:**
Firestore encourages denormalization because joins are expensive (or impossible in real-time listeners). The Flick codebase has specific denormalization patterns:
- `conversations` documents embed `lastMessage` (duplicated from the messages subcollection)
- `users` documents contain `friends` arrays (duplicated from `friendships` collection)
- `photos` documents may embed user data for feed rendering

When migrating to PostgreSQL/Supabase, developers often take the shortcut of preserving the Firestore structure using JSONB columns to "just get it working." This creates a relational database that has none of the benefits of relational modeling.

**Consequences:**
- JSONB columns cannot be efficiently indexed for the queries you need (e.g., "get all photos from my friends ordered by date")
- Data consistency breaks: updating a user's display name requires updating it in the users table AND every denormalized copy, just like Firestore -- you have gained nothing
- The N+1 query patterns from Firestore (visible in `feedService.js`'s `batchFetchUserData` and `chunkArray` for the 30-item `in` operator limit) persist because the data model was not redesigned

**Prevention:**
1. **Normalize the data model during migration, not after.** Design proper relational tables with foreign keys:
   - `conversations.lastMessage` becomes a JOIN on the `messages` table
   - `users.friends` becomes a `friendships` junction table (which already exists as a Firestore collection)
   - Photo feed queries become JOINs between `photos` and `friendships`
2. **Write the migration script as a transformation**, not a copy. Export Firestore JSON, transform it into normalized relational inserts, then import.
3. **Accept that queries will be different.** Firestore queries are document-fetches; SQL queries are joins and aggregations. Every service function's query logic must be rewritten, not adapted.
4. **Start with the schema design** and validate it can serve every screen's data needs before writing any migration code. Use the existing service functions as a requirements document: each function tells you exactly what data shape each screen needs.

**Detection:**
- If your new database schema has any JSONB columns that store arrays of IDs or embedded objects, you are preserving Firestore's denormalization
- If your migration script is less than 200 lines, you are probably copying structure instead of transforming it

**Phase to address:** Database schema design must happen before data migration. This is the first deliverable of the backend migration phase.

---

### Pitfall 4: Signed URL Expiry Model Breaks During Backend Transition

**What goes wrong:**
The app currently uses Firebase Storage signed URLs with 7-day expiry (5-minute for snaps). During migration, you move photos to a new storage backend (S3, Supabase Storage, etc.). Existing signed URLs in cached feed data, AsyncStorage, and in-flight push notifications still point to Firebase Storage. After you disable the Firebase project or change storage buckets, every cached photo URL returns 403/404. The entire feed goes blank.

**Why it happens:**
Signed URLs are time-bounded AND bucket-specific. A Firebase Storage signed URL cannot resolve against an S3 bucket. The `signedUrlService.js` generates URLs with 7-day TTL, meaning users who haven't opened the app in less than 7 days still have valid Firebase URLs cached locally. Push notifications sent before migration contain Firebase URLs in their payloads.

**Consequences:**
- Feed shows broken images for up to 7 days after storage migration
- Cached photo URLs in expo-image's memory-disk cache serve stale/broken URLs
- Snap viewing breaks if the signed URL was generated before migration but viewed after
- `uploadQueueService` may have queued uploads targeting the old Firebase Storage bucket

**Prevention:**
1. **Run dual storage during transition.** Keep Firebase Storage active (read-only) for at least 14 days after migrating to the new storage backend. New uploads go to the new backend; old URLs continue to resolve from Firebase.
2. **Implement a URL resolver layer** in the client that detects Firebase URLs and re-requests from the new backend if the Firebase URL fails. This is a client-side fallback, not a permanent solution.
3. **Clear expo-image cache** as part of the migration cutover. Add a one-time cache bust triggered by a version flag in remote config or the new backend's health check response.
4. **Migrate the `signedUrlService` first** before migrating any other service. This service is the gateway for all photo rendering in the app.
5. **Drain the upload queue** before switching storage backends. Check `uploadQueueService`'s AsyncStorage queue is empty before cutover.

**Detection:**
- Any photo in the feed showing a loading placeholder that never resolves after migration
- `signedUrlService` errors spiking in logs
- Upload queue items failing with storage permission errors

**Phase to address:** Storage migration must be coordinated with the feed and photo services. Cannot be done independently. Plan for a 14-day dual-storage overlap period.

---

### Pitfall 5: Cloud Functions Business Logic Becomes Orphaned

**What goes wrong:**
You migrate the client to talk to a new backend API, but forget that critical business logic lives in Cloud Functions, not in the client. The `functions/index.js` is ~2,700 lines containing: streak calculations, push notification routing, reaction batching/debouncing, snap cleanup, darkroom reveal scheduling, unread count management, `lastMessage` updates, tag debouncing, and account deletion scheduling. You rebuild the API layer but miss half the background processing.

**Why it happens:**
Cloud Functions are event-driven (Firestore triggers, scheduled functions, callable functions). They are invisible to the client -- the client writes a document and the function reacts. When you replace Firestore with a new database, these triggers stop firing because there are no Firestore writes to trigger them. The business logic they contain must be explicitly ported to the new backend.

**Consequences:**
- Streaks stop updating (no `onDocumentCreated` trigger on new snap messages)
- Push notifications stop sending (no `onNewMessage` function firing)
- Darkroom reveals stop happening in the background (no `processDarkroomReveals` scheduled function)
- Expired snaps stop being cleaned up (no `cleanupExpiredSnaps` scheduled function)
- Unread counts freeze (no `onDocumentCreated` incrementing them)

**Prevention:**
1. **Catalog every Cloud Function** with its trigger type, input, output, and side effects before starting migration. The inventory for Flick includes:
   - `onNewMessage` (Firestore trigger) -- lastMessage, unreadCount, push notifications, streak updates
   - `processDarkroomReveals` (scheduled, every 2 min) -- darkroom reveal batch processing
   - `cleanupExpiredSnaps` (scheduled) -- snap storage deletion
   - `sendBatchedNotification` (task queue) -- reaction notification batching
   - Various `onCall` functions for signed URLs, account deletion, etc.
2. **Port Cloud Functions to the new backend as background jobs/webhooks** before removing Firestore triggers. Use database triggers (PostgreSQL triggers + pg_notify, or Supabase Edge Functions) or a job queue (BullMQ, pg-boss) to replace Firestore event triggers.
3. **Test background processing independently.** Set up integration tests that verify: "when a snap is sent, the streak is updated within 5 seconds" and "when a photo is developing for 5 minutes, it is revealed."
4. **Keep Cloud Functions running in parallel** during transition, even if the client is talking to the new backend. They can serve as a safety net for any missed background jobs.

**Detection:**
- Streaks not incrementing after sending snaps through the new backend
- Push notifications stop arriving
- Darkroom photos stuck in "developing" state indefinitely
- Snap photos remaining in storage after being viewed

**Phase to address:** Cloud Function audit and porting must be a dedicated sub-phase of backend migration. Cannot be deferred to "cleanup."

---

## Moderate Pitfalls

Issues that cause significant bugs, performance regressions, or wasted effort but are recoverable.

---

### Pitfall 6: TypeScript Strict Mode Breaks Half the Codebase at Once

**What goes wrong:**
You enable `strict: true` in `tsconfig.json` to get the full benefit of TypeScript. The entire codebase lights up with 500+ type errors because existing JavaScript patterns are incompatible with strict null checks, implicit any detection, and strict function types. Development grinds to a halt as every PR touches type errors in unrelated files.

**Why it happens:**
The Flick codebase uses patterns that are common in JavaScript but invalid under strict TypeScript:
- Service functions returning `{ success, error }` where `error` is `undefined` on success -- strict null checks require every consumer to handle `undefined`
- Context values that are `null` before initialization (`useAuth()` returns `null` user during loading)
- Firebase Timestamps that might be Firestore `Timestamp` objects or ISO strings (documented in CLAUDE.md gotcha #2)
- `onSnapshot` callbacks where the snapshot type varies between query snapshots and document snapshots

**Prevention:**
1. **Start with `strict: false`** and enable strict checks incrementally:
   ```json
   {
     "strict": false,
     "noImplicitAny": false,
     "strictNullChecks": false
   }
   ```
   Enable one flag at a time, fix all errors, then enable the next flag.
2. **Migrate files as they are touched** during the backend migration, not as a separate sweep. When you rewrite `feedService.js` to use the new backend, that is when it becomes `feedService.ts` with proper types.
3. **Define shared types first** before converting any files:
   ```typescript
   // types/api.ts
   type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

   // types/models.ts
   interface Photo { id: string; userId: string; status: 'developing' | 'revealed'; ... }
   interface User { id: string; username: string; displayName: string; ... }
   interface Conversation { id: string; participants: string[]; ... }
   ```
4. **Use `// @ts-expect-error` sparingly** for known issues that will be fixed when the file is fully migrated. Never use `// @ts-ignore` (it suppresses errors silently even after they are fixed).
5. **Keep `index.js` as the entry point.** Expo/Metro expects `index.js` -- renaming it to `index.ts` can break production builds (documented in multiple migration guides).

**Detection:**
- More than 50 type errors in a single PR indicates you are trying to be too strict too fast
- `any` types appearing in function signatures as a workaround for strict mode

**Phase to address:** TypeScript configuration must be set up at the start of the TypeScript migration phase, but strict mode flags should be enabled gradually across the milestone.

---

### Pitfall 7: Premature Feed/List Optimization Breaks Existing UX

**What goes wrong:**
You profile the feed and see that `FlatList` re-renders on every state change. You add `React.memo()` to `FeedPhotoCard`, implement `getItemLayout` for fixed-height rows, add `removeClippedSubviews={true}`, and wrap callbacks in `useCallback`. The feed now scrolls faster but: photos sometimes show the wrong image (stale memo), the layout jumps because `getItemLayout` assumes a fixed height but photos have variable aspect ratios, and `removeClippedSubviews` causes photos to disappear when scrolling back up on Android.

**Why it happens:**
Performance optimization in React Native is measurement-driven, not intuition-driven. Common "optimization" advice from blog posts applies to simple lists with uniform items. Flick's feed has:
- Variable-height photo cards (different aspect ratios, captions, reaction counts)
- Real-time updates (new photos appearing, reaction counts changing)
- Signed URL refresh (URLs expire and must be regenerated, which is a prop change)
- Multiple photo groups per friend (not a flat list of items)

Applying generic FlatList optimizations to this specific feed structure breaks things.

**Prevention:**
1. **Profile before optimizing.** Use React Native's built-in performance monitor, Flipper, or React DevTools Profiler to identify actual bottlenecks. The bottleneck may be in data fetching (N+1 Firestore reads in `batchFetchUserData`), not rendering.
2. **Never use `getItemLayout` with variable-height items.** It causes layout thrashing and incorrect scroll positions.
3. **Be cautious with `React.memo`** on components that receive frequently-changing props (reaction counts, signed URLs). The shallow comparison cost can exceed the re-render cost.
4. **Test `removeClippedSubviews` on both platforms.** It behaves differently on Android (more aggressive clipping, can cause blank spaces) vs iOS.
5. **Optimize data fetching first, rendering second.** Moving from Firestore's N+1 query pattern to a single SQL query with JOINs will likely give a 10x improvement that dwarfs any rendering optimization.

**Detection:**
- Photos showing wrong content after scrolling (stale memo)
- Scroll position jumping when new items load
- Blank spaces appearing in the feed on Android
- Users reporting "photos disappear when I scroll"

**Phase to address:** Performance optimization should come AFTER the backend migration, not during. The backend migration itself will eliminate the primary performance bottleneck (Firestore's query limitations).

---

### Pitfall 8: Upload Queue Breaks During Storage Backend Switch

**What goes wrong:**
The `uploadQueueService` persists queued uploads to AsyncStorage. A user captures photos while on the old Firebase Storage backend, then the app updates to the new backend version before the queue drains. The queued items contain metadata referencing Firebase Storage paths and use Firebase Storage upload functions. The queue processor crashes or uploads to the wrong destination.

**Why it happens:**
`uploadQueueService.js` imports directly from `./firebase/storageService` and `@react-native-firebase/firestore`. Queue items persisted in AsyncStorage do not contain information about which storage backend they target. When the app code updates (via EAS OTA), the storage backend changes but the persisted queue items are stale.

**Consequences:**
- Photos captured before the update are lost (upload fails, max retries exhausted, item dropped)
- Duplicate photos if the fallback logic retries on both old and new backends
- Darkroom state becomes inconsistent (photo document created in Firestore but file uploaded to new storage, or vice versa)

**Prevention:**
1. **Add a `backendVersion` field to queued items.** When processing, check if the item's backend version matches the current backend. If not, route to the appropriate upload function.
2. **Drain the queue before OTA update.** Add a pre-update check: if the upload queue is non-empty, delay the EAS update application until the queue is empty. This can be done via `expo-updates` event listeners.
3. **Implement a queue migration function** that runs once on app launch after an update. It reads old-format queue items and rewrites them with the new backend target.
4. **Test the transition:** capture 5 photos, kill the app, update to the new backend version, relaunch, verify all 5 photos appear in the feed.

**Detection:**
- AsyncStorage contains queue items with no `backendVersion` field after update
- Upload errors in logs referencing Firebase Storage after migration
- Photos in darkroom that never reach "revealed" status

**Phase to address:** Upload queue migration must be handled as part of the storage migration sub-phase. It is a P0 edge case.

---

### Pitfall 9: TypeScript Migration Introduces Runtime Regressions in Untouched Files

**What goes wrong:**
You rename `feedService.js` to `feedService.ts` and add type annotations. Metro bundler now resolves imports differently -- other files that `import { getFeedPhotos } from './feedService'` may resolve to a cached `.js` version or fail to find the `.ts` file. Worse, you change the return type signature to be more precise, which makes the function behave identically at runtime but causes TypeScript to flag every caller that does not handle the new type shape.

**Why it happens:**
Metro bundler resolves files by extension priority. When both `feedService.js` and `feedService.ts` exist (during transition), Metro may pick the wrong one depending on configuration. Additionally, changing a file extension resets Metro's module cache for that file, which can cause stale imports in hot reload during development.

**Consequences:**
- Runtime errors in production from mismatched imports
- Developer confusion: "I converted this file but nothing changed" (Metro serving the old `.js` file)
- Type errors cascading to every file that imports from the converted module

**Prevention:**
1. **Delete the `.js` file immediately after creating the `.ts` file.** Never have both extensions coexist for the same module. Use `git mv` to preserve history.
2. **Configure Metro to prefer `.ts`/`.tsx` extensions** in `metro.config.js`:
   ```javascript
   resolver: {
     sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
   }
   ```
3. **Clear Metro cache after each batch of file conversions:** `npx expo start --clear`
4. **Convert files bottom-up** (leaf dependencies first, then their consumers). This means: utilities and types first, then services, then hooks, then components, then screens. This order minimizes cascade errors.
5. **Run the full test suite after each batch of conversions**, not just the tests for the converted files. TypeScript conversion can change module resolution in ways that affect unrelated files.

**Detection:**
- `ls src/services/firebase/ | sort | uniq -d` shows duplicate filenames with different extensions
- Hot reload stops picking up changes to recently converted files
- Tests pass locally but fail in CI due to module resolution differences

**Phase to address:** Establish the TypeScript conversion protocol at the start of the TS migration phase. The protocol must include the "delete old file" step.

---

### Pitfall 10: Offline-First Conflict Resolution for Social Features is Extremely Hard

**What goes wrong:**
You implement offline-first for the darkroom and feed. A user captures photos offline, and another friend reacts to existing photos offline. When both come online, the system must reconcile: new photos need to be uploaded, reactions need to be applied, but the photo that was reacted to might have been deleted by the author while both users were offline. The conflict resolution for social interactions (reactions, comments, friendships, streaks) is exponentially more complex than single-user document sync.

**Why it happens:**
Offline-first architectures are designed for single-user or collaborative document editing, not for social graphs. Social features have multi-party invariants:
- A reaction requires the photo to still exist
- A friend request requires the target user to not have blocked the sender
- A streak requires mutual daily engagement -- if one side is offline for 3 days, the streak must break even though they "intended" to maintain it
- Darkroom reveals are time-based -- offline users cannot reveal photos because the server-authoritative reveal logic cannot run

**Consequences:**
- Ghost reactions on deleted photos
- Streak desync: client shows streak alive but server broke it while user was offline
- Darkroom stuck in "developing" state because reveal requires server-side timestamp check
- Conflict resolution code becomes the most complex and bug-prone part of the app

**Prevention:**
1. **Limit offline-first to media capture and queue-based uploads only.** This is already the constraint in PROJECT.md: "photos/videos must be capturable, triageable, and uploaded when back online. Zero media loss." Do NOT extend offline-first to social interactions (reactions, comments, friendships, streaks).
2. **Use optimistic UI, not offline-first, for social features.** Show the reaction/comment immediately in the UI, send it to the server, and revert if the server rejects it. This is fundamentally different from offline-first (which queues operations for later sync).
3. **Keep darkroom reveals server-authoritative.** The existing architecture already has three reveal triggers (app foreground, screen focus, Cloud Function). This pattern works -- do not move reveal logic to the client.
4. **For the upload queue specifically:** the existing `uploadQueueService` with AsyncStorage persistence is the correct pattern. Extend it to work with the new storage backend, but do not generalize it into a full offline-first sync engine.

**Detection:**
- Design documents that describe "syncing reactions offline" or "offline streak tracking"
- Library evaluation that includes CRDTs or event sourcing for social features
- Any conflict resolution logic that handles more than upload retries

**Phase to address:** Architecture phase must explicitly scope offline-first to media capture only. Document this as a hard boundary.

---

### Pitfall 11: Firestore Security Rules Have No Equivalent in the New Backend

**What goes wrong:**
Firestore security rules enforce access control at the database level (users can only read their friends' photos, users can only write their own documents). When you move to a new backend with a REST/GraphQL API, these rules must be reimplemented as API middleware or database row-level security. If you forget to port a rule, you create a data access vulnerability.

**Why it happens:**
Firestore security rules are declarative and colocated with the database. Developers often do not document them separately because they are "just part of Firestore." When migrating, the rules file (`firestore.rules`) is the only documentation of the app's access control model, and it is easy to overlook rules for edge cases (blocked users cannot see each other's photos, deleted accounts' data is inaccessible, etc.).

**Prevention:**
1. **Export and document every Firestore security rule** as a requirements document before migration. Convert each rule into an English-language access control requirement.
2. **If using Supabase:** implement Row Level Security (RLS) policies that mirror Firestore rules. RLS is the closest equivalent to Firestore security rules in PostgreSQL.
3. **If using a custom API:** implement authorization middleware for every endpoint. Use a test suite that specifically tests access control: "user A cannot read user B's messages if they are not friends."
4. **Test blocked user scenarios specifically.** The `blockService` in Flick prevents blocked users from seeing each other. This must be enforced at the API/database level, not just in the client UI.

**Detection:**
- API endpoints that return data without checking the requesting user's relationship to the data owner
- Missing RLS policies on tables containing user-generated content
- Blocked user's content appearing in another user's feed

**Phase to address:** Security/access control must be implemented before any data migration, not after. Write RLS policies or middleware as part of schema design.

---

## Minor Pitfalls

Issues that cause developer friction, minor bugs, or suboptimal patterns but are easily fixable.

---

### Pitfall 12: Context API Re-Render Cascade During TypeScript Conversion

**What goes wrong:**
While adding TypeScript types to `AuthContext`, `PhotoDetailContext`, and `VideoMuteContext`, you refactor the context value shape to be more type-safe. This changes the object reference on every render, causing all consumers to re-render. The existing `usePhotoDetailActions()` hook (which exists specifically to avoid re-renders) breaks because the TypeScript refactor changed the memoization boundaries.

**Prevention:**
1. When typing contexts, preserve the exact same memoization structure. Add types to the existing `useMemo` calls, do not restructure them.
2. Use `as const` assertions for static values rather than creating new objects.
3. Test re-render counts before and after conversion using React DevTools Profiler.

---

### Pitfall 13: EAS OTA Update Size Explodes After TypeScript Conversion

**What goes wrong:**
TypeScript compilation adds type-checking overhead to the build process but should not change bundle size. However, if you add runtime type validation libraries (io-ts, zod on the client, runtypes) as part of the TypeScript migration, the bundle size increases significantly. EAS OTA updates become larger and slower to download.

**Prevention:**
1. TypeScript types are compile-time only -- they add zero bytes to the production bundle. Do not add runtime type validation on the client unless you have a specific need.
2. Keep Zod on the server side only (it is already used in `functions/validation.js`).
3. Monitor EAS update size before and after TypeScript migration. If it increases by more than 5%, investigate.

---

### Pitfall 14: Conversation ID Format Breaks During Data Migration

**What goes wrong:**
Conversations in Firestore use deterministic IDs: `[lowerUserId]_[higherUserId]`. This format is referenced in `messageService.js` and used by the client to construct conversation document paths without a server lookup. If the new backend uses auto-generated IDs (UUIDs, serial integers), every reference to a conversation by constructed ID breaks. The client must now query for conversations by participants instead of constructing the ID directly.

**Prevention:**
1. Preserve the deterministic ID format in the new backend, or create a lookup index on `(participant1, participant2)` that returns the conversation ID.
2. Audit all code that constructs conversation IDs client-side (search for `_` concatenation patterns in message-related files).
3. If using auto-generated IDs, add a `getOrCreateConversation(userId1, userId2)` API endpoint that handles the lookup/creation atomically.

---

### Pitfall 15: Performance Monitoring Metrics Become Incomparable After Migration

**What goes wrong:**
Firebase Performance Monitoring (`useScreenTrace`, `withTrace` in `performanceService.js`) provides screen load times and custom traces. After migrating to a new backend, network request timing and screen load patterns change fundamentally. Historical metrics become incomparable -- you cannot tell if the new backend is faster or slower because the measurement infrastructure changed simultaneously with the thing being measured.

**Prevention:**
1. Establish performance baselines BEFORE starting the backend migration. Record p50/p90/p99 for: feed load time, message send latency, photo upload time, darkroom reveal time, app cold start time.
2. Keep Firebase Performance Monitoring active during and after migration, even if you add additional monitoring. This provides a consistent measurement baseline.
3. Add custom traces around the specific operations being migrated so you can compare old vs new backend performance for the same operation.

---

### Pitfall 16: React Navigation Type Safety is Deceptively Complex

**What goes wrong:**
You add TypeScript to the navigation structure and attempt to type all route params. React Navigation 7's type system requires a `ParamList` type for each navigator, and nested navigators require compositing these types. The Flick app has 4+ levels of nesting (Root Stack > Main Tabs > Profile Stack > screens) with cross-navigator navigation (e.g., `PhotoDetail` opened from Feed tab but navigating to Profile). Typing this correctly takes longer than expected and produces cryptic type errors.

**Prevention:**
1. Start with `RootStackParamList` and type only the top-level routes. Leave nested navigators as `undefined` params initially.
2. Use React Navigation's `NavigatorScreenParams` type for nested navigators rather than trying to flatten all params.
3. Accept that `navigationRef.current.navigate()` calls with `setTimeout` (used for nested tab navigation, documented in CLAUDE.md gotcha #4) will be hard to type correctly. Use type assertions for these specific patterns rather than fighting the type system.
4. Reference React Navigation 7's TypeScript guide -- the typing API changed significantly from v6.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Database schema design | Copying Firestore structure into JSONB columns (Pitfall 3) | Normalize during migration, design schema before writing code |
| Auth migration | Attempting to replace Firebase Auth before data migration (Pitfall 1) | Keep Firebase Auth as identity provider, migrate auth last |
| Storage migration | Breaking cached signed URLs (Pitfall 4) | 14-day dual-storage overlap, client-side URL fallback |
| Real-time features | Migrating listeners one at a time (Pitfall 2) | Adapter pattern, feature flag for all-at-once switch |
| Cloud Functions | Forgetting to port background processing (Pitfall 5) | Full function inventory and porting checklist |
| TypeScript setup | Enabling strict mode immediately (Pitfall 6) | Incremental strict flag enablement |
| TypeScript conversion | Dual file extensions causing Metro confusion (Pitfall 9) | Delete .js immediately after creating .ts |
| Feed optimization | Applying generic FlatList advice (Pitfall 7) | Profile first, optimize data fetching before rendering |
| Offline-first scope | Extending offline-first beyond media capture (Pitfall 10) | Hard boundary: offline = capture + upload queue only |
| Upload queue | Queue items targeting wrong storage backend after update (Pitfall 8) | Backend version field, queue drain before update |
| Security | Missing access control rules in new backend (Pitfall 11) | Document Firestore rules, implement RLS/middleware before data migration |

## Sources

- [Firebase auth:import and auth:export documentation](https://firebase.google.com/docs/cli/auth)
- [How I Migrated from Firebase Auth to Better Auth Without Downtime](https://saulotauil.com/2025/04/17/firebase-auth-to-better-auth.html)
- [Supabase: Migrate from Firebase Firestore](https://supabase.com/docs/guides/platform/migrating-to-supabase/firestore-data)
- [RxDB: Downsides of Offline-First](https://rxdb.info/downsides-of-offline-first.html)
- [React Native Performance Overview (official docs)](https://reactnative.dev/docs/performance)
- [React Native Performance Optimization 2026 - Quokka Labs](https://quokkalabs.com/blog/react-native-performance/)
- [React Native JS to TypeScript Migration Guide](https://www.creolestudios.com/react-native-javascript-to-typescript-migration/)
- [Using TypeScript - Expo Documentation](https://docs.expo.dev/guides/typescript/)
- [Overcome Firestore Limitations by Migrating to MongoDB](https://www.d3vtech.com/insights/overcome-firestores-limitations-by-migrating-to-mongodb/)
- [Why RxDB Fails in WebViews](https://medium.com/@MhamadHFarhan/why-rxdb-fails-in-webviews-react-native-electron-and-how-to-avoid-data-loss-5b9cd04f3587)
- [How to Migrate from Firebase (FusionAuth)](https://fusionauth.io/blog/how-to-migrate-from-firebase)
