# Phase 9: Pinned Snaps iOS - Context

**Gathered:** 2026-03-05 (updated — pivoted from Live Activities to persistent notifications)
**Status:** Ready for planning

<domain>
## Phase Boundary

Allow senders to pin a snap to the recipient's iOS lock screen as a persistent notification. The notification shows the snap photo thumbnail and optional caption. Tapping opens the conversation. The notification persists until the snap is viewed. Android pinned snaps are a separate phase (Phase 10).

**PIVOT:** Originally implemented via Live Activities + widget extension. Pivoting to persistent notifications — simpler, more reliable, matches Lapse's UX pattern. All Live Activity code (widget extension, native module, NSE Live Activity logic) should be removed.

</domain>

<decisions>
## Implementation Decisions

### Pin toggle placement & design (UNCHANGED from v1)
- Toggle appears on the send confirmation screen (after capturing the snap, before sending)
- Visual: pixel-art pin icon with a toggle switch — fits the retro brand
- Default state: off, but sticky per friend (remembers last choice per conversation)
- First-time tooltip: brief one-time tooltip explaining "Pin this snap to their lock screen" — then never shown again
- Pin toggle only appears in one-to-one conversations

### Notification appearance
- Photo thumbnail shown as image attachment (rich notification with image preview)
- Caption displayed next to/below the thumbnail if present
- No extra descriptive text — just the thumbnail and caption content
- Sender name as notification title
- Default notification sound (no custom sound)
- No action buttons — just tap to open the conversation

### Persistence & dismissal
- Notification persists as long as the snap hasn't been viewed
- If user swipes the notification away, it should be re-delivered (snap is still unviewed)
- Viewing the snap in SnapViewer is the only thing that dismisses the notification
- No separate expiry timer — tied purely to snap viewed state

### Multiple pinned snaps
- Each pinned snap creates its own notification — they stack on top of each other
- No cap on number of active pinned notifications

### Caption behavior (UNCHANGED from v1)
- Caption reuses the snap's message text — no separate caption field
- If no message text: just photo thumbnail + sender name
- Emoji-only messages display normally as caption text

### Cleanup: Remove Live Activity code
- Remove the FlickLiveActivity widget extension target
- Remove the LiveActivityManager native module (modules/live-activity-manager/)
- Remove PinnedSnapAttributes.swift copies
- Simplify NSE to only handle thumbnail attachment (no ActivityKit)
- Remove liveActivityService.js
- Remove Live Activity imports/calls from App.js and SnapViewer.js
- Remove diagnose/NSE diagnostics from Settings screen
- Keep the FlickNotificationService NSE target (repurpose for thumbnail attachment)

### Claude's Discretion
- NSE implementation for downloading and attaching thumbnail to notification
- Notification identifier scheme for programmatic dismissal
- How to re-deliver notification if swiped away (foreground check vs scheduled local notification)
- How to track/persist the per-friend sticky toggle preference
- Exact tooltip implementation and dismissal logic
- Cloud Function notification payload structure

</decisions>

<specifics>
## Specific Ideas

- Lapse used this exact pattern: persistent notification with "don't swipe away" messaging
- The notification should feel native and clean — thumbnail image is the star
- Re-delivery after swipe-away is important — the snap stays pinned until viewed, period
- Pin toggle is intentionally opt-in but remembers per-friend to reduce friction

</specifics>

<deferred>
## Deferred Ideas

- Live Activities could be revisited as an enhancement in a future phase if persistent notifications feel insufficient
- Custom notification sound for pinned snaps — potential future polish

</deferred>

---

*Phase: 09-pinned-snaps-ios*
*Context gathered: 2026-03-05*
