# Phase 21: Full Verification of Phases 13-20 - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprehensive end-to-end regression testing of the entire Supabase migration (phases 13-20). Every user flow in the app is tested on both iOS and Android against the dev Supabase environment. This phase does NOT build new features — it systematically verifies that auth, storage, data layer, photos, feed, darkroom, social features, albums, messaging, background jobs, notifications, performance optimizations, TypeScript conversion, and Firebase removal all work correctly together as a complete system. Failures are fixed inline before continuing.

</domain>

<decisions>
## Implementation Decisions

### Test Scope & Coverage
- **D-01:** Comprehensive regression suite — every user flow in the app tested end-to-end on the new Supabase stack. This goes beyond Phase 20's migration validation (which tests BEFORE Firebase removal) to cover ALL app functionality in the final post-Firebase state.
- **D-02:** Both iOS and Android tested with full UAT on each platform. Not iOS-primary — equal coverage.
- **D-03:** Test the final state only — don't re-run individual blocked/failed items from Phase 13-14 UATs. If the comprehensive regression covers those flows (which it will), that's sufficient.
- **D-04:** Every user flow tested — auth, camera, darkroom, feed, stories, profiles, friends, messaging, albums, notifications, settings, blocking, reporting, account deletion. No flows skipped.

### Test Environment & Data
- **D-05:** Dev Supabase environment only. Prod testing is a separate step after UAT passes (outside this phase's scope).
- **D-06:** Both migrated data AND fresh seed data tested. Migrated dev Firebase data proves the migration pipeline works. Fresh accounts prove new user signup works on the pure Supabase stack. Both paths must pass.

### Pass/Fail Criteria
- **D-07:** Zero failures required. Every test case must pass to declare Phase 21 complete. No "acceptable gaps" or severity-based exceptions.
- **D-08:** Fix inline, re-test. When a test fails, stop UAT, fix the issue immediately, re-test that specific flow, then continue. Phase 21 includes both testing AND fixing.

### Verification Workflow
- **D-09:** Claude-guided interactive walkthrough. Claude presents each test case one at a time. User runs it on device and reports pass/fail. Claude logs results, handles failures, and guides to the next test.
- **D-10:** Organization: user journeys first, feature-area gaps second. Start with key end-to-end user journeys (covers happy paths and real usage patterns). Then sweep by feature area for edge cases and flows the journeys didn't cover.

### Claude's Discretion
- Exact user journeys to define (based on app's feature set and common usage patterns)
- Order of feature-area gap testing after journeys complete
- How to structure the fix-and-retest cycle (inline code fix vs creating a quick plan)
- Whether to run `npm test` as a prerequisite gate before starting manual UAT

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior UAT Results
- `.planning/phases/13-auth-storage-migration/13-UAT.md` — 5/6 passed, 1 issue (test suite failures)
- `.planning/phases/14-data-layer-caching-foundation/14-UAT.md` — 3/6 passed, 3 blocked (auth/Firestore conflict)

### Phase Context Files (what was built in 13-20)
- `.planning/phases/13-auth-storage-migration/13-CONTEXT.md` — Auth & storage migration decisions
- `.planning/phases/14-data-layer-caching-foundation/14-CONTEXT.md` — PowerSync + TanStack Query setup
- `.planning/phases/15-core-services-photos-feed-darkroom/15-CONTEXT.md` — Photos, feed, darkroom services
- `.planning/phases/16-core-services-social-albums/16-CONTEXT.md` — Social features and albums
- `.planning/phases/17-messaging-social/17-CONTEXT.md` — Messaging service migration
- `.planning/phases/18-background-jobs-notifications/18-CONTEXT.md` — Background jobs and notifications
- `.planning/phases/19-performance-polish/19-CONTEXT.md` — Performance optimizations
- `.planning/phases/20-typescript-sweep-firebase-removal/20-CONTEXT.md` — TS conversion, Firebase removal, Sentry

### Test Infrastructure
- `__tests__/setup/jest.setup.js` — Test setup (should have Supabase mocks by Phase 20)
- `jest.config.js` — Test configuration

### Project Docs
- `CLAUDE.md` — App architecture, navigation structure, photo lifecycle, service layer patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Prior UAT files (13-UAT.md, 14-UAT.md) — established format for test case documentation with status tracking
- `.planning/codebase/TESTING.md` — documents current test framework (Jest + jest-expo + Testing Library)
- Existing test suites in `__tests__/` — automated tests that can serve as prerequisite gate

### Established Patterns
- UAT format: numbered test cases with expected behavior, result (pass/fail/blocked/issue), and severity
- Service layer: `src/services/supabase/` for all Supabase operations
- Navigation: nested stack/tab structure documented in CLAUDE.md

### Integration Points
- Every Supabase service file is an integration point to verify
- Auth flow → profile → main app navigation chain
- Photo lifecycle: capture → developing → reveal → feed → triage
- Messaging: conversation list → individual conversation → send/receive

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for structuring the walkthrough.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- "Set up Supabase phone auth with Twilio SMS provider" — auth setup, not verification testing. Belongs in Phase 13 scope or infrastructure setup.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-full-verification-of-phases-13-20-guided-uat-of-supabase-migration*
*Context gathered: 2026-03-24*
