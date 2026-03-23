---
phase: 14
slug: data-layer-caching-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern="__tests__/(lib\|hooks)" --no-coverage` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern="__tests__/(lib|hooks)" --no-coverage`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | PERF-01, PERF-08 | unit | `npx jest --testPathPattern="queryClient" --no-coverage` | W0 (created in 14-02) | pending |
| 14-01-02 | 01 | 1 | PERF-09 | unit | `npx jest --testPathPattern="(powersync\|supabaseConnector)" --no-coverage` | W0 (created in 14-02) | pending |
| 14-02-01 | 02 | 2 | PERF-01, PERF-08, PERF-09 | unit | `npx jest --testPathPattern="__tests__/(lib\|hooks)" --no-coverage` | created in this task | pending |
| 14-02-02 | 02 | 2 | PERF-01 | unit | `npx jest --testPathPattern="useProfile" --no-coverage` | created in this task | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/lib/queryClient.test.ts` — TanStack Query client config + AsyncStorage persister tests
- [ ] `__tests__/lib/queryKeys.test.ts` — Query key factory tests
- [ ] `__tests__/lib/powersync.test.ts` — PowerSync schema tests
- [ ] `__tests__/lib/supabaseConnector.test.ts` — SupabaseConnector CRUD + error handling tests
- [ ] `__tests__/hooks/useProfile.test.ts` — useProfile PoC hook integration tests

*All test files are created in Plan 14-02 Task 2. Existing jest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cold start shows cached data | PERF-08 | Requires full app restart on device | 1. Open app, navigate feed 2. Kill app completely 3. Relaunch — feed should show cached photos before spinner |
| PowerSync instant reads | PERF-09 | Requires local SQLite populated state | 1. Navigate to feed 2. Switch to profile 3. Switch back — data appears without loading state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
