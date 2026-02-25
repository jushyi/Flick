---
phase: 06-tech-debt-darkroom-optimization
plan: 04
subsystem: testing, cloud-functions
tags: [jest, cloud-functions, variable-rename, test-audit]

# Dependency graph
requires: []
provides:
  - "Verified snapFunctions.test.js audit: all 15 tests pass with no fragile assertions"
  - "Renamed hoursSinceLastMutual to daysSinceLastMutual with inline comment in functions/index.js"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validBodies array pattern for randomized notification template assertions"

key-files:
  created: []
  modified:
    - functions/index.js

key-decisions:
  - "DEBT-02 confirmed as audit-and-pass: line 522 already correct, all 15 tests green, no fragile assertions found"
  - "Pre-existing failure in notifications.test.js (reaction lastMessage update) is out of scope -- not caused by this plan's changes"

patterns-established:
  - "validBodies array check pattern for notification body assertions avoids fragility from randomized templates"

requirements-completed: [DEBT-02, DEBT-05]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 6 Plan 4: Audit snapFunctions Tests and Rename hoursSinceLastMutual Summary

**Verified all 15 snapFunctions tests pass with no fragile assertions (DEBT-02) and renamed hoursSinceLastMutual to daysSinceLastMutual with clarifying inline comment in functions/index.js (DEBT-05)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T17:37:02Z
- **Completed:** 2026-02-25T17:38:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Audited all 15 snapFunctions.test.js tests: all pass, no fragile assertions found
- Renamed `hoursSinceLastMutual` to `daysSinceLastMutual` at lines 2880-2883 of functions/index.js
- Added inline comment explaining `daysSinceLastMutual < 1` means less than one full day
- Confirmed rename causes zero test regressions (21/21 streakFunctions tests pass, 15/15 snapFunctions tests pass)

## Audit Report: snapFunctions.test.js (DEBT-02)

**Result: PASS -- no fragile assertions found**

All 15 tests across 4 describe blocks pass cleanly:

| Describe Block | Tests | Status |
|---|---|---|
| getSignedSnapUrl | 5 | All pass |
| onSnapViewed | 5 | All pass |
| cleanupExpiredSnaps | 3 | All pass |
| onNewMessage - snap type | 2 | All pass |

**Assertion audit:**

1. **Line 520** -- `const validBodies = ['sent you a snap', 'just snapped you', 'New snap']; expect(validBodies).toContain(body);` -- Uses flexible array check for randomized notification templates. NOT fragile.
2. **Line 522** -- `expect(data.type).toBe('snap')` -- Tests a constant type field set by the function. Correct and stable.
3. **Line 523** -- `expect(data.messageId).toBe('msg-123')` -- Matches test fixture `context.params.messageId` defined at line 509. Correct.
4. **Line 524** -- `expect(data.conversationId).toBe('user-a_user-b')` -- Matches test fixture defined at line 509. Correct.
5. **Lines 154-165** -- Signed URL expiry check uses `toBeGreaterThan`/`toBeLessThan` with 5-second tolerance window. NOT fragile.
6. **All other assertions** -- Structural checks (rejection messages, mock call counts, `objectContaining` matchers). All stable.

No time-sensitive assertions that could drift. No hardcoded notification template strings (uses validBodies array pattern). No path assertions that could diverge from actual Storage paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit snapFunctions.test.js and rename hoursSinceLastMutual** - `9d3de03` (refactor)

## Files Created/Modified

- `functions/index.js` - Renamed `hoursSinceLastMutual` to `daysSinceLastMutual` at line 2880-2883 with inline comment

## Decisions Made

- DEBT-02 confirmed as audit-and-pass: the stale assertion documented in the v1.0 milestone audit was already corrected. Line 522 reads `expect(data.type).toBe('snap')` which is correct. All 15 tests pass with no fragile assertions.
- Pre-existing failure in `notifications.test.js` (`should not update lastMessage or unreadCount for reaction messages`) was verified to exist before this plan's changes and is out of scope. Logged to deferred items.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing test failure in `functions/__tests__/triggers/notifications.test.js` (1 of 45 tests failing: reaction lastMessage update assertion). Verified this failure exists on the unmodified codebase (via git stash/unstash). Not caused by this plan's changes and out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DEBT-02 and DEBT-05 are closed
- All functions tests remain at same pass rate as before (142/143, 1 pre-existing failure)
- Ready for remaining plans in phase 06

## Self-Check: PASSED

- [x] `functions/index.js` exists
- [x] `06-04-SUMMARY.md` exists
- [x] Commit `9d3de03` exists in git log
- [x] `hoursSinceLastMutual` has 0 occurrences in functions/index.js (renamed)
- [x] `daysSinceLastMutual` has 3 occurrences (comment + declaration + if-check)

---
*Phase: 06-tech-debt-darkroom-optimization*
*Completed: 2026-02-25*
