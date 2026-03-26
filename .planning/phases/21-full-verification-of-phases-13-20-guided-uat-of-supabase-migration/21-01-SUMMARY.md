---
phase: 21-full-verification-of-phases-13-20-guided-uat-of-supabase-migration
plan: 01
subsystem: testing
tags: [uat, supabase, migration, stubs, verification]

requires:
  - phase: 20-typescript-sweep-firebase-removal
    provides: Final codebase state with Firebase removed
provides:
  - TODO(20-01) stub catalog with triage (33 stubs across 3 categories)
  - UAT scaffold with 74 test cases covering 7 user journeys + gap sweep
  - npm test baseline (47 suites, 567 passed)
  - Edge Functions inventory and gap analysis
affects: [21-02, 21-03, 21-04]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/21-full-verification-of-phases-13-20-guided-uat-of-supabase-migration/21-TODO-STUBS.md
    - .planning/phases/21-full-verification-of-phases-13-20-guided-uat-of-supabase-migration/21-UAT.md
  modified: []
---

## What Was Built

Prerequisite gate for interactive UAT: ran the automated test suite (all passing), cataloged all 33 TODO stubs remaining from Phase 20's Firebase removal, and created a comprehensive UAT scaffold document with 74 test cases organized into 7 user journeys plus a feature-area gap sweep.

## Key Decisions

1. **Stub triage**: 14 stubs are simple wires (existing Supabase service function exists), 12 need new implementation, 7 are ignorable for UAT (non-critical paths with safe defaults).
2. **Edge Functions gap**: 5 Edge Functions referenced in CLAUDE.md are missing from the local codebase (process-darkroom-reveals, batch-reactions, process-account-deletion, cleanup-expired, dm-metadata). These may have been replaced by pg_cron functions or client-side logic.
3. **UAT scope**: 74 iOS test cases covering onboarding, photo lifecycle, social, messaging, albums, settings, stories, and edge cases. Android and fresh account sections are placeholders for Plans 03 and 04.

## Deviations

None. Plan executed as specified.

## Self-Check: PASSED

- [x] 21-TODO-STUBS.md has 33 stubs with triage categories
- [x] 21-UAT.md has 74 numbered test cases (>= 70 required)
- [x] UAT has "Part A: iOS UAT", "Part B: Android UAT", "Part C: Fresh Account Testing"
- [x] UAT has "Prerequisite Gate Results" with npm test results
- [x] Every test case has expected: and result: pending
- [x] 15 test cases reference TODO(20-01) stubs (>= 5 required)
- [x] UAT has Summary table
- [x] npm test passes (47 suites, 567 tests, 0 failures)
