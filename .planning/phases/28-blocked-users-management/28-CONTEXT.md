# Phase 28: Blocked Users Management - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<vision>
## How This Should Work

A simple, consistent screen for viewing and managing blocked users. Accessed from Settings, it shows all blocked users in a familiar card layout matching the Friends screen pattern.

Each blocked user appears as a card with their profile photo and name. Tapping a card navigates to view their profile. A three-dot menu on the right side of each card provides the unblock option — same interaction pattern as FriendCard.

The unblock flow should feel obvious and quick. After unblocking, the user disappears from the list.

</vision>

<essential>
## What Must Be Nailed

- **Easy to find** — Clear navigation path from Settings
- **Simple unblock flow** — Three-dot menu → Unblock, fast and obvious
- **Visual consistency** — Cards match FriendCard styling, feels like existing app patterns

</essential>

<boundaries>
## What's Out of Scope

- No ability to block users from this screen — blocking happens from profile/friend card menus elsewhere
- No block history or timestamps — just the current list of blocked users
- No search functionality — simple list is sufficient

</boundaries>

<specifics>
## Specific Ideas

- Cards styled like FriendCard component
- Tap card → view blocked user's profile
- Three-dot menu on right → Unblock option
- Confirmation dialog before unblocking

</specifics>

<notes>
## Additional Context

Service layer already exists from Phase 21 (blockService.js). This phase adds the UI layer only.

Source: Phase 24 Social Media Feature Audit identified this as a T2 partial gap (service exists, no UI).

</notes>

---

_Phase: 28-blocked-users-management_
_Context gathered: 2026-02-05_
