# Roadmap: Flick Messaging Upgrade

**Created:** 2026-02-23
**Phases:** 5
**Depth:** Comprehensive

## Phase Overview

| Phase | Name                                   | Goal                                              | Requirements              | Status                  |
| ----- | -------------------------------------- | ------------------------------------------------- | ------------------------- | ----------------------- |
| 1     | Message Infrastructure & Read Receipts | Extended message schema + read receipts UI        | READ-01..03, INFRA-01..02 | In Progress (2/4 plans) |
| 2     | Message Interactions                   | Complete                                          | 2026-02-24                | Complete (6/6 plans)    |
| 3     | Snap Messages                          | Ephemeral photo DMs with view-once mechanic       | SNAP-01..08, INFRA-03..04 | Complete (6/6 plans)    |
| 4     | Snap Streaks                           | Daily mutual snap tracking with visual indicators | STRK-01..07               | Not Started             |
| 5     | Photo Tag Integration                  | Tagged photos auto-send to DM + reshare to feed   | TAG-01..04                | Not Started             |

## Phase 1: Message Infrastructure & Read Receipts

**Goal:** Establish the extended message schema and Firestore rules that every subsequent phase depends on. Ship read receipts as the first user-visible improvement.

**Why first:** Every feature in Phases 2-5 depends on the message type polymorphism and updated Firestore security rules. Read receipts are low complexity and immediately visible — users notice them on day one.

**Requirements:** READ-01, READ-02, READ-03, INFRA-01, INFRA-02

**Key deliverables:**

- Extended message schema supporting `type` discriminator field for new message types
- Updated Firestore security rules: allow snap `viewedAt`/`screenshotted` updates, allow `readReceipts` on conversation docs
- `readReceipts` field on conversation document with `lastReadAt` per user
- Read receipt indicator below the last read message in ConversationScreen
- Extended `markConversationRead` to update `readReceipts` timestamp
- Extended `onNewMessage` Cloud Function to handle new message types in `lastMessage` preview

**Success criteria:**

- Sender sees "Read" indicator when recipient opens conversation
- Read indicator updates in real-time
- Firestore rules allow narrow updates for snap fields and readReceipts (verified with rules tests)
- No per-message write operations for read tracking

**Plans:** 2/4 plans complete

Plans:

- [x] 01-01-PLAN.md — Backend infrastructure: Firestore rules, messageService readReceipts, useConversation subscription, Cloud Function extension, tests
- [x] 01-02-PLAN.md — Read receipt UI: ReadReceiptIndicator component, ConversationScreen integration, ConversationRow status previews + count badge, privacy toggle

---

## Phase 2: Message Interactions

**Goal:** Add emoji reactions, quote replies, and message deletion — the three core message interactions that make DMs feel complete.

**Why this order:** Depends on Phase 1's message type polymorphism. Independent of snaps/streaks. Lower complexity than Phase 3, validates the type system.

**Requirements:** REACT-01, REACT-02, REACT-03, REACT-04, REACT-05, REPLY-01, REPLY-02, REPLY-03, REPLY-04, DEL-01, DEL-02, DEL-03

**Key deliverables:**

- `ReactionPicker` component: 6 preset emojis, appears on long-press of MessageBubble
- Double-tap heart shortcut on messages
- Reaction messages (`type: 'reaction'`) with client-side aggregation in `useConversation`
- Reaction emoji badges rendered below target messages
- Swipe-to-reply gesture on MessageBubble using reanimated PanGestureHandler
- `ReplyPreview` component above DMInput showing quoted message
- Reply messages with `replyTo` field containing denormalized original message preview
- Message deletion (soft-delete) via Cloud Function
- "This message was deleted" rendering for deleted messages
- Push notifications for reactions
- Extended `onNewMessage` Cloud Function for reaction/reply notification templates

**Success criteria:**

- Double-tap adds heart, long-press opens picker with 6 emojis
- Reactions display as pills below the target message
- Swipe right on message activates reply mode with preview
- Replies render with quoted context above
- User can delete own messages; both users see "deleted" state
- Reaction notifications delivered to recipient

**Plans:** 6/6 plans complete

Plans:

- [x] 02-01-PLAN.md — Service layer: sendReaction, removeReaction, sendReply, deleteMessageForMe
- [x] 02-02-PLAN.md — Cloud Functions: unsendMessage callable, onNewMessage reaction/reply handling, Firestore rules
- [x] 02-03-PLAN.md — Hook layer: useConversation reaction aggregation + useMessageActions state management
- [x] 02-04-PLAN.md — MessageBubble refactor: gesture composition, ReactionBadges, reply rendering, deleted states
- [x] 02-05-PLAN.md — Overlay components: ReactionPicker, ReplyPreview, PixelConfirmDialog
- [x] 02-06-PLAN.md — Integration: ConversationScreen wiring, DMInput reply support, visual verification

---

## Phase 3: Snap Messages

**Goal:** Ship ephemeral photo DMs — camera-only snaps that disappear after viewing, with server-side cleanup.

**Why this order:** Most complex feature. Depends on Phase 1 for message type support. Independent of Phase 2. Must ship before Phase 4 (streaks depend on snaps). No native build required — screenshot detection deferred to v2.

**Requirements:** SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05, SNAP-06, SNAP-07, SNAP-08, INFRA-03, INFRA-04

**Key deliverables:**

- Camera button in DMInput bar that opens snap capture flow
- `snapService.js`: upload snap to `snap-photos/` Storage path, send snap message, mark as viewed
- `SnapViewer` component: full-screen display, auto-dismiss on close
- Snap message bubble (generic camera icon, "Snap" label, "Opened"/"Delivered" status)
- Optional caption input before sending snap
- Short-lived signed URLs for snap photos (2-5 min, separate from 7-day feed URLs)
- `expo-image` with `cachePolicy: 'none'` for snap rendering
- `onSnapViewed` Cloud Function: delete Storage file + clean up Firestore document on view
- `cleanupExpiredSnaps` scheduled Cloud Function: catch orphaned snaps after 48h
- Firestore TTL policy on messages collection group (`expiresAt` field)
- Firebase Storage lifecycle rule on `snap-photos/` path (7-day auto-delete)

**Success criteria:**

- User can capture and send snap from within a conversation
- Recipient sees generic "Snap" icon, taps to view full-screen
- Snap disappears after closing viewer (cannot reopen)
- Sender sees "Opened" after recipient views
- Snap photo deleted from Storage within minutes of viewing
- Orphaned snaps auto-deleted after 48h
- Snap images do not persist in device cache

**Plans:** 6/6 plans complete

Plans:

- [x] 03-01-PLAN.md — Snap service layer + Cloud Functions (upload, send, mark viewed, signed URLs, cleanup)
- [x] 03-02-PLAN.md — Snap capture flow (SnapCameraModal + SnapPreviewScreen with Polaroid frame and caption)
- [x] 03-03-PLAN.md — Snap viewing experience (SnapBubble states + SnapViewer full-screen Polaroid viewer)
- [x] 03-04-PLAN.md — Integration (DMInput camera morph, MessageBubble delegation, ConversationScreen wiring, ConversationRow updates)
- [x] 03-05-PLAN.md — Infrastructure (Storage rules, Firestore rules, TTL/lifecycle documentation)
- [x] 03-06-PLAN.md — Test suite validation + visual verification checkpoint

---

## Phase 4: Snap Streaks

**Goal:** Add streak mechanics that reward daily mutual snap exchanges — activation at 3 days, visual indicators on the snap button, expiry warnings, and push notifications.

**Why this order:** Strictly depends on Phase 3 (streaks count mutual snap exchanges). Server-authoritative design prevents manipulation.

**Requirements:** STRK-01, STRK-02, STRK-03, STRK-04, STRK-05, STRK-06, STRK-07

**Key deliverables:**

- `streaks/` Firestore collection with deterministic IDs matching conversation pattern
- Streak state machine: inactive -> building -> active -> warning -> expired
- `streakService.js`: read/subscribe to streak data, derive UI state
- `useStreaks` hook: real-time streak subscription, countdown timer for expiry
- `StreakIndicator` component: fire icon + day count, hourglass warning
- Snap button color changes: default -> streak active (colored + count) -> warning (warning color + "!")
- Extended `onNewMessage` Cloud Function: update `lastSnapBy` on snap send, evaluate mutual snaps, increment streak
- `processStreakExpiry` scheduled Cloud Function (every 30 min): expire dead streaks, set warning state, send push notifications
- Push notification: "Your streak with [Name] is about to expire!"
- 24-hour rolling window using `serverTimestamp()` only (no client timestamps)
- Streak indicator in ConversationHeader

**Success criteria:**

- Both users sending snaps for 3 consecutive days activates streak with visible counter
- Snap button changes color and shows day count when streak active
- Warning state appears within 4 hours of expiry with "!" indicator
- Push notification sent when streak is about to expire
- Streak resets to 0 after 24h without mutual snaps
- Streak state cannot be manipulated by client (verified with security rules)

**Estimated plans:** 5-7

---

## Phase 5: Photo Tag Integration

**Goal:** Connect the existing photo tagging system to DMs — tagged photos auto-send into conversations, and recipients can reshare to their own feed with attribution.

**Why last:** Depends only on Phase 1's message type system. Placed last to let core messaging stabilize first. Highest integration surface with existing photo system.

**Requirements:** TAG-01, TAG-02, TAG-03, TAG-04

**Key deliverables:**

- Extended Cloud Function: when `taggedUserIds` is written on a photo document, create `type: 'tagged_photo'` message in each relevant DM conversation
- Auto-create conversation if none exists (using existing `getOrCreateConversation`)
- Tagged photo message rendering: photo card with "tagged you in a photo" header
- Tap tagged photo message opens PhotoDetail modal
- "Add to feed" action on tagged photo messages
- New photo document created for recipient with `attribution: { originalPhotoId, photographerId, photographerName }`
- Reshared photo shows "Photo by @username" on recipient's feed
- Photographer gets notified when their photo is reshared
- Edge case: tagging multiple friends sends to multiple conversations independently

**Success criteria:**

- Tagging a friend in a photo creates a message in their shared DM
- Tagged photo renders as photo card in conversation
- Recipient can add tagged photo to their own feed
- Reshared photo shows attribution ("Photo by @username")
- Photographer receives notification of reshare
- Multiple tags create messages in multiple conversations

**Estimated plans:** 5-7

---

## Phase Dependencies

```
Phase 1 --> Phase 2 (needs message type system)
Phase 1 --> Phase 3 (needs message type system + Firestore rules)
Phase 3 --> Phase 4 (streaks count snap exchanges)
Phase 1 --> Phase 5 (needs message type system)
```

Phases 2 and 3 are independent of each other.
Phase 5 is independent of Phases 2, 3, and 4.

## Risk Register

| Risk                                   | Likelihood | Impact | Mitigation                                                                                |
| -------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------- |
| Snap photo persistence in device cache | HIGH       | MEDIUM | `cachePolicy: 'none'`, short-lived URLs, explicit cleanup — designed from day one         |
| Firestore cost increase from reactions | LOW        | MEDIUM | Reactions are separate docs, but 1-on-1 DMs have low volume; monitor billing alerts       |
| Streak timezone edge cases             | MEDIUM     | HIGH   | Server-authoritative 24h rolling window; no client timestamps; extensive timezone testing |

---

_Roadmap created: 2026-02-23_
_Last updated: 2026-02-24 — Phase 3 complete: 6/6 plans, all SNAP requirements verified on device_
