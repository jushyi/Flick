---
phase: 18
slug: background-jobs-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest with jest-expo preset |
| **Config file** | `package.json` jest config section |
| **Quick run command** | `npm test -- --testPathPattern="phase18" --no-coverage` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Verify migration applies cleanly; check SQL function exists
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | JOBS-01 | integration (SQL) | Manual: apply migration, verify via SQL queries | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | JOBS-02 | integration (SQL) | Manual: apply migration, verify via SQL queries | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | JOBS-06 | unit | `npm test -- --testPathPattern="sendPushNotification"` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 1 | JOBS-03 | integration | `supabase functions serve` + curl test | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 1 | JOBS-04 | unit (SQL) | Manual: apply migration, verify DELETE query | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 2 | JOBS-07 | integration | Manual: insert pending, run drain, verify | ❌ W0 | ⬜ pending |
| 18-05-01 | 05 | 2 | JOBS-09 | unit (SQL) | Manual: apply migration, test trigger | ❌ W0 | ⬜ pending |
| 18-05-02 | 05 | 2 | JOBS-05 | integration (SQL + Edge) | Manual: multi-step verification | ❌ W0 | ⬜ pending |
| 18-06-01 | 06 | 2 | JOBS-08 | unit (SQL) | Manual: verify trigger exists (Phase 16) | ✅ Existing | ⬜ pending |
| 18-06-02 | 06 | 2 | JOBS-10 | integration | Manual: apply migration, verify | ❌ W0 | ⬜ pending |
| 18-07-01 | 07 | 3 | LIVE-01 | unit | `npm test -- --testPathPattern="liveActivity"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SQL function tests: verification queries for each pg_cron function
- [ ] Edge Function mock tests: Jest tests for notification template logic
- [ ] Migration verification: script to check all cron jobs are registered in `cron.job`

*Existing infrastructure covers JOBS-08 (friend count triggers from Phase 16).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Darkroom reveals process on schedule | JOBS-01 | Requires pg_cron running in Supabase | Apply migration, wait for cron cycle, verify photos.status changed |
| Streak expiry with 4h warning push | JOBS-02 | Requires pg_cron + live push delivery | Insert test streak near expiry, wait for cron, check push receipt |
| Push notifications for all event types | JOBS-06 | Requires deployed Edge Function + Expo | Deploy function, trigger each event type, verify push delivery |
| Account deletion cascade | JOBS-05 | Multi-step: SQL cascade + Edge Function cleanup | Schedule deletion, run cron, verify all related data removed |
| Live Activity APNS from background | LIVE-01 | Requires physical device + TestFlight | Deploy Edge Function, kill app, trigger pinned snap, verify LA appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
