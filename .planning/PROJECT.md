# Flick — Messaging Upgrade

## What This Is

A full social messaging experience within Flick's DMs — ephemeral snap photos with Polaroid-framed viewing, streak mechanics rewarding daily mutual exchanges, emoji reactions and swipe-to-reply, read receipts with privacy controls, photo tag integration with attribution resharing, and message management. DMs are now a core daily engagement loop, not a secondary feature.

## Core Value

Snaps and streaks make messaging a daily habit — ephemeral photo messages that disappear after viewing, with streak mechanics that reward consistent mutual engagement between friends.

## Requirements

### Validated

- ✓ Text messaging with real-time delivery — existing
- ✓ GIF messaging via Giphy SDK — existing
- ✓ Conversation list with unread counts — existing
- ✓ Cursor-based message pagination — existing
- ✓ Soft-delete conversations (per-user) — existing
- ✓ Push notifications for new messages — existing
- ✓ New message screen with friend search — existing
- ✓ Photo tagging on capture — existing
- ✓ Read receipts (delivered → read status) — v1.0
- ✓ Read receipt privacy toggle (mutual model) — v1.0
- ✓ Message reactions (double-tap heart + 6-emoji picker) — v1.0
- ✓ Reply to message (swipe-to-reply with quoted context) — v1.0
- ✓ Message deletion (unsend own messages via Cloud Function) — v1.0
- ✓ Delete-for-me (per-user message hiding) — v1.0
- ✓ Snap messages (camera-only ephemeral photo DMs) — v1.0
- ✓ Snap view-once with Polaroid-framed viewer — v1.0
- ✓ Snap auto-cleanup (Storage deletion on view + scheduled orphan cleanup) — v1.0
- ✓ Snap streaks (3-day activation, tiered expiry windows) — v1.0
- ✓ Streak visual indicators (5 states on snap button, header, input) — v1.0
- ✓ Streak warning notifications (push + visual "!" indicator) — v1.0
- ✓ Tagged photo → DM (auto-send tagged photos into DM thread) — v1.0
- ✓ Add tagged photo to feed (recipient reshares with "Photo by @username" attribution) — v1.0

### Active

#### Current Milestone: v1.1 Pinned Snaps & Polish

**Goal:** Add Live Activity snap pinning, screenshot detection, darkroom cleanup, and resolve carried tech debt.

**Target features:**

- Pinned Snaps via iOS Live Activities (+ Android equivalent exploration)
- Screenshot detection and notification for snaps
- Darkroom client-side reveal check optimization
- Tech debt resolution (test gaps, infra config, naming)

### Out of Scope

- Typing indicators — creates social pressure, constant Firestore writes, low impact vs read receipts
- Group DMs — massive complexity; 1-on-1 foundation needs to be solid first
- Voice/video messages — not part of the disposable camera identity
- End-to-end encryption — blocks server-side moderation; Firebase encryption at rest sufficient
- Message search — requires Algolia/Elasticsearch; low-value for ephemeral-focused app
- Gallery photo picks in snaps — camera-only keeps it authentic
- Drawing/doodle on snaps — caption text sufficient for v1; can add later
- Screenshot detection — deferred to v2 to avoid native rebuild (requires `expo-screen-capture` + EAS build)
- Auto-disappearing text messages — ephemerality is for snaps specifically

## Context

Shipped v1.0 messaging upgrade with ~75,700 LOC across src (64,761) and functions (10,976).
Tech stack: React Native + Expo SDK 54, React Native Firebase SDK, Firestore, Cloud Functions (Node 20).

The messaging system now supports 5 message types (text, reaction, reply, snap, tagged_photo) through a polymorphic type discriminator in Firestore. The `onNewMessage` Cloud Function is the central routing hub handling lastMessage previews, unreadCount, push notifications, and streak updates for all types.

34 quick-fix tasks were completed during the milestone for UI polish, platform compatibility, and UX refinements.

**Known tech debt (5 items):**

- useConversation hook Phase 2 additions lack dedicated unit tests
- Stale test assertion in snapFunctions.test.js (single-line fix)
- INFRA-03: Firestore TTL policy not yet configured (user deferred)
- INFRA-04: Firebase Storage lifecycle rule not yet configured (user deferred)
- hoursSinceLastMutual variable naming is misleading (info only)

## Constraints

- **Tech stack**: React Native + Expo SDK 54, React Native Firebase SDK, Firestore for data
- **Message types**: 5 types coexist in same conversation thread via type discriminator
- **Storage**: Snap photos cleaned up server-side after viewing (onSnapViewed + cleanupExpiredSnaps)
- **Platform**: iOS and Android with platform guards throughout
- **Existing patterns**: Service layer pattern, custom hooks, component structure established in v1.0
- **Native build required**: v1.1 requires EAS build (Live Activities via ActivityKit, expo-screen-capture)

## Key Decisions

| Decision                            | Rationale                                                               | Outcome |
| ----------------------------------- | ----------------------------------------------------------------------- | ------- |
| Camera-only snaps (no gallery)      | Keeps authentic, in-the-moment feel                                     | ✓ Good  |
| View once then gone                 | Ephemeral by design — creates urgency and authenticity                  | ✓ Good  |
| 3-day threshold for streaks         | Low enough to achieve, high enough to mean something                    | ✓ Good  |
| Streak visual on snap button        | Button changes color + day count — visible without clutter              | ✓ Good  |
| Streak warning on button + push     | Multi-signal before streak expires                                      | ✓ Good  |
| Caption text only on snaps          | No drawing/doodle complexity for v1                                     | ✓ Good  |
| Photo attribution on reshare        | "Photo by @user" respects photographer                                  | ✓ Good  |
| Screenshot detection (deferred)     | Avoids native rebuild; iterate on messaging first                       | — v2    |
| Reactions as separate message docs  | Preserves message immutability                                          | ✓ Good  |
| Conversation-level read receipts    | 1 write per open vs N per-message writes                                | ✓ Good  |
| Server-authoritative streaks        | Cloud Functions only, never client-side                                 | ✓ Good  |
| Polaroid frame for snap viewing     | Standard Polaroid aesthetic — 4:3 photo, 16px border, 64px strip        | ✓ Good  |
| 5-min signed URLs for snaps         | Shorter than regular photos; matches ephemeral nature                   | ✓ Good  |
| Tiered streak expiry windows        | 36h/48h/72h based on dayCount — more forgiving as streaks grow          | ✓ Good  |
| CameraScreen reused with mode param | No separate SnapCameraModal; mode='snap' hides darkroom UI              | ✓ Good  |
| EXIF normalization for snaps        | Bakes orientation into pixels before resize — cross-platform consistent | ✓ Good  |

---

_Last updated: 2026-02-25 after v1.1 milestone started_
