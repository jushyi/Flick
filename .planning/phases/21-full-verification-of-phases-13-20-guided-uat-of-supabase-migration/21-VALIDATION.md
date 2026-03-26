---
phase: 21
slug: full-verification-of-phases-13-20-guided-uat-of-supabase-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x with jest-expo preset |
| **Config file** | jest.config.js |
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
| 21-01-01 | 01 | 1 | D-01 | manual+auto | `npm test -- --bail` | ✅ | ⬜ pending |
| 21-02-01 | 02 | 1 | D-04 | manual | Device UAT walkthrough | N/A | ⬜ pending |
| 21-03-01 | 03 | 2 | D-04 | manual | Device UAT walkthrough | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Jest + jest-expo already configured. Manual UAT is the primary verification method for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auth OTP flow | D-04 | Requires real device + SMS delivery | Enter phone, receive OTP, verify, check session |
| Camera capture + darkroom reveal | D-04 | Requires device camera | Take photo, wait for reveal timer, verify in darkroom |
| Push notifications | D-04 | Requires real push token + device | Trigger notification event, verify delivery |
| Feed real-time updates | D-04 | Requires Supabase Realtime subscription | Post photo, verify friend sees it in feed |
| Messaging send/receive | D-04 | Requires two accounts + real-time | Send message, verify delivery and subscription |
| Album creation + photo management | D-04 | Requires photo data + UI interaction | Create album, add photos, verify persistence |
| Stories navigation | D-04 | Requires gesture interaction | Swipe between friends' stories, verify transitions |
| Account deletion + recovery | D-04 | Requires auth state management | Schedule deletion, verify countdown, cancel, verify recovery |

*This phase is primarily manual UAT — automated tests serve as a prerequisite gate, not the primary verification method.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
