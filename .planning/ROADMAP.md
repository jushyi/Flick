# Roadmap: Camera/Darkroom UX Refactor

## Overview

This roadmap transforms the Camera and Darkroom experience from two separate tabs into a unified, native-feeling iOS interface. Starting with navigation restructuring, we'll progressively add the darkroom button, implement press-and-hold reveals with haptic feedback, replace buttons with iOS Mail-style swipe gestures, add celebratory success moments, and polish the visual design system across all camera controls.

## Milestones

- ✅ **v1.1 Camera/Darkroom UX Refactor** - [archive](milestones/v1.1-ROADMAP.md) (Phases 1-5, shipped 2026-01-12)
- ✅ **v1.2 Phone Authentication** - [archive](milestones/v1.2-ROADMAP.md) (Phases 6-8, shipped 2026-01-19)
- 🚧 **v1.3 Firebase SDK Consolidation** - Phases 9-10 (in progress)

## Completed Milestones

<details>
<summary>✅ v1.2 Phone Authentication (Phases 6-8) - SHIPPED 2026-01-19</summary>

- [x] Phase 6: Phone Auth Implementation (4/4 plans) - completed 2026-01-19
- [x] Phase 7: Legacy Auth Removal & Cleanup (1/1 plan) - completed 2026-01-19
- [x] Phase 8: Polish & Testing (3/3 plans) - completed 2026-01-19

**Stats:** 3 phases, 8 plans, 2.1 hours execution time
**See:** [Full archive](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 Camera/Darkroom UX Refactor (Phases 1-5) - SHIPPED 2026-01-12</summary>

- [x] Phase 1: Navigation Restructure (1/1 plans) - completed 2026-01-12
- [x] Phase 2: Darkroom Bottom Sheet (2/2 plans) - completed 2026-01-12
- [x] Phase 3: Swipe Gesture Triage (2/2 plans) - completed 2026-01-12
- [x] Phase 4: Success & Return Flow (2/2 plans) - completed 2026-01-13
- [x] Phase 5: Camera Icon Redesign (1/1 plan) - completed 2026-01-13

**Stats:** 5 phases, 8 plans, 4.3 hours execution time
**See:** [Full archive](milestones/v1.1-ROADMAP.md)

</details>

### 🚧 v1.3 Firebase SDK Consolidation (In Progress)

**Milestone Goal:** Unify all Firebase services under React Native Firebase SDK to fix permission-denied errors caused by SDK auth state mismatch

#### Phase 9: Firestore Services Migration

**Goal**: Migrate photoService.js, feedService.js, and friendshipService.js from Firebase JS SDK to React Native Firebase
**Depends on**: v1.2 complete
**Research**: Unlikely (AuthContext.js already demonstrates correct RN Firebase pattern)

Plans:
- [ ] 09-01: TBD (run /gsd:plan-phase 9 to break down)

#### Phase 10: Storage Migration & Cleanup

**Goal**: Migrate storageService.js to RN Firebase, remove JS SDK dependencies, verify all functionality works
**Depends on**: Phase 9
**Research**: Unlikely (following same migration pattern)

Plans:
- [ ] 10-01: TBD (run /gsd:plan-phase 10 to break down)

## Progress

**Execution Order:** Phases execute in numeric order: 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Navigation Restructure | v1.1 | 1/1 | Complete | 2026-01-12 |
| 2. Darkroom Bottom Sheet | v1.1 | 2/2 | Complete | 2026-01-12 |
| 3. Swipe Gesture Triage | v1.1 | 2/2 | Complete | 2026-01-12 |
| 4. Success & Return Flow | v1.1 | 2/2 | Complete | 2026-01-13 |
| 5. Camera Icon Redesign | v1.1 | 1/1 | Complete | 2026-01-13 |
| 6. Phone Auth Implementation | v1.2 | 4/4 | Complete | 2026-01-19 |
| 7. Legacy Auth Removal & Cleanup | v1.2 | 1/1 | Complete | 2026-01-19 |
| 8. Polish & Testing | v1.2 | 3/3 | Complete | 2026-01-19 |
| 9. Firestore Services Migration | v1.3 | 0/? | Not started | - |
| 10. Storage Migration & Cleanup | v1.3 | 0/? | Not started | - |
