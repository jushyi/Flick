# Roadmap: Auth & Profile Refactor

## Overview

Transform Lapse Clone's authentication experience and profile system from inconsistent placeholders into polished, cohesive screens that match the app's established dark aesthetic. This journey starts with shared auth components, refactors login/signup flows, extends onboarding to capture full profile data, and builds out the profile screen with Selects banner, profile song, and album galleries.

## Milestones

- ✅ [v1.6 Auth & Profile Refactor](milestones/v1.6-ROADMAP.md) (Phases 1-31) — SHIPPED 2026-02-06
- ✅ [v0.9.0 Engagement & Polish](milestones/v0.9.0-ROADMAP.md) (Phases 32-45) — SHIPPED 2026-02-10
- 🚧 **v1.0.0 Release Readiness** — Phases 46-53 (in progress)

## Completed Milestones

<details>
<summary>v1.6 Auth & Profile Refactor (Phases 1-31) — SHIPPED 2026-02-06</summary>

**108 plans completed over 16 days**

- [x] Phase 1: Auth Shared Components (1/1 plans)
- [x] Phase 2: Login Screen Refactor (1/1 plans)
- [x] Phase 3: Signup Flow Refactor (2/2 plans)
- [x] Phase 3.1: Auth Input Field Fixes (1/1 plans) — INSERTED
- [x] Phase 4: Profile Creation Onboarding (4/4 plans)
- [x] Phase 4.1: Drag-Reorder Visual Feedback (1/1 plans) — INSERTED
- [x] Phase 5: Profile Screen Layout (2/2 plans)
- [x] Phase 6: Selects Banner (2/2 plans)
- [x] Phase 7: Profile Song Scaffold (5/5 + 2 FIX plans)
- [x] Phase 7.2: Song Modal Stacking Fix (1/1 + 1 FIX plans) — INSERTED
- [x] Phase 7.3: Simplify Clip Selection Modal (1/1 plans) — INSERTED
- [x] Phase 8: User Albums Display (6/6 + 7 FIX + 1 ENH plans)
- [x] Phase 8.1: Grid Header Safe Area Fix (1/1 plans) — INSERTED
- [x] Phase 8.2: Album Creation Animation (1/1 plans) — INSERTED
- [x] Phase 9: Monthly Albums (3/3 plans)
- [x] Phase 10: Empty Feed State UI Change (1/1 plans)
- [x] Phase 11: Feed Reaction Emoji Enhancements (1/1 + 1 FIX plans)
- [x] Phase 12: Own Snaps in Stories Bar (1/1 plans)
- [x] Phase 13: Split Activity into Notifications & Friends (2/2 plans)
- [x] Phase 14: Profile Field Character Limits (1/1 plans)
- [x] Phase 15: Friends Screen & Other Profiles (3/3 + 2 FIX plans)
- [x] Phase 15.1: Profile Setup Cancel Flow (1/1 plans) — INSERTED
- [x] Phase 15.2: Modal State Preservation (1/1 + 2 FIX plans) — INSERTED
- [x] Phase 15.3: Modal Architecture Fix (2/2 plans) — INSERTED
- [x] Phase 15.4: Story Viewed State Fix (1/1 + 3 FIX plans) — INSERTED
- [x] Phase 16: Color Constants Standardization (10/10 plans)
- [x] Phase 17: Nested Reply Comments (2/2 plans)
- [x] Phase 18: Content Visibility Duration (1/1 + 1 FIX plans)
- [x] Phase 19: Delete Account Fallback (5/5 plans)
- [x] Phase 20: Friend Suggestions via Contacts Sync (3/3 plans)
- [x] Phase 21: Remove/Block Friends (4/4 plans)
- [x] Phase 22: Ability to Edit Profile (2/2 plans)
- [x] Phase 23: Photo Deletion & Archiving (2/2 plans)
- [x] Phase 23.1: Recently Deleted Photos (2/2 plans) — INSERTED
- [x] Phase 24: Social Media Feature Audit (1/1 plans)
- [x] Phase 25: Color Palette Selection & Customization (5/5 plans)
- [x] Phase 26: Feed Pull-to-Refresh & Loading Skeleton (1/1 plans)
- [x] Phase 27: Color Constants Convention Documentation (1/1 plans)
- [x] Phase 28: Blocked Users Management (1/1 plans)
- [x] Phase 29: Settings & Help Enhancements (1/1 plans)
- [x] Phase 30: Optimization and Performance Enhancements (5/5 plans)
- [x] Phase 31: Settings Section Headers (1/1 plans)

</details>

<details>
<summary>v0.9.0 Engagement & Polish (Phases 32-45) — SHIPPED 2026-02-10</summary>

**30 plans (27 + 3 FIX) completed over 4 days**

- [x] Phase 32: Photo Issues Fix (2/2 plans) — completed 2026-02-06
- [x] Phase 33: Navigation Issues Fix (1/1 plan) — completed 2026-02-06
- [x] Phase 34: Push Infrastructure (2/2 plans) — completed 2026-02-06
- [x] Phase 35: Social Notification Events (2/2 plans) — completed 2026-02-06
- [x] Phase 36: Photo Notification Events (2/2 plans) — completed 2026-02-06
- [x] Phase 37: Darkroom Ready Notifications (1/1 plan) — completed 2026-02-06
- [x] Phase 38: Notification UI Polish (2/2 + 1 FIX plans) — completed 2026-02-09
- [x] Phase 39: Darkroom Photo Tagging (1/1 + 1 FIX plans) — completed 2026-02-09
- [x] Phase 40: Feed Photo Tagging (1/1 plan) — completed 2026-02-09
- [x] Phase 41: Tagged Notification Integration (1/1 plan) — completed 2026-02-09
- [x] Phase 42: Mutual Friends Suggestions (2/2 plans) — completed 2026-02-09
- [x] Phase 43: Comment Cleanup/Audit (4/4 plans) — completed 2026-02-09
- [x] Phase 44: Notification Activity Feed (2/2 plans) — completed 2026-02-09
- [x] Phase 45: Security Audit (4/4 plans) — completed 2026-02-10

</details>

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

_v1.6 phases complete. See [v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) for archive._
_v0.9.0 phases complete. See [v0.9.0-ROADMAP.md](milestones/v0.9.0-ROADMAP.md) for archive._

### 🚧 v1.0.0 Release Readiness (In Progress)

**Milestone Goal:** Optimize performance, establish testing infrastructure, and ship the first iOS release with CI/CD pipelines for future updates

**Constraints:**

- iOS only — no Android release in this milestone
- Unlisted release (not searchable, direct link access only)
- Privacy policy and ToS already exist, just need linking
- Apple Developer account partially set up — certificates/profiles still needed
- UAT should cover all 45 previously shipped phases across 8 feature areas

#### Phase 46: Performance Optimization

**Goal**: Firebase queries, UI rendering, and Cloud Functions code-level improvements — composite indexes, pagination, read/write batching, offline caching, FlatList optimization, image caching & lazy loading, native driver animations, React.memo/useMemo re-render reduction, cold start reduction, memory/timeout tuning
**Depends on**: Previous milestone complete
**Research**: Likely (Firebase optimization best practices, composite index configuration, Cloud Functions cold start patterns)
**Research topics**: Firebase composite indexes, query pagination patterns, Cloud Functions cold start reduction, React Native FlatList optimization
**Plans**: 7

Plans:

- [x] 46-01: Feed Query Server-Side Filtering
- [x] 46-02: Firestore Indexes & Read Optimization
- [x] 46-03: Image Loading & Caching
- [x] 46-04: FlatList & React Rendering
- [x] 46-05: React Compiler & Build Config
- [x] 46-06: Cloud Functions Performance
- [x] 46-07: Verification & Documentation

#### Phase 46.1: Other Users Albums View Fix (INSERTED)

**Goal**: Fix bug where viewing other users' albums doesn't work
**Depends on**: Phase 46
**Research**: Unlikely (bug fix — investigating existing code)
**Plans**: 1

Plans:

- [x] 46.1-01: Diagnose and fix other-user album viewing regression

#### Phase 46.2: Album Viewer Nav Bar Optimistic Updates (INSERTED)

**Goal**: Fix album grid full-screen viewer so the bottom nav bar updates optimistically during swipe gestures instead of waiting until the user lands on a photo — currently the nav outline jumps to the new position only after settling, rather than tracking the swipe
**Depends on**: Phase 46
**Research**: Unlikely (bug fix — investigating existing swipe/scroll event handling)
**Plans**: 1

Plans:

- [x] 46.2-01: Add optimistic scroll tracking to album photo viewer

#### Phase 47: Firebase Performance Monitoring

**Goal**: Integrate Firebase Performance Monitoring SDK for ongoing production metrics — network traces, custom traces, screen rendering performance, baseline establishment
**Depends on**: Phase 46
**Research**: Likely (new SDK integration — not currently in codebase)
**Research topics**: Firebase Performance Monitoring SDK setup for React Native/Expo, custom trace API, network trace configuration
**Plans**: 3

Plans:

- [x] 47-01: SDK Installation & Core Utilities
- [x] 47-02: Service File Instrumentation
- [x] 47-03: Screen Traces & Build Verification

#### Phase 47.1: Comment @-Tagging for Mutual Friends (INSERTED)

**Goal**: Add Instagram-style @-mention tagging in comments — users can @ mutual friends (friends of both the commenter and the photo owner) with autocomplete suggestions, linked mentions, and notification integration. Builds on existing comment reply architecture.
**Depends on**: Phase 47
**Research**: Unlikely (extending existing comment system — reviewing current reply/mention patterns)
**Plans**: 2

Plans:

- [x] 47.1-01: Cloud Function Backend (mutual friends + reply @mention notifications)
- [x] 47.1-02: Autocomplete UI + Integration (service, hook, overlay, input, wiring)

#### Phase 48: UI/UX Consistency Audit

**Goal**: Review all screens for visual and interaction consistency — spacing, colors, typography, component patterns, navigation flows, gesture patterns, loading/error states, feedback patterns
**Depends on**: Phase 47
**Research**: Unlikely (internal patterns — reviewing and standardizing existing code)
**Plans**: 7

Plans:

- [x] 48-01: Auth Flow Screens (audit & fix auth/onboarding screens)
- [x] 48-02: Settings & Account Screens (audit & fix settings/account screens)
- [x] 48-03: Social & Friends Screens (audit & fix social screens & components)
- [x] 48-04: FriendsScreen N+1 Query Fix — ISS-012 (batch user fetching, optimize subscriptions)
- [x] 48-05: Albums, Photos & Selects (audit & fix album screens & components)
- [x] 48-06: Feed, Camera & Core (audit & fix core screens & components)
- [x] 48-07: Profile, Notifications & Shared Components (audit & fix remaining screens & all shared components)

#### Phase 48.1: PhotoDetail Profile Navigation Fix — ISS-014 (INSERTED)

**Goal**: Fix regression where navigating to OtherUserProfile from PhotoDetail renders the profile behind the transparentModal. OtherUserProfile uses `presentation: 'card'` (changed from `fullScreenModal` in Phase 46.1 to allow child card screens on iOS), but PhotoDetail uses `presentation: 'transparentModal'` which renders on a higher native layer. All profile navigation from PhotoDetail/comments is blocked.
**Depends on**: Phase 48
**Research**: Unlikely (bug fix — investigating presentation mode alternatives)
**Plans**: 1

Plans:

- [x] 48.1-01: Fix profile navigation z-order from PhotoDetail/comments views

#### Phase 49: Automated Test Suite

**Goal**: Jest unit tests for business logic + Maestro E2E tests for critical user flows (auth, camera, feed, social) — regression guards for future development
**Depends on**: Phase 48
**Research**: Complete (49-RESEARCH.md — Maestro over Detox, RNTL v13 for hooks, firebase-functions-test for Cloud Functions)
**Plans**: 8

Plans:

- [x] 49-01: Test Infrastructure & Utility Tests
- [x] 49-02: Service Tests — Social Layer (comments, mentions, blocks, reports)
- [x] 49-03: Service Tests — Content & Account Layer (albums, users, accounts, notifications)
- [x] 49-04: Hook Tests (mentions, comments, feed, darkroom)
- [x] 49-05: Cloud Functions Test Infrastructure & Notification Tests
- [x] 49-06: Cloud Functions Trigger & Callable Tests
- [x] 49-07: Maestro E2E Setup & Auth Flow
- [x] 49-08: Maestro E2E Critical Flows & Final Verification

#### Phase 50: CI/CD Pipeline

**Goal**: GitHub Actions for lint/type-check/test on PR, EAS Build on merge to main, EAS Submit on release tag — Apple credentials and EAS tokens in GitHub Secrets
**Depends on**: Phase 49
**Research**: Likely (EAS Build/Submit integration, GitHub Actions workflows)
**Research topics**: EAS Build configuration, GitHub Actions for Expo/EAS, secrets management, pipeline validation
**Plans**: 3

Plans:

- [x] 50-01: Build Config & PR Checks (aps-environment switching, GitHub Actions PR workflow)
- [x] 50-02: EAS Build & Submit Workflows (tag-triggered builds, manual submit with approval gate)
- [x] 50-03: Secrets Setup & Pipeline Verification (EXPO_TOKEN, environment gate, pipeline verified)

#### Phase 50.1: Fix Failing Test Suites (INSERTED)

**Goal**: Fix 76 failing tests across 10 test suites — 3 service tests (feedService, friendshipService, photoService), 2 integration tests (friendshipFlow, photoLifecycle), and 5 cloud functions tests (callable, notifications/sender, scheduled, smoke, triggers/notifications). All failures are mock setup issues, not real bugs. Must pass before release so PR checks are green.
**Depends on**: Phase 50
**Research**: Unlikely (investigating existing mock setup issues)
**Plans**: 2

Plans:

- [x] 50.1-01: Test Infrastructure & Mock Fixes (jest.config.js cloud function isolation, Firestore mock exports, service mocks)
- [x] 50.1-02: Fix Diverged Test Expectations (feedService, photoService, integration tests)

#### Phase 51: iOS Release Preparation

**Goal**: Rebrand to Flick, set up production Firebase environment, build contributions page with IAP name color perk, configure domain/support infrastructure, route reports to email, switch Giphy to production, configure App Store Connect, build and submit to App Store
**Depends on**: Phase 50
**Research**: Complete (51-RESEARCH.md — EAS managed credentials, privacy manifests, App Store Connect workflow)
**Plans**: 10

Plans:

- [x] 51-01: Rebrand to Flick (replace all Rewind references, new icon, updated splash)
- [x] 51-02: Production Firebase Environment Setup (separate project, EAS profile switching)
- [x] 51-03: app.json & eas.json Production Configuration (privacy manifests, APS, supportsTablet)
- [x] 51-04: Domain & Support Infrastructure (domain registration, email, in-app links)
- [x] 51-05: Report Email Routing (Cloud Function to email reports)
- [x] 51-06: Giphy Production Key & Attribution (attribution complete, prod key pending approval)
- [ ] 51-07: Contributions Page UI & IAP Integration (pitch, tiers, color picker)
- [ ] 51-08: Name Color Perk — Storage & Display (contributor colors app-wide)
- [ ] 51-09: App Store Connect Setup & Screenshots (listing, metadata, privacy, IAP products)
- [ ] 51-10: EAS Build, Submit & Final Verification

#### Phase 52: Systematic UAT

**Goal**: Manual testing checklists across all 8 feature areas (Auth, Profile, Camera/Photos, Feed, Stories, Social, Notifications, Settings) with pass/fail criteria and edge case identification
**Depends on**: Phase 51
**Research**: Unlikely (internal testing — reviewing own app features)
**Plans**: TBD

Plans:

- [ ] 52-01: TBD

#### Phase 53: App Store Release

**Goal**: Build via EAS Build, submit via EAS Submit, pass App Review, publish publicly (no marketing — shared via direct link with friends/family). Post-release: verify CI/CD pipeline with a follow-up update, document future release playbook.
**Depends on**: Phase 52
**Research**: Likely (EAS Submit, App Review process, Apple review guidelines pre-check)
**Research topics**: EAS Submit configuration, App Review requirements, common rejection reasons, App Store listing best practices
**Plans**: TBD

Plans:

- [ ] 53-01: TBD

---

## Progress

| Phase                          | Milestone | Plans | Status      | Completed  |
| ------------------------------ | --------- | ----- | ----------- | ---------- |
| v1.6 (Phases 1-31)             | v1.6      | 108   | Complete    | 2026-02-06 |
| v0.9.0 (Phases 32-45)          | v0.9.0    | 30    | Complete    | 2026-02-10 |
| 46. Performance Optimization   | v1.0.0    | 7/7   | Complete    | 2026-02-10 |
| 46.1 Other Users Albums Fix    | v1.0.0    | 1/1   | Complete    | 2026-02-10 |
| 46.2 Album Viewer Nav Optimism | v1.0.0    | 1/1   | Complete    | 2026-02-11 |
| 47. Firebase Perf Monitoring   | v1.0.0    | 3/3   | Complete    | 2026-02-11 |
| 47.1 Comment @-Tagging         | v1.0.0    | 2/2   | Complete    | 2026-02-11 |
| 48. UI/UX Consistency Audit    | v1.0.0    | 7/7   | Complete    | 2026-02-12 |
| 48.1 PhotoDetail Profile Nav   | v1.0.0    | 1/1   | Complete    | 2026-02-12 |
| 49. Automated Test Suite       | v1.0.0    | 8/8   | Complete    | 2026-02-12 |
| 50. CI/CD Pipeline             | v1.0.0    | 3/3   | Complete    | 2026-02-12 |
| 50.1 Fix Failing Test Suites   | v1.0.0    | 2/2   | Complete    | 2026-02-13 |
| 51. iOS Release Preparation    | v1.0.0    | 5/10  | In progress | -          |
| 52. Systematic UAT             | v1.0.0    | 0/?   | Not started | -          |
| 53. App Store Release          | v1.0.0    | 0/?   | Not started | -          |

See [MILESTONES.md](MILESTONES.md) for milestone history.
