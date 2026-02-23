# Flick — Messaging Upgrade

## What This Is

A comprehensive upgrade to Flick's direct messaging system, evolving it from basic text/GIF chat into a full social messaging experience. This adds ephemeral snap photos, message interactions (reactions, replies, read receipts), streak mechanics, photo tag integration, and message management — turning DMs into a core engagement loop rather than a secondary feature.

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

### Active

- [ ] Snap messages (ephemeral photo messages in DMs)
- [ ] Snap streaks (consecutive daily mutual snaps)
- [ ] Read receipts (delivered → read status)
- [ ] Message reactions (emoji tapback)
- [ ] Reply to message (quote reply to specific messages)
- [ ] Message deletion (unsend own messages)
- [ ] Tagged photo → DM (auto-send tagged photos into DM thread)
- [ ] Add tagged photo to feed (recipient reshares with attribution)

### Out of Scope

- Typing indicators — lower impact, can add later
- Group DMs — 1-on-1 only for now
- Voice/video messages — not part of the disposable camera identity
- End-to-end encryption — not needed for MVP messaging upgrade
- Message search — separate effort, deferred
- Gallery photo picks in snaps — camera-only keeps it authentic
- Drawing/doodle on snaps — caption text is sufficient for v1

## Context

The messaging system already has a solid foundation: real-time subscriptions via Firestore, text + GIF messages, conversation lifecycle management, push notifications, and a service-oriented architecture. The existing patterns (messageService, useMessages/useConversation hooks, MessageBubble components) provide clear extension points for new message types and interactions.

Photo tagging already exists in the app — the new work connects tags to the DM system and adds a reshare-to-feed flow.

The app uses React Native Firebase SDK (not web SDK), react-native-reanimated for animations, and Expo SDK 54. All Firebase operations go through service modules returning `{ success, error }` objects.

## Constraints

- **Tech stack**: React Native + Expo SDK 54, React Native Firebase SDK, Firestore for data
- **Message types**: New snap type must coexist with existing text/GIF types in the same conversation thread
- **Storage**: Snap photos need Firebase Storage upload but should be cleaned up server-side after viewing
- **Platform**: Must work on both iOS and Android with appropriate platform guards
- **Existing patterns**: Follow the service layer pattern, custom hooks, and component structure already established

## Key Decisions

| Decision                        | Rationale                                                                                    | Outcome   |
| ------------------------------- | -------------------------------------------------------------------------------------------- | --------- |
| Camera-only snaps (no gallery)  | Keeps the authentic, in-the-moment feel consistent with Flick's identity                     | — Pending |
| View once then gone             | Ephemeral by design — creates urgency and authenticity                                       | — Pending |
| 3-day threshold for streaks     | Low enough to be achievable, high enough to mean something                                   | — Pending |
| Streak visual on snap button    | The snap button changes color + shows day count — keeps it visible without cluttering the UI | — Pending |
| Streak warning on button + push | Warning color with "!" on button plus push notification before streak expires                | — Pending |
| Caption text only on snaps      | Lightweight — no drawing/doodle complexity for v1                                            | — Pending |
| Photo attribution on reshare    | "Photo by @user" when adding tagged photo to feed — respects the photographer                | — Pending |
| Screenshot detection + alert    | Sender is notified if recipient screenshots a snap — reinforces ephemeral trust              | — Pending |

---

_Last updated: 2026-02-23 after initialization_
