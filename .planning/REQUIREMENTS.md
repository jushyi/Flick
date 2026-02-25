# Requirements: Flick v1.1 Pinned Snaps & Polish

**Defined:** 2026-02-25
**Core Value:** Snaps and streaks make messaging a daily habit

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Screenshot Detection

- [ ] **SCRN-01**: Sender receives push notification when recipient screenshots their snap
- [ ] **SCRN-02**: Screenshotted snaps display a visual indicator on the snap bubble in conversation
- [ ] **SCRN-03**: Screenshot event is recorded on the snap message document (`screenshottedAt` field)

### Pinned Snaps — iOS

- [ ] **PINI-01**: Sender can toggle "pin to screen" when sending a snap
- [ ] **PINI-02**: Recipient sees a Live Activity on lock screen with snap photo thumbnail, sender name, and optional caption
- [ ] **PINI-03**: Tapping the Live Activity opens the conversation (same deeplink as push notification)
- [ ] **PINI-04**: Live Activity disappears after recipient views the snap
- [ ] **PINI-05**: Live Activity auto-expires after 48 hours if snap is never viewed

### Pinned Snaps — Android

- [ ] **PINA-01**: Recipient sees a persistent ongoing notification with snap photo thumbnail for pinned snaps
- [ ] **PINA-02**: Tapping the notification opens the conversation
- [ ] **PINA-03**: Notification dismisses when recipient views the snap

### Story Viewing Performance

- [x] **PERF-01**: Photos display a blurred placeholder that crossfades to full resolution over 200ms (progressive loading)
- [x] **PERF-02**: Tapping to next photo immediately shows dark background + spinner instead of lingering on previous image
- [x] **PERF-03**: Cube transition between friends runs on the UI thread via Reanimated at 60fps
- [x] **PERF-04**: Next friend's first photo is prefetched while viewing current friend; next 2-3 photos within current friend are prefetched
- [x] **PERF-05**: Feed story cards load in paginated batches with a "Load more" button
- [x] **PERF-06**: Firestore real-time listeners pause during photo/friend transitions and resume after settling
- [x] **PERF-07**: Failed image loads auto-skip to the next photo after a timeout
- [x] **PERF-08**: New photos generate a tiny thumbnail at upload time stored as base64 data URL in Firestore

### Darkroom Optimization

- [ ] **DARK-01**: Darkroom reveal checks use local timestamp cache to avoid redundant Firestore reads
- [ ] **DARK-02**: Cache invalidates on new photo capture and after reveal processing

### Tech Debt

- [ ] **DEBT-01**: useConversation hook Phase 2 additions have dedicated unit tests
- [x] **DEBT-02**: Stale test assertion in snapFunctions.test.js line 522 is fixed
- [ ] **DEBT-03**: Firestore TTL policy configured for snap message auto-cleanup
- [ ] **DEBT-04**: Firebase Storage lifecycle rule configured for orphaned snap photo cleanup
- [x] **DEBT-05**: `hoursSinceLastMutual` variable renamed to accurately reflect its calculation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Screenshot Enhancement

- **SCRN-04**: Screen recording prevention during snap viewing (FLAG_SECURE on Android, preventScreenCapture on iOS)
- **SCRN-05**: Screenshot detection for all ephemeral message types (not just snaps)

### Live Activity Enhancement

- **PINI-06**: Push-to-start Live Activities from server without app involvement (iOS 17.2+)
- **PINI-07**: Darkroom countdown Live Activity showing developing photo timer on lock screen

### Android Enhancement

- **PINA-04**: Android Live Updates (native progress notifications) when Android 16 adoption is sufficient
- **PINA-05**: Rich snap notification with custom BigPictureStyle layout (sender avatar + styled text)

## Out of Scope

| Feature                                          | Reason                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Screenshot blocking (prevent all screenshots)    | iOS does not allow apps to fully block screenshots; creates poor UX on Android; industry standard is detect + notify |
| Screenshot detection for non-snap messages       | Creates social anxiety for normal conversations; Instagram model scopes to ephemeral content only                    |
| Live Activity showing full-resolution snap photo | 4KB ActivityKit data limit; App Groups workaround uses compressed thumbnail instead                                  |
| Dynamic Island snap display                      | Adds complexity without proportional user value; lock screen is the primary surface                                  |
| Group DM pinned snaps                            | 1-on-1 foundation needs to be solid first                                                                            |
| Snap replay (view a second time)                 | Undermines view-once ephemerality model; disposable camera metaphor                                                  |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| PERF-01     | 7     | Complete |
| PERF-02     | 7     | Complete |
| PERF-03     | 7     | Complete |
| PERF-04     | 7     | Complete |
| PERF-05     | 7     | Complete |
| PERF-06     | 7     | Complete |
| PERF-07     | 7     | Complete |
| PERF-08     | 7     | Complete |
| SCRN-01     | 8     | Pending |
| SCRN-02     | 8     | Pending |
| SCRN-03     | 8     | Pending |
| PINI-01     | 9     | Pending |
| PINI-02     | 9     | Pending |
| PINI-03     | 9     | Pending |
| PINI-04     | 9     | Pending |
| PINI-05     | 9     | Pending |
| PINA-01     | 10    | Pending |
| PINA-02     | 10    | Pending |
| PINA-03     | 10    | Pending |
| DARK-01     | 6     | Pending |
| DARK-02     | 6     | Pending |
| DEBT-01     | 6     | Pending |
| DEBT-02     | 6     | Complete |
| DEBT-03     | 6     | Pending |
| DEBT-04     | 6     | Pending |
| DEBT-05     | 6     | Complete |

**Coverage:**

- v1.1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---

_Requirements defined: 2026-02-25_
_Last updated: 2026-02-25 — Added PERF-01 through PERF-08 for Phase 7; fixed SCRN/PINI/PINA phase mapping after renumber_
