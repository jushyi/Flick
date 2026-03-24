---
phase: 17
slug: messaging-social
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | MSG-01 | unit | `npm test -- conversationService` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | MSG-02 | unit | `npm test -- messageService` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | MSG-03 | unit | `npm test -- snapService` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 2 | MSG-04 | unit | `npm test -- streakService` | ❌ W0 | ⬜ pending |
| 17-04-01 | 04 | 2 | MSG-05, MSG-06 | unit | `npm test -- useConversation` | ❌ W0 | ⬜ pending |
| 17-05-01 | 05 | 3 | MSG-07, MSG-08, MSG-09 | unit | `npm test -- reactions` | ❌ W0 | ⬜ pending |
| 17-06-01 | 06 | 3 | MSG-10, MSG-11 | unit | `npm test -- messageActions` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for all MSG-01 through MSG-11 requirement coverage
- [ ] Supabase client mocks (matching existing mock patterns in jest.setup.js)
- [ ] PowerSync mock fixtures for conversation sync tests

*Existing jest infrastructure covers framework setup; Wave 0 adds phase-specific stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snap Polaroid viewer | MSG-03 | Visual view-once UX | Send snap → open → verify Polaroid animation plays → verify snap disappears after viewing |
| Streak badge colors | MSG-04 | Visual color tiers | Build streak to each tier → verify correct color renders on conversation list |
| Swipe-to-reply gesture | MSG-09 | Gesture interaction | Swipe message left → verify reply compose opens with quoted message |
| Real-time message delivery | MSG-02 | End-to-end timing | Send message from device A → verify appears on device B within 2 seconds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
