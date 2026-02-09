# Phase 46: Full Notifications Testing - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<vision>
## How This Should Work

A structured, type-by-type manual test checklist on a real device. Go through every notification type the app supports and verify the full pipeline: trigger the event, confirm the notification fires, receive it, tap it, and verify it deep links to the correct screen with the correct content.

This is a systematic walkthrough — one notification type at a time — covering the entire send-receive-tap-land cycle. If something is broken along the way, fix it in-place rather than deferring to a separate phase.

</vision>

<essential>
## What Must Be Nailed

- **Every notification type actually fires** — no silent failures, every type we built sends and arrives
- **Deep links work correctly** — tapping a notification lands on the right screen with the right content
- **Settings/preferences respected** — toggle-off prevents notifications, per-type settings work as expected
- All three are equally important — this is a full end-to-end verification of the entire notification system

</essential>

<boundaries>
## What's Out of Scope

- Automated test suites — this is manual testing only
- New notification types — only testing what's already built
- No deferring bugs — if something's broken, fix it during this phase

</boundaries>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for structuring the type-by-type checklist.

</specifics>

<notes>
## Additional Context

This phase covers all notification types built across Phases 34-41: likes, comments, comment replies, friend requests, friend accepted, @mentions, story notifications, tagged photo notifications, and darkroom ready notifications. The checklist should be exhaustive across all of these.

</notes>

---

_Phase: 46-full-notifications-testing_
_Context gathered: 2026-02-09_
