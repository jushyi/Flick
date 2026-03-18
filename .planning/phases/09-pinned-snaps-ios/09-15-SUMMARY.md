---
phase: 09-pinned-snaps-ios
plan: 15
subsystem: ui
tags: [swiftui, live-activity, widget, polaroid, lock-screen, activitykit]

# Dependency graph
requires:
  - phase: 09-pinned-snaps-ios
    provides: "Live Activity widget layout and thumbnail pipeline (plans 01-13)"
provides:
  - "Redesigned Polaroid frame fitting within 160pt max lock screen height"
  - "Deterministic tilt rotation for natural appearance"
  - "Sharp photo corners matching real Polaroid aesthetics"
affects: [09-pinned-snaps-ios]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Deterministic pseudo-random tilt from activityId hash", "160pt height budget layout"]

key-files:
  created: []
  modified:
    - targets/FlickLiveActivity/FlickLiveActivityWidget.swift

key-decisions:
  - "Photo dimensions 83x104pt (4:5 ratio) with 7pt top/sides, 22pt bottom = 145pt total under 160pt"
  - "Tilt derived from Unicode scalar sum mod 81, mapped to -4.0 to +4.0 degrees"
  - "Rectangle() placeholder instead of RoundedRectangle for consistency with sharp photo corners"

patterns-established:
  - "Height budget pattern: 6pt outer + 133pt content + 6pt outer = 145pt (15pt margin for rotation bounding box)"

requirements-completed: [PINI-01, PINI-02, PINI-03]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 09 Plan 15: Live Activity Polaroid Frame Redesign Summary

**Polaroid frame overhauled to fit 160pt lock screen max with thick borders (7pt sides, 22pt bottom), sharp photo corners, and deterministic tilt rotation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T17:12:11Z
- **Completed:** 2026-03-18T17:13:55Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Redesigned Polaroid frame to fit within 160pt Apple lock screen height limit (145pt total, 15pt margin for rotation)
- Added deterministic tilt rotation (-4 to +4 degrees) derived from activityId hash for natural "casually placed" appearance
- Replaced rounded photo corners with sharp square `.clipped()` matching real Polaroid instant photos
- Increased border thickness to classic instant photo proportions: 7pt sides/top, 22pt bottom

## Task Commits

Each task was committed atomically:

1. **Task 1: Redesign Polaroid frame and lock screen layout within 160pt max height** - `9648f120` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `targets/FlickLiveActivity/FlickLiveActivityWidget.swift` - Complete Polaroid frame, lock screen layout, thumbnail view, and tilt angle overhaul

## Decisions Made
- Photo dimensions set to 83x104pt (4:5 ratio) fitting the 145pt height budget with 15pt rotation margin
- Tilt angle uses Unicode scalar sum hash mapped to -4.0 to +4.0 degree range via modulo 81
- Outer Polaroid frame gets subtle 3pt corner rounding; inner photo uses sharp square corners
- Drop shadow increased to 0.4 opacity with 4pt radius and slight x-offset for depth
- Caption text reduced from size 15 to 14 with 3 line limit (up from 2) to work with smaller Polaroid
- Placeholder uses `Rectangle()` instead of `RoundedRectangle()` for consistency with sharp photo corners

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. This change requires a native EAS build since it modifies the widget extension Swift code.

## Next Phase Readiness
- Polaroid frame visual issues (Issues 3 and 4 from device testing) are now resolved
- Widget layout fits within Apple's 160pt lock screen max height with safe margin
- Ready for next native build and device testing verification

## Self-Check: PASSED

- FOUND: targets/FlickLiveActivity/FlickLiveActivityWidget.swift
- FOUND: .planning/phases/09-pinned-snaps-ios/09-15-SUMMARY.md
- FOUND: commit 9648f120

---
*Phase: 09-pinned-snaps-ios*
*Completed: 2026-03-18*
