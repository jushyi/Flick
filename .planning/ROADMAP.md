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
- [ ] 46-05: React Compiler & Build Config
- [ ] 46-06: Cloud Functions Performance
- [ ] 46-07: Verification & Documentation

#### Phase 47: Firebase Performance Monitoring

**Goal**: Integrate Firebase Performance Monitoring SDK for ongoing production metrics — network traces, custom traces, screen rendering performance, baseline establishment
**Depends on**: Phase 46
**Research**: Likely (new SDK integration — not currently in codebase)
**Research topics**: Firebase Performance Monitoring SDK setup for React Native/Expo, custom trace API, network trace configuration
**Plans**: TBD

Plans:

- [ ] 47-01: TBD

#### Phase 48: UI/UX Consistency Audit

**Goal**: Review all screens for visual and interaction consistency — spacing, colors, typography, component patterns, navigation flows, gesture patterns, loading/error states, feedback patterns
**Depends on**: Phase 47
**Research**: Unlikely (internal patterns — reviewing and standardizing existing code)
**Plans**: TBD

Plans:

- [ ] 48-01: TBD

#### Phase 49: Automated Test Suite

**Goal**: Jest unit tests for business logic + Detox E2E tests for critical user flows (auth, camera, feed, social) — regression guards for future development
**Depends on**: Phase 48
**Research**: Likely (Detox E2E framework likely new to project)
**Research topics**: Detox setup with Expo/React Native, Jest configuration for React Native, test structure patterns
**Plans**: TBD

Plans:

- [ ] 49-01: TBD

#### Phase 50: CI/CD Pipeline

**Goal**: GitHub Actions for lint/type-check/test on PR, EAS Build on merge to main, EAS Submit on release tag — Apple credentials and EAS tokens in GitHub Secrets
**Depends on**: Phase 49
**Research**: Likely (EAS Build/Submit integration, GitHub Actions workflows)
**Research topics**: EAS Build configuration, GitHub Actions for Expo/EAS, secrets management, pipeline validation
**Plans**: TBD

Plans:

- [ ] 50-01: TBD

#### Phase 51: iOS Release Preparation

**Goal**: Finish distribution certificate + App Store provisioning profile, configure App Store Connect (bundle ID, metadata, screenshots), link existing privacy policy/ToS
**Depends on**: Phase 50
**Research**: Likely (Apple Developer portal, certificates, provisioning profiles, App Store Connect)
**Research topics**: Distribution certificate creation, App Store provisioning, EAS credentials setup, App Store Connect metadata
**Plans**: TBD

Plans:

- [ ] 51-01: TBD

#### Phase 52: Systematic UAT

**Goal**: Manual testing checklists across all 8 feature areas (Auth, Profile, Camera/Photos, Feed, Stories, Social, Notifications, Settings) with pass/fail criteria and edge case identification
**Depends on**: Phase 51
**Research**: Unlikely (internal testing — reviewing own app features)
**Plans**: TBD

Plans:

- [ ] 52-01: TBD

#### Phase 53: Unlisted App Store Release

**Goal**: Build via EAS Build, submit via EAS Submit, pass App Review, publish as unlisted (direct link only, not searchable)
**Depends on**: Phase 52
**Research**: Likely (EAS Submit, App Review process, unlisted distribution)
**Research topics**: EAS Submit configuration, App Review requirements, unlisted app distribution setup
**Plans**: TBD

Plans:

- [ ] 53-01: TBD

---

## Progress

| Phase                          | Milestone | Plans | Status      | Completed  |
| ------------------------------ | --------- | ----- | ----------- | ---------- |
| v1.6 (Phases 1-31)             | v1.6      | 108   | Complete    | 2026-02-06 |
| v0.9.0 (Phases 32-45)          | v0.9.0    | 30    | Complete    | 2026-02-10 |
| 46. Performance Optimization   | v1.0.0    | 4/7   | In progress | -          |
| 47. Firebase Perf Monitoring   | v1.0.0    | 0/?   | Not started | -          |
| 48. UI/UX Consistency Audit    | v1.0.0    | 0/?   | Not started | -          |
| 49. Automated Test Suite       | v1.0.0    | 0/?   | Not started | -          |
| 50. CI/CD Pipeline             | v1.0.0    | 0/?   | Not started | -          |
| 51. iOS Release Preparation    | v1.0.0    | 0/?   | Not started | -          |
| 52. Systematic UAT             | v1.0.0    | 0/?   | Not started | -          |
| 53. Unlisted App Store Release | v1.0.0    | 0/?   | Not started | -          |

See [MILESTONES.md](MILESTONES.md) for milestone history.
