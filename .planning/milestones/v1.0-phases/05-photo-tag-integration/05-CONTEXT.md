# Phase 5: Photo Tag Integration - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect the existing photo tagging system to DMs. When a user tags a friend in a photo, a tagged photo message auto-sends to their DM conversation. Recipients can reshare the tagged photo to their own feed with permanent attribution. Tag notifications migrate from the activity feed to DMs exclusively (stop creating new activity feed tag notifications; leave existing ones).

</domain>

<decisions>
## Implementation Decisions

### Tagged Photo Message Card

- Large photo card in the DM conversation (generous photo display, like iMessage photo messages)
- Header text above the photo: "[Name] tagged you in a photo"
- Distinct visual styling to differentiate from snaps and regular messages (different border/background)
- Caption not shown on the card — only visible when opening PhotoDetail
- Sender sees the same large photo card in their view (no compact version)
- ConversationRow preview: icon + "Tagged you in a photo" text (no thumbnail)
- Tapping the card opens the full PhotoDetail modal (with reactions, comments, Add to feed)

### Add-to-Feed Button

- Inline "Add to feed" button visible directly on the message card AND inside PhotoDetail
- One-tap instant add — no confirmation dialog, no undo toast
- After adding, button becomes greyed-out "Added to feed" (disabled state)
- Reshared photo appears immediately on recipient's feed — skips darkroom developing
- No limit on how many friends can be tagged in a single photo

### Attribution Display

- "Photo by @username" text positioned below display name/timestamp and above the caption
- Tapping attribution navigates to the photographer's profile
- Attribution is permanent — recipient cannot remove it
- Attribution visible in both the feed card and the PhotoDetail modal

### Tag Migration (Activity Feed to DMs)

- New tags only create DM messages — no new activity feed notifications for tags
- Existing tag notifications in the activity feed are left as-is (no cleanup)

### Notification & Delivery

- Tagged friend receives a push notification: "[Name] tagged you in a photo"
- Tapping the push notification navigates to the DM conversation (not directly to PhotoDetail)
- When a tagged friend reshares the photo to their feed, photographer gets push: "[Name] added your photo to their feed" (specific text, not randomized templates)
- Each tagged friend gets an individual push notification (no batching for multi-tag)
- Only the photographer is notified of reshares (other tagged friends are not notified)

### Claude's Discretion

- Re-addability: Whether a recipient can re-add a photo after removing it from their feed
- Exact card border/background styling for tagged photo messages
- Error handling for edge cases (blocked users, deleted conversations, deleted photos)
- Tag picker UI implementation details

</decisions>

<specifics>
## Specific Ideas

- Tagging already exists in the app — currently sends notifications to the activity feed. This phase redirects tag delivery to DMs exclusively.
- Photo card should feel different from snap messages — distinct visual treatment to signal "this is a tagged photo you can add to your feed"
- Attribution modeled after credit lines — always visible, tappable, part of the photo's identity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 05-photo-tag-integration_
_Context gathered: 2026-02-24_
