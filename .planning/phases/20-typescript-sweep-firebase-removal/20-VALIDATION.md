---
phase: 20
slug: typescript-sweep-firebase-removal
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-24
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x with jest-expo preset |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --bail --changedSince=HEAD~1` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail --changedSince=HEAD~1`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-07-01 | 07 | 0 | CLEAN-05 | unit | `npm test -- --bail` | jest.setup.ts | pending |
| 20-07-02 | 07 | 0 | CLEAN-05 | unit | `npm test -- --testPathPattern sentryService` | sentryService.test.ts | pending |
| 20-01-01 | 01 | 1 | CLEAN-03 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-01-02 | 01 | 1 | TS-01 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-02-01 | 02 | 2 | CLEAN-05 | unit | `npm test -- --testPathPattern sentryService --bail` | sentryService.test.ts | pending |
| 20-02-02 | 02 | 2 | CLEAN-05 | unit | `npm test -- --bail` | N/A | pending |
| 20-03-01 | 03 | 2 | TS-01 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-03-02 | 03 | 2 | TS-02 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-03-03 | 03 | 2 | TS-03 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-04-01 | 04 | 2 | TS-02 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-04-02 | 04 | 2 | TS-02 | type-check | `npx tsc --noEmit` | N/A | pending |
| 20-05-01 | 05 | 3 | TS-03 | build | `npx tsc --noEmit` | N/A | pending |
| 20-05-02 | 05 | 3 | TS-03 | build | `npx tsc --noEmit` | N/A | pending |
| 20-05-03 | 05 | 3 | TS-03 | build | `npx tsc --noEmit` | N/A | pending |
| 20-08-01 | 08 | 4 | TS-04 | script | `test -f scripts/reset-dev-supabase.ts` | reset-dev-supabase.ts | pending |
| 20-08-02 | 08 | 4 | TS-04 | script | `test -f scripts/validate-migration.ts` | validate-migration.ts | pending |
| 20-08-03 | 08 | 4 | TS-04 | manual | Human runs migration validation | N/A | pending |
| 20-06-01 | 06 | 5 | CLEAN-01 | build | `npx tsc --noEmit && echo PASS || echo FAIL` | N/A | pending |
| 20-06-02 | 06 | 5 | CLEAN-04 | grep | `grep -r "@react-native-firebase" src/` | N/A | pending |
| 20-06-03 | 06 | 5 | CLEAN-01 | manual | EAS build verification | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] Plan 07 creates jest.setup.ts with Supabase mocks replacing Firebase mocks
- [x] Plan 07 adds `@sentry/react-native` mock to jest.setup
- [x] Plan 07 creates sentryService.test.ts scaffold
- [x] Existing test suite passes with updated mocks before any conversion begins

*Wave 0 is Plan 07 (wave: 0, depends_on: []).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EAS build succeeds after Firebase removal | CLEAN-01 | Requires native build via EAS | Run `eas build --platform ios --profile preview` and verify success |
| Sentry events appear in dashboard | CLEAN-05 | Requires Sentry project + real device | Trigger a test error, verify it appears in Sentry dashboard |
| Full migration test against dev Firebase data | TS-04 | Requires live Firebase + Supabase | Run migration script, verify all data migrated correctly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 07)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
