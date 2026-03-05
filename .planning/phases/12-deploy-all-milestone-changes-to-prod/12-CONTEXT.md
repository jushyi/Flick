# Phase 12: Deploy All Milestone Changes to Prod - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy all v1.1 "Pinned Snaps & Polish" milestone changes (phases 6-11) to production via TestFlight. Includes Firebase backend deployment, a single dev build for native testing, on-device verification against prod Firebase, and a single prod build for TestFlight distribution. No App Store release in this phase.

</domain>

<decisions>
## Implementation Decisions

### Deployment Sequencing
- One dev build bundling all native changes from phases 8-11 (expo-screen-capture, expo-live-activity, expo-video, microphone permission)
- Phases 6-7 are OTA-only — no native build required for their JS changes
- One prod build after on-device testing passes, submitted to TestFlight only

### Firebase Backend Rollout
- Deploy cloud functions and storage rules first, before any app build
- Verify backend deployments work correctly before proceeding to app build
- Firestore TTL policy and GCS Storage lifecycle rule (phase 6 debt items) deployed separately after core features are confirmed working on-device
- Backend must be live before app update hits devices — new features depend on updated functions

### Testing Strategy
- Dev build installed on physical device, tested against prod Firebase
- Testing checklist generated from phases 6-11 success criteria covering:
  - Darkroom cache optimization (phase 6)
  - Story viewing performance (phase 7 — already shipped, verify no regressions)
  - Screenshot detection and notifications (phase 8)
  - Pinned Snaps Live Activities on iOS (phase 9 — currently blocked on NSE plist issue, must be resolved first)
  - Pinned Snaps Android notifications (phase 10)
  - Video capture, upload, darkroom, feed, PhotoDetail, stories (phase 11)
- All checklist items must pass before triggering prod build

### App Submission
- Prod build goes to TestFlight only — no App Store release
- No phased rollout or staged percentage needed

### Rollback Plan
- JS-only issues: fix and push OTA update via `eas update`
- Native issues: fix and rebuild
- No feature flags — fix and rebuild approach
- Firestore TTL and GCS lifecycle rules held back until core features verified, since they're harder to reverse

### Claude's Discretion
- EAS build profile configuration details
- Exact order of cloud function deployments
- Testing checklist formatting and grouping
- Version bump strategy

</decisions>

<specifics>
## Specific Ideas

- Phase 9 is currently blocked on an NSE NSSupportsLiveActivities plist key issue — this must be resolved before the deployment phase can fully execute
- The dev build serves dual purpose: test native code integration AND verify features against prod Firebase
- Backend-first deployment ensures no window where the app expects endpoints/rules that don't exist yet

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-deploy-all-milestone-changes-to-prod*
*Context gathered: 2026-03-05*
