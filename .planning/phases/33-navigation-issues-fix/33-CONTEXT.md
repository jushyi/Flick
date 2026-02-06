# Phase 33: Navigation Issues Fix - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<vision>
## How This Should Work

When you're reading comments and tap on someone's profile, the comments sheet shouldn't close. It should work like Instagram — you navigate to the profile, browse around, and when you come back, the comments are exactly where you left them. Same scroll position, same context, like you never left.

The swipe-up gesture to open comments is a secondary addition. It's a power user feature — just an alternative way to get to comments instead of tapping. It should feel subtle and optional, not a primary action. When you swipe up on a photo, it opens the comments sheet (same behavior as tapping the comment icon).

</vision>

<essential>
## What Must Be Nailed

- **Comments sheet persistence** — When tapping a profile from comments, the sheet must stay open/restorable. Navigation shouldn't break the context.
- **Return experience** — Coming back to comments after viewing a profile should feel seamless — exactly where you left off, same scroll position, same context.
- **Swipe-up gesture** — Swiping up on a photo opens comments. Should behave identically to tapping the comment icon.

</essential>

<boundaries>
## What's Out of Scope

- No new comment functionality — just fixing navigation behavior
- No other gesture additions — only swipe-up for comments
- No visual redesign — keep existing sheet appearance, just fix behavior
- No visual hint for swipe-up — power user feature that's discovered naturally

</boundaries>

<specifics>
## Specific Ideas

- Should work like Instagram for the profile navigation flow
- Swipe-up gesture is subtle and optional — not a primary interaction
- Empty state for swipe-up: same behavior as tapping comment icon
- For other navigation from comments (like tagged photos): decide case-by-case during implementation, but profile taps are the main issue

</specifics>

<notes>
## Additional Context

The two issues being addressed:

- ISS-004: Comments sheet closes when navigating to profile
- ISS-005: Swipe up on photo to open comments

Both are equally critical to the feed interaction experience. The focus is on fixing existing behavior, not adding new features.

</notes>

---

_Phase: 33-navigation-issues-fix_
_Context gathered: 2026-02-06_
