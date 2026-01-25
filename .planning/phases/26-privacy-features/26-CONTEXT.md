# Phase 26: Privacy Features - Context

**Gathered:** 2026-01-25
**Status:** Ready for research

<vision>
## How This Should Work

Minimal compliance screens — functional, not fancy. Users access privacy features through a settings gear icon on the profile screen. The settings menu includes:

- Privacy Policy (scrollable screen with generated legal content)
- Terms of Service (scrollable screen with generated legal content)
- Delete Account (with re-authentication required)

When a user deletes their account, everything gets purged — their photos disappear from everyone's feeds, their user document is deleted, friendships are cleaned up. Standard social app behavior that matches what Instagram/Lapse does.

The settings screen should match the existing app style (dark theme, existing colors/typography) rather than mimicking iOS native Settings.

</vision>

<essential>
## What Must Be Nailed

- **App Store approval** — Functional account deletion and accessible legal docs (Apple requirement)
- **Working deletion** — Account deletion that actually cleans up all user data properly (full purge)
- **Legal text ready** — Claude-generated privacy policy and terms content based on app features
- **Re-authentication** — Require phone verification before allowing account deletion (security)

</essential>

<boundaries>
## What's Out of Scope

- Data export/download feature (GDPR-style "download my data" — not needed for MVP)
- Granular privacy controls (per-photo visibility, blocking users, etc. — future features)
- Custom legal text (using generated content, not lawyer-reviewed documents)
- External hosted legal docs (keeping everything in-app)

</boundaries>

<specifics>
## Specific Ideas

- Settings accessed via gear icon on Profile screen
- Settings screen uses app's existing dark theme and typography
- Account deletion requires re-authentication (phone verification) before proceeding
- Full data purge on deletion: photos, friendships, user document, reactions — everything
- Legal screens are simple scrollable text views

</specifics>

<notes>
## Additional Context

Research needed on:

- iOS App Store privacy policy requirements (what must be included)
- App Store account deletion requirements (timeline, process requirements)
- Standard competitor patterns for delete flow UX

The priority is App Store compliance — this needs to pass Apple review. The experience should be functional and clean but doesn't need to be polished beyond that.

</notes>

---

_Phase: 26-privacy-features_
_Context gathered: 2026-01-25_
