# Roadmap: Camera/Darkroom UX Refactor

## Overview

This roadmap transforms the Camera and Darkroom experience from two separate tabs into a unified, native-feeling iOS interface. Starting with navigation restructuring, we'll progressively add the darkroom button, implement press-and-hold reveals with haptic feedback, replace buttons with iOS Mail-style swipe gestures, add celebratory success moments, and polish the visual design system across all camera controls.

## Milestones

- ✅ **v1.1 Camera/Darkroom UX Refactor** - [archive](milestones/v1.1-ROADMAP.md) (Phases 1-5, shipped 2026-01-12)
- ✅ **v1.2 Phone Authentication** - [archive](milestones/v1.2-ROADMAP.md) (Phases 6-8, shipped 2026-01-19)
- ✅ **v1.3 Firebase SDK Consolidation** - [archive](milestones/v1.3-ROADMAP.md) (Phases 9-10, shipped 2026-01-19)
- 🚧 **v1.4 Production Ready** - Phases 11-14 (in progress)

### 🚧 v1.4 Production Ready (In Progress)

**Milestone Goal:** Fix all deprecation warnings, resolve service errors, and prepare app for TestFlight distribution with full notification support.

#### Phase 11: Firebase Modular API Migration

**Goal**: Migrate all services from namespaced API to modular API (v22+)
**Depends on**: v1.3 complete
**Research**: Level 1 - Quick Verification (completed during planning)
**Plans**: 4

Plans:
- [x] 11-01: Core Services (photoService, darkroomService)
- [x] 11-02: Social Services (feedService, friendshipService)
- [x] 11-03: Storage & Remaining (storageService, userService, notificationService)
- [x] 11-04: Screens & Components (AuthContext, ProfileScreen, UserSearchScreen, FriendsListScreen, FriendRequestCard)

#### Phase 12: Friendship Service Fix + Testing

**Goal**: Debug and fix friendship errors, verify all social features work
**Depends on**: Phase 11
**Research**: Unlikely (internal debugging)
**Plans**: 1

Plans:
- [x] 12-01: Fix exists() Method Calls

#### Phase 12.1: Friends List Screen Crash Fix (INSERTED)

**Goal**: Fix FriendsListScreen crash - ErrorBoundary catching component tree error
**Depends on**: Phase 12
**Research**: Unlikely (internal debugging)
**Plans**: 1

Plans:
- [x] 12.1-01: Fix Filter.or Usage

**Details:**
Fixed Filter.or access pattern via modular API. The firestore.Filter.or() pattern was also broken. Solution: use modular or(where(...), where(...)) pattern per React Native Firebase v22+ modular API exports.

#### Phase 12.2: Feed Stories Feature (INSERTED)

**Goal**: Add Instagram Stories-style viewer for friends' photos with curated feed showing top 5 snaps
**Depends on**: Phase 12.1
**Research**: Level 0 - Skip (existing patterns for gestures, animations, Firestore queries)
**Plans**: 4

Plans:
- [x] 12.2-01: Service Layer (getTopPhotosByEngagement, getFriendStoriesData)
- [x] 12.2-02: Stories Row Component (FriendStoryCard + horizontal row in FeedScreen)
- [x] 12.2-03: Stories Viewer (StoriesViewerModal with navigation gestures)
- [x] 12.2-04: Feed Curation & Polish (top 5 per friend, edge cases)

**Details:**
Feature request: PhotoCards of friends that when tapped display all of friend's snaps in IG Story-style viewer. Main feed changes to show only top 5 snaps from friends, ranked by engagement (reactionCount - no comments system exists).

#### Phase 13: Production Build & Branding

**Goal**: EAS build setup, app icon, splash screen, TestFlight prep
**Depends on**: Phase 12.2
**Research**: Likely (EAS Build, first deployment)
**Research topics**: EAS Build configuration, iOS App Store requirements
**Plans**: 3

Plans:
- [x] 13-01: Oly Brand Assets (icon, splash, app.json)
- [x] 13-02: Animated Splash Screen (shutter opening effect)
- [x] 13-03: EAS Build & Distribution (iOS build, internal distribution)

#### Phase 13.1: Darkroom Reveal Timing Fix (INSERTED)

**Goal**: Fix inaccurate nextRevealAt calculation and change reveal interval to 0-15 minutes
**Depends on**: Phase 13
**Research**: Unlikely (internal debugging)
**Plans**: 1

Plans:
- [x] 13.1-01: Timing Fix & Darkroom Initialization

**Details:**
Fixed darkroom timing accuracy by adding ensureDarkroomInitialized() call on photo capture. Reduced reveal interval from 0-2 hours to 0-15 minutes.

#### Phase 13.2: Darkroom Auto-Reveal Fix (INSERTED)

**Goal**: Fix darkroom not revealing photos when nextRevealAt time passes - reveal happens only when user opens DarkroomScreen
**Depends on**: Phase 13.1
**Research**: Unlikely (internal debugging)
**Plans**: 1 + 1 FIX

Plans:
- [x] 13.2-01: Fix ensureDarkroomInitialized + Add foreground reveal check
- [x] 13.2-01-FIX: Server-side darkroom reveal via scheduled Cloud Function

**Details:**
Bug: When nextRevealAt time passes, nothing happens automatically. The reveal logic only runs when the user opens DarkroomScreen. Additionally, ensureDarkroomInitialized() resets stale nextRevealAt without revealing photos first, causing photos to remain in 'developing' state indefinitely.

**UAT Fix:** Added processDarkroomReveals scheduled Cloud Function (every 2 minutes) for server-side reveal regardless of app state.

#### Phase 14: Remote Notification Testing & Polish

**Goal**: End-to-end notification verification, final bug fixes
**Depends on**: Phase 13
**Research**: Level 0 - Skip (existing Cloud Functions, internal testing)
**Plans**: 1

Plans:
- [ ] 14-01: Remote Notification E2E Testing (all 3 notification types)

## Completed Milestones

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
| 14. Remote Notification Testing & Polish | v1.4 | 0/1 | Planned | - |
