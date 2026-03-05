# Project State: Flick

**Status:** In Progress
**Last Updated:** 2026-03-05

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Snaps and streaks make messaging a daily habit
**Current focus:** Phase 9 — Pinned Snaps iOS

## Current Position

Phase: 9 of 10 (Pinned Snaps iOS)
Plan: 7 of 10 executed, Plan 05 checkpoint pending
Status: In Progress — Plan 08 complete (Live Activity cleanup + NSE rewrite)
Last activity: 2026-03-05 - Completed Plan 09-08: Remove Live Activity infrastructure

Progress: [██████░░░░] 50% (v1.1)

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
| Phase 09 P01 | 4min | 2 tasks | 13 files |
| Phase 09 P02 | 4min | 2 tasks | 4 files |
| Phase 09 P03 | 4min | 2 tasks | 4 files |
| Phase 09 P04 | 4min | 2 tasks | 4 files |
| Phase 09 P06 | 4min | 2 tasks | 8 files |
| Phase 09 P07 | 4min | 2 tasks | 2 files |
| Phase 09 P08 | 4min | 2 tasks | 22 files |

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

**Phase 9 Decisions:**
- Used .system(design: .monospaced) font in widget extension as pixel font fallback -- custom font embedding in widget targets not supported by @bacons/apple-targets
- Thumbnails stored in App Groups /thumbnails/ subdirectory for clean separation
- Cap enforcement (5 max) implemented in native Swift module, not JS
- Widget extension uses compact-only layout with minimal Dynamic Island fallback views
- Used notifications-outline PixelIcon as pin indicator (no pin/bookmark icon in set)
- PinToggle returns null on Android via Platform.OS guard (iOS-only feature)
- Tooltip uses RN core Animated for fade, not Reanimated, per project convention
- Deep link URL uses lapse://messages/{conversationId} matching existing linking config
- isOneOnOne derived from !!friendId since snap mode is always 1:1
- pinnedActivityId reuses snapId for simplicity
- Explicit pinned:false field on non-pinned snaps for clean Firestore queries
- Live Activity started in notification received listener (not response listener) for immediate lock screen appearance
- Thumbnail downloaded to FileSystem.cacheDirectory (ephemeral) before Live Activity start
- Pinned snap notification body uses distinct text instead of randomized templates
- All notification data values are strings per push notification constraint (pinned='true')
- NSE downloads thumbnail via URLSession to App Groups container (same path as native module)
- Deduplication checks activityId attribute match -- returns existing activity.id if already running
- Used Expo SDK _mutableContent field which maps to APNS mutable-content:1 header
- Removed Platform/FileSystem/startPinnedSnapActivity imports from App.js since NSE handles all states
- Cap enforcement in NSE runs after Activity.request to avoid race with newly created activity
- Consumer mods using withXcodeProjectBeta must be listed BEFORE @bacons/apple-targets in app.json plugins (base mod provider must be last)
- Match NSE target by getDisplayName() with productName fallback for reliability
- Do NOT set GENERATE_INFOPLIST_FILE=NO -- use INFOPLIST_KEY_* build settings with GENERATE_INFOPLIST_FILE=YES
- Replaced ~298-line ActivityKit NSE with ~85-line thumbnail-attachment-only version
- Lowered NSE deploymentTarget from 16.2 to 16.0 (ActivityKit no longer required)
- SnapViewer handleDismiss left TODO for dismissPinnedSnapNotification (Plan 09-09)
- Version display in SettingsScreen changed from TouchableOpacity with diagnostics to plain View

**Open blockers:**

1. ~~**NSE NSSupportsLiveActivities plist key**~~ FULLY RESOLVED -- Plan 08 deleted withNSELiveActivities.js entirely. NSE no longer uses ActivityKit or NSSupportsLiveActivities.

2. **Multiple pins in a row** — Sending multiple pinned snaps in succession may cause issues (needs investigation).

3. **React Native Firebase deprecated namespaced API warnings** — `putFile()` and `getDownloadURL()` on storage references use deprecated namespaced API. Need migration to modular API per https://rnfirebase.io/migrating-to-v22.

### Roadmap Evolution

- Phase 10 added: Performance enhancements to story viewing
- Phases reordered: Performance moved to Phase 7, Screenshot Detection→8, Pinned iOS→9, Pinned Android→10
- Phase 11 added: Add video support to main camera
- Phase 12 added: deploy all milestone changes to prod

**Key notes for v1.1:**

- Phase 6 is OTA-deployable (no native build needed)
- Phase 9 pivoted from Live Activities to persistent rich notifications (Plan 08 removed all ActivityKit code)
- NSE uses UNNotificationAttachment for thumbnail display (no App Groups needed)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 39 | Fix streak reset bug: new streak starts at dayCount 0 (not old count) | 2026-03-05 | 8e8c99e | [39-fix-streak-reset-bug-new-streak-starts-a](./quick/39-fix-streak-reset-bug-new-streak-starts-a/) |
| 38 | Snap expand/suck-back animation matching story viewer | 2026-03-04 | cbda9de | [38-opening-and-closing-a-snap-should-use-th](./quick/38-opening-and-closing-a-snap-should-use-th/) |
| 37 | Fix streak expiration: add local expiry override to useStreak/useStreakMap | 2026-03-04 | 5991492 | [37-fix-streak-expiration-add-logic-to-end-s](./quick/37-fix-streak-expiration-add-logic-to-end-s/) |
| 36 | Fix BackHandler.removeEventListener crash on Android stories | 2026-02-25 | 8486fe8 | [36-fix-backhandler-removeeventlistener-cras](./quick/36-fix-backhandler-removeeventlistener-cras/) |
| 35 | Fix mispositioned loading spinner on Android | 2026-02-25 | 3e43ebe | [35-fix-mispositioned-loading-spinner-on-and](./quick/35-fix-mispositioned-loading-spinner-on-and/) |

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 09-08-PLAN.md (Remove Live Activity infrastructure). Phase 9 plans 01-04, 06-08 executed. Checkpoint 05 pending EAS build + verification.
Resume file: None

---

Last activity: 2026-03-05 - Completed Plan 09-08: Remove Live Activity infrastructure, rewrite NSE for rich notifications
