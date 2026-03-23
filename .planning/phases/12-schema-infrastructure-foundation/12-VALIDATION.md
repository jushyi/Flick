---
phase: 12
slug: schema-infrastructure-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (jest-expo preset) |
| **Config file** | `jest.config.js` / `package.json` jest section |
| **Quick run command** | `npm test -- --testPathPattern=supabase` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=supabase`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | INFRA-01 | integration | `supabase db reset && supabase db lint` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | INFRA-01 | unit | `npm test -- --testPathPattern=schema` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | INFRA-02 | integration | `supabase test db` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | INFRA-03 | integration | `npm test -- --testPathPattern=powersync` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | INFRA-04, INFRA-05 | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/` — SQL migration files for schema
- [ ] `supabase/tests/` — pgTAP test stubs for RLS policies
- [ ] `__tests__/supabase/` — Jest test stubs for PowerSync sync rules
- [ ] `supabase` CLI — install if not present (`npx supabase`)

*Supabase CLI and local dev environment must be configured before execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PowerSync offline reads | INFRA-03 | Requires device with airplane mode | 1. Load app, 2. Enable airplane mode, 3. Verify local SQLite reads return cached data |
| Supabase dashboard provisioning | INFRA-01 | External service setup | 1. Log into Supabase dashboard, 2. Verify project exists with correct region, 3. Verify tables match migration |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
