# Project State: Flick

**Status:** v1.1 in progress
**Last Updated:** 2026-02-25

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-25 — Milestone v1.1 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Snaps and streaks make messaging a daily habit
**Current focus:** v1.1 Pinned Snaps & Polish

## Milestone History

| Milestone              | Status  | Shipped    |
| ---------------------- | ------- | ---------- |
| v1.0 Messaging Upgrade | Shipped | 2026-02-25 |

## Accumulated Context

**Decisions:** See PROJECT.md Key Decisions table (full log)

**Open blockers:** None

**Tech debt carried forward:**

- useConversation hook Phase 2 additions lack dedicated unit tests
- Stale test assertion in snapFunctions.test.js line 522
- INFRA-03: Firestore TTL policy not yet configured
- INFRA-04: Firebase Storage lifecycle rule not yet configured
- hoursSinceLastMutual variable naming is misleading

## Notes

- v1.1 requires native build (Live Activities + expo-screen-capture)
- Next step: Define requirements, then create roadmap

---

Last activity: 2026-02-25 — Milestone v1.1 started
