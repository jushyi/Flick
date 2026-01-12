# Roadmap: Camera/Darkroom UX Refactor

## Overview

This roadmap transforms the Camera and Darkroom experience from two separate tabs into a unified, native-feeling iOS interface. Starting with navigation restructuring, we'll progressively add the darkroom button, implement press-and-hold reveals with haptic feedback, replace buttons with iOS Mail-style swipe gestures, add celebratory success moments, and polish the visual design system across all camera controls.

## Domain Expertise

None

## Phases

- [ ] **Phase 1: Navigation Restructure** - Remove Darkroom tab, add darkroom button to Camera
- [ ] **Phase 2: Darkroom Bottom Sheet** - Press-and-hold reveal UI with progress bar
- [ ] **Phase 3: Swipe Gesture Triage** - iOS Mail-style swipe actions for Archive/Journal
- [ ] **Phase 4: Success & Return Flow** - Animated celebration page with camera return
- [ ] **Phase 5: Camera Icon Redesign** - Update control icons for visual consistency

## Phase Details

### Phase 1: Navigation Restructure
**Goal**: Remove Darkroom tab from bottom navigation and add darkroom button to CameraScreen
**Depends on**: Nothing (first phase)
**Research**: Unlikely (React Navigation restructuring with established patterns)
**Plans**: 1 plan
**Status**: Complete

Plans:
- [x] 01-01: Navigation restructure (remove Darkroom tab, add darkroom button to CameraScreen)

### Phase 2: Darkroom Bottom Sheet
**Goal**: Implement press-and-hold reveal interaction with progress bar and haptic feedback
**Depends on**: Phase 1
**Research**: Unlikely (React Native bottom sheet patterns, existing haptic utilities)
**Plans**: 2 plans

Plans:
- [ ] 02-01: Create bottom sheet component with press-and-hold progress bar
- [ ] 02-02: Connect reveal logic with haptic feedback and photo triage transition

### Phase 3: Swipe Gesture Triage
**Goal**: Replace Archive/Journal buttons with iOS Mail-style swipe gestures
**Depends on**: Phase 2
**Research**: Likely (native iOS gesture patterns)
**Research topics**: React Native gesture libraries (react-native-gesture-handler, Reanimated), iOS Mail swipe-to-action patterns, gesture conflict resolution with bottom sheet
**Plans**: 2 plans

Plans:
- [ ] 03-01: Implement swipe gesture detection with left/right actions
- [ ] 03-02: Add native iOS animations and integrate with photoService triage

### Phase 4: Success & Return Flow
**Goal**: Create animated celebration page after triage with camera return
**Depends on**: Phase 3
**Research**: Unlikely (animation libraries already in stack)
**Plans**: 2 plans

Plans:
- [ ] 04-01: Build success page with animated celebration (confetti/animation)
- [ ] 04-02: Add "Return to Camera" button and navigation flow

### Phase 5: Camera Icon Redesign
**Goal**: Update camera control icons to match bottom nav design system
**Depends on**: Phase 4
**Research**: Unlikely (internal icon system)
**Plans**: 1 plan

Plans:
- [ ] 05-01: Redesign flash, camera toggle icons for visual consistency

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Navigation Restructure | 1/1 | Complete | 2026-01-12 |
| 2. Darkroom Bottom Sheet | 0/2 | Not started | - |
| 3. Swipe Gesture Triage | 0/2 | Not started | - |
| 4. Success & Return Flow | 0/2 | Not started | - |
| 5. Camera Icon Redesign | 0/1 | Not started | - |
