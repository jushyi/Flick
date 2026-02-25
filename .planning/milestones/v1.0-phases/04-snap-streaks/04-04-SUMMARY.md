---
phase: 04-snap-streaks
plan: 04
subsystem: ui
tags: [react-native, streaks, messaging, firestore, real-time]

# Dependency graph
requires:
  - phase: 04-02
    provides: StreakIndicator component with 5 visual states and streakService
  - phase: 04-03
    provides: useStreak and useStreakMap hooks, notification toggle

provides:
  - StreakIndicator wired into ConversationRow snap camera button
  - StreakIndicator wired into ConversationHeader next to display name
  - StreakIndicator wired into DMInput snap camera button
  - useStreakMap integrated into useMessages for single-listener batch streak data
  - Conversations enriched with streakState and streakDayCount at the hook level
affects:
  - 05-photo-tag-integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Hook enrichment pattern: conversations enriched with streak data inside useMessages via useMemo before rendering'
    - 'Single Firestore listener pattern: useStreakMap provides batch streak data for all conversations in one listener'
    - 'Drop-in replacement pattern: StreakIndicator has same interface as PixelIcon for easy swap'

key-files:
  created: []
  modified:
    - src/hooks/useMessages.js
    - src/components/ConversationRow.js
    - src/components/ConversationHeader.js
    - src/components/DMInput.js
    - src/screens/ConversationScreen.js

key-decisions:
  - 'StreakIndicator as drop-in PixelIcon replacement — same size prop, identical across all 3 locations'
  - 'Conversations enriched at useMessages hook layer — data flows automatically to ConversationRow without prop drilling'
  - 'useMemo for streak enrichment — ensures real-time updates when streakMap changes without unnecessary re-renders'
  - 'Instant streak state transitions (no animation) — per user decision from planning phase'
  - 'ConversationHeader always renders StreakIndicator — identical treatment across all 3 locations including default muted gray'

patterns-established:
  - 'Hook enrichment: attach derived data (streakState, streakDayCount) to conversation objects inside useMessages using useMemo'
  - "Single-listener batch data: useStreakMap subscribes to all user's streaks once, keyed by streakId for O(1) lookup"
  - 'Drop-in swap: StreakIndicator replaces PixelIcon at the leaf level, wrapping component unchanged'

requirements-completed:
  - STRK-03
  - STRK-04

# Metrics
duration: 20min
completed: 2026-02-24
---

# Phase 04 Plan 04: Snap Streaks UI Integration Summary

**StreakIndicator wired into all three DM UI locations (ConversationRow, ConversationHeader, DMInput) with single-listener batch streak data from useStreakMap**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-02-24T21:50:00Z
- **Completed:** 2026-02-24T22:10:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments

- Integrated `useStreakMap` into `useMessages` hook for efficient single-listener batch streak data — no N+1 Firestore reads
- Replaced `PixelIcon snap-polaroid` with `StreakIndicator` in `ConversationRow`, `ConversationHeader`, and `DMInput` — identical icon treatment across all three locations
- Conversations are enriched with `streakState` and `streakDayCount` inside `useMessages` via `useMemo`, so `ConversationRow` receives streak data as part of the conversation object with no prop drilling
- `useStreak` wired into `ConversationScreen` to supply live streak state to `ConversationHeader` and `DMInput`
- User visually verified streak UI rendering on device — confirmed correct state-based coloring with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate useStreakMap into useMessages and wire StreakIndicator into ConversationRow, ConversationHeader, and DMInput** - `a414d09` (feat)
2. **Task 2: Visual verification of streak UI across all locations** - N/A (checkpoint approved by user)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/hooks/useMessages.js` - Added `useStreakMap` integration; enriches each conversation object with `streakState`, `streakDayCount`, `streakColor` via `useMemo`
- `src/components/ConversationRow.js` - Replaced `PixelIcon snap-polaroid` with `StreakIndicator` for the snap camera shortcut button
- `src/components/ConversationHeader.js` - Added `StreakIndicator` next to display name; accepts `streakState` and `streakDayCount` props; always renders including default state
- `src/components/DMInput.js` - Replaced `PixelIcon snap-polaroid` with `StreakIndicator` in the animated camera button; default props for backward compat
- `src/screens/ConversationScreen.js` - Added `useStreak(currentUserId, friendId)` call; passes `streakState` and `streakDayCount` to `ConversationHeader` and `DMInput`

## Decisions Made

- Hook enrichment in `useMessages`: attaching streak data to conversation objects at the hook layer prevents prop drilling and keeps `ConversationRow` stateless with respect to streaks
- `useMemo` used for streak enrichment to ensure the list re-derives when either conversations or `streakMap` changes — ensures real-time updates appear in the list without unnecessary renders
- `ConversationHeader` always renders `StreakIndicator` (including default muted gray) to maintain identical icon treatment across all three locations — per locked user decision

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 04 (Snap Streaks) is now fully complete — all 4 plans executed
- Streak system is end-to-end: server-side engine (04-01) → client service + component (04-02) → hooks + notification toggle (04-03) → UI wiring (04-04)
- Phase 05 (Photo Tag Integration) can begin — depends only on Phase 01 infrastructure which is complete

---

_Phase: 04-snap-streaks_
_Completed: 2026-02-24_
