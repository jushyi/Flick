# Phase 1: Message Infrastructure & Read Receipts - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the message schema with a `type` discriminator field for future message types (reactions, replies, snaps, tagged photos). Update Firestore security rules to support new fields. Ship read receipts as the first user-visible improvement — sender sees "Read" when recipient opens conversation. Add privacy toggle for read receipts. Extend `onNewMessage` Cloud Function for new message type preview text.

</domain>

<decisions>
## Implementation Decisions

### Read Indicator Style

- iMessage-style "Read" text label with timestamp (e.g., "Read 2:45 PM")
- "Delivered" state shown before "Read" (two states: Delivered → Read)
- "Delivered" shows no timestamp, just the word; "Read" includes the time
- Indicator appears only below the sender's most recent sent message (not every message)
- Muted secondary color (#7B7B9E) for both "Delivered" and "Read" text
- Readable sans-serif font (body font, not pixel/retro display font)
- Font size should match existing timestamp styling (~10px)

### Read Trigger Behavior

- "Read" triggered when recipient opens the conversation screen (on mount) — same trigger as current `markConversationRead`
- Real-time updates via Firestore conversation document subscription — sender sees "Read" appear live
- First-read timestamp only — if friend re-opens the conversation later, the timestamp does NOT update
- Only mark as read when app is in foreground (not while backgrounded, even if conversation screen was left open)
- Opening from push notification follows the same behavior — marks read on screen load
- Unread dot in conversation list tied to the read receipt system (clearing one clears the other)
- Auto-dismiss pending push notifications when conversation is opened (existing behavior, keep it)

### Message Type Previews (Conversation List)

- When YOU sent the last message: show status word instead of message content
  - Text messages: "Sent" (unread by friend) / "Seen" (read by friend)
  - Snap messages: "Delivered" (snap not opened) / "Opened" (snap viewed)
- When FRIEND sent the last message: show descriptive text
  - Text: actual message text
  - GIF: "Sent a GIF" (existing behavior, keep it)
  - Snap: "Sent you a snap"
  - Reaction: "Reacted [emoji] to your message" (shows actual emoji)
  - Reply: show the reply text directly (like a normal message)
  - Tagged photo: "Tagged you in a photo"

### Read Receipt Privacy

- Global toggle in Privacy settings (not per-conversation)
- Mutual privacy model: turning off hides YOUR read status AND hides others' read status from you
- When either user has receipts off, sender's messages stay at "Delivered" permanently — never shows "Read"
- In conversation list, "Seen" is also hidden when receipts off — stays at "Sent"
- Show explanation when user toggles off: "When you turn off read receipts, you also won't see when others read your messages."
- Default state for new users: read receipts ON
- Toggle stored on user's Firestore profile document

### Read Indicator Animation

- "Delivered" fades in after message bubble lands (subtle entrance animation)
- "Delivered" → "Read [time]" transition uses a subtle fade (200-300ms crossfade)
- Conversation list status transitions ("Sent" → "Seen") are instant, no animation
- No artificial delay before showing "Delivered" — appears immediately on Firestore write confirmation

### Conversation List Behavior

- Sorted chronologically by last message time (newest first) — no special unread positioning
- Sending a message updates conversation's last activity time, jumping it to the top
- Unread indicator upgraded from simple 8×8 dot to count badge: cyan circle with white number inside
- Count badge replaces the dot when there are unread messages (shows "1", "2", "3", etc.)

### Claude's Discretion

- Exact animation easing curves and durations
- Badge sizing and positioning relative to conversation row
- "Delivered" confirmation logic (optimistic vs wait for Firestore)
- Privacy settings section layout and toggle component style
- How to handle the `type` field on existing messages that predate the schema update

</decisions>

<specifics>
## Specific Ideas

- Conversation list sent-message previews should work like Snapchat — status words ("Sent"/"Seen"/"Delivered"/"Opened") instead of showing your own message text back to you
- Read receipt feel should be iMessage-like: subtle, informational, not attention-grabbing
- Count badge on conversation rows replaces the plain dot — gives quick sense of "how much did I miss"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 01-message-infrastructure-read-receipts_
_Context gathered: 2026-02-23_
