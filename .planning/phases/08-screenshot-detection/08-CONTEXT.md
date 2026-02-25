# Phase 8: Screenshot Detection - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect when a recipient screenshots a snap, notify the sender, and display a persistent system message in the conversation. Detection only — no screenshot prevention. No new capabilities (comments, reactions, etc.).

</domain>

<decisions>
## Implementation Decisions

### Detection scope
- Detection triggers only while the recipient is actively viewing a snap in the full-screen snap viewer
- Screen recording also triggers detection (same as screenshot)
- If the platform API is unavailable (some Android devices), fail silently — no error shown, some screenshots may go undetected
- Detection only — do not block/prevent screenshots
- Self-screenshots are ignored (sender screenshotting their own snap does nothing)

### In-chat visibility
- Both users see a system message in the conversation when a screenshot is detected
- System message names the screenshotter: "Alex screenshotted a snap"
- Message does not identify which specific snap — just that a screenshot happened
- No persistent badge/icon on the snap bubble itself — system message is the only visual

### Push notification
- Only the snap sender receives a push notification (not the screenshotter)
- Neutral/factual tone: "Alex screenshotted your snap"
- Tapping the notification deep-links to the conversation
- Respects existing notification mute settings — if conversation is muted, screenshot notifications are also muted
- Screenshot events do NOT appear in the Activity screen — conversation + push only
- Notification batching strategy (if multiple screenshots in quick succession): Claude's discretion

### System message styling
- Small centered gray text, same style as date separators in the conversation
- Standard UI font (not pixel art font)
- No inline timestamp — the message's position in the conversation provides timing context

### Repeat & edge cases
- Only the first screenshot of a given snap triggers detection, notification, and system message — subsequent screenshots of the same snap are ignored
- `screenshottedAt` timestamp is set once on the snap message document and not updated on repeat screenshots
- If the device is offline when a screenshot is detected, queue the event locally and sync when back online (retry until successful)
- Only active snaps trigger detection — expired or deleted snaps are ignored even if still rendered on screen

### Claude's Discretion
- Notification batching strategy for rapid multiple-snap screenshots
- Exact implementation of offline queue/retry mechanism
- Screen recording detection API choice per platform
- System message Firestore document structure

</decisions>

<specifics>
## Specific Ideas

- System messages should feel like Snapchat's "Alex screenshotted a snap" chat events — subtle, informational, not dramatic
- The `screenshottedAt` field on the snap message document is the source of truth for whether a screenshot occurred (SCRN-03 requirement)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-screenshot-detection*
*Context gathered: 2026-02-25*
