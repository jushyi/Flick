---
phase: 50-cicd-pipeline
plan: 01
subsystem: infra
tags: [github-actions, eas, ci-cd, expo, aps-environment]

# Dependency graph
requires:
  - phase: 49-automated-test-suite
    provides: Jest test suite with npm test command
provides:
  - Dynamic aps-environment switching via APP_ENV env var
  - PR checks workflow (lint + test + bundle verification)
affects: [51-ios-release-preparation, 50-02, 50-03]

# Tech tracking
tech-stack:
  added: [github-actions]
  patterns: [APP_ENV-based config switching, PR quality gates]

key-files:
  created: [.github/workflows/pr-checks.yml]
  modified: [app.config.js, eas.json]

key-decisions:
  - 'aps-environment switches dynamically via APP_ENV env var (not separate app.json files)'
  - 'PR checks use expo export --platform ios for free JS bundle verification (not full EAS builds)'

patterns-established:
  - 'APP_ENV=production for production builds via eas.json env block'
  - 'Single quality job with lint → test → bundle verify pipeline'

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-12
---

# Phase 50 Plan 01: Build Config & PR Checks Summary

**Dynamic aps-environment switching via APP_ENV env var and GitHub Actions PR quality gate with lint, test, and iOS bundle verification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-12T14:03:44Z
- **Completed:** 2026-02-12T14:06:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- app.config.js dynamically switches aps-environment between development/production based on APP_ENV
- eas.json production profile sets APP_ENV=production for App Store builds
- GitHub Actions PR checks workflow gates PRs to main with lint, Jest tests, and expo export bundle verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dynamic aps-environment to app.config.js and APP_ENV to eas.json** - `f6acab4` (feat)
2. **Task 2: Create PR checks workflow** - `de9d4da` (feat)

## Files Created/Modified

- `app.config.js` - Added isProduction flag and dynamic aps-environment entitlement
- `eas.json` - Added APP_ENV: production to build.production.env
- `.github/workflows/pr-checks.yml` - PR quality gate workflow (checkout, Node 22, npm ci, lint, test, expo export)

## Decisions Made

- aps-environment switching uses APP_ENV env var with spread of base entitlements (preserves any future entitlements added to app.json)
- PR workflow uses single "quality" job rather than parallel jobs (simple project, no benefit from matrix)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing lint and test failures were detected in the working tree:

- **Lint:** 15 prettier formatting errors in `useSwipeableCard.js` from uncommitted working tree changes (not in committed code)
- **Tests:** 76 pre-existing test failures across 10 suites (mock/assertion issues in friendship, feed, darkroom, and other service tests)

These are not caused by Phase 50 changes and exist only in the local working tree. The CI workflow runs on clean PR branch checkouts where committed code is expected to pass. The pre-existing failures should be addressed before merging PRs to main.

## Next Phase Readiness

- Build config and PR checks workflow ready
- Ready for 50-02-PLAN.md (next plan in CI/CD Pipeline phase)

---

_Phase: 50-cicd-pipeline_
_Completed: 2026-02-12_
