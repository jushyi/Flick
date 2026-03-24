---
phase: 19
slug: performance-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest with jest-expo preset |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | PERF-03 | unit | `npm test -- __tests__/components/skeletons/ --bail` | W0 | pending |
| 19-01-02 | 01 | 1 | PERF-03 | unit | `npm test -- __tests__/components/skeletons/ --bail` | W0 | pending |
| 19-02-01 | 02 | 1 | PERF-05, PERF-06 | unit | `npm test -- __tests__/utils/imageUrl.test.ts --bail` | W0 | pending |
| 19-02-02 | 02 | 1 | PERF-07 | unit | `npm test -- __tests__/components/EmptyState.test.tsx --bail` | W0 | pending |
| 19-03-01 | 03 | 2 | PERF-04 | unit | `npm test -- __tests__/hooks/useOptimisticMutation.test.ts --bail` | W0 | pending |
| 19-03-02 | 03 | 2 | PERF-02 | unit | `npm test -- __tests__/hooks/useFeedPhotos.test.ts --bail` | Exists | pending |
| 19-04-01 | 04 | 3 | PERF-03, PERF-07 | unit | `npm test -- --bail` | Exists | pending |
| 19-04-02 | 04 | 3 | PERF-10, PERF-11 | unit | `npm test -- __tests__/hooks/useFeedPhotos.test.ts --bail` | Exists | pending |
| 19-04-03 | 04 | 3 | PERF-03 | manual | checkpoint:human-verify | N/A | pending |
| 19-05-01 | 05 | 3 | PERF-04 | unit | `npm test -- --bail` | Exists | pending |
| 19-05-02 | 05 | 3 | PERF-05 | unit | `npm test -- --bail` | Exists | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/components/skeletons/` — directory for skeleton render tests (PERF-03)
- [ ] `__tests__/utils/imageUrl.test.ts` — covers PERF-05, PERF-06 (URL transforms, expiry parsing)
- [ ] `__tests__/components/EmptyState.test.tsx` — covers PERF-07
- [ ] `__tests__/hooks/useOptimisticMutation.test.ts` — covers PERF-04 (optimistic update rollback)
- [ ] Update existing `useFeedPhotos.test.ts` for prefetch assertions (PERF-10, PERF-11)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton shimmer animation smooth at 60fps | PERF-03 | Visual quality requires human eyes + device | Open each screen with slow network, confirm smooth shimmer |
| Cached data renders in <100ms | PERF-02 | Timing sensitive, requires real device | Kill app, reopen, measure time to first content |
| No expired URL flash on snaps | PERF-05 | Race condition timing on real device | Open snap conversation, wait 5 minutes, reopen — no flash |
| Empty states match pixel art aesthetic | PERF-07 | Visual design quality | Review each empty state on device, confirm style consistency |
| Toast appears on optimistic failure | PERF-04 | Requires network error simulation | Toggle airplane mode mid-action, confirm toast + rollback |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
