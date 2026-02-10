# Phase 44: Notification Activity Feed - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<vision>
## How This Should Work

The notification activity feed is already set up — this phase is about fixing what's broken. Two main problems: deep linking doesn't work properly (tapping notifications takes you to the person's profile or the feed screen instead of the intended destination), and reaction notifications flood the inbox when someone spams reactions on a photo.

**Deep linking — every notification type has a specific destination:**

- **Reaction** → Photo detail screen (the photo that was reacted to)
- **Comment** → Photo with comments sheet auto-opened, scrolled to the comment
- **Comment reply** → Photo with comments sheet auto-opened, scrolled to the reply
- **Photo tag** → The tagged photo fullscreen
- **Friend request** → Requester's profile
- **Friend accepted** → New friend's profile

This deep linking should work the same everywhere — tapping in the in-app feed, tapping a push notification, and tapping the in-app notification banner should all navigate to the same destination.

**Reaction clumping — per-photo batching:**
When someone reacts multiple times to the same photo (e.g. ❤️😂🔥), those should collapse into a single notification showing all the emojis, not flood the inbox with separate items. Different photos = separate notifications. Tapping a clumped reaction takes you to that specific photo.

**Time grouping — Instagram-style sections:**
Notifications organized into Today / This Week / This Month / Earlier sections.

</vision>

<essential>
## What Must Be Nailed

- **Deep linking for every notification type** — Every notification takes you to the exact right place, not a generic screen. Same behavior across in-app feed, push notification taps, and in-app banners.
- **Reaction clumping per-photo** — Multiple reactions from the same user on the same photo collapse into one notification showing all emojis. No more inbox flooding from reaction spam.

</essential>

<boundaries>
## What's Out of Scope

- No new notification types — only fixing existing ones
- No visual redesign — keep existing styling/layout, just fix behavior
- No push notification delivery changes — only fixing navigation targets
- No in-app notification banner visual changes — only fixing their deep link destinations
- Darkroom notifications do NOT appear in the activity feed — they are a separate system
- No swipe-to-delete or notification management gestures

</boundaries>

<specifics>
## Specific Ideas

- Instagram-style time grouping: Today / This Week / This Month / Earlier
- Reaction clumping shows emoji summary per photo: "John reacted ❤️😂🔥 to your photo"
- Unified deep linking — push, banner, and feed all use the same navigation targets
- Comments deep link should auto-open the comments sheet and scroll to the relevant comment

</specifics>

<notes>
## Additional Context

The activity feed UI and notification rendering already exist from Phases 34-38. Phase 38-02 added bold usernames and unread dots. This phase is a fix/polish pass — the core issue is that deep linking routes to wrong destinations and reaction spam floods the inbox.

The original plan scope (type renderers, photo thumbnails, visual verification) has been replaced with this focused fix scope since the feed was already built.

</notes>

---

_Phase: 44-notification-activity-feed_
_Context gathered: 2026-02-09_
