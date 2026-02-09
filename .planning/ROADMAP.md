# Roadmap: Auth & Profile Refactor

## Overview

Transform Lapse Clone's authentication experience and profile system from inconsistent placeholders into polished, cohesive screens that match the app's established dark aesthetic. This journey starts with shared auth components, refactors login/signup flows, extends onboarding to capture full profile data, and builds out the profile screen with Selects banner, profile song, and album galleries.

## Milestones

- ✅ [v1.6 Auth & Profile Refactor](milestones/v1.6-ROADMAP.md) (Phases 1-31) — SHIPPED 2026-02-06
- 🚧 **v1.7 Engagement & Polish** — Phases 32-46 (in progress)

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

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

_v1.6 phases complete. See [v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) for archive._

---

### 🚧 v1.7 Engagement & Polish (In Progress)

**Milestone Goal:** Clean up technical debt, build robust push notifications, and add friend tagging in photos.

#### Phase 32: Photo Issues Fix

**Goal**: Fix ISS-001 (photo display optimization) and ISS-011 (custom profile photo crop UI)
**Depends on**: v1.6 complete
**Research**: Unlikely (internal patterns)
**Plans**: 2

Plans:

- [x] 32-01: Photo display fix (AlbumPhotoViewer contentFit=contain)
- [x] 32-02: Profile photo crop UI

#### Phase 33: Navigation Issues Fix

**Goal**: Fix ISS-004 (comments sheet navigation) and ISS-005 (swipe up for comments)
**Depends on**: Phase 32
**Research**: Unlikely (internal patterns)
**Plans**: 1

Plans:

- [x] 33-01: Comments sheet persistence and swipe-up gesture

#### Phase 34: Push Infrastructure

**Goal**: Complete push notification foundation — audit existing code, fix gaps, ensure reliable delivery
**Depends on**: Phase 33
**Research**: Likely (Expo Push API, notification services)
**Research topics**: Expo push notification setup, APNs/FCM configuration, notification tokens
**Plans**: 2

Plans:

- [x] 34-01: Reliability foundation (expo-server-sdk, token refresh)
- [x] 34-02: Receipt checking

#### Phase 35: Social Notification Events

**Goal**: Add notification triggers for likes, comments, follows, and friend requests
**Depends on**: Phase 34
**Research**: Unlikely (building on infrastructure)
**Plans**: 2

Plans:

- [x] 35-01: Notification settings UI (master toggle + per-type toggles)
- [x] 35-02: Friend accepted notifications, @mentions, preference checks

#### Phase 36: Photo Notification Events

**Goal**: Add notifications for tagged in photo and new story events
**Depends on**: Phase 35
**Research**: Unlikely (internal patterns)
**Plans**: 2

Plans:

- [x] 36-01: Story notifications (triage completion tracking, Cloud Function, deep linking)
- [x] 36-02: Tagged photo notifications (Cloud Function infrastructure, deep linking, schema docs)

#### Phase 37: Darkroom Ready Notifications

**Goal**: Audit and update existing darkroom ready notification — ensure reliable delivery and clear messaging
**Depends on**: Phase 34
**Research**: Unlikely (audit existing implementation)
**Plans**: 1

Plans:

- [x] 37-01: Audit and clean darkroom notification (dead code removal, simplified messaging, push enable banner)

#### Phase 38: Notification UI Polish

**Goal**: Polish in-app notification presentation and user experience
**Depends on**: Phase 35, Phase 36
**Research**: Unlikely (internal UI patterns)
**Plans**: 2

Plans:

- [x] 38-01: In-app notification banner (custom dark-themed foreground display)
- [x] 38-02: Notification list polish (bold usernames, unread dots, per-tap read, tappable items)

#### Phase 39: Darkroom Photo Tagging

**Goal**: Add UI to tag friends during darkroom photo triage (button on photo card)
**Depends on**: Phase 38
**Research**: Unlikely (internal UI patterns)
**Plans**: 1

Plans:

- [x] 39-01: TagFriendsModal, darkroom tag button, taggedUserIds persistence

#### Phase 40: Feed Photo Tagging

**Goal**: Allow tagging on existing feed photos via three-dots menu
**Depends on**: Phase 39
**Research**: Unlikely (internal UI patterns)
**Plans**: 1

Plans:

- [x] 40-01: Tag button on PhotoDetailScreen, TaggedPeopleModal, updatePhotoTags persistence

#### Phase 41: Tagged Notification Integration

**Goal**: Connect photo tagging to notification system — notify tagged users
**Depends on**: Phase 40
**Research**: Unlikely (internal patterns)
**Plans**: 1

Plans:

- [x] 41-01: Notification settings toggle + tag removal cancellation

#### Phase 42: Mutual Friends Suggestions

**Goal**: Suggest friends based on mutual connections
**Depends on**: Phase 41
**Research**: Unlikely (internal patterns)
**Plans**: 2

Plans:

- [x] 42-01: getMutualFriendSuggestions service function + FriendCard subtitle prop
- [x] 42-02: Integrate mutual friend suggestions into FriendsScreen UI + Cloud Function

#### Phase 43: Comment Cleanup and Audit

**Goal**: Full sweep of all code comments — fix inaccurate, remove stale TODOs, cut noise
**Depends on**: Phase 42
**Research**: Unlikely (internal patterns)
**Plans**: 4

Plans:

- [x] 43-01: Services + Cloud Functions comment audit (known stale fixes + full service audit)
- [x] 43-02: Hooks, utils, context, navigation, App.js comment audit
- [ ] 43-03: Components comment audit
- [ ] 43-04: Screens, styles, constants comment audit

#### Phase 44: Notification Activity Feed

**Goal**: Complete the notification screen to properly display all notification types — reactions, comments, comment replies, photo tags, and push notification activity
**Depends on**: Phase 43
**Research**: Unlikely (internal patterns)
**Plans**: 2

Plans:

- [ ] 44-01: Notification type renderers + photo thumbnails
- [ ] 44-02: Time grouping + deep linking polish + visual verification

#### Phase 45: Security Audit

**Goal**: Full-stack security sweep — fix Storage rules (public photo access), Cloud Functions authorization (getSignedPhotoUrl), Firestore access hierarchy (comments), input validation (mentions, tags), and client-side defense-in-depth
**Depends on**: Phase 44
**Research**: Unlikely (internal patterns)
**Plans**: 4

Plans:

- [ ] 45-01: Firebase Security Rules hardening (Storage auth + Firestore comment access)
- [ ] 45-02: Cloud Functions access control (getSignedPhotoUrl auth + CORS + error sanitization)
- [ ] 45-03: Cloud Functions input validation (@mention cap + tag validation + atomic deletions)
- [ ] 45-04: Client-side security (comment/tag validation + logger refinement + album sanitization)

#### Phase 46: Full Notifications Testing

**Goal**: [To be planned]
**Depends on**: Phase 45
**Research**: Unlikely (internal patterns)
**Plans**: 0

Plans:

- [ ] TBD (run /gsd:plan-phase 46 to break down)

---

## Progress

**v1.6 Auth & Profile Refactor — SHIPPED 2026-02-06**

| Milestone | Phases              | Plans | Status   | Shipped    |
| --------- | ------------------- | ----- | -------- | ---------- |
| v1.6      | 1-31 (+ 14 decimal) | 108   | Complete | 2026-02-06 |

**v1.7 Engagement & Polish — In Progress**

| Phase                          | Milestone | Plans | Status      | Completed  |
| ------------------------------ | --------- | ----- | ----------- | ---------- |
| 32. Photo Issues Fix           | v1.7      | 2/2   | Complete    | 2026-02-06 |
| 33. Navigation Issues Fix      | v1.7      | 1/1   | Complete    | 2026-02-06 |
| 34. Push Infrastructure        | v1.7      | 2/2   | Complete    | 2026-02-06 |
| 35. Social Notifications       | v1.7      | 2/2   | Complete    | 2026-02-06 |
| 36. Photo Notifications        | v1.7      | 2/2   | Complete    | 2026-02-06 |
| 37. Darkroom Notifications     | v1.7      | 1/1   | Complete    | 2026-02-06 |
| 38. Notification UI Polish     | v1.7      | 2/2   | Complete    | 2026-02-09 |
| 39. Darkroom Tagging           | v1.7      | 1/1   | Complete    | 2026-02-09 |
| 40. Feed Tagging               | v1.7      | 1/1   | Complete    | 2026-02-09 |
| 41. Tag Integration            | v1.7      | 1/1   | Complete    | 2026-02-09 |
| 42. Mutual Friends             | v1.7      | 2/2   | Complete    | 2026-02-09 |
| 43. Comment Cleanup/Audit      | v1.7      | 2/4   | In progress |            |
| 44. Notification Activity      | v1.7      | 0/2   | Planned     |            |
| 45. Security Audit             | v1.7      | 0/4   | Planned     |            |
| 46. Full Notifications Testing | v1.7      | 0/?   | Planned     |            |

See [MILESTONES.md](MILESTONES.md) for milestone history.
