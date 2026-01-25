---
phase: 30-rewind-rebrand
plan: FIX
subsystem: infra
tags: [eas, expo, build, configuration]

# Dependency graph
requires:
  - phase: 30-03
    provides: App identity rebrand (slug changed to Rewind)
provides:
  - Working EAS project binding for Rewind slug
  - Development build capability
  - GoogleService-Info.plist environment variable setup
affects: [31, testflight-prep]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - app.json

key-decisions:
  - 'Reinitialize EAS with new project rather than rename old project'
  - 'Upload GoogleService-Info.plist as EAS file environment variable'

patterns-established: []

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-25
---

# Phase 30 FIX: EAS ProjectId Mismatch Resolution

**Removed stale EAS projectId from Oly-era, reinitialized EAS for Rewind slug, configured GoogleService-Info.plist as EAS secret**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-25T18:30:00Z
- **Completed:** 2026-01-25T18:38:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 1

## Accomplishments

- Resolved blocker UAT-001: EAS projectId/slug mismatch preventing app launch
- Created new EAS project @spoodsjs/Rewind with correct slug binding
- Configured GoogleService-Info.plist as EAS file environment variable for builds
- Successfully completed iOS development build

## Task Commits

1. **Task 1: Remove stale EAS projectId** - `8e77368` (fix)
2. **EAS reinitialization** - `fe4cf60` (chore)

**Plan metadata:** (this commit)

## Files Created/Modified

- `app.json` - Removed stale projectId, then EAS added new projectId for Rewind project

## Decisions Made

- **Reinitialize EAS** - Created new project rather than trying to rename old Oly project on expo.dev (cleaner, avoids potential issues with old project state)
- **EAS file environment variable** - Uploaded GoogleService-Info.plist as sensitive env var for development builds

## Deviations from Plan

### Additional Work Required

**1. [Rule 3 - Blocking] EAS reinitialization required for builds**

- **Found during:** User wanted to build dev app, not use Expo Go
- **Issue:** After removing projectId, user needed full EAS project for builds
- **Fix:** Ran `eas init --force` to create @spoodsjs/Rewind project
- **Files modified:** app.json (new projectId added)
- **Committed in:** fe4cf60

**2. [Rule 3 - Blocking] GoogleService-Info.plist not configured for new project**

- **Found during:** EAS build attempt
- **Issue:** File env var was on old Oly project, not migrated to new Rewind project
- **Fix:** User uploaded via `eas env:create` command
- **Verification:** Build completed successfully

---

**Total deviations:** 2 blocking fixes (both necessary for builds)
**Impact on plan:** Extended scope from "allow local dev" to "enable full EAS builds"

## Issues Encountered

None - all issues resolved during execution.

## Next Phase Readiness

- Development build complete and ready for device testing
- EAS project properly configured for future builds
- Ready to continue with Phase 31 planning

---

_Phase: 30-rewind-rebrand (FIX)_
_Completed: 2026-01-25_
