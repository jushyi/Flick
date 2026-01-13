# Roadmap: Camera/Darkroom UX Refactor

## Overview

This roadmap transforms the Camera and Darkroom experience from two separate tabs into a unified, native-feeling iOS interface. Starting with navigation restructuring, we'll progressively add the darkroom button, implement press-and-hold reveals with haptic feedback, replace buttons with iOS Mail-style swipe gestures, add celebratory success moments, and polish the visual design system across all camera controls.

## Milestones

- ✅ **v1.1 Camera/Darkroom UX Refactor** - [archive](milestones/v1.1-ROADMAP.md) (Phases 1-5, shipped 2026-01-12)
- 🚧 **v1.2 Phone Authentication** - Phases 6-8 (in progress)

## Completed Milestones

<details>
<summary>v1.1 Camera/Darkroom UX Refactor (Phases 1-5) - SHIPPED 2026-01-12</summary>

- [x] Phase 1: Navigation Restructure (1/1 plans) - completed 2026-01-12
- [x] Phase 2: Darkroom Bottom Sheet (2/2 plans) - completed 2026-01-12
- [x] Phase 3: Swipe Gesture Triage (2/2 plans) - completed 2026-01-12
- [x] Phase 4: Success & Return Flow (2/2 plans) - completed 2026-01-13
- [x] Phase 5: Camera Icon Redesign (1/1 plan) - completed 2026-01-13

**Stats:** 5 phases, 8 plans, 4.3 hours execution time
**See:** [Full archive](milestones/v1.1-ROADMAP.md)

</details>

### 🚧 v1.2 Phone Authentication (In Progress)

**Milestone Goal:** Migrate authentication from email/Apple Sign-In to phone-only with SMS verification

#### Phase 6: Phone Auth Implementation

**Goal**: Set up Firebase phone authentication with phone number input UI and SMS code verification
**Depends on**: v1.1 complete
**Research**: Likely (Firebase Phone Auth API, APNs setup for iOS)
**Research topics**: Firebase Phone Auth configuration, reCAPTCHA verification, APNs silent push setup, expo-auth-session integration
**Plans**: TBD

Plans:
- [ ] 06-01: TBD (run /gsd:plan-phase 6 to break down)

#### Phase 7: Legacy Auth Removal & Cleanup

**Goal**: Remove email/password and Apple Sign-In flows, update AuthContext for phone-only auth
**Depends on**: Phase 6
**Research**: Unlikely (internal refactoring)
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

#### Phase 8: Polish & Testing

**Goal**: Error handling, edge cases, phone number formatting, and international support
**Depends on**: Phase 7
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Navigation Restructure | v1.1 | 1/1 | Complete | 2026-01-12 |
| 2. Darkroom Bottom Sheet | v1.1 | 2/2 | Complete | 2026-01-12 |
| 3. Swipe Gesture Triage | v1.1 | 2/2 | Complete | 2026-01-12 |
| 4. Success & Return Flow | v1.1 | 2/2 | Complete | 2026-01-13 |
| 5. Camera Icon Redesign | v1.1 | 1/1 | Complete | 2026-01-13 |
| 6. Phone Auth Implementation | v1.2 | 0/? | Not started | - |
| 7. Legacy Auth Removal & Cleanup | v1.2 | 0/? | Not started | - |
| 8. Polish & Testing | v1.2 | 0/? | Not started | - |
