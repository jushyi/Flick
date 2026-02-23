# Phase 2: Message Interactions - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add emoji reactions, quote replies, and message deletion to DM conversations. These are the three core message interactions that make DMs feel complete. Depends on Phase 1's message type polymorphism. Independent of snaps/streaks.

</domain>

<decisions>
## Implementation Decisions

### Emoji Set & Reaction Display

- Classic 6-emoji set: heart, laugh, surprise, sad, angry, thumbs up
- Stacked emoji badges with count displayed below target messages
- Tap own reaction to toggle/remove it
- One reaction per user per message — new reaction replaces the old one
- Can react to any message type (text, image, GIF) including your own messages
- Cannot react to reaction messages themselves (no reaction chains)
- Pixel-style heart pop animation on double-tap
- Reaction pills fade in when first appearing (no bounce)
- Floating reaction picker appears directly above the long-pressed message
- Dark semi-transparent overlay behind picker when active

### Message Action Menu (Long-Press)

- iMessage-style layout: floating emoji row above message, text-only action menu below message
- Long-pressed message scales up slightly for emphasis
- Actions (text labels only, no icons):
  - **Reply** — available on all messages
  - **Unsend** — available on your own messages within 15-minute window (shows/hides, no countdown displayed)
  - **Delete** — available on your own messages (always available, labeled "Delete for me")
- Medium haptic feedback on long-press activation
- Tap anywhere outside to dismiss picker + menu

### Reply Visual Treatment

- **Compose preview:** Mini message bubble above DMInput showing the message being replied to
  - For image/GIF messages: shows icon + label (e.g., camera icon + "Photo"), not a thumbnail
  - Cancel via X button or swipe preview downward
- **Sent reply rendering:** Embedded mini bubble inside the reply message bubble (self-contained, iMessage-style)
- Tapping the quoted mini bubble scrolls conversation to the original message and briefly highlights it
- Flat replies only — can reply to any message but no nested reply chains
- Deleted original shows italic gray "Original message deleted" in the mini bubble
- Auto-focus keyboard on swipe-to-reply activation
- **Swipe gesture:**
  - Short swipe threshold (~40px)
  - Message bubble slides right during swipe
  - Reply arrow icon appears behind the sliding message
  - Haptic feedback at trigger point
- Reply to any message type (text, image, GIF)

### Unsend & Delete

- **Two distinct actions:**
  - **Unsend** (within 15 min): instant (no confirmation), message vanishes completely for both users with fade-out animation (~300ms), cascades to remove all reactions on that message
  - **Delete for me** (always available): custom pixel-themed confirmation dialog, shows "You deleted this message" placeholder in your view only, other person's view unchanged, permanent with no undo
- All message types support unsend and delete (text, image, GIF)
- Firestore-only soft delete — uploaded images stay in Firebase Storage for moderation trail
- Conversation preview (ConversationRow) updates:
  - On unsend: falls back to previous message as preview
  - On delete-for-me: deleter sees "You deleted this message" as preview, other person sees original

### Notification Behavior

- Reaction push notifications include the emoji: "[Name] reacted :heart: to your message"
- Every reaction sends its own notification (no batching)
- Tapping reaction notification opens the conversation screen (no scroll-to-message)
- Reply messages trigger standard new message notifications (not reply-specific)

### Edge Cases

- If a message gets unsent while reaction picker is open: dismiss picker silently (no error)
- If original message gets unsent while composing a reply: clear reply mode, keep typed text in input
- Only original messages (text, image, GIF) can be reacted to — not reaction messages

### Claude's Discretion

- Exact pixel dimensions and spacing for reaction pills, mini bubbles, and picker
- Animation easing curves and spring configurations
- Swipe-to-reply arrow icon design
- Color choices for reaction picker background and menu items
- How the "scroll to original message" highlight animation works
- Implementation of the custom pixel confirmation dialog (can reuse existing patterns if available)
- Handling of offline/network error states during reactions and deletions

</decisions>

<specifics>
## Specific Ideas

- Long-press interaction should feel like iMessage: message scales up, reactions float above, context menu below, dark overlay behind
- Pixel-style heart pop on double-tap (not Instagram's burst — something that fits the 16-bit retro aesthetic)
- Text-only context menu labels (no icons) to match the pixel/retro vibe
- Custom pixel-themed confirmation dialog for delete (not native OS alerts)

</specifics>

<deferred>
## Deferred Ideas

- Custom emoji reactions beyond the 6 presets — captured as INTER-V2-01 in v2 requirements
- "+" button on reaction picker with emoji search and editable preset row — v2 feature

</deferred>

---

_Phase: 02-message-interactions_
_Context gathered: 2026-02-23_
