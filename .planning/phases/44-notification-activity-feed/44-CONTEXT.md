# Phase 44: Notification Activity Feed - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<vision>
## How This Should Work

The notification screen becomes a full activity stream — a single, chronological feed showing every notification type the app generates. Reactions, comments, comment replies, photo tags, friend requests — all in one scrollable list with clear visual distinctions between types.

It should feel Instagram-style: rich previews with profile pictures, thumbnails of the photo or content being interacted with, and clear action descriptions. When you open notifications, you immediately see what's been happening — who reacted to your photo, who commented, who tagged you.

Every notification is tappable and takes you directly to the relevant content — the photo, the comment thread, or the person's profile. No dead-end items.

</vision>

<essential>
## What Must Be Nailed

- **All notification types render correctly** — Every type (reactions, comments, replies, photo tags, friend requests) has its own distinct, polished rendering with appropriate thumbnails and descriptions
- **Tappable deep linking** — Tapping any notification navigates directly to the relevant content (photo, comment thread, profile)
- **Time-grouped sections** — Notifications grouped into "Today", "This Week", "Earlier" sections like Instagram's activity feed
- **Unread styling** — Unread notifications stand out visually with bold text, dot indicator, or subtle background highlight

</essential>

<boundaries>
## What's Out of Scope

- No filtering or search — just the chronological feed
- No swipe-to-delete or swipe-to-mark-read gestures
- No notification management beyond tapping to navigate
- Keep it to rendering and navigation only

</boundaries>

<specifics>
## Specific Ideas

- Instagram-style activity feed is the reference point — rich, visual, scannable
- Time grouping sections ("Today", "This Week", "Earlier") for temporal context
- Unread notifications should be visually distinct from read ones
- Each notification type needs its own visual treatment (icon, thumbnail, description format)

</specifics>

<notes>
## Additional Context

This phase builds on the notification infrastructure from Phases 34-38 and the notification list polish from Phase 38-02. The existing notification screen already has some rendering — this phase completes it to handle all notification types with a polished, Instagram-inspired presentation.

Phase 38-02 already added bold usernames and unread dots — this phase extends that foundation to cover all notification types with full deep linking.

</notes>

---

_Phase: 44-notification-activity-feed_
_Context gathered: 2026-02-09_
