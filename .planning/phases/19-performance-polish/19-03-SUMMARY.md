---
phase: 19-performance-polish
plan: 03
subsystem: hooks
tags: [tanstack-query, optimistic-updates, swr, cache, rollback, toast]

requires:
  - phase: 19-01
    provides: Toast.tsx component and react-native-toast-message setup
  - phase: 19-02
    provides: queryKeys.ts factory for cache key management
  - phase: 14-01
    provides: TanStack Query client with staleTime/gcTime/persist config
provides:
  - useOptimisticMutation hook with single-key and multi-key optimistic cache updates
  - Automatic rollback on error with toast notification
  - Callback passthrough (onSuccess, onMutate, onSettled) for consumer extensions
  - Verified SWR on feed, profile, and conversations hooks
affects: [19-04, 20-cutover]

tech-stack:
  added: []
  patterns: [optimistic-mutation-with-rollback, multi-key-cache-update, callback-passthrough]

key-files:
  created:
    - src/hooks/useOptimisticMutation.ts
    - __tests__/hooks/useOptimisticMutation.test.ts
    - __tests__/__mocks__/react-native-toast-message.js
  modified:
    - jest.config.js

key-decisions:
  - "Map<serializedKey, snapshot> for multi-key rollback storage"
  - "QueryKey can be static array or function(variables) for dynamic keys"
  - "useMessages uses PowerSync (local SQLite) -- already instant, no TanStack changes needed"
  - "react-native-toast-message manual mock added to jest config for pre-install testing"

patterns-established:
  - "useOptimisticMutation: standardized pattern for all future optimistic mutations (reactions, comments, friend requests)"
  - "Multi-key updaters: array of {queryKey, updater} pairs for operations that touch multiple cache entries"

requirements-completed: [PERF-02, PERF-04]

duration: 4min
completed: 2026-03-25
---

# Phase 19 Plan 03: Optimistic Mutation Hook Summary

**Reusable useOptimisticMutation hook with multi-key cache update, automatic rollback, toast error, and callback passthrough; SWR verified on feed, profile, and conversations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T15:07:35Z
- **Completed:** 2026-03-25T15:11:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created useOptimisticMutation hook supporting both single-key and multi-key (updaters array) optimistic cache updates
- Automatic snapshot, rollback on error, and Toast.show notification on failure
- Callback passthrough (onSuccess, onMutate, onSettled) for consumer extensions like haptic feedback
- Verified stale-while-revalidate on feed (meta.persist + 30s staleTime), profile (meta.persist), and conversations (PowerSync local SQLite)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for useOptimisticMutation** - `6040ebad` (test)
2. **Task 1 (GREEN): Implement useOptimisticMutation hook** - `6a88877c` (feat)
3. **Task 2: Verify SWR on feed, profile, conversations** - No changes needed (all hooks already configured correctly)

_TDD task had RED and GREEN commits. No REFACTOR needed._

## Files Created/Modified
- `src/hooks/useOptimisticMutation.ts` - Reusable optimistic mutation wrapper with multi-key support, rollback, toast, callback passthrough
- `__tests__/hooks/useOptimisticMutation.test.ts` - 10 tests covering single-key, multi-key, callback passthrough, and return value
- `__tests__/__mocks__/react-native-toast-message.js` - Manual mock for pre-install testing
- `jest.config.js` - Added moduleNameMapper for react-native-toast-message mock

## Decisions Made
- Used Map<serializedKey, snapshot> for multi-key rollback -- JSON.stringify(queryKey) as map key for stable serialization
- QueryKey supports both static arrays and functions of variables for dynamic key resolution (e.g., reactions where photoId comes from mutation variables)
- useMessages.ts uses PowerSync (local SQLite via usePowerSyncQuery) -- already renders instantly from local DB, no TanStack Query persist needed
- Added react-native-toast-message manual mock to jest.config.js since the package is not yet installed (will be installed when Plan 04 wires Toast into App.js)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added react-native-toast-message manual mock**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** react-native-toast-message not installed yet (deferred to Plan 04 wiring), causing jest.mock to fail
- **Fix:** Created __tests__/__mocks__/react-native-toast-message.js and added moduleNameMapper in jest.config.js
- **Files modified:** __tests__/__mocks__/react-native-toast-message.js, jest.config.js
- **Verification:** All tests pass with mock in place
- **Committed in:** 6040ebad (Task 1 RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mock was necessary for testing before package installation. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all functionality is fully implemented.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useOptimisticMutation ready for consumers (reactions, comments, friend requests in Plan 04+)
- Toast.tsx and react-native-toast-message mock in place for all hooks to use
- SWR verified on all three key screens -- ready for performance benchmarking

---
*Phase: 19-performance-polish*
*Completed: 2026-03-25*
