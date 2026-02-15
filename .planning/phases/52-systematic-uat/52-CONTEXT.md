# Phase 52: Systematic UAT - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<vision>
## How This Should Work

UAT is the release gate — a structured, thorough walkthrough of every feature in the app, done on a real iPhone with step-by-step test scripts. Claude acts as the QA lead, providing exact instructions ("Tap X, enter Y, verify Z appears"), and the user taps through and reports what they see. Claude verifies pass/fail against expected outcomes.

The process combines structured checklist testing with deliberate edge-case poking — trying weird inputs, rapid tapping, empty states, permission denials, and anything else that might break. Small issues get fixed inline during testing (plans should account for this fix time). Anything too complex for an inline fix gets escalated to a GitHub issue. Nice-to-have improvements get logged in a "post-launch improvements" list without blocking the release.

Testing starts with a **fresh install** on a real device — delete the app, reinstall, and go through the complete new-user journey from scratch. Then single-device tests cover each feature area with detailed step-by-step scripts, including empty state testing. All **multi-device tests** (notifications, friend request/accept flows, real-time feed updates) are grouped together at the end so two phones only need to be set up once.

Full UAT runs on the **dev Firebase environment** first (familiar data, faster iteration). After all dev tests pass, a quick smoke test re-runs the most critical paths on the **production Firebase environment** to verify the clean environment works.

The darkroom reveal cycle has a short enough wait time to test the full cycle live — no time manipulation needed.

</vision>

<essential>
## What Must Be Nailed

- **Every feature area gets equal scrutiny** — Auth, Profile, Camera/Photos, Feed, Stories, Social, Notifications, Settings, and Contributions/IAP. This is the release gate, not a spot check.
- **Step-by-step test scripts** — Detailed QA-style scripts ("Tap X, enter Y, verify Z"), not vague checklists. Nothing gets missed.
- **Real device testing** — Physical iPhone, not simulator. Camera, haptics, push notifications, and real performance all need real hardware.
- **Fresh install experience** — True first-time user experience tested from a clean slate, not just dev state.
- **Inline fixes** — Small issues fixed on the spot during testing. Plans should anticipate and accommodate inline fix time.

</essential>

<boundaries>
## What's Out of Scope

- **Android testing** — iOS only for v1.0.0, no Android testing at all
- **Performance benchmarking** — Already covered in Phase 46/47. UAT is about functional correctness, not speed metrics
- **CI/CD pipeline testing** — Pipeline was verified in Phase 50. UAT is about the app experience
- **Full production test suite** — Production gets a quick smoke test of critical paths only, not a full re-run

</boundaries>

<specifics>
## Specific Ideas

- **Plan structure: single-device then multi-device** — First batch covers everything testable on one phone. Last batch groups all two-phone tests together (notifications, friend flows, real-time updates) so devices only need to be set up once.
- **Fresh install as Plan #1** — Start UAT by deleting the app, reinstalling, and running through the entire new-user journey. Then also test empty states within each feature area.
- **Edge cases throughout** — Empty states, long text, rapid actions, offline/reconnect, permission denials woven into every feature area's tests.
- **Contributions/IAP included** — Full testing of the contributions page, purchase flow, and name color perk from Phase 51.
- **Production smoke test** — Not a separate plan. Quick re-run of critical paths (auth, camera, reveal, feed) on production after dev UAT passes.
- **Issue triage** — Inline fix if small, GitHub issue if complex, "post-launch improvements" list if nice-to-have.

</specifics>

<notes>
## Additional Context

Claude guides step by step, user taps and reports what happens. Claude verifies pass/fail based on expected outcomes and helps fix issues inline when they're small enough.

The darkroom reveal wait time is short in dev, so the full capture-develop-reveal cycle can be tested live without time manipulation.

All 8 feature areas from the roadmap constraint are covered, plus the Contributions/IAP feature from Phase 51.

</notes>

---

_Phase: 52-systematic-uat_
_Context gathered: 2026-02-12_
