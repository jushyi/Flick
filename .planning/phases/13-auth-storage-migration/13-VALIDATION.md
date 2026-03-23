---
phase: 13
slug: auth-storage-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x with `jest-expo` preset |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern="services/(phoneAuth\|storage\|signedUrl\|uploadQueue)" --no-coverage -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="services/(phoneAuth\|storage\|signedUrl\|uploadQueue)" --no-coverage -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | AUTH-01 | unit | `npm test -- __tests__/services/phoneAuthService.test.js -x` | Exists (rewrite needed) | ⬜ pending |
| 13-01-02 | 01 | 1 | AUTH-02 | integration | `npm test -- __tests__/integration/authMigration.test.js -x` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | AUTH-03 | unit | `npm test -- __tests__/services/accountService.test.js -x` | Exists (rewrite needed) | ⬜ pending |
| 13-02-01 | 02 | 2 | STOR-01 | unit | `npm test -- __tests__/services/storageService.test.js -x` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | STOR-02 | unit | `npm test -- __tests__/services/signedUrlService.test.js -x` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 2 | STOR-03 | unit | `npm test -- __tests__/services/uploadQueueService.test.js -x` | Exists (rewrite needed) | ⬜ pending |
| 13-03-01 | 03 | 3 | STOR-04 | manual-only | N/A (run against dev Supabase project) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/services/phoneAuthService.test.js` — rewrite mocks from Firebase to Supabase (`jest.mock('@supabase/supabase-js')`)
- [ ] `__tests__/services/storageService.test.js` — new file for Supabase Storage operations
- [ ] `__tests__/services/signedUrlService.test.js` — new simplified tests (public URL + snap signed URL)
- [ ] `__tests__/services/uploadQueueService.test.js` — rewrite to mock PowerSync local table + Supabase Storage
- [ ] `__tests__/integration/authMigration.test.js` — new file testing the silent migration flow
- [ ] `jest.config.js` — update `testMatch` to include `.test.ts` files: `['**/__tests__/**/*.test.{js,ts}']`
- [ ] `jest.config.js` — update `collectCoverageFrom` to include `.ts/.tsx`: `['src/**/*.{js,jsx,ts,tsx}']`
- [ ] Supabase client mock setup in `__tests__/setup/jest.setup.js`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration script transfers all files from Firebase Storage to Supabase Storage | STOR-04 | Requires live Firebase + Supabase projects with real data | Run migration script against dev Supabase project, verify file counts match, spot-check URLs resolve |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
