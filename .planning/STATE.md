---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Speed & Scale
status: planning
stopped_at: null
last_updated: "2026-03-23"
last_activity: "2026-03-23 — Milestone v1.2 started"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Flick

**Status:** Defining requirements
**Last Updated:** 2026-03-23

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Snaps and streaks make messaging a daily habit
**Current focus:** Milestone v1.2 — Speed & Scale

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-23 — Milestone v1.2 started

## Milestone History

| Milestone                  | Status      | Shipped    |
| -------------------------- | ----------- | ---------- |
| v1.0 Messaging Upgrade     | Shipped     | 2026-02-25 |
| v1.1 Pinned Snaps & Polish | Shipped     | 2026-03-20 |
| v1.2 Speed & Scale         | In progress | -          |

## Accumulated Context

**Decisions:** See PROJECT.md Key Decisions table (full log)

**v1.0 key patterns:** Service layer pattern ({success, error} returns), custom hooks for business logic, React Native Firebase SDK (not web SDK), 5 message types via type discriminator, server-authoritative streaks via Cloud Functions.

**v1.1 key patterns:** @bacons/apple-targets for widget extension, NSE for background thumbnail attachment, push-to-start Live Activities, expo-video for video capture/playback, viewport-driven autoplay, RecordingProgressRing animated SVG, VideoMuteContext for cross-navigator mute state.

**Known tech debt carried into v1.2:**
- Phase 6 incomplete: DARK-01/02 (darkroom cache), DEBT-01 (useConversation tests), DEBT-03/04 (Firestore TTL + Storage lifecycle)
- Phase 8 gap: 08-03 (SnapBubble screenshotted visual state)
- Phase 9 gaps: 09-19, 09-20 (push-to-start fixes, deep link fixes)
- Phase 10 gap: 10-03 (Android pinnedNotifId wiring)
- React Native Firebase deprecated namespaced API warnings (putFile, getDownloadURL)
- Multiple pins in a row may cause issues (needs investigation)
