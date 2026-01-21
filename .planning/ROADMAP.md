# Roadmap: Camera/Darkroom UX Refactor

## Overview

This roadmap transforms the Camera and Darkroom experience from two separate tabs into a unified, native-feeling iOS interface. Starting with navigation restructuring, we'll progressively add the darkroom button, implement press-and-hold reveals with haptic feedback, replace buttons with iOS Mail-style swipe gestures, add celebratory success moments, and polish the visual design system across all camera controls.

## Milestones

- ✅ **v1.1 Camera/Darkroom UX Refactor** - [archive](milestones/v1.1-ROADMAP.md) (Phases 1-5, shipped 2026-01-12)
- ✅ **v1.2 Phone Authentication** - [archive](milestones/v1.2-ROADMAP.md) (Phases 6-8, shipped 2026-01-19)
- ✅ **v1.3 Firebase SDK Consolidation** - [archive](milestones/v1.3-ROADMAP.md) (Phases 9-10, shipped 2026-01-19)
- ✅ **v1.4 Production Ready** - [archive](milestones/v1.4-ROADMAP.md) (Phases 11-14, shipped 2026-01-20)
- 🚧 **v1.5 Camera Performance & UX Polish** - Phases 15-18 (in progress)

### 🚧 v1.5 Camera Performance & UX Polish (In Progress)

**Milestone Goal:** Make the core camera-to-darkroom experience feel instant and delightful

#### Phase 15: Background Photo Upload (Complete)

**Goal**: Async capture pipeline with upload queue and progress indicators - photos save instantly, upload in background
**Depends on**: Previous milestone complete
**Research**: Unlikely (internal patterns, React Native background task APIs well-established)
**Plans**: 1/1 complete

Plans:
- [x] 15-01: Background upload queue and async capture - completed 2026-01-20

#### Phase 15.1: Darkroom Notification Fix (INSERTED) - Complete

**Goal**: Fix notification spam and implement reveal-all-on-tap UX
**Depends on**: Phase 15
**Plans**: 1/1 complete

Plans:
- [x] 15.1-01: Notification tracking + reveal-all-on-tap - completed 2026-01-21

**Delivered:**
- lastNotifiedAt field prevents duplicate notifications for same batch
- 0-photo reveals skip notification entirely
- revealedCount and revealAll passed in notification payload
- App navigates to Camera with reveal params on tap

#### Phase 15.2: Camera UI & Darkroom Animation Overhaul (INSERTED) - In Progress

**Goal**: Complete visual redesign of camera controls footer, darkroom card stack button, and capture animation
**Depends on**: Phase 15.1
**Research**: Unlikely (React Native Reanimated already in use, internal UI patterns)
**Plans**: 2/3 complete

Plans:
- [x] 15.2-01: Camera footer UI redesign - completed 2026-01-21
- [x] 15.2-02: Darkroom button card stack - completed 2026-01-21
- [ ] 15.2-03: Capture animation change (TBD)

**Details:**
Camera Footer Redesign:
- Extend footer to cover ~1/3 of screen, background color matches nav bar
- Remove debug darkroom button on right side
- Capture button: 10% larger, stays white, thin spaced ring around it
- Flash/camera-switch buttons: 10% smaller, circular icons instead of rectangles
- Camera preview: rounded edges instead of square
- Zoom control: rounded rectangular bar (same height as flash/flip buttons) with standard iOS zoom levels (0.5x, 1x, 2x, 3x)

Darkroom Button Redesign (left side):
- Start as singular card with rounded edges (~75% capture button size)
- Number displayed within card instead of badge overlay
- Card fanning animation:
  - 1 photo: single card
  - 2 photos: 2 cards fanned
  - 3 photos: 3 cards fanned
  - 4+ photos: 4 cards fanned (max), number updates on front card

Capture Animation Change:
- Remove current snapshot-to-darkroom animation
- Replace with "bounce" animation on darkroom button (scale up then back to normal)
- Quick, satisfying feedback indicating photo was captured

#### Phase 15.3: ISS-001 - Add True 0.5x Ultra-Wide Zoom (INSERTED)

**Goal**: Implement true 0.5x ultra-wide zoom via lens switching instead of digital zoom
**Depends on**: Phase 15.2
**Research**: Likely (expo-camera lens switching API, device capability detection)
**Plans**: TBD

Plans:
- [ ] 15.3-01: TBD (run /gsd:plan-phase 15.3 to break down)

**Details:**
[To be added during planning]

#### Phase 16: Camera Capture Feedback

**Goal**: Enhanced shutter animation, haptic feedback, and visual confirmation on capture
**Depends on**: Phase 15.3
**Research**: Unlikely (established patterns, existing haptics utility)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD (run /gsd:plan-phase 16 to break down)

#### Phase 17: Darkroom UX Polish

**Goal**: Improved reveal animations, smoother triage gestures, better navigation flow, and polished empty/loading states
**Depends on**: Phase 16
**Research**: Unlikely (internal patterns, React Native Reanimated already in use)
**Plans**: TBD

Plans:
- [ ] 17-01: TBD (run /gsd:plan-phase 17 to break down)

#### Phase 18: Reaction Notification Debouncing

**Goal**: Aggregate reaction notifications over 10-second window instead of per-tap to prevent spam
**Depends on**: Phase 17
**Research**: Unlikely (Cloud Function update to existing sendReactionNotification)
**Plans**: TBD

Plans:
- [ ] 18-01: TBD (run /gsd:plan-phase 18 to break down)

#### Phase 18.1: Batched Darkroom Triage with Undo (INSERTED)

**Goal**: Batch triage decisions locally until user confirms, with undo capability and session persistence
**Depends on**: Phase 18
**Research**: Unlikely (React Native state management and AsyncStorage patterns)
**Plans**: TBD

Plans:
- [ ] 18.1-01: TBD (run /gsd:plan-phase 18.1 to break down)

**Details:**
Current behavior: Triage choices (archive/journal/delete) save immediately to Firestore on swipe, no undo option.

New behavior:
- Triage decisions stored locally during session (not saved to Firestore until confirmed)
- Undo button at top of screen to reverse last decision and re-triage that photo
- "Done" or "Back to Camera" button finalizes and saves all decisions to Firestore
- If darkroom closed mid-triage (app backgrounded, crash, etc.), session persists via AsyncStorage
- Reopening darkroom restores the same batch with any previous local decisions intact

## Completed Milestones

<details>
<summary>✅ v1.4 Production Ready (Phases 11-14) - SHIPPED 2026-01-20</summary>

- [x] Phase 11: Firebase Modular API Migration (4/4 plans) - completed 2026-01-19
- [x] Phase 12: Friendship Service Fix + Testing (1/1 plan) - completed 2026-01-19
- [x] Phase 12.1: Friends List Screen Crash Fix (1/1 plan + fixes) - completed 2026-01-20
- [x] Phase 12.2: Feed Stories Feature (4/4 plans) - completed 2026-01-20
- [x] Phase 13: Production Build & Branding (3/3 plans) - completed 2026-01-20
- [x] Phase 13.1: Darkroom Reveal Timing Fix (1/1 plan) - completed 2026-01-20
- [x] Phase 13.2: Darkroom Auto-Reveal Fix (1/1 plan + fix) - completed 2026-01-20
- [x] Phase 14: Remote Notification Testing & Polish (1/1 plan) - completed 2026-01-20

**Stats:** 8 phases, 17 plans, 1.4 hours execution time
**See:** [Full archive](milestones/v1.4-ROADMAP.md)

</details>

<details>
<summary>✅ v1.3 Firebase SDK Consolidation (Phases 9-10) - SHIPPED 2026-01-19</summary>

- [x] Phase 9: Firestore Services Migration (2/2 plans) - completed 2026-01-19
- [x] Phase 10: Storage Migration & Cleanup (2/2 plans) - completed 2026-01-19

**Stats:** 2 phases, 4 plans, 42 min execution time
**See:** [Full archive](milestones/v1.3-ROADMAP.md)

</details>

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

## Progress

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
| 9. Firestore Services Migration | v1.3 | 2/2 | Complete | 2026-01-19 |
| 10. Storage Migration & Cleanup | v1.3 | 2/2 | Complete | 2026-01-19 |
| 11. Firebase Modular API Migration | v1.4 | 4/4 | Complete | 2026-01-19 |
| 12. Friendship Service Fix + Testing | v1.4 | 1/1 | Complete | 2026-01-19 |
| 12.1 Friends List Screen Crash Fix | v1.4 | 1/1 | Complete | 2026-01-19 |
| 12.2 Feed Stories Feature | v1.4 | 4/4 | Complete | 2026-01-20 |
| 13. Production Build & Branding | v1.4 | 3/3 | Complete | 2026-01-20 |
| 13.1 Darkroom Reveal Timing Fix | v1.4 | 1/1 | Complete | 2026-01-20 |
| 13.2 Darkroom Auto-Reveal Fix | v1.4 | 1/1 | Complete | 2026-01-20 |
| 14. Remote Notification Testing & Polish | v1.4 | 1/1 | Complete | 2026-01-20 |
| 15. Background Photo Upload | v1.5 | 1/1 | Complete | 2026-01-20 |
| 15.1 Darkroom Notification Fix | v1.5 | 1/1 | Complete | 2026-01-21 |
| 15.2 Camera UI & Darkroom Animation Overhaul | v1.5 | 2/3 | In progress | - |
| 16. Camera Capture Feedback | v1.5 | 0/? | Not started | - |
| 17. Darkroom UX Polish | v1.5 | 0/? | Not started | - |
| 18. Reaction Notification Debouncing | v1.5 | 0/? | Not started | - |
| 18.1 Batched Darkroom Triage with Undo | v1.5 | 0/? | Not started | - |
