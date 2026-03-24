---
phase: 15
slug: core-services-photos-feed-darkroom
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-24
---

# Phase 15 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | `jest.config.js` / `package.json` jest section |
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
| 15-01-01 | 01 | 1 | CORE-01 | unit | `npx tsc --noEmit src/services/supabase/photoService.ts` | N/A (type check) | pending |
| 15-01-02 | 01 | 1 | CORE-03 | unit | `npx tsc --noEmit src/services/supabase/darkroomService.ts` | N/A (type check) | pending |
| 15-01-03 | 01 | 1 | CORE-01, CORE-03 | unit | `npm test -- photoService darkroomService` | Wave 1 (tdd task) | pending |
| 15-02-01 | 02 | 1 | CORE-02, CORE-07 | unit | `npx tsc --noEmit src/services/supabase/feedService.ts src/services/supabase/profileService.ts` | N/A (type check) | pending |
| 15-02-02 | 02 | 1 | CORE-02, CORE-07 | unit | `npm test -- feedService profileService` | Wave 1 (tdd task) | pending |
| 15-03-01 | 03 | 2 | CORE-01, CORE-03 | unit | `npm test -- useDarkroom` | Wave 2 | pending |
| 15-03-02 | 03 | 2 | CORE-02 | unit | `npm test -- useFeedPhotos` | Wave 2 | pending |
| 15-04-01 | 04 | 3 | CORE-01, CORE-02, CORE-03 | integration | manual (screen wiring) | N/A | pending |
| 15-04-02 | 04 | 3 | CORE-01, CORE-02, CORE-03 | manual | human verify checkpoint | N/A | pending |

*Status: pending / green / red / flaky*

---

## Nyquist Compliance

Plans 01 and 02 use `tdd="true"` on their test tasks, which means tests are written first (RED) then implementation is verified (GREEN). This satisfies the Nyquist sampling requirement:
- Tests are co-located with implementation in the same plan (not a separate Wave 0)
- The `tdd="true"` directive ensures test-first execution order
- Every service function has a corresponding test case in the `<behavior>` block

Plan 03 creates hook tests alongside hook implementations.
Plan 04 uses manual verification (human checkpoint) since screen wiring is integration-level.

---

## Wave 0 Requirements

Test files are created within Plans 01-02 (tdd tasks), not in a separate Wave 0 plan:
- [x] `__tests__/services/photoService.test.ts` -- Plan 01, Task 3 (tdd)
- [x] `__tests__/services/darkroomService.test.ts` -- Plan 01, Task 3 (tdd)
- [x] `__tests__/services/feedService.test.ts` -- Plan 02, Task 2 (tdd)
- [x] `__tests__/services/profileService.test.ts` -- Plan 02, Task 2 (tdd)
- [x] `__tests__/setup/powersync.mock.ts` -- Plan 01, Task 1
- [x] Supabase mock: extends existing `__supabaseMocks` pattern

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture -> darkroom flow | CORE-01 | Requires device camera | Open app -> capture photo -> verify appears in darkroom as "developing" |
| Photo reveal animation | CORE-03 | Visual/timing verification | Wait for reveal timer -> verify batch reveal with animation |
| Feed photo rendering | CORE-02 | Visual verification | Open feed -> verify friend photos display correctly with stories grouping |
| Profile photo upload | CORE-07 | Requires Supabase Storage + device | Edit profile -> change photo -> verify upload and display |
| Foreground reveal trigger | CORE-03 | Requires app backgrounding | Background app -> wait -> foreground -> verify reveals fire |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or manual checkpoint
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Test creation handled by tdd tasks within Plans 01-02
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
