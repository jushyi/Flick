# Requirements: Flick Messaging Upgrade

**Defined:** 2026-02-23
**Core Value:** Snaps and streaks make messaging a daily habit — ephemeral photo messages that disappear after viewing, with streak mechanics that reward consistent mutual engagement between friends.

## v1 Requirements

Requirements for the messaging upgrade. Each maps to roadmap phases.

### Read Receipts

- [x] **READ-01**: Sender can see "Read" status on their last message when the recipient has opened the conversation
- [x] **READ-02**: Read receipt uses a conversation-level `readReceipts` timestamp (not per-message writes) to minimize Firestore costs
- [x] **READ-03**: Read indicator updates in real-time via existing conversation document subscription

### Message Reactions

- [x] **REACT-01**: User can double-tap a message to add a heart reaction
- [x] **REACT-02**: User can long-press a message to open a reaction picker with 6 preset emojis
- [x] **REACT-03**: Reactions appear as emoji badges below the target message bubble
- [x] **REACT-04**: Reactions are stored as separate `type: 'reaction'` message documents (preserving message immutability)
- [x] **REACT-05**: Recipient receives a push notification when someone reacts to their message

### Reply to Message

- [ ] **REPLY-01**: User can swipe right on a message to quote-reply to it
- [x] **REPLY-02**: Reply shows a compact preview of the original message above the compose input
- [x] **REPLY-03**: Sent reply renders with a quoted message preview above the reply bubble
- [ ] **REPLY-04**: If the original message was deleted, reply shows "Original message deleted"

### Message Deletion

- [x] **DEL-01**: User can delete (unsend) their own sent messages
- [x] **DEL-02**: Deleted messages show "This message was deleted" for both users
- [x] **DEL-03**: Deletion is a soft-delete (document preserved for moderation) via Cloud Function

### Snap Messages

- [ ] **SNAP-01**: Camera button in the DM input bar opens Flick's camera for snap capture
- [ ] **SNAP-02**: User can add an optional caption to a snap before sending
- [ ] **SNAP-03**: Snap is uploaded to Firebase Storage and delivered instantly (no darkroom delay)
- [ ] **SNAP-04**: Unopened snap shows as a generic camera icon with "Snap" label in the conversation
- [ ] **SNAP-05**: Recipient taps to view snap full-screen; snap disappears after closing (view once)
- [ ] **SNAP-06**: Sender sees "Opened" status after recipient views the snap
- [ ] **SNAP-07**: Snap photos use `cachePolicy: 'none'` and short-lived signed URLs (2-5 min)
- [ ] **SNAP-08**: Cloud Function deletes snap photo from Storage after viewing; Firestore TTL as safety net for unopened snaps

### Snap Streaks

- [ ] **STRK-01**: Streak tracking begins when both users send at least one snap to each other within 24 hours
- [ ] **STRK-02**: Streak activates (visible) after 3 consecutive days of mutual snaps
- [ ] **STRK-03**: Snap button in DM input changes color and shows day count when streak is active
- [ ] **STRK-04**: Snap button shows warning color with "!" when streak is about to expire (within 4 hours)
- [ ] **STRK-05**: Push notification sent when a streak is about to expire
- [ ] **STRK-06**: Streak resets to 0 if 24 hours pass without mutual snaps
- [ ] **STRK-07**: All streak calculations are server-authoritative (Cloud Functions only, never client-side)

### Photo Tag Integration

- [ ] **TAG-01**: When a user tags a friend in a photo, that photo auto-sends as a message in their DM conversation
- [ ] **TAG-02**: Tagged photo message renders as a photo card with "tagged you in a photo" context
- [ ] **TAG-03**: Recipient can tap "Add to feed" on a tagged photo message to add it to their own feed
- [ ] **TAG-04**: Reshared photo shows "Photo by @username" attribution on the recipient's feed

### Infrastructure

- [x] **INFRA-01**: Firestore security rules updated to allow snap `viewedAt` updates by recipient
- [x] **INFRA-02**: Firestore security rules updated to allow `readReceipts` field updates on conversation documents
- [ ] **INFRA-03**: Firestore TTL policy configured on messages collection group for `expiresAt` field
- [ ] **INFRA-04**: Firebase Storage lifecycle rule configured on `snap-photos/` path (7-day auto-delete)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Screenshot Detection

- **SCRN-V2-01**: App detects screenshots while recipient is viewing a snap (using `expo-screen-capture`)
- **SCRN-V2-02**: Sender is notified when recipient screenshots a snap (push notification + in-conversation indicator)
- **SCRN-V2-03**: Screen capture is prevented while viewing snaps (`preventScreenCaptureAsync`)
- **SCRN-V2-04**: Screenshot detection works on iOS and Android 14+ (with documented workaround for older Android)
- **SCRN-V2-05**: `expo-screen-capture` installed and native EAS build created for both platforms

### Enhanced Snaps

- **SNAP-V2-01**: Snap captions with text overlay positioned on the photo
- **SNAP-V2-02**: Snap replay (view twice before disappearing)
- **SNAP-V2-03**: Snap reply (reply to a snap with another snap)

### Enhanced Streaks

- **STRK-V2-01**: Streak milestones with special visual celebrations (7, 30, 100, 365 days)
- **STRK-V2-02**: Streak recovery within a grace period after expiry

### Enhanced Interactions

- **INTER-V2-01**: Custom emoji reactions beyond the 6 presets
- **INTER-V2-02**: Message editing (not just deletion)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                         | Reason                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Typing indicators               | Creates social pressure; constant Firestore writes increase costs; low-impact vs read receipts |
| Group DMs                       | Massive complexity multiplier; 1-on-1 DM foundation needs to be solid first                    |
| Voice/video messages            | Not aligned with Flick's disposable camera identity                                            |
| End-to-end encryption           | Enormous complexity; blocks server-side moderation; Firebase encryption at rest is sufficient  |
| Message search                  | Requires Algolia/Elasticsearch; low-value for ephemeral-focused app                            |
| Gallery photo picks in snaps    | Destroys authentic, in-the-moment feel; camera-only keeps it real                              |
| Drawing/doodles on snaps        | Significant complexity; caption text covers 80% of need; can add later                         |
| Auto-disappearing text messages | Adds complexity to every message type; ephemerality is for snaps specifically                  |

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| READ-01     | Phase 1 | Complete |
| READ-02     | Phase 1 | Complete |
| READ-03     | Phase 1 | Complete |
| INFRA-01    | Phase 1 | Complete |
| INFRA-02    | Phase 1 | Complete |
| DEL-01      | Phase 2 | Complete |
| DEL-02      | Phase 2 | Complete |
| DEL-03      | Phase 2 | Complete |
| REACT-01    | Phase 2 | Complete |
| REACT-02    | Phase 2 | Complete |
| REACT-03    | Phase 2 | Complete |
| REACT-04    | Phase 2 | Complete |
| REACT-05    | Phase 2 | Complete |
| REPLY-01    | Phase 2 | Pending  |
| REPLY-02    | Phase 2 | Complete |
| REPLY-03    | Phase 2 | Complete |
| REPLY-04    | Phase 2 | Pending  |
| SNAP-01     | Phase 3 | Pending  |
| SNAP-02     | Phase 3 | Pending  |
| SNAP-03     | Phase 3 | Pending  |
| SNAP-04     | Phase 3 | Pending  |
| SNAP-05     | Phase 3 | Pending  |
| SNAP-06     | Phase 3 | Pending  |
| SNAP-07     | Phase 3 | Pending  |
| SNAP-08     | Phase 3 | Pending  |
| INFRA-03    | Phase 3 | Pending  |
| INFRA-04    | Phase 3 | Pending  |
| STRK-01     | Phase 4 | Pending  |
| STRK-02     | Phase 4 | Pending  |
| STRK-03     | Phase 4 | Pending  |
| STRK-04     | Phase 4 | Pending  |
| STRK-05     | Phase 4 | Pending  |
| STRK-06     | Phase 4 | Pending  |
| STRK-07     | Phase 4 | Pending  |
| TAG-01      | Phase 5 | Pending  |
| TAG-02      | Phase 5 | Pending  |
| TAG-03      | Phase 5 | Pending  |
| TAG-04      | Phase 5 | Pending  |

**Coverage:**

- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---

_Requirements defined: 2026-02-23_
_Last updated: 2026-02-23 — deferred screenshot detection (SCRN) to v2, removed native build requirement_
