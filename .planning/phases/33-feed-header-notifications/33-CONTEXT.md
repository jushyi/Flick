# Phase 33: Feed Header & Notifications - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<vision>
## How This Should Work

The feed gets a clean new header with the Rewind logo on the left and a heart icon on the right. Tapping the heart opens a dedicated Activity page — a social hub with two tabs.

**Notifications tab** shows reactions on your photos. Friend requests are pinned at the top, with reactions listed chronologically below. Tapping a reaction opens that photo in a modal (same as current feed behavior). This tab will expand to include comment notifications when Phase 36 is built.

**Friends tab** consolidates all friend-related actions: incoming/sent friend requests, user search to find new friends, and request management. The existing Friends screens (FriendsListScreen, UserSearchScreen, FriendRequestsScreen) get absorbed into this tab.

The feed header should hide when scrolling down and reappear when scrolling up — standard Instagram behavior. A red dot on the heart icon indicates new activity; it clears when you open the Activity page.

</vision>

<essential>
## What Must Be Nailed

- **Clean header redesign** — Logo left, heart icon right, feels polished and branded
- **Two-tab activity page** — Notifications and Friends tabs work as a cohesive social hub
- Both equally important as an integrated package

</essential>

<boundaries>
## What's Out of Scope

- Push notification settings UI — no settings screen for managing preferences
- Read/unread states per item — just the red dot for "any new activity"
- Time-based grouping (Today/This Week/Earlier) — simple chronological list

</boundaries>

<specifics>
## Specific Ideas

- Instagram Activity style: clean rows with profile photos, names, action text, timestamps
- Friend requests pinned at top of Notifications tab (not inline chronologically)
- Photo detail modal opens when tapping a reaction (consistent with feed)
- Header hides on scroll down, returns on scroll up
- Red dot indicator (not count badge) on heart icon
- Notifications tab designed with future extensibility for comment notifications (Phase 36)

</specifics>

<notes>
## Additional Context

This phase consolidates the existing Friends tab functionality into the Activity page's Friends tab. The main navigation will have 3 tabs (Feed, Camera, Profile) after Phase 32, and the Friends screens move into this Activity page accessed via the heart icon.

The heart icon (rather than a bell) makes sense since the activity is primarily about reactions.

</notes>

---

_Phase: 33-feed-header-notifications_
_Context gathered: 2026-01-25_
