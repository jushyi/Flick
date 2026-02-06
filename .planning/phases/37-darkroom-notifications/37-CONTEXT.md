# Phase 37: Darkroom Ready Notifications - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

> **Note:** Phase renamed from "iOS Live Activities" to "Darkroom Ready Notifications" — user preferred simple push notifications over Live Activity complexity.

<vision>
## How This Should Work

When photos finish developing in the darkroom, the user receives a push notification. The notification is actionable — tapping it takes them straight to the darkroom to see their ready photos.

No fancy real-time progress indicators or Lock Screen widgets. Just a clear, reliable notification that says "your photos are ready" and gets them there fast.

</vision>

<essential>
## What Must Be Nailed

- **Clear messaging** — User should instantly understand what's ready and what to do when they see the notification. No confusion about what the notification means or where it leads.

</essential>

<boundaries>
## What's Out of Scope

- No rich media — No image previews or thumbnails in the notification itself
- No scheduling — Don't let users customize when/if they get these notifications
- No grouping — Each darkroom session = one notification, don't batch multiple sessions

</boundaries>

<specifics>
## Specific Ideas

- Notification should have a quick action to jump straight to darkroom
- Keep the notification copy simple and direct (e.g., "Your 5 photos are ready!")

</specifics>

<notes>
## Additional Context

This phase was originally scoped as iOS Live Activities (real-time Lock Screen/Dynamic Island updates). User decided push notifications are simpler and sufficient for the use case.

This builds on Phase 34 (Push Infrastructure) — the notification plumbing should already exist.

</notes>

---

_Phase: 37-darkroom-notifications_
_Context gathered: 2026-02-06_
