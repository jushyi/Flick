# Phase 21: Full Verification of Phases 13-20 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 21-full-verification-of-phases-13-20-guided-uat-of-supabase-migration
**Areas discussed:** Test scope & coverage, Test environment & data, Pass/fail criteria, Verification workflow

---

## Test Scope & Coverage

### Phase 21 vs Phase 20 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Post-removal smoke test | Phase 20 tests BEFORE Firebase removal. Phase 21 tests AFTER. | |
| Cross-phase integration UAT | Tests interactions between phases — integration seams, not individual features. | |
| Comprehensive regression suite | Exhaustive regression — every user flow in the app tested e2e on new Supabase stack. | ✓ |

**User's choice:** Comprehensive regression suite
**Notes:** Goes beyond Phase 20's migration validation to cover ALL app functionality.

### Platforms

| Option | Description | Selected |
|--------|-------------|----------|
| iOS only | Primary platform, test iOS thoroughly. | |
| Both iOS & Android | Full UAT on both platforms. | ✓ |
| iOS primary, Android spot-check | Full UAT on iOS, quick smoke on Android. | |

**User's choice:** Both iOS & Android

### Prior gaps handling

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, sweep up all prior gaps | Re-run all blocked/failed UAT items from phases 13-14. | |
| Only test final state | Don't re-run old UAT individually. Comprehensive regression covers same flows. | ✓ |
| You decide | Claude determines approach. | |

**User's choice:** Only test final state

### Flow granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Every user flow | Auth, camera, darkroom, feed, stories, profiles, friends, messaging, albums, notifications, settings, blocking, reporting, account deletion. | ✓ |
| Critical paths only | Core loop only — auth, camera, photo reveal, feed, messaging, profile. | |
| Risk-based | Focus on flows that changed in the migration. | |

**User's choice:** Every user flow

---

## Test Environment & Data

### Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Dev Supabase only | Test against dev Supabase project. Prod testing is separate step. | ✓ |
| Dev first, then prod | Full UAT on dev, subset on prod. | |
| You decide | Claude determines strategy. | |

**User's choice:** Dev Supabase only

### Test data

| Option | Description | Selected |
|--------|-------------|----------|
| Use migrated dev data | Migrated Firebase data is sufficient. | |
| Fresh seed data | Clean seed script with known test accounts. | |
| Both — migrated + seed | Test migrated data AND fresh accounts. | ✓ |

**User's choice:** Both — migrated + seed

---

## Pass/Fail Criteria

### Pass criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Zero failures | Every test case must pass. Any failure blocks completion. | ✓ |
| Zero critical, minor OK | Critical must pass, minor can be logged. | |
| Threshold-based | Set a pass rate, document all failures with severity. | |

**User's choice:** Zero failures

### Failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fix inline, re-test | Stop UAT, fix issue, re-test, continue. Phase includes testing AND fixing. | ✓ |
| Log all, batch fix | Run all tests first, batch-fix after. | |
| Log and triage | Log with severity, fix critical inline, defer non-critical. | |

**User's choice:** Fix inline, re-test

---

## Verification Workflow

### Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Claude-guided walkthrough | Claude presents each test case one at a time. User runs on device, reports pass/fail. | ✓ |
| Checklist document | Claude generates comprehensive checklist. User works through at own pace. | |
| Automated + manual hybrid | Run npm test first, then Claude guides manual on-device testing. | |

**User's choice:** Claude-guided walkthrough

### Organization

| Option | Description | Selected |
|--------|-------------|----------|
| By feature area | Group tests by domain: Auth, Camera, Darkroom, Feed, etc. | |
| By user journey | Group tests by e2e flows: new user signup, existing user daily use. | |
| Both — journeys first, gaps second | Key user journeys first, then feature-area sweep for edge cases. | ✓ |

**User's choice:** Both — journeys first, gaps second

---

## Claude's Discretion

- Exact user journeys to define
- Order of feature-area gap testing
- Fix-and-retest cycle structure
- Whether to run npm test as prerequisite gate

## Deferred Ideas

None — discussion stayed within phase scope.
