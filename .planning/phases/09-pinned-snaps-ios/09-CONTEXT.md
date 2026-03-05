# Phase 9: Pinned Snaps iOS - Context

**Gathered:** 2026-03-05 (updated — reverted notification pivot, Live Activities restored)
**Status:** Gap closure — fixing issues from device testing

<domain>
## Phase Boundary

Allow senders to pin a snap to the recipient's iOS lock screen as a Live Activity. The Live Activity shows the snap photo thumbnail with Polaroid frame and optional caption. Tapping opens the conversation. The Live Activity persists until the snap is viewed — even if swiped away. Android pinned snaps are a separate phase (Phase 10).

**HISTORY:** Originally implemented via Live Activities (plans 01-07). Briefly pivoted to persistent notifications (plans 08-09) but user testing showed notifications couldn't achieve the custom layout desired (large thumbnail, no app icon, no title bar). Reverted back to Live Activities (commit 1dee950). Now in gap closure fixing device-testing issues.

</domain>

<decisions>
## Implementation Decisions

### Pin toggle placement & design (UNCHANGED from v1)
- Toggle appears on the send confirmation screen (after capturing the snap, before sending)
- Visual: pixel-art pin icon with a toggle switch — fits the retro brand
- Default state: off, but sticky per friend (remembers last choice per conversation)
- First-time tooltip: brief one-time tooltip explaining "Pin this snap to their lock screen" — then never shown again
- Pin toggle only appears in one-to-one conversations

### Live Activity appearance
- Large photo thumbnail (~128px wide) with natural portrait aspect ratio (~4:5)
- Polaroid-style white frame around thumbnail (thicker on bottom)
- Caption displayed to the right of the thumbnail if present
- Sender name shown as small label above caption (only when caption exists)
- When no caption: centered Polaroid image only, no text at all
- No "Tap to view" or other fallback text
- Flick dark background (#0A0A1A)
- Monospaced font for text (matching brand)

### Persistence & dismissal
- Live Activity persists as long as the snap hasn't been viewed
- If user swipes the Live Activity away, it is automatically re-created (ActivityState observation)
- Viewing the snap in SnapViewer calls endActivity which removes it permanently
- 48-hour auto-expiry via ActivityKit staleDate

### Thumbnail pipeline
- Sender: 300px wide thumbnail generated in snapService (enough for 128px at 2-3x Retina)
- Sender: Thumbnail uploaded to Firebase Storage, download URL sent in push notification
- NSE (killed app): Downloads thumbnail from URL, saves to App Groups, starts Live Activity
- JS handler (foreground/background): Downloads thumbnail from pinnedThumbnailUrl to local temp file via expo-file-system, then passes local URI to native module
- Native module: Copies from local file URI to App Groups shared container

### Multiple pinned snaps
- Each pinned snap creates its own Live Activity — they stack
- Cap of 5 concurrent Live Activities (oldest dismissed to make room)

### Caption behavior (UNCHANGED from v1)
- Caption reuses the snap's message text — no separate caption field
- If no message text: just photo thumbnail with Polaroid frame, centered
- Emoji-only messages display normally as caption text

### Live Activity infrastructure (KEEP)
- FlickLiveActivity widget extension target (SwiftUI layout)
- LiveActivityManager native Expo module (ActivityKit bridge)
- PinnedSnapAttributes.swift (3 copies: widget, NSE, native module)
- FlickNotificationService NSE (thumbnail download + Live Activity start for killed-app state)
- liveActivityService.js (JS bridge)
- App.js foreground handler (starts Live Activity when notification received)
- SnapViewer.js (ends Live Activity when snap viewed)

### Claude's Discretion
- Exact Polaroid frame dimensions and proportions in SwiftUI
- ActivityState observation implementation details
- Thumbnail download retry/error handling in JS
- How to track/persist the per-friend sticky toggle preference
- Exact tooltip implementation and dismissal logic

</decisions>

<specifics>
## Specific Ideas

- Lapse likely uses Live Activities for their pinning feature (auto-appears on lock screen, custom layout, can't be accidentally dismissed)
- The Live Activity should feel like a Polaroid instant photo pinned to the lock screen
- Re-creation after swipe-away is critical — the snap stays pinned until viewed, period
- Pin toggle is intentionally opt-in but remembers per-friend to reduce friction
- Thumbnail size ~128px to be visually prominent on lock screen

</specifics>

<deferred>
## Deferred Ideas

- Custom notification sound for pinned snaps — potential future polish
- Dynamic Island expanded view (currently minimal/empty)

</deferred>

---

*Phase: 09-pinned-snaps-ios*
*Context gathered: 2026-03-05*
