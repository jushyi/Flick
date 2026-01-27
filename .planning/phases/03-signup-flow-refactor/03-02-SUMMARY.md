---
phase: 03-signup-flow-refactor
plan: 02
subsystem: auth
tags: [selects, photo-picker, navigation, signup-flow, expo-image-picker]

# Dependency graph
requires:
  - phase: 03-signup-flow-refactor
    provides: ProfileSetupScreen with song section, username validation
provides:
  - SelectsScreen for picking highlight photos
  - Three-step signup flow (Phone → Profile → Selects)
  - selectsCompleted auth flag for navigation control
affects: [04-profile-creation-onboarding, 06-selects-banner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-step auth flow with conditional navigator rendering
    - Photo picker with multiple selection and preview

key-files:
  created:
    - src/screens/SelectsScreen.js
  modified:
    - src/navigation/AppNavigator.js
    - src/context/AuthContext.js
    - src/screens/index.js

key-decisions:
  - 'Use conditional navigator rendering instead of manual navigation.replace()'
  - 'Store photo URIs directly in user document selects array'
  - 'Maximum 5 selects to match typical profile highlight patterns'

patterns-established:
  - 'Multi-flag auth flow: chain profileSetupCompleted → selectsCompleted for step control'
  - 'Photo picker preview: horizontal ScrollView with remove buttons'

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 3 Plan 2: SelectsScreen Summary

**SelectsScreen with multi-photo picker completing three-step signup flow: Phone → Profile → Selects → Main app**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T06:00:00Z
- **Completed:** 2026-01-27T06:08:00Z
- **Tasks:** 2 (+ 1 checkpoint)
- **Files modified:** 4

## Accomplishments

- Created SelectsScreen with expo-image-picker multiple selection
- Horizontal preview row with photo removal functionality
- Complete and Skip paths both working
- Navigation flow updated: ProfileSetup → Selects → MainTabs
- Auth state checks both profileSetupCompleted AND selectsCompleted flags

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SelectsScreen** - `473a6ea` (feat)
2. **Task 2: Update navigation and auth flow** - `acecc7a` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `src/screens/SelectsScreen.js` - New screen with photo picker, preview row, complete/skip buttons
- `src/screens/index.js` - Added SelectsScreen export
- `src/navigation/AppNavigator.js` - Added SelectsScreen import, needsSelects condition, Selects route
- `src/context/AuthContext.js` - Added selectsCompleted to new user documents, updated logging

## Decisions Made

- **Conditional rendering over manual navigation** - Navigator's conditional branches automatically handle transitions when auth state changes, cleaner than navigation.replace()
- **Photo URIs stored directly** - For MVP, storing local URIs; future enhancement could upload to Firebase Storage
- **5 photo limit** - Matches typical profile highlight patterns (Instagram, etc.)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 3 complete - all signup flow screens done
- Three-step flow working: Phone → Profile → Selects → Main app
- Ready for Phase 4 (Profile Creation Onboarding) which may extend or refine this flow
- SelectsScreen patterns ready for reuse in Phase 6 (Selects Banner)

---

_Phase: 03-signup-flow-refactor_
_Completed: 2026-01-27_
