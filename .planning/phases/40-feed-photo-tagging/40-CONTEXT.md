# Phase 40: Feed Photo Tagging - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<vision>
## How This Should Work

On feed photos, there's a dedicated tag button positioned above the existing three-dots menu. It uses a person icon with a + badge — instantly recognizable for "tag someone."

When the photo owner taps it, the same tagging modal from Phase 39 (darkroom) opens where they can add or remove friends from the tag list. The experience should feel identical to tagging during darkroom triage.

When a viewer (non-owner) taps the button, they see a list of everyone tagged in that photo — each person shown with their profile pic and display name. Tapping any person navigates to their profile.

The icon itself changes appearance (highlights/fills) when there are tagged people, so users know at a glance whether anyone's tagged — but no count badge.

</vision>

<essential>
## What Must Be Nailed

- **Consistency with darkroom** — The tagging modal and experience must feel identical whether you're in darkroom (Phase 39) or feed
- **Easy discovery** — Dedicated button above three-dots menu, not buried in a submenu. Users should immediately see they can tag people

</essential>

<boundaries>
## What's Out of Scope

- Tag notifications — notifying tagged users is Phase 41
- Self-untagging — allowing tagged users to remove themselves is future work
- Other locations — this phase is feed photos only (stories, album viewer, etc. are separate)

</boundaries>

<specifics>
## Specific Ideas

- Person icon with + badge for the button design
- Icon changes to filled/highlighted state when tags exist (no count badge)
- Can only tag friends (not any user)
- No limit on number of people tagged
- Tapping a tagged person in the viewer list navigates to their profile
- Reuse the exact same tagging modal that Phase 39 creates for darkroom

</specifics>

<notes>
## Additional Context

This phase builds directly on Phase 39's tagging infrastructure. The key new work is:

1. Adding the tag button to the feed photo UI
2. Differentiating owner vs viewer experience when button is tapped
3. Creating the "view tagged people" list for non-owners

</notes>

---

_Phase: 40-feed-photo-tagging_
_Context gathered: 2026-02-06_
