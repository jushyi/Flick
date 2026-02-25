# Phase 9: Pinned Snaps iOS - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow senders to pin a snap to the recipient's iOS lock screen as a Live Activity. The Live Activity displays a photo thumbnail, sender name, and optional caption. Tapping opens the conversation. The activity dismisses after viewing or auto-expires after 48 hours. Android pinned snaps are a separate phase (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Pin toggle placement & design
- Toggle appears on the send confirmation screen (after capturing the snap, before sending)
- Visual: pixel-art pin icon with a toggle switch — fits the retro brand
- Default state: off, but sticky per friend (remembers last choice per conversation)
- First-time tooltip: brief one-time tooltip explaining "Pin this snap to their lock screen" — then never shown again

### Live Activity layout
- Small square photo thumbnail, left-aligned, with sender name and caption text to the right (notification-row style)
- Pixel-art branded styling: app's pixel font, dark background, CRT-style accents — the Live Activity should feel like part of Flick
- Text shown: sender display name + caption (if present)
- Compact view only — no expanded state on long-press. Tapping opens the app.

### Multiple active pins
- Each pinned snap creates its own separate Live Activity — they stack on the lock screen
- Global cap of 5 active Live Activities per recipient across all senders
- When cap is reached, oldest Live Activity is dismissed to make room for new one
- Silent fallback: snap still sends normally if cap is reached, just without the pin — no feedback to sender
- Pin toggle only appears in one-to-one conversations (not multi-recipient)

### Caption behavior
- Caption reuses the snap's message text — no separate caption field
- Long text truncated with ellipsis (~40 chars) on the Live Activity
- If no message text: caption area is hidden entirely — just photo thumbnail + sender name
- Emoji-only messages display normally as caption text

### Claude's Discretion
- SwiftUI layout specifics for the Live Activity widget
- App Groups configuration for sharing thumbnail between main app and widget extension
- Push notification payload structure for triggering Live Activity updates
- How to track/persist the per-friend sticky toggle preference
- Exact tooltip implementation and dismissal logic

</decisions>

<specifics>
## Specific Ideas

- The Live Activity should feel like a branded piece of Flick on the lock screen — pixel font, dark background, retro accents
- Pin toggle is intentionally opt-in (not on by default) but remembers per-friend to reduce friction for power users
- Compact-only design keeps the native code surface area small and the lock screen presence clean

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-pinned-snaps-ios*
*Context gathered: 2026-02-25*
