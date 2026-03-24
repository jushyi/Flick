---
phase: 16
slug: core-services-social-albums
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x with jest-expo preset |
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
| 16-01-01 | 01 | 1 | CORE-04 | unit | `npm test -- friendshipService` | W0 | pending |
| 16-01-02 | 01 | 1 | CORE-04 | unit | `npm test -- friendshipService` | W0 | pending |
| 16-02-01 | 02 | 1 | CORE-05 | unit | `npm test -- commentService` | W0 | pending |
| 16-02-02 | 02 | 1 | CORE-05, CORE-10 | unit | `npm test -- useComments.test.ts useMentionSuggestions.test.ts` | W0 | pending |
| 16-03-01 | 03 | 2 | CORE-06 | unit | `npm test -- albumService` | W0 | pending |
| 16-03-02 | 03 | 2 | CORE-06 | unit | `npm test -- useAlbums.test.ts` | W0 | pending |
| 16-04-01 | 04 | 2 | CORE-08 | unit | `npm test -- blockService reportService` | W0 | pending |
| 16-04-02 | 04 | 2 | CORE-09 | unit | `npm test -- contactSyncService` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/services/friendshipService.test.ts` -- stubs for CORE-04
- [ ] `__tests__/services/commentService.test.ts` -- stubs for CORE-05
- [ ] `__tests__/hooks/useComments.test.ts` -- stubs for CORE-05, CORE-10
- [ ] `__tests__/hooks/useMentionSuggestions.test.ts` -- stubs for CORE-05
- [ ] `__tests__/services/albumService.test.ts` -- stubs for CORE-06
- [ ] `__tests__/hooks/useAlbums.test.ts` -- stubs for CORE-06
- [ ] `__tests__/services/blockService.test.ts` -- stubs for CORE-08
- [ ] `__tests__/services/reportService.test.ts` -- stubs for CORE-08
- [ ] `__tests__/services/contactSyncService.test.ts` -- stubs for CORE-09

*Existing jest infrastructure covers framework needs. Only test stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Realtime friendship updates | CORE-04 | Requires live Supabase connection | Send friend request from second account, verify list updates without refresh |
| @mention autocomplete UI | CORE-05 | Visual interaction | Type @ in comment, verify dropdown appears with friend names |
| Album cover photo display | CORE-06 | Visual rendering | Create album, verify cover photo renders correctly |
| Blocked user disappears from feed | CORE-08 | End-to-end flow | Block user, navigate to feed, verify their photos are hidden |
| Contact sync matching | CORE-09 | Requires real contacts access | Allow contacts, verify matched friends appear in suggestions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
