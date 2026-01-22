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

#### Phase 15.2: Camera UI & Darkroom Animation Overhaul (INSERTED) - Complete

**Goal**: Complete visual redesign of camera controls footer, darkroom card stack button, and capture animation
**Depends on**: Phase 15.1
**Research**: Unlikely (React Native Reanimated already in use, internal UI patterns)
**Plans**: 3/3 complete

Plans:
- [x] 15.2-01: Camera footer UI redesign - completed 2026-01-21
- [x] 15.2-02: Darkroom button card stack - completed 2026-01-21
- [x] 15.2-03: Capture animation change - completed 2026-01-21

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

#### Phase 15.3: ISS-001 - Add True 0.5x Ultra-Wide Zoom (INSERTED) - Complete

**Goal**: Implement true 0.5x ultra-wide zoom via lens switching instead of digital zoom
**Depends on**: Phase 15.2
**Research**: Complete
**Plans**: 1/1 complete

Plans:
- [x] 15.3-01: True 0.5x ultra-wide zoom via iOS lens switching - completed 2026-01-21

**Delivered:**
- iOS ultra-wide lens detection via onAvailableLensesChanged + async fallback
- Dynamic 0.5x zoom option appears only on iOS devices with ultra-wide (back camera)
- selectedLens prop wiring for physical lens switching
- Android gracefully shows 1x, 2x, 3x only

#### Phase 16: Camera Capture Feedback (Complete)

**Goal**: Enhanced shutter animation, haptic feedback, and visual confirmation on capture
**Depends on**: Phase 15.3
**Research**: Unlikely (established patterns, existing haptics utility)
**Plans**: 1/1 complete

Plans:
- [x] 16-01: DSLR-style capture feedback - completed 2026-01-21

**Delivered:**
- Two-stage DSLR haptic feedback: lightImpact on press-down, mediumImpact on release
- Pressable component for onPressIn/onPressOut events
- Flash overlay contained within camera preview bounds with rounded corners

#### Phase 16.1: UI Overhaul for Darkroom Bottom Sheet (INSERTED) - Complete

**Goal**: Redesign the darkroom bottom sheet UI for improved visual polish and user experience
**Depends on**: Phase 16
**Research**: Unlikely (React Native Reanimated already in use, internal UI patterns)
**Plans**: 1/1 complete

Plans:
- [x] 16.1-01: Darkroom bottom sheet UI overhaul - completed 2026-01-21

**Delivered:**
- Dark theme (#1A1A1A) with header layout (title + status dot + status text)
- Card stack display (1-4 fanned cards) in bottom sheet header
- Neon purple gradient hold-to-reveal button using expo-linear-gradient
- Fill animation left-to-right (1600ms, 1.25x faster)
- Spinner that speeds up 2x during hold
- Crescendo haptic feedback (4 intensity phases)

#### Phase 16.2: Fix 0.5x Ultra-Wide Zoom (INSERTED) - Complete

**Goal**: Fix 0.5x zoom which appears to be showing same view as 1x and not switching cameras properly
**Depends on**: Phase 16.1
**Research**: Complete
**Plans**: 1/1 complete

Plans:
- [x] 16.2-01: Fix ultra-wide lens switching with explicit wideAngleLens - completed 2026-01-21

**Delivered:**
- Fixed expo-camera lens switching by using explicit wideAngleLens ("Back Camera") for 1x/2x/3x instead of null
- Added wideAngleLens useMemo for explicit lens detection
- Added debug logging for lens switching

#### Phase 16.3: Fix React Native Firebase Warnings (INSERTED) - Complete

**Goal**: Resolve @react-native-firebase/app package warnings and migrate deprecated namespaced API to modular SDK
**Depends on**: Phase 16.2
**Research**: Complete
**Plans**: 1/1 complete

Plans:
- [x] 16.3-01: Migrate App.js and friendshipService.js to modular API - completed 2026-01-21

**Delivered:**
- Migrated App.js from namespaced `auth()` to modular `getAuth()` API
- Removed unused `firestore` default import from friendshipService.js
- All 15+ Firebase imports now use modular API pattern
- Zero deprecation warnings from @react-native-firebase packages

#### Phase 17: Darkroom UX Polish (Complete)

**Goal**: Improved reveal animations, smoother triage gestures, better navigation flow, and polished empty/loading states
**Depends on**: Phase 16.3
**Research**: Unlikely (internal patterns, React Native Reanimated already in use)
**Plans**: 2/2 complete

Plans:
- [x] 17-01: Triage flow polish - confirmations removed, button triage added, photo cards resized - completed 2026-01-21
- [x] 17-02: Flick animation with arc motion, on-card overlays, three-stage haptics - completed 2026-01-22

**Delivered:**
- Removed all confirmation popups for instant triage
- Added Archive/Delete/Journal button bar with haptic feedback
- Increased photo card size (92% width, 4:5 aspect ratio) with black border
- Removed debug button from header
- Flick-style swipe animation with downward arc motion
- On-card confirmation overlays with non-emoji icons
- Three-stage haptic feedback (threshold, release, completion)
- Down-swipe for delete gesture

#### Phase 17.1: Darkroom Animation Refinements (INSERTED) - Complete

**Goal**: Improve darkroom open/close animations and triage completion UX
**Depends on**: Phase 17
**Research**: Unlikely (React Native Reanimated already in use)
**Plans**: 1/1 complete + FIX plans

Plans:
- [x] 17.1-01: Bottom slide animation, down chevron, inline success - completed 2026-01-22
- [x] 17.1-01-FIX: UAT fixes (empty flash, success polish, header swipe) - completed 2026-01-22
- [x] 17.1-01-FIX-2: UAT-004 fix (header swipe moves entire screen) - completed 2026-01-22
- [x] 17.1-01-FIX-3: UAT-005/UAT-006 fix (transparent gesture root, goBack for Done) - completed 2026-01-22
- [x] 17.1-01-FIX-4: UAT-007/UAT-008 fix (remove header swipe, button-only delete overlay) - completed 2026-01-22

**Details:**
Animation Changes:
- Darkroom opens from bottom (slide up) instead of from the side after press-and-hold reveal
- Darkroom closes by falling towards bottom of screen (slide down)
- Change back arrow icon from left-pointing to down-pointing to indicate dismiss direction

Triage Completion UX:
- Remove navigation to separate success screen after completing triage
- Stay on darkroom screen and transition empty state to success message state
- Smoother, less janky experience when all photos are triaged

#### Phase 17.2: Reveal Timing 0-5 Minutes (INSERTED) - Complete

**Goal**: Change darkroom reveal timing from 0-15 minutes to 0-5 minutes for faster photo reveals
**Depends on**: Phase 17.1
**Research**: Unlikely (simple constant change in darkroomService)
**Plans**: 1/1 complete

Plans:
- [x] 17.2-01: Update client/server reveal timing to 0-5 minutes - completed 2026-01-22

**Delivered:**
- Client-side calculateNextRevealTime() uses Math.random() * 5 (0-5 minutes)
- Server-side revealUserPhotos() uses Math.floor(Math.random() * 6) (0-5 minutes)
- Cloud Functions deployed to Firebase

#### Phase 18: Reaction Notification Debouncing (Complete)

**Goal**: Aggregate reaction notifications over 10-second window instead of per-tap to prevent spam
**Depends on**: Phase 17.2
**Research**: Unlikely (Cloud Function update to existing sendReactionNotification)
**Plans**: 2/2 complete

Plans:
- [x] 18-01: Backend - Cloud Function debouncing with 10-second batching - completed 2026-01-22
- [x] 18-02: Frontend - Notifications feed UI with heart button - completed 2026-01-22
- [x] 18-FIX: UAT fixes (Firestore rules, back button, empty state centering) - completed 2026-01-22

**Delivered:**
- Cloud Function debouncing with 10-second sliding window batching
- NotificationsScreen with Instagram-style vertical notification list
- Heart button in FeedScreen header with red dot indicator for unread notifications
- Fixed Firestore security rules for notifications (recipientId field)
- Back button navigation in NotificationsScreen
- Properly centered empty state UI

#### Phase 18.1: Batched Darkroom Triage with Undo (INSERTED) - Complete

**Goal**: Batch triage decisions locally until user confirms, with undo capability and session persistence
**Depends on**: Phase 18
**Research**: Unlikely (React Native state management and AsyncStorage patterns)
**Plans**: 2/2 complete

Plans:
- [x] 18.1-01: Undo stack state and UI - completed 2026-01-22
- [x] 18.1-02: Done button batch save and undo animation - completed 2026-01-22

**Delivered:**
- Undo stack state management for local triage decisions
- Reverse card animation (cards slide back from exit direction on undo)
- Done button batch saves all decisions to Firestore
- Silent close after Done tap (haptic only, no celebration screen)
- Ionicons undo button with clean "Undo" text

#### Phase 18.2: Success Sound Effect on Triage Completion (INSERTED)

**Goal**: Play a celebratory sound clip when user finishes triaging all photos (during success screen)
**Depends on**: Phase 18.1
**Research**: Unlikely (expo-av already available for audio playback)
**Plans**: TBD

Plans:
- [ ] 18.2-01: TBD (run /gsd:plan-phase 18.2 to break down)

**Details:**
- Add satisfying audio feedback when all photos are triaged
- Sound plays during the inline success state (sparkles animation)
- Use expo-av for audio playback
- Consider: chime, whoosh, or subtle celebration sound
- Ensure sound respects device silent mode settings

#### Phase 18.3: Triage Animation Z-Index & Delete Suction Effect (INSERTED)

**Goal**: Fix photo card animations rendering over triage buttons and add suction effect for delete action
**Depends on**: Phase 18.2
**Research**: Unlikely (React Native Reanimated z-index and animation patterns)
**Plans**: TBD

Plans:
- [ ] 18.3-01: TBD (run /gsd:plan-phase 18.3 to break down)

**Details:**
Z-Index Fix:
- Photo card triage animations currently render on top of the triage buttons
- Cards should animate behind the button bar, not over it
- Ensure proper z-index layering during all animation states

Delete Suction Effect:
- Current delete animation: card falls straight down off screen
- New behavior: card should get "sucked into" the delete button
- Animation should scale down and move toward delete button position
- Creates satisfying visual feedback that the photo is being deleted

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
| 15.2 Camera UI & Darkroom Animation Overhaul | v1.5 | 3/3 | Complete | 2026-01-21 |
| 15.3 ISS-001 - Add True 0.5x Ultra-Wide Zoom | v1.5 | 1/1 | Complete | 2026-01-21 |
| 16. Camera Capture Feedback | v1.5 | 1/1 | Complete | 2026-01-21 |
| 16.1 UI Overhaul for Darkroom Bottom Sheet | v1.5 | 1/1 | Complete | 2026-01-21 |
| 16.2 Fix 0.5x Ultra-Wide Zoom | v1.5 | 1/1 | Complete | 2026-01-21 |
| 16.3 Fix React Native Firebase Warnings | v1.5 | 1/1 | Complete | 2026-01-21 |
| 17. Darkroom UX Polish | v1.5 | 2/2 | Complete | 2026-01-22 |
| 17.1 Darkroom Animation Refinements | v1.5 | 1/1 | Complete | 2026-01-22 |
| 17.2 Reveal Timing 0-5 Minutes | v1.5 | 1/1 | Complete | 2026-01-22 |
| 18. Reaction Notification Debouncing | v1.5 | 2/2 + FIX | Complete | 2026-01-22 |
| 18.1 Batched Darkroom Triage with Undo | v1.5 | 2/2 | Complete | 2026-01-22 |
| 18.2 Success Sound Effect on Triage Completion | v1.5 | 0/? | Not started | - |
| 18.3 Triage Animation Z-Index & Delete Suction | v1.5 | 0/? | Not started | - |
