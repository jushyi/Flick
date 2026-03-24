---
phase: 20
slug: typescript-sweep-firebase-removal
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 20-01-01 | 01 | 1 | TS-01 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 20-01-02 | 01 | 1 | TS-02 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 20-02-01 | 02 | 1 | CLEAN-01 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 1 | CLEAN-02 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 2 | CLEAN-03 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 20-03-02 | 03 | 2 | CLEAN-04 | grep | `grep -r "@react-native-firebase" src/` | N/A | ⬜ pending |
| 20-04-01 | 04 | 2 | CLEAN-05 | unit | `npm test -- --testPathPattern sentry` | ❌ W0 | ⬜ pending |
| 20-05-01 | 05 | 3 | TS-03, TS-04 | integration | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Jest setup updated with Supabase mocks replacing Firebase mocks
- [ ] `@sentry/react-native` mock added to jest.setup
- [ ] Existing test suite passes with updated mocks before any conversion begins

*Existing jest infrastructure covers most needs; Wave 0 focuses on mock replacement.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EAS build succeeds after Firebase removal | CLEAN-03 | Requires native build via EAS | Run `eas build --platform ios --profile preview` and verify success |
| Sentry events appear in dashboard | CLEAN-05 | Requires Sentry project + real device | Trigger a test error, verify it appears in Sentry dashboard |
| Full migration test against dev Firebase data | TS-04 | Requires live Firebase + Supabase | Run migration script, verify all data migrated correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
