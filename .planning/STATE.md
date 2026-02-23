# Project State: Flick Messaging Upgrade

**Current Phase:** Not started
**Last Updated:** 2026-02-23

## Progress

| Phase                                      | Status      | Started | Completed |
| ------------------------------------------ | ----------- | ------- | --------- |
| 1 — Message Infrastructure & Read Receipts | Not Started | —       | —         |
| 2 — Message Interactions                   | Not Started | —       | —         |
| 3 — Snap Messages                          | Not Started | —       | —         |
| 4 — Snap Streaks                           | Not Started | —       | —         |
| 5 — Photo Tag Integration                  | Not Started | —       | —         |

## Requirements Coverage

- Total v1 requirements: 42
- Completed: 0
- In progress: 0
- Remaining: 42

## Key Decisions Log

| Date       | Decision                                 | Context                                              |
| ---------- | ---------------------------------------- | ---------------------------------------------------- |
| 2026-02-23 | Camera-only snaps (no gallery)           | Keeps authentic, in-the-moment feel                  |
| 2026-02-23 | View once then gone                      | Ephemeral by design                                  |
| 2026-02-23 | 3-day streak threshold                   | Low enough to achieve, high enough to mean something |
| 2026-02-23 | Streak visual on snap button             | Button changes color + day count                     |
| 2026-02-23 | Warning color + "!" + push               | Multi-signal before streak expires                   |
| 2026-02-23 | Caption text only on snaps               | No drawing/doodle for v1                             |
| 2026-02-23 | Photo attribution on reshare             | "Photo by @user" respects photographer               |
| 2026-02-23 | Screenshot notification (not protection) | Deterrent, not security guarantee                    |
| 2026-02-23 | Reactions as separate message docs       | Preserves message immutability                       |
| 2026-02-23 | Conversation-level read receipts         | 1 write per open vs N per-message writes             |
| 2026-02-23 | Server-authoritative streaks             | Cloud Functions only, never client-side              |

## Blockers

None currently.

## Notes

- Only 1 new dependency needed: `expo-screen-capture` (requires native build in Phase 3)
- Existing stack covers ~90% of requirements
- Phase 2 and 3 are independent; Phase 4 depends on Phase 3; Phase 5 depends only on Phase 1

---

_State initialized: 2026-02-23_
