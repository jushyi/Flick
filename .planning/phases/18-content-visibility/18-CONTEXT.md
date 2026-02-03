# Phase 18: Content Visibility Duration - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<vision>
## How This Should Work

Content in Rewind has a natural freshness cycle — stories live for 7 days, feed posts live for 1 day. The feed is purely about friends' content; your own posts never appear in your own feed.

Users see their own recent photos in two places: the "Me" story card in the stories bar, and on their profile (albums, monthly albums). The feed scroll is 100% friend activity.

When content "expires," it doesn't get deleted — it just quietly cycles out of the active views. Photos still exist in albums and monthly albums. The expiration is seamless; users don't notice the moment content disappears, it just feels like the feed stays fresh.

</vision>

<essential>
## What Must Be Nailed

- **Correct timing logic** — The 7-day (stories) and 1-day (feed) rules must work accurately. Content appears and disappears at the right times.
- **Feed feels fresh** — No stale content. The feed should always feel like recent friend activity, not a backlog.
- **Own content separation** — Clear distinction between "my stuff" (profile/stories bar) vs "friends' stuff" (feed). Your posts never pollute your own feed.

</essential>

<boundaries>
## What's Out of Scope

- Visual countdown indicators — No "expires in 2 hours" timers or countdown UI
- Different rules per friend — Everyone sees content with the same timing rules (no close friends / best friends exceptions)
- User-configurable durations — Fixed 7-day / 1-day rules; users can't change visibility settings
- Content deletion — Expired content stays in albums/monthly albums, just drops from active views

</boundaries>

<specifics>
## Specific Ideas

- Seamless transition — Content quietly disappears without fanfare. Users don't notice the expiration moment; it just feels natural.
- No empty state changes needed — Existing empty feed states (Phase 10) should handle cases where no recent friend posts exist.

</specifics>

<notes>
## Additional Context

The timing model (7 days stories, 1 day feed) is longer than Instagram/Snapchat's 24-hour stories, giving content more time to be seen while still maintaining freshness.

The "own posts don't appear on own feed" rule is important — it reinforces that the feed is for discovering what friends are up to, not reviewing your own activity.

</notes>

---

_Phase: 18-content-visibility_
_Context gathered: 2026-02-03_
