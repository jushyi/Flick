# Phase 47: Firebase Performance Monitoring - Context

**Gathered:** 2026-02-10
**Status:** Ready for research

<vision>
## How This Should Work

Firebase Performance Monitoring should be integrated to track critical flows across the entire app — both user-facing moments (app startup, feed loading, photo capture, story playback, profile load) and backend round-trips (auth requests, Firestore queries, Cloud Function invocations, image uploads). The goal is full visibility: connecting user-perceived slowness to the actual backend cause.

This runs invisibly in the background — users never know it's there. The data flows into the Firebase console where it becomes immediately useful for spotting bottlenecks and understanding real-world performance.

</vision>

<essential>
## What Must Be Nailed

- **Actionable traces** — Not just raw data. Traces must be organized so you can quickly identify WHAT is slow and WHERE the bottleneck is. When something feels sluggish, the traces should point directly to the cause.
- **Feature-area organization** — Traces grouped by feature area (auth/, feed/, camera/, social/, stories/) matching the app's existing structure, making it intuitive to find relevant performance data.
- **Full-stack visibility** — Both user-facing moments and backend network calls instrumented, so you can trace a slow experience from the UI down to the specific Firebase call causing it.

</essential>

<boundaries>
## What's Out of Scope

- No custom dashboards or alert rules — Firebase console is sufficient for now
- No optimization work — this phase measures and baselines, doesn't fix issues found
- No building monitoring UI within the app itself

</boundaries>

<specifics>
## Specific Ideas

- Traces named by feature area: `auth/login`, `feed/load`, `camera/capture`, `social/friend_request`, `stories/playback`
- Both custom traces (user-facing flows) and automatic network traces (Firebase/API calls)
- Baseline establishment so future changes can be measured against known-good numbers

</specifics>

<notes>
## Additional Context

This phase follows Phase 46 (Performance Optimization) which already improved Firebase queries, UI rendering, and Cloud Functions. Phase 47 provides the measurement layer to validate those improvements with real production data and catch regressions going forward.

</notes>

---

_Phase: 47-firebase-perf-monitoring_
_Context gathered: 2026-02-10_
