# Phase 37: Darkroom Ready Notifications - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

> **Note:** Phase renamed from "iOS Live Activities" to "Darkroom Ready Notifications" — user preferred simple push notifications over Live Activity complexity.

<vision>
## How This Should Work

**This is an audit/update of existing functionality, not a new build.**

Darkroom "photos ready" notification already exists. This phase audits the current implementation, identifies any gaps, and updates as needed to ensure:

- Notification reliably fires when photos finish developing
- Tapping notification takes user straight to darkroom
- Messaging is clear and actionable

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

**Existing implementation:** Darkroom ready notification already exists in the codebase. This phase is an audit and update, not a greenfield build. During planning, research the current implementation to identify what works and what needs fixing.

</notes>

---

_Phase: 37-darkroom-notifications_
_Context gathered: 2026-02-06_
