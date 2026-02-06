# Phase 41: Tagged Notification Integration - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<vision>
## How This Should Work

When someone gets tagged in a photo, they receive a push notification. Tapping it takes them directly to the photo they were tagged in.

**Darkroom tagging:** Tags made during a single triage session get batched into one notification. If a friend tags you in 5 photos during one triage, you get "[Name] tagged you in 5 photos" — not 5 separate notifications. The deep link goes to the first tagged photo.

**Feed tagging:** Tags on existing feed photos (via three-dots menu) send immediately — one notification per tag. No batching since these are one-off actions.

Notifications should be reliable, fast (within seconds), and clear about who tagged you.

</vision>

<essential>
## What Must Be Nailed

- **Reliable delivery** — Every tag must result in a notification, no silent failures
- **Speed/immediacy** — Notification arrives within seconds of being tagged
- **Clear messaging** — Simple format: "[Name] tagged you in a photo" (or "in X photos" for batched)
- **Smart batching** — Darkroom triage tags grouped together, feed tags instant

</essential>

<boundaries>
## What's Out of Scope

- Tag management UI (no "view all my tags" screen)
- Removing yourself from tags
- Tag privacy settings (no "who can tag me" controls)
- Abuse protection (trust the users — friends-only context)

</boundaries>

<specifics>
## Specific Ideas

- Notification format: "[Name] tagged you in a photo" (single) or "[Name] tagged you in X photos" (batched)
- Deep link: Always to the photo (first photo for batched)
- Batching boundary: Same darkroom triage session
- Preferences: Add dedicated "Tagged in photos" toggle to notification settings
- Cancelation: If tag is removed before notification sends, cancel the notification

</specifics>

<notes>
## Additional Context

Two distinct flows:

1. **Darkroom tagging** (Phase 39) — Multiple tags possible in one session, batch notifications
2. **Feed tagging** (Phase 40) — One-off tags, instant notifications

The batching for darkroom prevents notification spam when someone goes through a batch of photos tagging the same friend in several of them.

</notes>

---

_Phase: 41-tagged-notification-integration_
_Context gathered: 2026-02-06_
