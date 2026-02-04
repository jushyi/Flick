# Phase 22: Ability to Edit Profile - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<vision>
## How This Should Work

Users access Edit Profile from the Settings screen. Tapping it opens a dedicated, Instagram-style edit screen with a clean, minimal aesthetic. The layout is a scrollable form with the profile photo at the top, followed by text fields for display name, username, and bio.

Tapping the profile photo opens an options menu with: Edit (re-crop existing), Take New Picture, and Choose New Picture. After selecting or capturing a photo, a circular crop tool lets users frame the shot before setting it. Users can also remove their photo entirely, falling back to the default avatar.

Username changes are limited to once every 14 days. When within this window, the username field is disabled with a tooltip showing "Can change in X days." When editable, real-time availability checking works like during signup — debounced check with checkmark/X indicator.

After saving changes, users are navigated back to their Profile screen to see the updated info.

</vision>

<essential>
## What Must Be Nailed

- **Quick access** — Getting to edit mode from Settings should be fast and obvious
- **Clear save/cancel** — Users should always know how to save changes or discard them
- **Validation feedback** — Real-time feedback for invalid fields (username taken, too long, 14-day restriction)

</essential>

<boundaries>
## What's Out of Scope

- Selects editing — already works from profile tap
- Album management — already exists
- Privacy settings — defer to future phase
- Profile song editing — already has edit menu from Phase 7

**This phase focuses on:** display name, username, bio, and profile photo only.

</boundaries>

<specifics>
## Specific Ideas

- Instagram-style clean, minimal edit screen
- Photo options menu: Edit (re-crop), Take New Picture, Choose New Picture, Remove Photo
- Circular crop tool for photo framing
- 14-day username change restriction with disabled field + tooltip
- Real-time username availability check (500ms debounce, same as signup)
- Remove photo option falls back to default avatar (ProfileIcon SVG)
- Navigate to Profile screen after successful save

</specifics>

<notes>
## Additional Context

Access flow: Settings → Edit Profile (dedicated screen)

The app already has patterns for:

- Username availability checking (ProfileSetupScreen)
- Circular crop tool may need to be built or found (expo-image-manipulator or similar)
- Character limits from Phase 14: display name (24), username (24), bio (240)

</notes>

---

_Phase: 22-edit-profile_
_Context gathered: 2026-02-04_
