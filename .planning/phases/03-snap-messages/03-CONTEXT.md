# Phase 3: Snap Messages - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Ephemeral photo DMs with view-once mechanic. Users capture camera-only snaps within a DM conversation, optionally add a caption, and send. Recipient views the snap full-screen once, then it disappears. Server-side cleanup deletes snap photos after viewing (or after 48h if unviewed). No screenshot detection (deferred to v2), no gallery picks, no filters/editing.

</domain>

<decisions>
## Implementation Decisions

### Snap Capture Flow

- Full-screen camera that slides up from bottom (modal presentation) when camera button is tapped
- Reuses existing CameraScreen component in a "snap mode" — hides darkroom button, keeps flash toggle, camera flip, zoom
- Both front and rear cameras available (selfie snaps supported)
- After capture: preview screen shows the snap in a Polaroid layout before sending
- Preview screen has retake via X button (top-left) AND swipe-down gesture to discard and return to camera
- No editing tools on preview (no crop, rotate, or filters) — capture and send only
- Send button: prominent, bottom-right of preview screen
- "To: [RecipientName]" shown at top of preview screen to confirm recipient
- After send: returns to conversation immediately (no confirmation overlay)

### Snap Viewer (Recipient Experience)

- Full black background, immersive full-screen
- Snap displayed in a Polaroid frame: thin white border on top/sides, thick white strip at bottom (classic Polaroid proportions)
- Polaroid sits perfectly straight (no tilt/rotation)
- Caption displayed in the thick bottom strip using the app's pixel art font
- Polaroid strip always visible even when there's no caption (consistent visual identity)
- No timer — user views at their own pace until dismissed
- Dismiss via swipe-down gesture OR X button in corner
- After dismiss: snap marked as viewed, cannot be reopened

### Snap Bubble (Conversation Thread)

- Unopened snap: warm yellow/amber accent bubble with custom pixel art camera icon (NOT an emoji) and "Snap" label
- Opened snap: dimmed/faded version of the bubble with "Opened" label replacing "Snap"
- Same timestamp metadata as regular text messages (consistent with existing MessageBubble patterns)
- Three sender-visible states: "Sending..." (uploading) -> "Delivered" (sent) -> "Opened" (viewed by recipient)

### Caption Input

- Caption typed directly into the Polaroid's thick bottom strip on the preview screen (WYSIWYG — what you type is exactly how it appears in the viewer)
- ~150 character limit
- Optional with visual nudge — subtle "Write something!" hint that encourages but doesn't require a caption
- Pixel art font matches the viewer display

### DMInput Camera Button

- Camera button replaces the send button when the text input field is empty (Messenger-style morph)
- Custom pixel art camera icon (matches the snap bubble icon)
- Subtle crossfade animation when morphing between send arrow and camera icon
- When text is typed, camera icon fades to send arrow; when text is cleared, send arrow fades to camera icon

### Conversation List (ConversationRow)

- Snap as last message preview: small pixel art camera icon + "Snap" text
- Unread snap indicator: amber dot/highlight (distinct from regular unread message indicators)
- Always-visible snap camera button on each ConversationRow (right side) — one-tap shortcut to open snap camera for that friend

### Push Notifications

- Playful randomized notification templates (no emojis) — e.g., "X sent you a snap", "New snap from X", "X just snapped you"
- Tapping notification: opens the conversation, then automatically opens the snap viewer for the unviewed snap (two-step: context + auto-view)
- No push notification to sender when their snap is opened — status updates passively via "Opened" label in conversation

### Upload & Sending States

- Optimistic snap bubble appears immediately in conversation with amber progress ring around the icon
- "Sending..." status text during upload
- Auto-retry 2-3 times silently on network failure
- If auto-retries exhausted: show error state with tap-to-retry button on the bubble
- Progress ring uses warm amber color (matches snap theme)

### Claude's Discretion

- Exact Polaroid frame proportions (thin border width, thick strip height) — optimize for mobile screen sizes
- Upload progress ring implementation details (circular progress vs indeterminate spinner)
- Snap camera mode flag implementation (how CameraScreen detects snap mode vs normal mode)
- Error state icon/indicator design
- Keyboard handling when typing caption in Polaroid strip
- Auto-open snap viewer timing after notification tap (immediate vs slight delay for conversation render)

</decisions>

<specifics>
## Specific Ideas

- "I want snaps to look like a Polaroid with the caption where on a Polaroid you would write something" — the Polaroid frame is the core visual identity of snaps
- Pixel art camera icon must be custom (not an emoji) — consistent with the app's 16-bit aesthetic
- The camera button replacing the send button when input is empty follows the Messenger pattern — space-efficient and intuitive
- Snap notification opens conversation first, THEN auto-opens the snap viewer — user gets context before viewing

</specifics>

<deferred>
## Deferred Ideas

- Send snap from main camera screen — would need a friend/conversation picker after capture, which is a separate flow from DM-initiated snaps. Capture as a future phase or backlog item.
- Screenshot detection — already deferred to v2 (SCRN-V2-01 through SCRN-V2-05)

</deferred>

---

_Phase: 03-snap-messages_
_Context gathered: 2026-02-24_
