# Project State: Flick

**Status:** Executing phase 9
**Last Updated:** 2026-02-26

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Snaps and streaks make messaging a daily habit
**Current focus:** Phase 9 — Pinned Snaps iOS

## Current Position

Phase: 9 of 10 (Pinned Snaps iOS)
Plan: 2 of 5 in current phase (09-01, 09-02 complete)
Status: Phase 9 in progress
Last activity: 2026-02-26 — Completed 09-02-PLAN.md (pin toggle UI & preference hook)

Progress: [███████░░░] 65% (v1.1)

## Performance Metrics

**Velocity (v1.0):**

- Total plans completed: 24
- Total execution time: ~3 days
- Average: ~8 plans/day

**By Phase (v1.0):**

| Phase                     | Plans | Status   |
| ------------------------- | ----- | -------- |
| 1. Message Infrastructure | 2     | Complete |
| 2. Message Interactions   | 6     | Complete |
| 3. Snap Messages          | 8     | Complete |
| 4. Snap Streaks           | 4     | Complete |
| 5. Photo Tag Integration  | 4     | Complete |
| Phase 07 P00 | 4min | 1 tasks | 3 files |
| Phase 07 P01 | 7min | 2 tasks | 3 files |
| Phase 07 P02 | 2min | 3 tasks | 3 files |
| Phase 07 P03 | 10min | 2 tasks | 3 files |
| Phase 08 P00 | 6min | 3 tasks | 3 files |
| Phase 08 P01 | 10min | 3 tasks | 9 files |
| Phase 08 P02 | 3min | 2 tasks | 4 files |
| Phase 09 P01 | 4min | 2 tasks | 13 files |
| Phase 09 P02 | 3min | 2 tasks | 4 files |

## Milestone History

| Milestone                  | Status      | Shipped    |
| -------------------------- | ----------- | ---------- |
| v1.0 Messaging Upgrade     | Shipped     | 2026-02-25 |
| v1.1 Pinned Snaps & Polish | In progress | -          |

## Accumulated Context

**Decisions:** See PROJECT.md Key Decisions table (full log)

**Phase 6 Decisions:**
- DEBT-02 confirmed as audit-and-pass: stale assertion already fixed in v1.0, all 15 snapFunctions tests pass with no fragile assertions
- Pre-existing notifications.test.js failure (reaction lastMessage) is out of scope for phase 6

**Phase 7 Decisions:**
- Used eslint-disable-next-line for scaffold imports that will be needed when tests are implemented
- Used named function expressions in FeedScreen mock components to satisfy react/display-name ESLint rule
- Task 1 (feed pagination) was already committed in 07-00 RED scaffolding - no duplicate commit needed
- Thumbnail generated from local URI before storage upload to avoid re-downloading
- thumbnailDataURL uses conditional spread (null = no field in Firestore document)
- Keep RN Animated for expand/collapse/dismiss; only cube faces migrate to Reanimated
- Separate gesture systems: Gesture.Pan (horizontal) + PanResponder (vertical) to avoid migration risk
- GestureDetector wraps only incoming cube face; outgoing is pointerEvents=none
- Android BackHandler calls existing animatedClose for suck-back dismiss
- Dark overlay uses zIndex 2 to fully cover image during loading (replaces old centered spinner)
- Auto-skip timeout (5s) only fires in stories mode; feed mode has no auto-skip
- getNextFriendFirstPhotoURL callback added to FeedScreen setCallbacks rather than modifying PhotoDetailContext schema

**Phase 8 Decisions:**
- Used { virtual: true } for expo-screen-capture mock since package not yet installed
- Tightened Cloud Function notification test assertions to check type: system_screenshot ensuring true RED state
- Added unreadCount non-increment assertion for system_screenshot to ensure complete behavior coverage
- senderId on system_screenshot message set to screenshotter's ID for correct onNewMessage recipient derivation
- system_screenshot messages do NOT increment unread count (informational, not actionable)
- Updated muted-conversation test to use existing dmEnabled preference check (no mutedBy field in codebase)
- Removed { virtual: true } from expo-screen-capture jest mock after package installation
- Used onScreenshotRef pattern to avoid stale closure in screenshot callback
- isExpired check uses useMemo to handle both Firestore Timestamp and Date objects
- viewerDisplayName prop added to SnapViewer (passed from ConversationScreen) rather than internal fetch

**Phase 9 Decisions:**
- Used monospaced system font (.system(design: .monospaced)) as fallback for pixel font in widget extension -- custom fonts cannot be reliably embedded via @bacons/apple-targets
- Thumbnail stored in pinned_thumbnails/ subdirectory within App Groups container for clean organization
- Cap enforcement (max 5 activities) implemented in native module on recipient device, not sender side
- Dynamic Island included with minimal compact presentation for devices that support it
- Used pricetag-outline PixelIcon since no pin icon exists in icon set
- Amber color scheme (colors.status.developing) for enabled pin state to match retro aesthetic
- Used RN core Animated for tooltip fade (not reanimated) per project convention for simple animations
- PinToggle uses pill/chip design with icon + label + dot indicator rather than reusing PixelToggle switch

**Open blockers:** None

### Roadmap Evolution

- Phase 10 added: Performance enhancements to story viewing
- Phases reordered: Performance moved to Phase 7, Screenshot Detection→8, Pinned iOS→9, Pinned Android→10

**Key notes for v1.1:**

- Phase 6 is OTA-deployable (no native build needed)
- Phases 8-10 share a single EAS native build (expo-screen-capture + expo-live-activity)
- expo-live-activity is early-stage (MEDIUM confidence) — Voltra is documented fallback
- PINI features use App Groups workaround for photo thumbnails in Live Activities

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 36 | Fix BackHandler.removeEventListener crash on Android stories | 2026-02-25 | 8486fe8 | [36-fix-backhandler-removeeventlistener-cras](./quick/36-fix-backhandler-removeeventlistener-cras/) |
| 35 | Fix mispositioned loading spinner on Android | 2026-02-25 | 3e43ebe | [35-fix-mispositioned-loading-spinner-on-and](./quick/35-fix-mispositioned-loading-spinner-on-and/) |

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 09-02-PLAN.md (pin toggle UI & preference hook)
Resume file: None

---

Last activity: 2026-02-26 - Completed 09-02-PLAN.md: usePinPreference hook, PinToggle component, PinTooltip component, 9 unit tests
