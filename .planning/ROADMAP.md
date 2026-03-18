# Roadmap: Flick

## Milestones

- ✅ **v1.0 Messaging Upgrade** — Phases 1-5 (shipped 2012-02-25)
- 🚧 **v1.1 Pinned Snaps & Polish** — Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 Messaging Upgrade (Phases 1-5) — SHIPPED 2012-02-25</summary>

- [x] Phase 1: Message Infrastructure & Read Receipts (2/2 plans) — completed 2012-02-23
- [x] Phase 2: Message Interactions (6/6 plans) — completed 2012-02-24
- [x] Phase 3: Snap Messages (8/8 plans) — completed 2012-02-24
- [x] Phase 4: Snap Streaks (4/4 plans) — completed 2012-02-24
- [x] Phase 5: Photo Tag Integration (4/4 plans) — completed 2012-02-25

</details>

### v1.1 Pinned Snaps & Polish

- [ ] **Phase 6: Tech Debt & Darkroom Optimization** — Resolve carried tech debt and optimize darkroom reveal checks with local caching
- [x] **Phase 7: Performance Enhancements to Story Viewing** — Optimize story viewing performance for smoother user experience (completed 2012-02-25)
- [x] **Phase 8: Screenshot Detection** — Detect and notify when a recipient screenshots a snap (completed 2026-03-18)
- [ ] **Phase 9: Pinned Snaps iOS** — Pin snaps to the lock screen via Live Activities with photo thumbnail, sender info, and deep linking
- [x] **Phase 10: Pinned Snaps Android** — Pin snaps via persistent ongoing notifications with photo thumbnail and deep linking (completed 2026-03-18)

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

**Plans:** 3/3 plans complete

Plans:

- [ ] 08-00-PLAN.md — Wave 0: Test scaffolds for screenshotService and Cloud Function notification handling (RED tests)
- [ ] 08-01-PLAN.md — Service layer: expo-screen-capture install, Firestore rules update, screenshotService, screenshotQueueService, Cloud Function extension, notification deep-link
- [ ] 08-02-PLAN.md — UI integration: useScreenshotDetection hook, SystemMessage component, SnapViewer wiring, ConversationScreen rendering

### Phase 9: Pinned Snaps iOS

**Goal**: Senders can pin a snap to the recipient's iOS lock screen as a Live Activity with photo thumbnail, sender name, and a tap-to-open action that persists until the snap is viewed
**Depends on**: Phase 8 (shared EAS native build)
**Requirements**: PINI-01, PINI-02, PINI-03, PINI-04, PINI-05
**Success Criteria** (what must be TRUE):

1. When composing a snap, the sender can toggle a "pin to screen" option before sending
2. The recipient sees a Live Activity on their iOS lock screen showing the snap photo thumbnail, sender display name, and optional caption
3. Tapping the Live Activity opens the app directly to the conversation with the sender
4. After the recipient views the snap, the Live Activity disappears
5. If the recipient swipes away the Live Activity, it is automatically re-created until the snap is viewed

**Plans:** 15 plans (7 original + 3 pivot attempts reverted + 3 gap closure R1 + 2 gap closure R2)

Plans (Live Activity infrastructure -- executed):

- [x] 09-01-PLAN.md — Native infrastructure: @bacons/apple-targets, local Expo module (ActivityKit bridge), SwiftUI widget extension, App Groups
- [x] 09-02-PLAN.md — JS pin toggle UI: usePinPreference hook, PinToggle component, PinTooltip component, unit tests
- [x] 09-03-PLAN.md — JS service layer: liveActivityService.js, snapService pinned flag, SnapPreviewScreen send flow wiring
- [x] 09-04-PLAN.md — Recipient-side wiring: Cloud Function pinned notification payload, App.js Live Activity trigger, SnapViewer dismissal
- [ ] 09-05-PLAN.md — (SUPERSEDED) Checkpoint: end-to-end verification on physical iOS device
- [x] 09-06-PLAN.md — NSE for background Live Activities, mutableContent flag, native deduplication
- [x] 09-07-PLAN.md — Fix NSE plist blocker: rewrite withNSELiveActivities.js to use @bacons/apple-targets API

Plans (persistent notification pivot -- REVERTED, Live Activities restored):

- [ ] 09-08-PLAN.md — (REVERTED) Remove Live Activity infrastructure
- [ ] 09-09-PLAN.md — (REVERTED) Recipient-side notification dismissal
- [ ] 09-10-PLAN.md — (REVERTED) End-to-end verification checkpoint

Plans (gap closure R1 -- fixes from first device testing):

- [x] 09-11-PLAN.md — Fix thumbnail display: download thumbnail in JS handler, increase resolution to 300px
- [x] 09-12-PLAN.md — Widget visual polish: portrait aspect ratio, Polaroid frame, conditional text layout
- [x] 09-13-PLAN.md — Live Activity persistence: auto re-create on swipe-away via ActivityState observation

Plans (gap closure R2 -- fixes from second device testing):

- [ ] 09-14-PLAN.md — Thumbnail pipeline diagnostics + NSE fix + foreground-resume fallback for background Live Activities
- [ ] 09-15-PLAN.md — Polaroid visual overhaul: 160pt max height, thick borders, sharp corners, tilt rotation

### Phase 10: Pinned Snaps Android

**Goal**: Android recipients see a persistent notification for pinned snaps with the snap photo thumbnail and tap-to-open behavior, matching the iOS experience as closely as possible
**Depends on**: Phase 9 (iOS implementation informs Android UX decisions)
**Requirements**: PINA-01, PINA-02, PINA-03
**Success Criteria** (what must be TRUE):

1. When a pinned snap is received on Android, the recipient sees a persistent ongoing notification showing the snap photo thumbnail, sender name, and caption
2. Tapping the notification opens the app directly to the conversation with the sender
3. After the recipient views the snap, the notification is automatically dismissed

**Plans:** 2/2 plans complete

Plans:

- [x] 10-01-PLAN.md — Notification infrastructure: extend sendPushNotification with richContent, pinned-snaps channel, pinned_snap tap handler, onNewMessage pinned snap branch
- [x] 10-02-PLAN.md — Pin toggle UI, isPinned field, notification dismissal on snap view, 48h expiry cloud function

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10 → 11

**Build Note:** Phases 8-10 share a single EAS native build (bundles expo-screen-capture + Live Activity module). Phases 6-7 are OTA-deployable with no native build required.

| Phase                                        | Milestone | Plans Complete | Status      | Completed  |
| -------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Message Infrastructure & Read Receipts    | v1.0      | 2/2            | Complete    | 2012-02-23 |
| 2. Message Interactions                      | v1.0      | 6/6            | Complete    | 2012-02-24 |
| 3. Snap Messages                             | v1.0      | 8/8            | Complete    | 2012-02-24 |
| 4. Snap Streaks                              | v1.0      | 4/4            | Complete    | 2012-02-24 |
| 5. Photo Tag Integration                     | v1.0      | 4/4            | Complete    | 2012-02-25 |
| 6. Tech Debt & Darkroom Optimization         | v1.1      | 0/5            | Not started | -          |
| 7. Performance Enhancements to Story Viewing | v1.1      | Complete    | 2012-02-25 | 2012-02-25 |
| 8. Screenshot Detection                      | 3/3 | Complete   | 2026-03-18 | -          |
| 9. Pinned Snaps iOS                          | v1.1      | 10/15          | In Progress | -          |
| 10. Pinned Snaps Android                     | 2/2 | Complete   | 2026-03-18 | -          |
| 11. Add Video Support to Main Camera         | 4/8 | In Progress|  | -          |

### Phase 11: Add Video Support to Main Camera

**Goal:** Users can capture, upload, develop, and view videos alongside photos using the same camera interface, darkroom workflow, feed, PhotoDetail, and stories views
**Depends on:** Phase 10
**Requirements:** VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, VID-07, VID-08, VID-09, VID-10
**Success Criteria** (what must be TRUE):

1. Tapping the shutter button takes a photo; holding for ~500ms starts video recording with haptic feedback
2. A circular progress ring fills around the shutter button during recording (30s max)
3. Recorded videos upload to Firebase Storage and create Firestore documents with mediaType, videoURL, and duration fields
4. Videos develop and reveal identically to photos in darkroom, with a small video icon overlay
5. Feed autoplays videos muted when scrolled into view; tapping unmutes with state persisting across subsequent videos
6. Video cards show a duration badge (e.g. "0:12") in the corner
7. PhotoDetail plays videos with progress bar and mute toggle, looping in feed mode
8. Stories plays videos once to completion then auto-advances to the next story
9. expo-video installed, microphone permission configured, storage rules updated for video content types
10. Video thumbnail placeholder generated at capture time for progressive loading

**Plans:** 4/8 plans executed

Plans:
- [ ] 11-00-PLAN.md — Wave 0: RED test scaffolds for useCameraBase, uploadQueueService, VideoMuteContext
- [ ] 11-01-PLAN.md — Native config: expo-video install, microphone permission, storage rules, storageService uploadVideo, jest mock
- [ ] 11-02-PLAN.md — Upload queue video support (mediaType/duration/videoURL/thumbnail), VideoMuteContext, App.js provider wiring
- [ ] 11-03-PLAN.md — UI components: RecordingProgressRing (animated SVG), VideoPlayer wrapper (expo-video)
- [ ] 11-04-PLAN.md — Camera hold-to-record: useCameraBase recording logic, CameraScreen progress ring integration
- [ ] 11-05-PLAN.md — Feed video playback: FeedPhotoCard video rendering, viewport detection, duration badge
- [ ] 11-06-PLAN.md — PhotoDetail/Stories video playback, stories auto-advance, darkroom video icon overlay
- [ ] 11-07-PLAN.md — Full test suite + lint verification, end-to-end checkpoint on physical device

**Build Note:** Phase 11 requires a new EAS build (expo-video native module + microphone permission). Storage rules must be deployed separately: `firebase deploy --only storage`.
