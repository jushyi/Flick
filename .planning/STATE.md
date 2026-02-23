# Project State: Flick Messaging Upgrade

**Current Phase:** 1 — Plan 01 complete, executing Plan 02
**Current Plan:** 2 of 4
**Last Updated:** 2026-02-23

## Progress

| Phase                                      | Status                  | Started    | Completed |
| ------------------------------------------ | ----------------------- | ---------- | --------- |
| 1 — Message Infrastructure & Read Receipts | In Progress (1/4 plans) | 2026-02-23 | —         |
| 2 — Message Interactions                   | Not Started             | —          | —         |
| 3 — Snap Messages                          | Not Started             | —          | —         |
| 4 — Snap Streaks                           | Not Started             | —          | —         |
| 5 — Photo Tag Integration                  | Not Started             | —          | —         |

## Requirements Coverage

- Total v1 requirements: 37
- Completed: 4 (INFRA-01, INFRA-02, READ-02, READ-03)
- In progress: 0
- Remaining: 33
- Deferred to v2: 5 (screenshot detection)

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
| 2026-02-23 | Defer screenshot detection to v2         | Avoids native rebuild; iterate on messaging first    |
| 2026-02-23 | readReceipts at conversation level       | Map field on conversation doc, 1 write per open      |
| 2026-02-23 | First-read-only guard in hook layer      | Service always writes; hook checks unreadCount > 0   |
| 2026-02-23 | Foreground-only read receipt writes      | AppState check prevents backgrounded writes          |

## Blockers

None currently.

### Quick Tasks Completed

| #   | Description                                                                     | Date       | Commit  | Directory                                                                                         |
| --- | ------------------------------------------------------------------------------- | ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1   | Fix notification badge persisting on Activity tab when all notifications viewed | 2026-02-23 | d72ed7d | [1-fix-notification-badge-persisting-on-act](./quick/1-fix-notification-badge-persisting-on-act/) |

## Notes

- No new dependencies needed — `expo-screen-capture` deferred to v2 (avoids native rebuild)
- Existing stack covers 100% of v1 requirements
- All v1 changes are JS-only (deployable via OTA update)
- Phase 2 and 3 are independent; Phase 4 depends on Phase 3; Phase 5 depends only on Phase 1

---

Last session: 2026-02-23T19:33:18Z
Stopped at: Completed 01-01-PLAN.md (backend infrastructure for read receipts)
Resume file: .planning/phases/01-message-infrastructure-read-receipts/01-01-SUMMARY.md
