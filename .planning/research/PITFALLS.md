# Pitfalls Research

**Domain:** Social messaging features (ephemeral snaps, streaks, reactions, read receipts, screenshot detection) for a Firestore-backed React Native app
**Researched:** 2026-02-23
**Confidence:** HIGH (verified against official Firebase docs, Expo docs, existing codebase patterns, and multiple community sources)

## Critical Pitfalls

### Pitfall 1: Ephemeral Snap Photos Persist After "Viewing" Due to Client-Side Caching

**What goes wrong:**
The recipient opens a snap, the app marks it as "viewed" in Firestore, but the image remains in expo-image's disk cache, in the OS image cache, and potentially in the Firebase Storage signed URL (still valid for hours/days). The snap is "deleted" in the database but the actual photo bytes are still accessible on the device and via the URL.

**Why it happens:**
Developers focus on the Firestore document lifecycle (mark as viewed, delete the record) but forget that:

1. `expo-image` defaults to `cachePolicy: 'disk'`, which persists images to the device filesystem even after the component unmounts
2. Firebase Storage signed URLs remain valid until their expiry time (the app currently uses 7-day signed URLs via `signedUrlService`)
3. iOS and Android both have OS-level image caches that persist independently of the app's logic

**How to avoid:**

- Use `cachePolicy: 'none'` on the `<Image>` component that renders snap photos. This is the only expo-image policy that prevents disk persistence.
- Generate short-lived signed URLs (2-5 minutes) specifically for snap photos, separate from the 7-day URLs used for feed photos. The Cloud Function `getSignedPhotoUrl` needs a separate code path for snaps.
- After the snap is viewed, explicitly call `Image.clearMemoryCache()` for the specific URI if expo-image supports it, or clear the entire memory cache as a fallback.
- Store snap photos in a separate Storage path (`/snaps/{senderId}/{snapId}`) so they can be deleted from Storage independently by the cleanup Cloud Function without affecting feed photos.

**Warning signs:**

- A viewed snap reappears briefly if the recipient navigates back to the conversation (image loaded from disk cache)
- Snap photos show up in the device's photo cache or gallery apps
- Signed URLs from old snaps still resolve to images days later

**Phase to address:**
Phase 1 (Snap Messages) -- must be designed into the snap viewing component from the start. Retrofitting cache prevention is error-prone.

---

### Pitfall 2: Firestore TTL Deletion Delay Makes "View-Once" Unreliable

**What goes wrong:**
You set up a Firestore TTL policy on snap message documents with an `expiresAt` timestamp field, expecting the document to disappear immediately after the recipient views it. Instead, the document (and its real-time listener data) remains visible for up to 24 hours after the TTL timestamp passes. The recipient can re-open the conversation and see the snap document still in the message list.

**Why it happens:**
Firestore TTL is designed for cost-efficient background cleanup, not real-time deletion. Per official Firebase docs: "Data is typically deleted within 24 hours after its expiration date." TTL trades speed for efficiency. Additionally, TTL only deletes the targeted document -- it does NOT delete subcollections underneath it.

**How to avoid:**

- Do NOT rely on Firestore TTL as the primary deletion mechanism for view-once snaps. TTL should be a safety net for orphaned documents, not the primary enforcement.
- Use a two-layer approach:
  1. **Immediate:** When the recipient opens the snap, a Cloud Function (triggered by the client writing a `viewedAt` timestamp) deletes the snap message document and its Storage file immediately.
  2. **Safety net:** Set a TTL `expiresAt` field (e.g., 48 hours after creation) as a fallback for snaps that were never viewed (recipient never opened the conversation).
- On the client side, filter out snaps where `viewedAt` is set (treated as "already consumed") even before the Cloud Function deletes them. This provides instant UI feedback.

**Warning signs:**

- Snaps remain visible in conversations after being viewed
- "Ghost" snap messages appear in the message list with expired timestamps
- Storage costs grow because snap files are not cleaned up promptly

**Phase to address:**
Phase 1 (Snap Messages) -- the viewing/deletion flow is the core mechanic and must be designed correctly from day one.

---

### Pitfall 3: Streak Timezone and Clock Drift Causes Unfair Streak Loss

**What goes wrong:**
Streaks are calculated using client-side timestamps or local time comparisons. User A sends a snap at 11:58 PM their time, User B responds at 12:02 AM their time (4 minutes later, but technically "the next day" in User B's timezone). The streak logic sees both snaps on different calendar days and either double-counts or misses a day depending on implementation. Alternatively, if using server timestamps, a user with a slow network gets a `serverTimestamp()` that lands minutes after they actually tapped "send," causing their snap to be attributed to the wrong day.

**Why it happens:**
Developers implement streaks using one of two flawed approaches:

1. **Calendar-day based (midnight reset):** Breaks immediately with users in different timezones. What counts as "today" depends on who you ask.
2. **Client-side time comparison:** Device clocks can be wrong by hours, and `new Date()` on the client is not authoritative.

**How to avoid:**

- Use a **24-hour rolling window** anchored to **server-side timestamps only**. Never use the client's local time for streak calculations.
- Store `lastSnapSentAt` (per-user, per-friendship) as a Firestore `serverTimestamp()`. The streak is alive if BOTH users have a `lastSnapSentAt` within the last 24 hours of the current server time.
- All streak evaluation logic should run in Cloud Functions or at minimum use `Timestamp.now()` from the Firebase Admin SDK, never client-side `Date.now()`.
- The PROJECT.md mentions a "3-day threshold" for streak formation. Implement this as: "mutual snaps on 3 consecutive 24-hour windows" using server timestamps, not calendar days.
- Store the streak start timestamp (`streakStartedAt`) and compute the day count as `floor((now - streakStartedAt) / 86400)` rather than counting discrete calendar days.

**Warning signs:**

- Users in different timezones report streaks breaking "for no reason"
- Streak counts are off by one inconsistently
- QA tests pass in one timezone but fail in another

**Phase to address:**
Phase 2 (Streaks) -- this must be the foundational design decision before any streak UI work begins.

---

### Pitfall 4: Firestore Write Costs Explode with Per-Message Read Receipts and Reactions

**What goes wrong:**
Each time a user opens a conversation, you update every unread message document with a `readAt` timestamp. Each emoji reaction writes to the message document. With 50 unread messages, opening a conversation triggers 50 Firestore write operations. Multiply by active users and you get thousands of writes per minute. At $0.18 per 100K writes, a moderately active app (10K users) can hit hundreds of dollars/month just from read receipts.

**Why it happens:**
The naive implementation treats read receipts and reactions as per-message document updates. This mirrors the mental model ("mark this message as read") but ignores Firestore's per-operation pricing. The existing codebase already has a smart pattern -- `markConversationRead` updates a single conversation-level `unreadCount` field instead of per-message writes. But adding actual read receipts (showing "read" status on individual messages) tempts developers to add per-message fields.

**How to avoid:**

- **Read receipts:** Do NOT store per-message `readAt` timestamps. Instead, store a single `lastReadAt` timestamp per user on the conversation document (or a `lastReadMessageId`). On the client, compare each message's `createdAt` against `lastReadAt` -- if the message was created before `lastReadAt`, it was read. This is exactly 1 write per conversation-open instead of N writes.
- **Reactions:** Store reactions as a map field on the message document (`reactions: { "emoji": { "userId": true } }`). This is 1 write per reaction, which is acceptable. Do NOT create reaction subcollections -- the extra reads to hydrate them will be more expensive than the slightly larger message documents.
- **Batching:** If you must update multiple documents, use Firestore batched writes (max 500 per batch). But prefer the conversation-level approach above.
- **Cost monitoring:** Set up Firebase billing alerts at $10, $50, and $100 thresholds before launching any of these features.

**Warning signs:**

- Firestore write counts spike when read receipts go live
- The `onNewMessage` Cloud Function triggers cascading writes for receipt updates
- Monthly Firebase bill increases more than 3x after feature launch

**Phase to address:**
Phase 3 (Read Receipts) and Phase 4 (Reactions) -- data model decisions here are nearly impossible to migrate later without a full data migration.

---

### Pitfall 5: Screenshot Detection is Unreliable and Creates False Trust

**What goes wrong:**
You ship screenshot detection using `expo-screen-capture`'s `addScreenshotListener`, telling users "the sender will be notified if you screenshot." But the listener silently fails on Android 14+ (documented bug, fix was merged but may not be in all Expo SDK versions), and users can trivially bypass detection via screen recording on a second device, ADB screen mirroring (scrcpy), or simply photographing the screen with another phone. Users develop a false sense of privacy and share more sensitive content than they otherwise would.

**Why it happens:**

- `expo-screen-capture`'s `addScreenshotListener` had a known bug where it never fired on Android 14+ due to missing `registerScreenCaptureCallback` registration. A fix was merged (PR #31702) but may not be in Expo SDK 54.
- On Android, the listener requires `READ_MEDIA_IMAGES` permission on Android 13 and below, which the app currently does not request.
- Even when working perfectly, screenshot detection is trivially bypassable. It detects OS-level screenshots only. Screen mirroring, external cameras, and accessibility tools all bypass it.
- iOS is more reliable (no permission needed, works on iOS 13+) but still cannot prevent external capture.

**How to avoid:**

- **Do NOT call screenshot detection "protection" or "security."** Frame it as "screenshot notification" -- the sender is informed, not protected.
- Verify which Expo SDK 54 version of `expo-screen-capture` you have and whether PR #31702's fix is included. If not, apply the workaround: call `ScreenCapture.allowScreenCaptureAsync()` before registering the listener on Android 14+.
- Add `READ_MEDIA_IMAGES` to Android permissions for devices below Android 14.
- Use `preventScreenCaptureAsync()` to add `FLAG_SECURE` on Android while viewing snaps -- this blocks standard screenshot mechanisms (though it can still be bypassed via ADB). On iOS, this prevents screen recording.
- In the UI, show "Screenshot detection may not work on all devices" as a disclaimer rather than promising absolute detection.
- Accept that screenshot detection is a deterrent, not a security measure. Design the feature accordingly -- notify the sender, but do not guarantee content cannot be saved.

**Warning signs:**

- Android users report no screenshot notifications being sent
- QA testing only on iOS (where it works reliably) and skipping Android
- Users treating snap messages as "secure" and sharing content they would not share publicly

**Phase to address:**
Phase 1 (Snap Messages) -- screenshot detection is a snap feature and its limitations must be understood before marketing snaps as "ephemeral."

---

### Pitfall 6: Snap Storage Cleanup Creates Orphaned Files

**What goes wrong:**
Snap photos are uploaded to Firebase Storage, a Firestore document references them, and when the snap is "viewed" the Firestore document is deleted. But the Storage file is never deleted because: (a) client-side deletion is unreliable (the app can crash between marking viewed and deleting the file), (b) the TTL policy only deletes the Firestore document, not the Storage file, and (c) no Cloud Function cleans up the orphaned file. Over months, thousands of orphaned snap photos accumulate in Storage, costing money.

**Why it happens:**
Firestore and Firebase Storage are independent systems. Deleting a Firestore document does not delete referenced Storage files. Developers assume the TTL or document deletion "handles everything" but Storage files require explicit `admin.storage().bucket().file(path).delete()` calls.

**How to avoid:**

- Create a Cloud Function `onSnapViewed` triggered by the snap document update (when `viewedAt` is set). This function should:
  1. Delete the Storage file at the snap's storage path
  2. Delete the Firestore snap message document
  3. Log success/failure
- Create a scheduled Cloud Function `cleanupOrphanedSnaps` (daily) that queries for snap documents older than 48 hours (regardless of viewed status) and deletes both the document and Storage file. This catches snaps that were never viewed.
- Store snap photos in a dedicated Storage path (`/snaps/{senderId}/{snapId}`) separate from feed photos (`/photos/{userId}/`) so cleanup can target the right files without risk of deleting feed photos.
- Track the Storage file path in the snap message document itself (`storagePath` field) so the cleanup function knows exactly what to delete.

**Warning signs:**

- Firebase Storage usage grows continuously even though Firestore snap document count stays stable
- Storage costs increase disproportionately to user activity
- Manual inspection of Storage shows thousands of files in snap directories with no corresponding Firestore documents

**Phase to address:**
Phase 1 (Snap Messages) -- the cleanup Cloud Function must ship alongside the snap feature, not as a follow-up.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                         | Immediate Benefit                                               | Long-term Cost                                                                                                          | When Acceptable                                               |
| ------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Storing reactions as a subcollection per message | Clean data model, easy to query individual reactions            | N+1 reads to load reactions for a conversation (1 read per message's reaction subcollection), costs multiply with scale | Never for this app -- use a map field on the message document |
| Client-side streak calculation                   | Faster development, no Cloud Function needed                    | Users can manipulate device time, timezone bugs, inconsistent results across devices                                    | Never -- streaks must be server-authoritative                 |
| Using existing 7-day signed URLs for snap photos | No new Cloud Function needed, reuse existing `signedUrlService` | Snap URLs remain valid for days after viewing, defeating the ephemeral purpose                                          | Never -- snaps need short-lived URLs (2-5 min)                |
| Storing `readAt` on each message document        | Precise per-message read tracking                               | O(N) writes per conversation open, Firestore costs explode                                                              | Never -- use conversation-level `lastReadAt` pointer          |
| Skipping Storage cleanup for snaps in v1         | Ship faster, "we will add cleanup later"                        | Orphaned files accumulate silently, Storage bill grows, cleanup becomes a migration project                             | Never -- this is the definition of hidden cost                |
| Using client `Date.now()` for streak timestamps  | No server round-trip, instant UI update                         | Clock manipulation, timezone drift, inconsistent streak states                                                          | Only for optimistic UI display, never for authoritative state |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration                                  | Common Mistake                                                                   | Correct Approach                                                                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firestore TTL for snap messages              | Assuming deletion is instant (it takes up to 24 hours)                           | Use TTL as safety net only; primary deletion via Cloud Function on view                                                                                                                       |
| Firebase Storage for snap photos             | Not deleting Storage files when Firestore documents are deleted                  | Cloud Function deletes both Firestore doc AND Storage file atomically                                                                                                                         |
| expo-screen-capture on Android               | Assuming `addScreenshotListener` works on all Android versions                   | Test on Android 14+, verify PR #31702 is included in your Expo SDK, add `READ_MEDIA_IMAGES` permission for Android < 14                                                                       |
| expo-image caching for snaps                 | Using default `cachePolicy: 'disk'` which persists snap images                   | Use `cachePolicy: 'none'` for snap photos specifically                                                                                                                                        |
| Firestore security rules for message updates | Current rules disallow message updates (`allow update: if false`)                | Need to modify rules to allow specific fields (e.g., `viewedAt`, `reactions`) while keeping other fields immutable. Use `affectedKeys().hasOnly()` pattern already established in photo rules |
| Cloud Function `onNewMessage`                | Extending it for all new message types (snap, reaction, reply) without branching | Create type-specific handlers: snap creation needs different logic (Storage upload, TTL field, shorter signed URL) than text/GIF messages                                                     |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap                                                         | Symptoms                        | Prevention                                                                                                                                                                             | When It Breaks                                                                           |
| ------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| One real-time listener per active conversation for reactions | UI works, reactions update live | Only subscribe to the active (open) conversation. Use the conversation list listener (already exists) for aggregate data. Never open per-message listeners.                            | > 20 active conversations per user (each listener = reconnection cost after 30 min idle) |
| Fetching full message document to check read status          | Read receipts show correctly    | Use conversation-level `lastReadAt` field, derive per-message read status client-side from comparison                                                                                  | > 50 messages per conversation load (50 reads per open)                                  |
| Re-uploading snap photo to Firestore Storage on retry        | Upload succeeds after retry     | Use `uploadQueueService` pattern already in codebase -- it handles retries with deduplication                                                                                          | User on flaky network sends 3 duplicate snaps                                            |
| Streak evaluation on every app foreground                    | Streak badge stays current      | Cache streak state locally (AsyncStorage), only re-evaluate on snap send/receive or after 1 hour. Cloud Function can push streak updates via Firestore listener.                       | > 1000 users foregrounding every few minutes (1000+ streak reads/minute)                 |
| Loading all message reactions for entire conversation        | Reaction display works          | Reactions are stored as map on message doc, so they load with the message. But if you add "who reacted" lists, paginate them -- don't load 100 reactor profiles for a popular message. | Messages with > 50 reactions (unlikely in 1-on-1 DMs but possible)                       |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake                                                 | Risk                                                                                                    | Prevention                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client controls snap deletion timing                    | Malicious client never marks snap as viewed, photo persists forever                                     | Server-side TTL as fallback (48h max lifetime). Cloud Function `cleanupExpiredSnaps` runs daily.                                                                                                                                                                       |
| Snap photo URL leaked via notification payload          | Push notification contains the signed URL for the snap preview, recipient shares the URL                | Never include the actual photo URL in push notifications. Use a generic "New snap from [name]" message. Fetch the URL only when the snap is opened in-app.                                                                                                             |
| Message deletion (unsend) only removes from local state | Other user still sees the "deleted" message because only the sender's client hides it                   | Delete from Firestore via Cloud Function (admin SDK bypasses rules). Set a `deletedAt` field rather than hard-deleting to preserve moderation audit trail. Current rules say `allow update, delete: if false` on messages -- deletion must go through Cloud Functions. |
| Reactions reveal user identity without consent          | Any friend can see who reacted with what emoji on a message, potentially revealing they saw the message | This is expected behavior in social apps. But if implementing "anonymous reactions" later, the data model change would be breaking. Decide now: reactions are always attributed.                                                                                       |
| Streak data manipulation via client                     | User writes a fake `lastSnapSentAt` timestamp to their streak document                                  | Streak documents should only be writable by Cloud Functions (admin SDK). Client sends snaps, Cloud Function updates streak state. Never let the client directly write streak fields.                                                                                   |
| Snap photo accessible after account deletion            | User deletes account but snap photos they sent to others are still in Storage                           | Account deletion Cloud Function (already exists in codebase) must also clean up sent snap files from Storage, not just the user's own photo directory                                                                                                                  |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall                                          | User Impact                                                                                                           | Better Approach                                                                                                                                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No loading state while snap photo downloads      | User taps snap, sees blank screen for 2-3 seconds on slow connection, thinks it is broken                             | Show a loading shimmer/animation during download. Auto-dismiss after timeout (30s) with error message.                                                                                                                                                        |
| Streak counter resets without warning            | User loses a 30-day streak overnight, no notification                                                                 | Show hourglass/warning icon when streak has < 4 hours remaining. Send push notification at the 20-hour mark. The PROJECT.md already calls for this.                                                                                                           |
| "Read" status appears before user actually reads | Opening a conversation marks all as "read" even if user only glanced at the list                                      | Mark as read only when the conversation screen is visible for > 1 second (debounce), or when the user scrolls to the message. The existing `markConversationRead` fires on mount -- keep this for unread count but delay the visual "read receipt" indicator. |
| Snap viewing timer too short                     | User opens snap, it auto-closes in 3 seconds, they did not get to read the caption                                    | Allow the user to control dismissal (tap to close) rather than auto-timer. If using a timer, minimum 5 seconds with caption, 3 seconds without.                                                                                                               |
| Reply context lost in conversation               | User replies to a message, but the original message is not shown -- just "Reply to: [text preview]" that is truncated | Show the full original message in a quote block above the reply. If the original was a snap (now deleted), show "Replied to a snap" with no photo preview.                                                                                                    |
| Streak notifications feel spammy                 | Every friendship sends streak reminders, user gets 10+ "streak about to expire" notifications                         | Limit streak reminders to top 5 highest-count streaks per user. Batch remaining into "X streaks expiring soon." Respect notification preferences.                                                                                                             |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Snap viewing:** Often missing Storage file cleanup -- verify Cloud Function deletes both Firestore document AND Storage file on view
- [ ] **Snap viewing:** Often missing image cache clearing -- verify `cachePolicy: 'none'` is set on the snap Image component
- [ ] **Snap sending:** Often missing upload deduplication -- verify snap uses `uploadQueueService` pattern to prevent duplicate uploads on retry
- [ ] **Streak calculation:** Often missing server-side validation -- verify streaks are computed by Cloud Functions, not client code
- [ ] **Streak display:** Often missing timezone handling -- verify streak countdown uses server timestamp, not local `Date.now()`
- [ ] **Read receipts:** Often missing conversation-level aggregation -- verify receipts use `lastReadAt` on conversation doc, not per-message writes
- [ ] **Reactions:** Often missing Firestore security rules update -- verify rules allow updating reaction fields on message documents (current rules disallow ALL message updates)
- [ ] **Screenshot detection:** Often missing Android 14+ workaround -- verify `addScreenshotListener` fires on Android 14+ devices
- [ ] **Screenshot detection:** Often missing Android permission -- verify `READ_MEDIA_IMAGES` in AndroidManifest for Android < 14
- [ ] **Message deletion (unsend):** Often missing Cloud Function -- verify deletion goes through admin SDK since client-side message delete is blocked by rules
- [ ] **Tagged photo in DM:** Often missing attribution preservation -- verify the photo's tagger attribution survives the DM send and feed reshare flow
- [ ] **Snap push notification:** Often missing URL security -- verify the push payload does NOT contain the snap's signed URL

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                                  | Recovery Cost | Recovery Steps                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Orphaned snap files in Storage                           | LOW           | Run a one-time cleanup script via Cloud Function: query Storage `/snaps/` directory, cross-reference with Firestore snap documents, delete orphans. Schedule this as recurring.                                    |
| Streaks calculated with wrong timezone                   | MEDIUM        | Recalculate all streaks server-side from message history. Set all `streakStartedAt` to server-authoritative values. Push corrected streak counts to clients. May anger users who lost streaks unfairly.            |
| Per-message read receipt writes causing cost spike       | HIGH          | Data model migration required: remove `readAt` from all message documents, add `lastReadAt` to conversation documents, update all client code. Cannot be done incrementally -- old and new clients would conflict. |
| Snap images cached on device after viewing               | MEDIUM        | Release an app update that clears the expo-image disk cache on launch (one-time migration). Add `cachePolicy: 'none'` to all snap image components going forward.                                                  |
| Screenshot detection not working on Android              | LOW           | OTA update to add the `allowScreenCaptureAsync()` workaround and permission request. Does not require a native build unless adding a new permission to AndroidManifest.                                            |
| Reactions stored in subcollections instead of map fields | HIGH          | Full data migration: read every message's reaction subcollection, merge into a map field on the parent message, delete subcollection documents. Must be done in batches to avoid Firestore rate limits.            |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall                                   | Prevention Phase               | Verification                                                                                       |
| ----------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Snap photo caching on device              | Phase 1: Snap Messages         | QA: Open snap, navigate away, navigate back -- image should not reload from cache                  |
| Snap Storage cleanup (orphaned files)     | Phase 1: Snap Messages         | Automated test: Send snap, view snap, verify Storage file deleted within 60 seconds                |
| Short-lived signed URLs for snaps         | Phase 1: Snap Messages         | QA: Copy snap URL, wait 5 minutes, verify URL returns 403                                          |
| Firestore TTL as safety net (not primary) | Phase 1: Snap Messages         | QA: Send snap, do NOT view it, verify auto-deletion after 48 hours                                 |
| Screenshot detection Android workaround   | Phase 1: Snap Messages         | QA: Screenshot on Android 14+ device, verify sender receives notification                          |
| Streak timezone/server-side validation    | Phase 2: Streaks               | QA: Two users in different timezones maintain a streak across midnight boundary                    |
| Streak Cloud Function authority           | Phase 2: Streaks               | Security rule: verify client cannot write to streak fields directly                                |
| Read receipt cost optimization            | Phase 3: Read Receipts         | Monitor: Firestore write count before/after launch should not increase by more than 2x             |
| Reaction data model (map on message)      | Phase 4: Reactions             | Code review: verify reactions use map field, not subcollection                                     |
| Firestore rules update for message fields | Phase 3-4: Receipts/Reactions  | Deploy updated `firestore.rules` before shipping client update                                     |
| Message deletion via Cloud Function       | Phase 5: Message Deletion      | QA: Delete message, verify both users see it removed, verify moderation log preserved              |
| Tagged photo attribution in DM            | Phase 6: Photo Tag Integration | QA: Tag friend in photo, verify DM contains attribution, verify reshare preserves "Photo by @user" |

## Sources

- [Firestore TTL Policies - Official Firebase Docs](https://firebase.google.com/docs/firestore/ttl) -- TTL deletion takes up to 24 hours, does not delete subcollections, costs normal delete operations (HIGH confidence)
- [Firestore TTL - Google Cloud Docs](https://docs.cloud.google.com/firestore/native/docs/ttl) -- Only one TTL field per collection group, documents not deleted in order (HIGH confidence)
- [Firestore Billing - Official Firebase Docs](https://firebase.google.com/docs/firestore/pricing) -- Listener billing: charged per document added/updated in result set, reconnection after 30 min costs full re-read (HIGH confidence)
- [Firestore Real-time Queries at Scale](https://firebase.google.com/docs/firestore/real-time_queries_at_scale) -- Scaling considerations for listeners (HIGH confidence)
- [Expo ScreenCapture Documentation](https://docs.expo.dev/versions/latest/sdk/screen-capture/) -- API reference, platform differences, permission requirements (HIGH confidence)
- [expo-screen-capture Android 14+ Bug - GitHub Issue #31678](https://github.com/expo/expo/issues/31678) -- Screenshot listener not firing on Android 14+, fix merged in PR #31702 (HIGH confidence)
- [expo-image Documentation](https://docs.expo.dev/versions/latest/sdk/image/) -- cachePolicy options: 'none', 'disk', 'memory', 'memory-disk' (HIGH confidence)
- [Snapchat Streak Mechanics - Official Support](https://help.snapchat.com/hc/en-us/sections/5686234719636-Streaks) -- 24-hour rolling window, not midnight reset, not timezone-dependent (MEDIUM confidence)
- [Firestore Messaging Cost Issues - GitHub #2621](https://github.com/firebase/firebase-js-sdk/issues/2621) -- Community discussion on Firestore being expensive for chat (MEDIUM confidence)
- [Firestore Read/Write Optimization Strategies](https://www.javacodegeeks.com/2025/03/firestore-read-write-optimization-strategies.html) -- Batching, caching, query optimization patterns (MEDIUM confidence)
- [View-Once Security Bypasses](https://www.makeuseof.com/how-to-take-screenshots-on-android-when-the-app-doesnt-allow-it/) -- FLAG_SECURE bypassed via ADB, screen mirroring, external camera (MEDIUM confidence)
- Existing codebase analysis: `firestore.rules` (messages allow update: if false), `messageService.js`, `useConversation.js`, `signedUrlService.js`, `uploadQueueService.js` patterns (HIGH confidence -- direct code inspection)

---

_Pitfalls research for: Flick messaging upgrade (ephemeral snaps, streaks, reactions, read receipts, screenshot detection)_
_Researched: 2026-02-23_
