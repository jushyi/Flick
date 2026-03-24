---
phase: 17
slug: messaging-social
status: draft
nyquist_compliant: true
created: 2026-03-24
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --bail --findRelatedTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail --findRelatedTests`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 17-01-01 | 01 | 1 | MSG-01 | structural | `grep -c "message_deletions\|last_read_at" supabase/migrations/20260324000001_*.sql` | pending |
| 17-01-02 | 01 | 1 | MSG-04, MSG-05 | structural | `grep -c "CREATE TRIGGER" supabase/migrations/20260324000002_*.sql` | pending |
| 17-01-03 | 01 | 1 | MSG-05 | structural | `grep -c "storage_path" supabase/functions/snap-cleanup/index.ts` | pending |
| 17-02-01 | 02 | 2 | MSG-01, MSG-02 | unit | `npx jest --testPathPattern="messageService" --passWithNoTests` | pending |
| 17-02-02 | 02 | 2 | MSG-01, MSG-02 | unit | `npx jest --testPathPattern="messageService" --passWithNoTests` | pending |
| 17-03-01 | 03 | 2 | MSG-04 | unit | `npx jest --testPathPattern="snapService\|streakService" --passWithNoTests` | pending |
| 17-03-02 | 03 | 2 | MSG-04 | unit | `npx jest --testPathPattern="snapService\|streakService" --passWithNoTests` | pending |
| 17-04-01 | 04 | 3 | MSG-06 | structural | `grep -c "useInfiniteQuery\|usePowerSync" src/hooks/useConversation.ts src/hooks/useMessages.ts` | pending |
| 17-04-02 | 04 | 3 | MSG-06 | structural | `grep -c "useInfiniteQuery\|supabase.channel" src/hooks/useConversation.ts` | pending |
| 17-05-01 | 05 | 4 | MSG-10, MSG-11 | structural | `grep -c "useMessages\|useConversation" src/screens/MessagesListScreen.js src/screens/ConversationScreen.js` | pending |
| 17-05-02 | 05 | 4 | MSG-03 | structural | `grep -c "uploadAndSendSnap\|getOrCreateConversation" src/screens/CameraScreen.js src/screens/NewMessageScreen.js` | pending |
| 17-05-03 | 05 | 4 | MSG-10, MSG-11 | manual | Human verification of full messaging flow | pending |

*Status: pending / green / red / flaky*

---

## Nyquist Compliance Note

Plans 02 and 03 create tests within the same plan as implementation. This is acceptable because:
- Tests are created as dedicated tasks (Task 2 in each plan) after implementation (Task 1)
- Each plan's `<verify>` commands use structural greps or Jest runs that validate both implementation and tests
- No separate Wave 0 is needed since test infrastructure (jest.setup.js, mock patterns) already exists from prior phases

Plan 01 tasks are SQL migrations and Edge Functions verified via structural grep (no unit tests applicable).
Plans 04 and 05 tasks are hook/screen wiring verified via structural grep for correct imports.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snap Polaroid viewer | MSG-03 | Visual view-once UX | Send snap -> open -> verify Polaroid animation plays -> verify snap disappears after viewing |
| Streak badge colors | MSG-04 | Visual color tiers | Build streak to each tier -> verify correct color renders on conversation list |
| Swipe-to-reply gesture | MSG-09 | Gesture interaction | Swipe message left -> verify reply compose opens with quoted message |
| Real-time message delivery | MSG-02 | End-to-end timing | Send message from device A -> verify appears on device B within 2 seconds |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (structural greps or Jest runs)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Test creation co-located with implementation in Plans 02 and 03
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
