---
phase: 32-navigation-restructure
plan: 01
subsystem: navigation
tags: [react-navigation, bottom-tabs, deep-linking, expo]

# Dependency graph
requires:
  - phase: 31-personalization-scaffolding
    provides: ThemeContext infrastructure and ProfileStackNavigator pattern
provides:
  - 3-tab layout (Feed | Camera | Profile)
  - Friends screens as root stack screens
  - Updated deep linking for friends routes
affects: [33-feed-header-notifications, activity-page, friends-access]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Root stack screens for non-tab navigation destinations'
    - 'Deep linking routes at root level for stack screens'

key-files:
  created: []
  modified:
    - src/navigation/AppNavigator.js

key-decisions:
  - 'Friends screens moved to root stack (not nested in tabs) for Phase 33 activity page access'
  - "Deep linking routes kept at 'friends', 'friends/search', 'friends/requests' paths"
  - 'darkroomCount state and DarkroomIcon kept for future use'

patterns-established:
  - '3-tab Instagram-style layout: Feed | Camera | Profile'
  - 'Stack screens for modal-style navigation from any tab'

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-25
---

# Phase 32-01: Navigation Restructure Summary

**Tab bar restructured from 4 tabs to 3 tabs (Feed | Camera | Profile), Friends screens relocated to root stack for Phase 33 activity page integration**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-25T10:00:00Z
- **Completed:** 2026-01-25T10:08:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Restructured MainTabNavigator from 4 tabs to 3-tab layout (Feed | Camera | Profile)
- Removed Friends tab, FriendsStackNavigator function, and FriendsIcon component
- Relocated FriendsList, UserSearch, FriendRequests screens to root stack
- Updated deep linking configuration with root-level routes for friends screens
- Camera tab remains center position and initialRouteName (capture-first philosophy preserved)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Friends tab and restructure to 3-tab layout** - `fa08f63` (feat)
2. **Task 2: Relocate Friends screens to root stack** - `37af996` (feat)

## Files Created/Modified

- `src/navigation/AppNavigator.js` - Restructured tabs, removed FriendsStackNavigator/FriendsIcon, added Friends screens to root stack, updated deep linking

## Decisions Made

- Kept FriendsListScreen, UserSearchScreen, FriendRequestsScreen imports (used in Task 2)
- Kept darkroomCount useEffect and DarkroomIcon (may be used in future phases)
- Deep linking paths preserved as 'friends', 'friends/search', 'friends/requests' at root level

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## Next Phase Readiness

- 3-tab navigation structure ready for Phase 33 (Feed Header & Notifications)
- Friends screens accessible via `navigation.navigate('FriendsList')` from any screen
- Deep links functional: `lapse://friends`, `lapse://friends/search`, `lapse://friends/requests`
- Camera remains center tab and initial route

---

_Phase: 32-navigation-restructure_
_Completed: 2026-01-25_
