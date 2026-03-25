---
phase: 17-messaging-social
verified: 2026-03-25T00:00:00Z
status: gaps_found
score: 8/11 requirements verified
gaps:
  - truth: "Screenshot detection inserts notification record into Supabase notifications table"
    status: failed
    reason: "handleScreenshotDetected function exists in ConversationScreen but useScreenshotDetection hook is never imported or called -- the handler never fires"
    artifacts:
      - path: "src/screens/ConversationScreen.js"
        issue: "handleScreenshotDetected callback defined (line 643) but useScreenshotDetection hook not imported or wired to it -- screenshot listener never registered"
    missing:
      - "Import useScreenshotDetection from '../hooks/useScreenshotDetection' in ConversationScreen"
      - "Call useScreenshotDetection({ active: true, onScreenshot: handleScreenshotDetected }) in ConversationScreen body"
  - truth: "Read receipts with privacy toggle work via Supabase"
    status: partial
    reason: "isRead is hardcoded to false (line 482) -- read receipt write path works (markConversationRead called on mount/foreground) but read receipt display is permanently disabled; last_read_at_p1/p2 not in PowerSync schema so UI cannot reflect the actual state"
    artifacts:
      - path: "src/screens/ConversationScreen.js"
        issue: "isRead = false hardcoded at line 482 with comment 'Will be enhanced when conversations metadata is wired' -- ReadReceiptIndicator always shows unread"
    missing:
      - "Add last_read_at_p1 and last_read_at_p2 to PowerSync sync rules for conversations table so the columns are available in local SQLite"
      - "Derive isRead from conversation.last_read_at_p1/p2 vs the last message timestamp in ConversationScreen"
  - truth: "No Firebase imports remain in messaging screens"
    status: failed
    reason: "NewMessageScreen still imports getFriendships and batchGetUsers from Firebase friendshipService"
    artifacts:
      - path: "src/screens/NewMessageScreen.js"
        issue: "Line 18: import { getFriendships, batchGetUsers } from '../services/firebase/friendshipService' -- Firebase import not removed as required by Plan 05"
    missing:
      - "Replace Firebase getFriendships/batchGetUsers with Supabase equivalents (friendshipService.ts already exists from Phase 16)"
      - "Remove the Firebase friendshipService import from NewMessageScreen"
human_verification:
  - test: "Snap Polaroid viewer end-to-end"
    expected: "Send snap from Camera snap mode, recipient sees Polaroid overlay, views snap once, snap disappears and cannot be reopened"
    why_human: "Visual snap viewer UX and view-once behavior requires device interaction"
  - test: "Streak badge colors on conversation list"
    expected: "Active streak at 3-9 days shows amber, 10-49 shows orange, 50+ shows deep orange, warning state shows red"
    why_human: "Visual color rendering requires device/simulator inspection"
  - test: "Swipe-to-reply gesture"
    expected: "Swipe a message left, reply compose opens with quoted message context above input"
    why_human: "Gesture interaction requires physical device testing"
  - test: "Real-time message delivery across devices"
    expected: "Send message from device A, message appears on device B within 2 seconds without refresh"
    why_human: "Requires two devices or simulators with network connectivity to Supabase"
---

# Phase 17: Messaging & Social Verification Report

**Phase Goal:** The entire messaging system works through Supabase -- all 5 message types, snap lifecycle, streaks, read receipts, reactions, replies, and tagged photo pipeline function identically
**Verified:** 2026-03-25
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                          | Status      | Evidence                                                                                    |
|----|--------------------------------------------------------------------------------|-------------|---------------------------------------------------------------------------------------------|
| 1  | Conversation list loads with unread counts via PowerSync                       | VERIFIED    | useMessages.ts uses usePowerSyncQuery; derives unreadCount from unread_count_p1/p2          |
| 2  | All 5 message types send and display identically                               | VERIFIED    | messageService.ts exports sendMessage/sendReaction/sendReply/sendTaggedPhotoMessage; adaptMessage() handles all 5 types |
| 3  | Snap lifecycle works end-to-end: upload, send, view-once, auto-cleanup         | VERIFIED    | snapService.ts uploads to snaps bucket, markSnapViewed triggers PG handle_snap_viewed, pg_net calls snap-cleanup Edge Function |
| 4  | Streak engine maintains 3-day activation, tiered expiry, server-authoritative  | VERIFIED    | PostgreSQL trigger update_streak_on_snap handles upsert and tiered expiry (48h/72h/96h); streakService.ts provides pure derivation |
| 5  | Read receipts with privacy toggle work                                         | PARTIAL     | markConversationRead called on mount/foreground; privacy toggle respected; BUT isRead = false hardcoded in UI (display broken) |
| 6  | Emoji reactions work with new backend                                          | VERIFIED    | sendReaction inserts type='reaction' with emoji and reply_to_id; buildReactionMap() in ConversationScreen aggregates for display |
| 7  | Swipe-to-reply with quoted context works                                       | VERIFIED    | sendReply inserts type='reply' with reply_preview JSONB; adaptMessage() reconstructs replyTo from reply_to_id + reply_preview |
| 8  | Message unsend and delete-for-me work                                          | VERIFIED    | unsendMessage sets unsent_at; deleteMessageForMe inserts into message_deletions; getMessages filters deletions client-side |
| 9  | Screenshot detection and notification work                                     | FAILED      | handleScreenshotDetected defined but useScreenshotDetection hook never wired -- no listener registered |
| 10 | Tagged photo DM pipeline works                                                 | VERIFIED    | sendTaggedPhotoMessage inserts type='tagged_photo' with tagged_photo_id; adaptMessage maps tagged_photo_id to photoId for rendering |
| 11 | No Firebase imports remain in messaging screens                                | FAILED      | NewMessageScreen imports getFriendships/batchGetUsers from Firebase friendshipService (line 18) |

**Score:** 8/11 truths verified (2 failed, 1 partial)

---

### Required Artifacts

| Artifact                                                          | Expected                                          | Status     | Details                                                            |
|-------------------------------------------------------------------|---------------------------------------------------|------------|--------------------------------------------------------------------|
| `supabase/migrations/20260324000005_add_messaging_columns.sql`    | Schema additions for messaging                    | VERIFIED   | 34 lines; contains message_deletions, last_read_at_p1/p2, emoji, reply_preview, pg_net |
| `supabase/migrations/20260324000006_create_message_triggers.sql`  | PostgreSQL triggers for message lifecycle         | VERIFIED   | 199 lines; 3 trigger functions + 3 triggers, all SECURITY DEFINER |
| `supabase/functions/snap-cleanup/index.ts`                        | Edge Function for snap file cleanup               | VERIFIED   | 68 lines; validates auth header, extracts storage_path, calls supabase.storage.from('snaps').remove() |
| `src/lib/queryKeys.ts`                                            | Extended query key factory with streaks namespace | VERIFIED   | streaks.all, streaks.detail, streaks.forUser present              |
| `src/services/supabase/messageService.ts`                         | Complete message service, 13 exports, 200+ lines  | VERIFIED   | 563 lines; all 13 functions exported                              |
| `__tests__/services/messageService.test.ts`                       | Unit tests for messageService, 100+ lines         | VERIFIED   | 546 lines; 23 test cases across 11 describe blocks                |
| `src/services/supabase/snapService.ts`                            | Snap upload, send, mark viewed, signed URL        | VERIFIED   | 209 lines; uploadAndSendSnap/markSnapViewed/getSignedSnapUrl exported |
| `src/services/supabase/streakService.ts`                          | Streak pure functions for state derivation        | VERIFIED   | 129 lines; no Supabase imports; generateStreakId/deriveStreakState/getStreakColor exported |
| `__tests__/services/snapService.test.ts`                          | Unit tests for snapService                        | VERIFIED   | 225 lines; 11 test cases                                           |
| `__tests__/services/streakService.test.ts`                        | Unit tests for streakService                      | VERIFIED   | 202 lines; 25 test cases covering all 5 states + 3 tier colors    |
| `src/hooks/useMessages.ts`                                        | Conversation list hook reading from PowerSync     | VERIFIED   | 116 lines; useMessages exports conversations/loading/deleteConversation |
| `src/hooks/useConversation.ts`                                    | Individual conversation hook, TanStack + Realtime | VERIFIED   | 376 lines; useInfiniteQuery + supabase.channel + removeChannel + 10 action functions |
| `src/hooks/useStreaks.ts`                                         | Streak hooks reading from PowerSync               | VERIFIED   | 149 lines; useStreak + useStreakMap exported                       |
| `src/screens/MessagesScreen.js`                                   | Wired to useMessages + useStreakMap               | VERIFIED   | imports useMessages from ../hooks/useMessages; imports useStreakMap from ../hooks/useStreaks |
| `src/screens/ConversationScreen.js`                               | Wired to useConversation + useStreak              | PARTIAL    | useConversation + useStreak wired; screenshot handler DEFINED but NOT CONNECTED; isRead hardcoded false |
| `src/screens/SnapPreviewScreen.js`                                | Wired to Supabase snapService                     | VERIFIED   | line 42: import { uploadAndSendSnap } from '../services/supabase/snapService' |
| `src/screens/NewMessageScreen.js`                                 | Wired to Supabase getOrCreateConversation         | PARTIAL    | line 17: getOrCreateConversation from supabase messageService; BUT line 18: getFriendships/batchGetUsers still from Firebase |

---

### Key Link Verification

| From                              | To                                       | Via                                         | Status      | Details                                                               |
|-----------------------------------|------------------------------------------|---------------------------------------------|-------------|-----------------------------------------------------------------------|
| `20260324000006_create_message_triggers.sql` | conversations table            | AFTER INSERT trigger on messages            | WIRED       | trg_update_conversation_on_message present; updates last_message_* and unread_count |
| `20260324000006_create_message_triggers.sql` | streaks table                  | AFTER INSERT trigger on messages WHERE snap | WIRED       | trg_update_streak_on_snap with WHEN (NEW.type = 'snap') conditional trigger |
| `20260324000006_create_message_triggers.sql` | snap-cleanup Edge Function     | pg_net HTTP POST on snap_viewed_at update   | WIRED       | net.http_post() in handle_snap_viewed() uses current_setting URLs    |
| `src/services/supabase/snapService.ts`       | messageService.ts              | sendMessage for snap type                   | WIRED       | import { sendMessage } from './messageService' at line 18            |
| `src/services/supabase/snapService.ts`       | supabase.storage.from('snaps') | upload and signed URL                       | WIRED       | supabase.storage.from('snaps').upload() and .createSignedUrl()       |
| `src/hooks/useMessages.ts`                   | PowerSync local SQLite         | usePowerSyncQuery on conversations          | WIRED       | useQuery as usePowerSyncQuery from @powersync/react                  |
| `src/hooks/useConversation.ts`               | TanStack useInfiniteQuery      | queryKeys.conversations.messages            | WIRED       | useInfiniteQuery with staleTime: 30_000                              |
| `src/hooks/useConversation.ts`               | Supabase Realtime              | supabase.channel per conversation           | WIRED       | channel `messages:${conversationId}` with INSERT+UPDATE listeners; supabase.removeChannel in cleanup |
| `src/hooks/useStreaks.ts`                    | PowerSync local SQLite         | usePowerSyncQuery on streaks table          | WIRED       | SELECT * FROM streaks WHERE id = ? and user1_id/user2_id variants    |
| `src/screens/MessagesScreen.js`              | useMessages hook               | import useMessages                          | WIRED       | line 16: import { useMessages } from '../hooks/useMessages'          |
| `src/screens/ConversationScreen.js`          | useConversation hook           | import useConversation                      | WIRED       | line 39: import { useConversation } from '../hooks/useConversation'  |
| `src/screens/ConversationScreen.js`          | useStreak hook                 | import useStreak for streak indicator       | WIRED       | line 41: import { useStreak } from '../hooks/useStreaks'             |
| `src/screens/ConversationScreen.js`          | Supabase notifications table   | screenshot notification insert              | NOT_WIRED   | handleScreenshotDetected inserts to notifications BUT useScreenshotDetection hook never called -- handler never fires |
| `src/screens/SnapPreviewScreen.js`           | snapService.ts                 | import uploadAndSendSnap                    | WIRED       | line 42: import { uploadAndSendSnap } from '../services/supabase/snapService' |
| `src/screens/NewMessageScreen.js`            | messageService.ts              | import getOrCreateConversation              | WIRED       | line 17: import { getOrCreateConversation } from '../services/supabase/messageService' |

---

### Data-Flow Trace (Level 4)

| Artifact                 | Data Variable    | Source                                    | Produces Real Data | Status     |
|--------------------------|------------------|-------------------------------------------|--------------------|------------|
| `useMessages.ts`         | conversations    | usePowerSyncQuery on conversations table  | Yes (PowerSync SQLite) | FLOWING |
| `useConversation.ts`     | messages         | useInfiniteQuery -> getMessages() -> supabase.from('messages') | Yes (Supabase REST + filter) | FLOWING |
| `useStreaks.ts`           | streakMap        | usePowerSyncQuery on streaks table        | Yes (PowerSync SQLite) | FLOWING |
| `ConversationScreen.js`  | isRead           | Hardcoded false                           | No                 | STATIC -- isRead = false at line 482 |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED -- messaging screens require a running Expo dev server connected to Supabase; cannot test without live infrastructure.

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                         | Status    | Evidence                                                              |
|-------------|-------------|-------------------------------------------------------------------------------------|-----------|-----------------------------------------------------------------------|
| MSG-01      | 17-01, 17-02, 17-04 | Conversation service rewritten -- list, create, soft delete, unread counts | SATISFIED | getOrCreateConversation, softDeleteConversation, markConversationRead; useMessages reads unread counts from PowerSync |
| MSG-02      | 17-02, 17-04 | Message service rewritten -- send, paginate, real-time subscription              | SATISFIED | sendMessage, getMessages with cursor pagination; useConversation with useInfiniteQuery + Supabase Realtime |
| MSG-03      | 17-02, 17-05 | All 5 message types work identically                                              | SATISFIED | sendMessage/sendReaction/sendReply/sendTaggedPhotoMessage all exported; adaptMessage() handles all 5 types in ConversationScreen |
| MSG-04      | 17-01, 17-03 | Snap lifecycle: upload, send, view-once, auto-cleanup                             | SATISFIED | snapService.ts; handle_snap_viewed trigger + pg_net + snap-cleanup Edge Function |
| MSG-05      | 17-01, 17-03 | Streak engine: 3-day activation, tiered expiry, warning notifications             | SATISFIED | update_streak_on_snap trigger handles server-authoritative writes; streakService.ts for client display |
| MSG-06      | 17-01, 17-04 | Read receipts with privacy toggle                                                 | PARTIAL   | Write path works (markConversationRead on mount + foreground); privacy toggle respected; BUT isRead = false hardcoded in ConversationScreen -- display never reflects actual read state |
| MSG-07      | 17-02, 17-04 | Message reactions (double-tap heart + 6-emoji picker)                             | SATISFIED | sendReaction inserts type='reaction' with emoji; buildReactionMap() aggregates; removeReaction sets unsent_at |
| MSG-08      | 17-02, 17-04 | Swipe-to-reply with quoted context                                                | SATISFIED | sendReply inserts with reply_preview JSONB; adaptMessage reconstructs replyTo object; needs human gesture verification |
| MSG-09      | 17-01, 17-02 | Message deletion (unsend) and delete-for-me                                      | SATISFIED | unsendMessage sets unsent_at; deleteMessageForMe inserts into message_deletions; getMessages filters client-side |
| MSG-10      | 17-05       | Screenshot detection and notification work with new backend                       | BLOCKED   | handleScreenshotDetected exists but useScreenshotDetection never wired -- screenshot listener never registered; REQUIREMENTS.md marks this [x] but code does not deliver |
| MSG-11      | 17-02, 17-05 | Tagged photo DM pipeline                                                          | SATISFIED | sendTaggedPhotoMessage sets tagged_photo_id; photoId mapped in adaptMessage; ConversationScreen wired |

**Orphaned requirements from REQUIREMENTS.md:** None -- all 11 MSG-* requirements for Phase 17 appear in at least one plan's `requirements` field.

**Note on REQUIREMENTS.md status:** MSG-10 is marked `[x]` complete in REQUIREMENTS.md and the traceability table, but the implementation is not wired. The checkbox is inaccurate.

---

### Anti-Patterns Found

| File                                    | Line | Pattern                                              | Severity | Impact                                                      |
|-----------------------------------------|------|------------------------------------------------------|----------|-------------------------------------------------------------|
| `src/screens/ConversationScreen.js`     | 482  | `isRead = false` hardcoded                           | Blocker  | Read receipt indicator always shows unread regardless of actual state |
| `src/screens/ConversationScreen.js`     | 641  | handleScreenshotDetected defined but never connected | Blocker  | Screenshot notifications never reach Supabase -- MSG-10 not delivered |
| `src/screens/NewMessageScreen.js`       | 18   | Firebase import remains                             | Warning  | `getFriendships, batchGetUsers from '../services/firebase/friendshipService'` -- Firebase dependency not removed as required by Plan 05 |

---

### Human Verification Required

#### 1. Snap Polaroid Viewer

**Test:** From camera in snap mode, capture a photo and send it to a friend. Recipient opens the snap.
**Expected:** Snap displays in Polaroid frame overlay; after viewing, snap cannot be reopened; snap file is removed from Supabase Storage
**Why human:** Visual view-once UX and server-side cleanup verification requires device interaction

#### 2. Streak Badge Colors

**Test:** Create a streak with a friend through 3, 10, and 50 snap exchanges. Observe conversation list badges.
**Expected:** 3-9 days = amber (#F5A623), 10-49 days = orange (#FF8C00), 50+ days = deep orange (#E65100), warning = red (#FF3333)
**Why human:** Visual color rendering and tier transitions require device inspection

#### 3. Swipe-to-Reply Gesture

**Test:** In a conversation with messages, swipe a message bubble leftward.
**Expected:** Reply compose UI opens with quoted message context (sender and preview text) shown above the text input
**Why human:** Gesture interaction requires physical device testing

#### 4. Real-Time Message Delivery

**Test:** Open the same conversation on two devices/simulators. Send a message from device A.
**Expected:** Message appears on device B within 2 seconds without any manual refresh
**Why human:** Requires two devices/simulators connected to Supabase with active Realtime subscriptions

---

### Gaps Summary

Three gaps block full goal achievement:

**Gap 1 -- Screenshot detection not wired (MSG-10, Blocker):** `handleScreenshotDetected` is fully implemented in ConversationScreen and correctly inserts a notification row into Supabase. However, `useScreenshotDetection` (which exists at `src/hooks/useScreenshotDetection.js`) is never imported or called in ConversationScreen. The screenshot listener is never registered, so the handler never fires. This is a 2-line fix: add the import and wire the hook.

**Gap 2 -- Read receipt display hardcoded false (MSG-06, Partial):** The write path for read receipts is fully functional -- `markConversationRead` is called on mount and foreground transitions in `useConversation`, and the last_read_at columns exist in the migration. However, `isRead` is hardcoded `false` in ConversationScreen because `last_read_at_p1/p2` are not included in the PowerSync sync rules for the conversations table. The ReadReceiptIndicator always shows the "unread" state. The 17-05 SUMMARY acknowledged this as a known issue.

**Gap 3 -- Firebase import in NewMessageScreen (Warning):** `NewMessageScreen.js` imports `getFriendships` and `batchGetUsers` from the Firebase `friendshipService` (line 18). Plan 05 required removal of all Firebase imports from messaging screens. These functions are still being called for the friends list data. The Supabase `friendshipService.ts` from Phase 16 exists and should be substituted.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
