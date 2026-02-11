# Phase 49: Automated Test Suite - Context

**Gathered:** 2026-02-11
**Status:** Ready for research

<vision>
## How This Should Work

A safety net for shipping. Tests run automatically on every PR as a CI gate — can't merge if tests fail — plus a full suite run before cutting a release for final confidence. The combination gives fast feedback during development and a last sanity check before anything reaches the App Store.

The test suite should feel lightweight, not burdensome. Unit tests run in seconds, not minutes — quick enough that you actually want to run them. Adding a new test for a new feature should be copy-paste simple, following clear patterns, not a research project every time.

The whole point is catching regressions before they hit users. Run tests, know nothing broke, ship with confidence.

</vision>

<essential>
## What Must Be Nailed

- **E2E critical user journeys** — Detox tests covering auth/onboarding, camera/darkroom, and feed/social flows. These are the flows where a silent break would be catastrophic.
- **Unit test foundation** — Jest tests for business logic (services, hooks, utils). Fast, reliable, easy to maintain.
- **Test infrastructure** — Config, CI integration, and patterns that make adding new tests trivial. The setup needs to be solid so future test additions are effortless.

All three are equally important — can't ship without them working together.

</essential>

<boundaries>
## What's Out of Scope

- **100% coverage** — Not chasing a coverage number. Focus on critical paths and business logic, not every edge case.
- **Visual regression tests** — No screenshot comparison or pixel-perfect visual testing. That's a different beast entirely.
- **Performance benchmarks** — Already handled by Firebase Performance Monitoring in Phase 47. Tests here are functional, not performance-oriented.

</boundaries>

<specifics>
## Specific Ideas

- Fast feedback loop — unit tests should run in seconds so they don't become something you avoid running
- Easy to extend — clear, copy-paste patterns for adding new tests. No research project per test.
- Minimal maintenance — prefer fewer, broader tests that rarely need updating. Tests shouldn't slow down feature work. Test at the right abstraction level so feature changes don't cascade across the test suite.
- E2E should cover all three critical areas: auth + onboarding, camera + darkroom, feed + social

</specifics>

<notes>
## Additional Context

The app has 57,000+ lines of JavaScript/JSX across 45+ shipped phases covering 8 feature areas (Auth, Profile, Camera/Photos, Feed, Stories, Social, Notifications, Settings). Phase 50 (CI/CD Pipeline) depends on this phase, so the test infrastructure needs to be CI-ready from the start.

The user values shipping speed — the test suite should protect quality without becoming a drag on velocity.

</notes>

---

_Phase: 49-automated-test-suite_
_Context gathered: 2026-02-11_
