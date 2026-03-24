---
phase: 15
slug: core-services-photos-feed-darkroom
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 15 — Validation Strategy

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
| 15-01-01 | 01 | 1 | CORE-01 | unit | `npm test -- photoService` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | CORE-01 | unit | `npm test -- darkroomService` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | CORE-02 | unit | `npm test -- feedService` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 1 | CORE-03 | unit | `npm test -- userProfileService` | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 2 | CORE-07 | integration | `npm test -- useDarkroom` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for photoService, darkroomService, feedService, userProfileService
- [ ] Shared fixtures for Supabase/PowerSync mock setup
- [ ] Mock factories for photo, user, friendship test data

*Existing jest infrastructure covers framework; service-specific test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture → darkroom flow | CORE-01 | Requires device camera | Open app → capture photo → verify appears in darkroom as "developing" |
| Photo reveal notification | CORE-01 | Requires push notification delivery | Wait for reveal timer → verify push notification received |
| Feed photo rendering | CORE-02 | Visual verification | Open feed → verify friend photos display correctly with proper layout |
| Profile photo upload | CORE-03 | Requires Supabase Storage + device | Edit profile → change photo → verify upload and display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
