# Phase 20: Friend Suggestions via Contacts Sync - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<vision>
## How This Should Work

After completing profile setup, users get a prompt to sync their contacts. This happens as a final onboarding step before they hit the feed for the first time. The permission request should feel trustworthy with clear privacy messaging - contacts stay on device, we just match phone numbers.

When contacts sync, we match against existing app users and show a full list of matched contacts with "Add Friend" buttons. Users can add multiple friends at once during this onboarding flow.

If no matches are found, we encourage sharing - a friendly message suggesting they tell friends about the app.

Beyond onboarding, suggestions persist in the Friends screen's Requests tab. They appear at the top if there are no pending/sent requests, or below any active requests. Users who skipped contacts sync during onboarding see a "Sync contacts to find friends" prompt in this section.

Suggestion cards match the existing friend request card format for visual consistency. Users can dismiss suggestions they don't want to see.

</vision>

<essential>
## What Must Be Nailed

- **Permission flow** - Making the contacts permission request feel natural and trustworthy with clear privacy messaging
- **Match quality** - Only showing relevant people (contacts who are existing app users)
- **Easy bulk add** - Making it effortless to add multiple friends at once during onboarding

</essential>

<boundaries>
## What's Out of Scope

- Social graph suggestions (friends-of-friends / mutual friends logic) - just direct contacts for now
- Auto-sync updates (automatically re-syncing contacts periodically) - one-time sync only
- Contact invites (sending SMS/invite links to contacts who don't have the app yet)

</boundaries>

<specifics>
## Specific Ideas

- **Privacy first messaging** - Emphasize that contacts stay on device, we just match phone numbers
- **Dismissible suggestions** - Allow hiding specific suggestions the user doesn't want to see
- **Onboarding timing** - Prompt appears after profile setup, before hitting the feed
- **Requests tab integration** - Suggestions appear in Requests tab, below any active requests
- **Skip recovery** - If user skips during onboarding, show "Sync contacts" prompt in suggestions section
- **Empty state** - If no matches found, show encouraging message about sharing with friends
- **Card consistency** - Suggestion cards match existing friend request card format

</specifics>

<notes>
## Additional Context

This phase focuses on the core contact matching flow. Future phases could add:

- Mutual friends display ("3 friends in common")
- Periodic re-sync of contacts
- SMS invite functionality for contacts not on the app
- Friends-of-friends suggestions

The Requests tab is the natural home for suggestions since that's where users manage incoming friend activity.

</notes>

---

_Phase: 20-friend-suggestions-contacts-sync_
_Context gathered: 2026-02-04_
