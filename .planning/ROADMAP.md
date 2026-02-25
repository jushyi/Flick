# Roadmap: Flick

## Milestones

- ✅ **v1.0 Messaging Upgrade** — Phases 1-5 (shipped 2026-02-25)
- 🚧 **v1.1 Pinned Snaps & Polish** — Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 Messaging Upgrade (Phases 1-5) — SHIPPED 2026-02-25</summary>

- [x] Phase 1: Message Infrastructure & Read Receipts (2/2 plans) — completed 2026-02-23
- [x] Phase 2: Message Interactions (6/6 plans) — completed 2026-02-24
- [x] Phase 3: Snap Messages (8/8 plans) — completed 2026-02-24
- [x] Phase 4: Snap Streaks (4/4 plans) — completed 2026-02-24
- [x] Phase 5: Photo Tag Integration (4/4 plans) — completed 2026-02-25

</details>

### v1.1 Pinned Snaps & Polish

- [ ] **Phase 6: Tech Debt & Darkroom Optimization** — Resolve carried tech debt and optimize darkroom reveal checks with local caching
- [x] **Phase 7: Performance Enhancements to Story Viewing** — Optimize story viewing performance for smoother user experience (completed 2026-02-25)
- [ ] **Phase 8: Screenshot Detection** — Detect and notify when a recipient screenshots a snap
- [ ] **Phase 9: Pinned Snaps iOS** — Pin snaps to the lock screen via Live Activities with photo thumbnail, sender info, and deep linking
- [ ] **Phase 10: Pinned Snaps Android** — Pin snaps via persistent ongoing notifications with photo thumbnail and deep linking

## Phase Details

### Phase 6: Tech Debt & Darkroom Optimization

**Goal**: The codebase has zero carried tech debt from v1.0 and darkroom reveal checks no longer make redundant Firestore reads
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DARK-01, DARK-02
**Success Criteria** (what must be TRUE):

1. useConversation hook Phase 2 features (reactions, replies, deletion) have dedicated unit tests that pass
2. snapFunctions.test.js passes without stale assertions (line 522 fixed)
3. Firestore TTL policy is configured in Firebase console and auto-deletes expired snap messages
4. Firebase Storage lifecycle rule is configured in GCS console and auto-deletes orphaned snap photos
5. Darkroom reveal checks on app foreground use a cached timestamp and skip Firestore reads when the cached time has not elapsed

**Plans:** 5 plans

Plans:

- [ ] 06-01-PLAN.md — Darkroom cache: write failing tests for isDarkroomReadyToReveal cache behavior (TDD RED)
- [ ] 06-02-PLAN.md — Darkroom cache: implement module-level cache + wire clearRevealCache in App.js, useDarkroom.js, uploadQueueService.js (TDD GREEN)
- [ ] 06-03-PLAN.md — DEBT-01: add useConversation Phase 2 tests (reactions, replies, soft deletion)
- [ ] 06-04-PLAN.md — DEBT-02/05: audit snapFunctions.test.js + rename hoursSinceLastMutual to daysSinceLastMutual
- [ ] 06-05-PLAN.md — DEBT-03/04: configure Firestore TTL and GCS Storage lifecycle rule (includes human checkpoint)

### Phase 7: Performance Enhancements to Story Viewing

**Goal:** Story viewing feels instant and smooth — 60fps cube transitions, progressive image loading with placeholder crossfade, immediate dark loading states, smart prefetching, and paginated feed story cards
**Depends on:** Phase 6
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, PERF-08
**Success Criteria** (what must be TRUE):

1. Tapping to the next photo immediately shows dark background + spinner, not the previous image
2. New photos display a blurred placeholder that crossfades to full resolution over 200ms
3. Cube transition between friends runs at 60fps via Reanimated on the UI thread
4. Next friend's first photo is prefetched while viewing the current friend
5. Feed story cards load in batches with a "Load more" button
6. Firestore real-time listeners pause during transitions and resume after settling
7. Failed image loads auto-skip to the next photo after 5 seconds
8. New photos generate a thumbnail at upload time for progressive loading

**Plans:** 4/4 plans complete

Plans:

- [x] 07-00-PLAN.md — Wave 0: Test scaffolds for Phase 7 behaviors (RED tests)
- [x] 07-01-PLAN.md — Feed story card pagination + thumbnail generation at upload
- [x] 07-02-PLAN.md — Cube transition Reanimated migration (SharedValue + Gesture Handler) + Android back button dismiss
- [x] 07-03-PLAN.md — Progressive loading + dark loading states + subscription management + auto-skip + prefetching

### Phase 8: Screenshot Detection

**Goal**: Snap senders are notified when a recipient screenshots their snap, with a persistent visual record in the conversation
**Depends on**: Phase 7
**Requirements**: SCRN-01, SCRN-02, SCRN-03
**Success Criteria** (what must be TRUE):

1. When a recipient takes a screenshot while viewing a snap, the sender receives a push notification identifying which snap was screenshotted
2. A screenshotted snap displays a visual indicator (e.g., sparkle/eye icon) on its bubble in the conversation thread
3. The snap message document in Firestore contains a `screenshottedAt` timestamp field after a screenshot event
   **Plans**: TBD

Plans:

- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Pinned Snaps iOS

**Goal**: Senders can pin a snap to the recipient's iOS lock screen as a Live Activity showing the snap photo thumbnail, sender name, and a tap-to-open action
**Depends on**: Phase 8 (shared EAS native build includes both expo-screen-capture and expo-live-activity)
**Requirements**: PINI-01, PINI-02, PINI-03, PINI-04, PINI-05
**Success Criteria** (what must be TRUE):

1. When composing a snap, the sender can toggle a "pin to screen" option before sending
2. The recipient sees a Live Activity on their iOS lock screen showing the snap photo thumbnail (via App Groups), sender display name, and optional caption
3. Tapping the Live Activity opens the app directly to the conversation with the sender
4. After the recipient views the snap, the Live Activity disappears from the lock screen
5. If the recipient never views the snap, the Live Activity auto-expires and disappears after 48 hours
   **Plans**: TBD

Plans:

- [ ] 09-01: TBD
- [ ] 09-02: TBD
- [ ] 09-03: TBD

### Phase 10: Pinned Snaps Android

**Goal**: Android recipients see a persistent notification for pinned snaps with the snap photo thumbnail and tap-to-open behavior, matching the iOS experience as closely as possible
**Depends on**: Phase 9 (iOS implementation informs Android UX decisions)
**Requirements**: PINA-01, PINA-02, PINA-03
**Success Criteria** (what must be TRUE):

1. When a pinned snap is received on Android, the recipient sees a persistent ongoing notification showing the snap photo thumbnail, sender name, and caption
2. Tapping the notification opens the app directly to the conversation with the sender
3. After the recipient views the snap, the notification is automatically dismissed
   **Plans**: TBD

Plans:

- [ ] 10-01: TBD
- [ ] 10-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10

**Build Note:** Phases 8-10 share a single EAS native build (bundles expo-screen-capture + expo-live-activity). Phases 6-7 are OTA-deployable with no native build required.

| Phase                                        | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Message Infrastructure & Read Receipts    | v1.0      | 2/2            | Complete    | 2026-02-23 |
| 2. Message Interactions                      | v1.0      | 6/6            | Complete    | 2026-02-24 |
| 3. Snap Messages                             | v1.0      | 8/8            | Complete    | 2026-02-24 |
| 4. Snap Streaks                              | v1.0      | 4/4            | Complete    | 2026-02-24 |
| 5. Photo Tag Integration                     | v1.0      | 4/4            | Complete    | 2026-02-25 |
| 6. Tech Debt & Darkroom Optimization         | v1.1      | 0/5            | Not started | -          |
| 7. Performance Enhancements to Story Viewing | v1.1      | Complete    | 2026-02-25 | 2026-02-25 |
| 8. Screenshot Detection                      | v1.1      | 0/0            | Not started | -          |
| 9. Pinned Snaps iOS                          | v1.1      | 0/0            | Not started | -          |
| 10. Pinned Snaps Android                     | v1.1      | 0/0            | Not started | -          |

---

_Roadmap created: 2026-02-23_
_Last updated: 2026-02-25 — Phase 7: completed 07-03 (progressive loading, subscription management, auto-skip, prefetching)_
