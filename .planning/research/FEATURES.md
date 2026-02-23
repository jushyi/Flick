# Feature Research: Social Messaging Upgrade

**Domain:** Social messaging features for a friends-only disposable camera app (Flick)
**Researched:** 2026-02-23
**Confidence:** MEDIUM-HIGH (well-established patterns from Snapchat, Instagram, iMessage, WhatsApp; technical feasibility verified against existing codebase and Expo SDK)

## Context: What Already Exists

The app has a working DM foundation:

- Text and GIF messages with real-time Firestore subscriptions
- Conversation list with unread counts and soft-delete
- Cursor-based pagination for message history
- Push notifications for new messages via `onNewMessage` Cloud Function
- Photo tagging (select friends during darkroom triage, stored as `taggedUserIds` on photo documents)
- `messageService.js` with `{ success, error }` pattern; message types `'text' | 'gif'`
- `MessageBubble` component with basic text/GIF rendering, tap-to-show timestamps

The message schema is simple and extensible:

```
messages/{id}: { senderId, text, gifUrl, type: 'text'|'gif', createdAt }
```

Adding new types (snap, reaction, reply, system) means extending the `type` field and the `MessageBubble` rendering logic.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any modern social messaging experience. Missing these makes DMs feel unfinished.

| Feature                                 | Why Expected                                                                                                                                                                                                        | Complexity | Notes                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Read Receipts**                       | Every major messaging app (iMessage, WhatsApp, Instagram, Snapchat) shows delivered/read status. Users expect to know if their message was seen.                                                                    | LOW        | Add `status: 'sent'                                                                                                                                                                                                                                                                                                                                             | 'delivered' | 'read'`and`readAt`field to message docs. Update on conversation open via existing`markConversationRead`. The existing unread count system already tracks "read" at conversation level; this extends it to per-message visibility. |
| **Message Reactions (Emoji Tapback)**   | iMessage, Instagram, WhatsApp, Snapchat all support quick emoji reactions on messages. Reactions grew 44% on Snapchat in 2025. They let users acknowledge messages without typing.                                  | MEDIUM     | Industry standard: double-tap for heart/default emoji, long-press for emoji picker (6 preset + custom). Store as subcollection or map on message doc: `reactions: { [userId]: emoji }`. Render as small pill below the message bubble.                                                                                                                          |
| **Reply to Message (Quote Reply)**      | WhatsApp, Instagram, iMessage, Telegram all support replying to a specific message. Essential for context in busy threads. Standard gesture: swipe right on a message to quote it.                                  | MEDIUM     | Add `replyTo: { messageId, senderId, text, type }` field on message docs. Denormalize the replied-to content (avoids extra read). Render as a compact preview bubble above the new message. Swipe-to-reply gesture using `react-native-reanimated` (already in project).                                                                                        |
| **Message Deletion (Unsend)**           | iMessage allows unsend within 2 minutes. WhatsApp allows "Delete for Everyone." Instagram supports unsending. Users expect to be able to retract mistakes.                                                          | LOW        | Soft-delete: set `deleted: true` and `deletedAt` on the message doc. Replace bubble content with "Message deleted" text (like WhatsApp). Time limit optional but recommended (e.g., 5 minutes). Server-side: Cloud Function can enforce time window.                                                                                                            |
| **Snap Messages (Ephemeral Photo DMs)** | Snapchat's core mechanic. Instagram has "View Once" photos. WhatsApp has "View Once." Sending camera-only photos in DMs that disappear after viewing is expected for any app with a camera + messaging combination. | HIGH       | New message type `'snap'`. Camera capture in conversation context, upload to Firebase Storage, store signed URL in message. After recipient views: mark as `viewed: true`, schedule server-side cleanup (Cloud Function deletes Storage file after viewing + grace period). Requires new UI: full-screen viewer, view-once lock, "opened" indicator for sender. |

### Differentiators (Competitive Advantage)

Features that set Flick apart. These aren't expected but create stickiness and align with Flick's disposable camera identity.

| Feature                                                 | Value Proposition                                                                                                                                                                                                                                                                                     | Complexity | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Snap Streaks**                                        | Borrowed from Snapchat but tuned for Flick's identity. Streaks reward consistent mutual photo sharing, turning DMs into a daily habit. Snapchat's streak mechanic is proven to drive DAU. Flick's 3-day threshold (vs Snapchat's 1-day) is more forgiving and fits a less-intense, friends-only vibe. | HIGH       | Track per-friendship: `streaks/{conversationId}: { currentStreak, longestStreak, lastSnapSentAt: { [userId]: Timestamp }, startedAt }`. Both users must send a snap within 24h of each other. Streak starts after 3 consecutive mutual-snap days. Hourglass warning at ~4h before expiry. Cloud Function `processStreakExpirations` runs on schedule. Visual: snap button color change + day counter. Push notification before streak expires. |
| **Tagged Photo to DM**                                  | Unique to Flick: when you tag a friend in a darkroom photo, the photo auto-sends into your DM thread as a special message type. This bridges the photo lifecycle (capture > darkroom > feed) with messaging, creating natural conversation starters that no competitor offers.                        | MEDIUM     | New message type `'tagged_photo'`. On triage, when `taggedUserIds` is written, a Cloud Function creates a system message in the relevant conversation: `{ type: 'tagged_photo', photoId, photoURL, senderId }`. Render as a photo card in the chat with "tagged you in a photo" context. Tapping opens PhotoDetail.                                                                                                                            |
| **Add Tagged Photo to Feed (Reshare with Attribution)** | Recipient of a tagged photo can reshare it to their own feed with "Photo by @username" attribution. This rewards photographers and spreads content organically within the friends-only network. No competitor in the camera-social space does this.                                                   | MEDIUM     | From the tagged-photo message in chat, add a "Add to Feed" action. Creates a new photo document owned by the resharer with `originalPhotoId`, `originalPhotographerId`, `attribution: "Photo by @username"`. Feed rendering shows attribution badge. Photographer gets notified.                                                                                                                                                               |
| **Screenshot Detection + Alert**                        | Snapchat and Instagram Vanish Mode notify senders when recipients screenshot. Reinforces the ephemeral trust contract. For a camera app where photos "develop," this extends the ethos of impermanence into DMs.                                                                                      | LOW        | `expo-screen-capture` provides `addScreenshotListener()` out of the box. Works in Expo Go, no custom build needed. On detection: send a system message `{ type: 'screenshot', userId }` to the conversation. Render as "[username] took a screenshot" (like Snapchat). iOS fully supported; Android 14+ supported natively, Android 13- needs `READ_MEDIA_IMAGES` permission.                                                                  |
| **Streak Visual on Snap Button**                        | The camera/snap button in a conversation changes color and shows the streak day count. Creates ambient awareness of streak status without cluttering the UI. The hourglass "!" warning state adds urgency.                                                                                            | LOW        | Pure UI: conditional styling on the snap capture button based on streak data. Color tiers (e.g., day 3-7 orange, 7-30 red, 30+ special). No backend changes beyond streak data that already exists for the streak feature.                                                                                                                                                                                                                     |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but should be deliberately excluded.

| Feature                             | Why Requested                                                            | Why Problematic                                                                                                                                                                                                                                                                                                                                                   | Alternative                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typing Indicators**               | "Every chat app has them." Users want to know when someone is composing. | Creates social pressure and anxiety ("they're typing... stopped... typing again"). Also adds constant Firestore writes for ephemeral state, increasing costs. For a friends-only, low-pressure app, this undermines the vibe.                                                                                                                                     | Show read receipts instead. Knowing they _saw_ your message is enough signal without the real-time pressure.                                       |
| **Gallery Photo Picks in Snaps**    | "Let me send photos from my camera roll in DMs."                         | Destroys the authentic, in-the-moment feel that defines Flick. If users can curate from gallery, snap messages become just regular photo DMs. Snapchat itself enforces camera-only for snaps (gallery sends are regular messages, not snaps).                                                                                                                     | Camera-only snaps keep it real. Users who want to share existing photos can do so via the tagging/feed system.                                     |
| **Drawing/Doodles on Snaps**        | "Snapchat has drawing and stickers on snaps."                            | Adds significant complexity (drawing canvas, color picker, undo, layer management) for a v1 feature. Text caption covers 80% of the communication need. Can always add later.                                                                                                                                                                                     | Caption text on snaps. Simple, fast, consistent with the pixel-art retro aesthetic.                                                                |
| **Group DMs**                       | "I want to message multiple friends at once."                            | Group messaging is a massive complexity multiplier: read receipts per user, typing indicators, @mentions, admin controls, group naming, member management, message delivery guarantees to N users. The 1-on-1 DM foundation needs to be solid first.                                                                                                              | Defer to v2. The existing "shared rolls" concept from the original Lapse app is a better fit for group photo sharing in Flick's identity.          |
| **Voice/Video Messages**            | "Let me send voice notes or video clips."                                | Not aligned with Flick's disposable camera identity. The app is about captured _moments_, not real-time communication. Voice and video recording also require additional permissions, storage costs, and playback UI.                                                                                                                                             | Stay photo-focused. The snap (ephemeral photo) is the voice note equivalent in Flick's world.                                                      |
| **End-to-End Encryption**           | "Privacy is important, messages should be encrypted."                    | E2EE is enormously complex to implement correctly (key exchange, device management, message retention for moderation becomes impossible). For a friends-only social app (not a security tool), server-side encryption at rest (which Firebase provides) is sufficient. Adding E2EE also blocks features like server-side content moderation and abuse prevention. | Firebase's default encryption at rest + TLS in transit. Clearly communicate privacy practices in-app.                                              |
| **Message Search**                  | "I want to find old messages."                                           | Firestore does not support full-text search natively. Requires Algolia or Elasticsearch integration, significantly increasing infrastructure complexity and cost. Low-value for an app focused on ephemeral, in-the-moment communication.                                                                                                                         | Defer indefinitely. Ephemeral snaps are gone by design. For persistent text, users can scroll.                                                     |
| **Auto-Disappearing Text Messages** | "All messages should disappear like Snapchat."                           | Adds complexity to every message type. Snapchat's disappearing chat creates confusion (users save messages they want to keep, defeating the purpose). For Flick, ephemerality is specifically the _snap photo_ mechanic, not all messages.                                                                                                                        | Snaps are ephemeral. Text and GIF messages persist (like Snapchat's saved messages). Clear distinction between permanent chat and ephemeral snaps. |

---

## Feature Dependencies

```
Read Receipts
    (no dependencies, extends existing markConversationRead)

Message Reactions
    (no dependencies, extends MessageBubble)

Reply to Message
    (no dependencies, extends message schema + MessageBubble)

Message Deletion
    (no dependencies, extends message schema + MessageBubble)

Snap Messages
    └── requires ── Firebase Storage upload path for DM snaps
    └── requires ── Full-screen snap viewer component
    └── requires ── Cloud Function for snap cleanup after viewing
    └── enables ── Snap Streaks
    └── enables ── Screenshot Detection (most valuable on snaps)

Snap Streaks
    └── requires ── Snap Messages (streaks count mutual snaps)
    └── requires ── Cloud Function for streak expiration checks
    └── enhances ── Snap button visual (streak indicator)

Screenshot Detection
    └── requires ── expo-screen-capture (already available in Expo SDK)
    └── enhances ── Snap Messages (most value when detecting snap screenshots)
    └── works on ── any conversation screen (detects all screenshots)

Tagged Photo to DM
    └── requires ── Existing photo tagging system (already built)
    └── requires ── Cloud Function to create DM message on tag
    └── enables ── Add Tagged Photo to Feed (reshare)

Add Tagged Photo to Feed
    └── requires ── Tagged Photo to DM (needs the tagged photo message in chat)
    └── requires ── Attribution system on photo documents
```

### Dependency Notes

- **Snap Streaks require Snap Messages:** Streaks are counted by mutual snap exchanges. Without snap messages, there's nothing to streak on. Build snaps first.
- **Screenshot Detection enhances Snap Messages:** While screenshot detection works globally, its primary value is on ephemeral snap content. Ship them together or screenshot detection right after snaps.
- **Tagged Photo to DM is independent of messaging upgrades:** It extends the existing tagging system with a Cloud Function trigger. Can be built in parallel with other messaging features.
- **Add Tagged Photo to Feed requires Tagged Photo to DM:** The reshare action happens from within the DM thread's tagged photo message. The DM message must exist first.
- **Read Receipts, Reactions, Replies, and Deletion are all independent:** They can be built in any order or in parallel. None depend on each other.

---

## MVP Definition

### Launch With (v1 -- Messaging Foundations)

Minimum viable messaging upgrade. These features fill the most glaring gaps in the current DM experience.

- [x] **Read Receipts** -- Lowest complexity table-stakes feature. Every user expects this. Extends existing `markConversationRead` pattern.
- [x] **Message Reactions** -- High engagement, proven by 44% growth on Snapchat in 2025. Double-tap for heart, long-press for picker.
- [x] **Message Deletion (Unsend)** -- Simple soft-delete with "Message deleted" replacement. Prevents the "I sent that to the wrong person" panic.
- [x] **Reply to Message** -- Context threading with swipe-to-reply gesture. Essential once conversations get longer.

### Launch With (v1.1 -- Ephemeral Snaps)

The signature differentiator. Should follow shortly after v1 foundations.

- [x] **Snap Messages** -- Camera-only ephemeral photos in DMs. View-once mechanic with server-side cleanup.
- [x] **Screenshot Detection + Alert** -- Ships with snaps to reinforce ephemeral trust. Uses `expo-screen-capture`.

### Add After Validation (v1.2 -- Engagement Loop)

Features that drive daily retention. Add once snap messages are working and users are sending them.

- [ ] **Snap Streaks** -- Trigger: users are sending snaps daily. Add streak tracking to reward and reinforce the behavior.
- [ ] **Streak Visual on Snap Button** -- Trigger: streaks are active. Add ambient visual feedback.
- [ ] **Tagged Photo to DM** -- Trigger: users are tagging friends in photos. Connect tags to DM threads for natural conversation starters.

### Future Consideration (v2+)

Features to defer until the messaging upgrade is validated and adopted.

- [ ] **Add Tagged Photo to Feed (Reshare)** -- Defer: requires tagged-to-DM first, plus attribution system. Build after tagging-to-DM is validated.
- [ ] **Snap Captions** -- Defer: text overlay on snap photos. Nice-to-have, not essential for v1 snaps.
- [ ] **Snap Replay (view twice)** -- Defer: Snapchat offers one replay per snap. Adds complexity to the view-once lifecycle.

---

## Feature Prioritization Matrix

| Feature                  | User Value | Implementation Cost | Priority | Phase |
| ------------------------ | ---------- | ------------------- | -------- | ----- |
| Read Receipts            | HIGH       | LOW                 | **P1**   | v1    |
| Message Reactions        | HIGH       | MEDIUM              | **P1**   | v1    |
| Message Deletion         | MEDIUM     | LOW                 | **P1**   | v1    |
| Reply to Message         | MEDIUM     | MEDIUM              | **P1**   | v1    |
| Snap Messages            | HIGH       | HIGH                | **P1**   | v1.1  |
| Screenshot Detection     | MEDIUM     | LOW                 | **P1**   | v1.1  |
| Snap Streaks             | HIGH       | HIGH                | **P2**   | v1.2  |
| Streak Visual            | MEDIUM     | LOW                 | **P2**   | v1.2  |
| Tagged Photo to DM       | MEDIUM     | MEDIUM              | **P2**   | v1.2  |
| Add Tagged Photo to Feed | LOW        | MEDIUM              | **P3**   | v2    |

**Priority key:**

- P1: Must have for the messaging upgrade to feel complete
- P2: Should have, drives daily engagement
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature                      | Snapchat                                                        | Instagram DMs                                                 | iMessage                                 | WhatsApp                                                | Flick (Proposed)                                                         |
| ---------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Read receipts**            | Blue arrow = opened                                             | "Seen" with timestamp                                         | "Read" with timestamp (optional)         | Blue double-check                                       | Delivered/Read status per message                                        |
| **Reactions**                | Emoji reactions (heart most popular, 44% growth in 2025)        | Double-tap for heart, long-press for 6 presets + custom emoji | Tapback: 6 presets + any emoji (iOS 18+) | Double-tap for heart, long-press for 6 presets + custom | Double-tap for heart, long-press for preset picker                       |
| **Quote reply**              | Swipe right on message                                          | Swipe right on message                                        | Long-press > Reply                       | Swipe right on message                                  | Swipe right on message                                                   |
| **Unsend**                   | Hold > Delete (sender only)                                     | Hold > Unsend                                                 | Unsend within 2 min, Edit within 15 min  | Delete for Everyone                                     | Soft-delete within 5 min, "Message deleted" shown                        |
| **Ephemeral photos**         | Core mechanic: camera snaps, view-once, auto-delete             | "View Once" photos/videos in DMs, Vanish Mode                 | N/A                                      | "View Once" photos/videos                               | Camera-only snap messages, view-once, server cleanup                     |
| **Streaks**                  | 24h mutual snap exchange, fire emoji + count, hourglass warning | N/A                                                           | N/A                                      | N/A                                                     | 24h mutual snap exchange, 3-day threshold to start, button color + count |
| **Screenshot alert**         | "[Name] took a screenshot!" system message                      | Notifies in Vanish Mode only                                  | N/A                                      | N/A                                                     | System message on screenshot detection                                   |
| **Photo tag to DM**          | N/A                                                             | Share post to DM thread                                       | N/A                                      | N/A                                                     | **Unique**: tagged photo auto-sends to DM                                |
| **Reshare with attribution** | N/A                                                             | Repost to Stories with attribution                            | N/A                                      | N/A                                                     | **Unique**: add tagged photo to own feed with "Photo by @user"           |

### Key Competitive Insights

1. **Reactions are universal now.** Every major platform supports them. Double-tap for heart is the de facto standard. Long-press for expanded emoji is the secondary interaction. Not having reactions makes a messaging app feel outdated.

2. **Swipe-to-reply is the standard gesture.** WhatsApp pioneered it, Instagram and Snapchat adopted it. Users' muscle memory expects swipe-right to quote-reply. Do not invent a new gesture.

3. **View-once photos are expected when camera + DMs coexist.** Instagram, WhatsApp, and Snapchat all offer this. For a _camera app_ with DMs, not having ephemeral photo messages is a glaring omission.

4. **Streaks are a Snapchat-unique retention mechanic.** No other major platform has copied streaks. This means it's either (a) too tied to Snapchat's identity, or (b) an untapped opportunity. For Flick, the 3-day threshold and friends-only context make it feel less gamified and more relational. This is Flick's biggest retention opportunity.

5. **Tagged photo to DM and reshare are genuinely novel.** No competitor bridges photo tagging into the DM thread as a conversation starter. This is Flick's unique differentiator that no one else offers.

---

## Implementation Complexity Deep-Dive

### Read Receipts (LOW)

- Extend message schema: add `status: 'sent' | 'delivered' | 'read'`
- On `markConversationRead()` (already called on conversation open), batch-update all unread messages to `read`
- Render: small text below last message ("Delivered" / "Read" / checkmarks)
- No new Cloud Functions needed; existing `markConversationRead` pattern handles it

### Message Reactions (MEDIUM)

- Schema: `reactions` map on message doc: `{ [userId]: { emoji, reactedAt } }`
- Gesture: double-tap on `MessageBubble` triggers heart reaction; long-press opens reaction picker
- Picker UI: horizontal row of 6 preset emojis (heart, thumbs up, thumbs down, laugh, surprise, fire) matching Flick's pixel art style
- Render: small emoji pill(s) below the message bubble, showing unique emojis + count
- Cloud Function: optional push notification "reacted [emoji] to your message" (can batch like existing `reactionBatches`)
- Conflict with existing `onPress` (toggleTimestamp): move timestamp toggle to a different gesture or combine with long-press menu

### Reply to Message (MEDIUM)

- Schema: `replyTo: { messageId, senderId, text, type }` on message doc (denormalized)
- Gesture: swipe-right on message using `react-native-reanimated` `PanGestureHandler`
- UI: shows compact preview of replied-to message above the compose input, renders as mini-bubble above the reply message
- Edge case: if replied-to message is deleted, show "Original message deleted"

### Message Deletion (LOW)

- Schema: add `deleted: true`, `deletedAt: Timestamp`, `deletedBy: userId` to message doc
- Client: replace bubble content with italicized "This message was deleted"
- Optional: time window enforcement (5 minutes) via Cloud Function validation
- Keep the document (don't hard-delete) for moderation purposes (aligns with existing "Messages are permanent, retained for moderation" design)

### Snap Messages (HIGH)

- New message type `'snap'` with fields: `{ snapURL, viewed, viewedAt, expiresAt, caption }`
- Capture: mini camera within conversation (floating button or toolbar icon), uses existing `useCamera` patterns
- Upload: Firebase Storage path `snaps/{conversationId}/{messageId}` with signed URL
- View: full-screen overlay, tap-and-hold to view (like Snapchat), release or timeout closes
- After view: set `viewed: true`, `viewedAt: serverTimestamp()`
- Cleanup: Cloud Function runs on schedule, deletes Storage files where `viewed: true` AND `viewedAt` > 24h ago
- Sender sees: "Opened" or "Delivered" status (not the photo again)
- Significant new UI work: snap viewer, snap capture in conversation, snap message bubble (shows "Snap" with status, not the photo)

### Snap Streaks (HIGH)

- New Firestore document: `streaks/{conversationId}` with fields for tracking mutual snap counts
- Logic: both users must send AND open at least one snap within 24h of each other
- Streak starts after 3 consecutive days of mutual snaps
- Cloud Function `processStreakExpirations`: runs every 30 minutes, checks all active streaks, expires those past deadline
- Push notification: "Your streak with [name] is about to expire!" at ~4h before deadline
- Streak recovery: NOT offered in v1 (Snapchat monetizes streak recovery; Flick should keep it simple)
- Counter display: in conversation header and on snap button

### Screenshot Detection (LOW)

- Use `expo-screen-capture`'s `useScreenshotListener()` hook in `ConversationScreen`
- On detection: call service function to create system message `{ type: 'screenshot', screenshottedBy: userId }`
- Render as centered, gray, italicized "[Name] took a screenshot" (like Snapchat)
- Optional: also use `preventScreenCaptureAsync()` while viewing snaps (stronger protection, but users find workarounds)
- Platform notes: iOS fully supported; Android 14+ works without permissions; Android 13- needs `READ_MEDIA_IMAGES`

### Tagged Photo to DM (MEDIUM)

- Cloud Function trigger: when `taggedUserIds` is written on a photo doc (during triage), for each tagged user, create a message in the relevant conversation
- Message type `'tagged_photo'` with fields: `{ photoId, photoURL, taggerUserId }`
- Conversation auto-created if none exists (uses existing `getOrCreateConversation`)
- Render as a photo card in chat with "tagged you in a photo" header, tapping navigates to PhotoDetail
- Edge case: tagging multiple friends sends to multiple conversations independently

---

## Sources

- [Snapchat Streak mechanics - Official Snapchat Support](https://help.snapchat.com/hc/en-us/articles/7012394193684-How-do-Streaks-work-and-when-do-they-expire) -- HIGH confidence
- [Snapchat 2025 feature trends and reaction growth statistics](https://newsroom.snap.com/snapchat-recap-2025) -- HIGH confidence
- [Instagram DM features including Vanish Mode, reactions, replies](https://www.socialchamp.com/blog/instagram-vanish-mode/) -- MEDIUM confidence
- [Apple Tapback reactions documentation](https://support.apple.com/guide/iphone/react-with-tapbacks-iph018d3c336/ios) -- HIGH confidence
- [expo-screen-capture API documentation](https://docs.expo.dev/versions/latest/sdk/screen-capture/) -- HIGH confidence (official Expo docs)
- [WhatsApp double-tap reactions UX](https://www.nextpit.com/how-tos/whatsapp-double-tap-react-emoji-how-to-use) -- MEDIUM confidence
- [Messaging app development features guide 2025](https://www.jploft.com/blog/how-to-develop-a-messaging-app) -- LOW confidence (general guide)
- [Snapchat hourglass timer duration analysis](https://growthscribe.com/how-long-does-the-hourglass-last-on-snapchat/) -- MEDIUM confidence
- [Lapse app official features and social removal announcement](https://lapse.com/) -- MEDIUM confidence
- [BeReal RealChat messaging feature](https://techcrunch.com/2023/06/01/bereal-is-adding-a-messaging-feature-called-realchat/) -- MEDIUM confidence

---

_Feature research for: Flick Messaging Upgrade_
_Researched: 2026-02-23_
