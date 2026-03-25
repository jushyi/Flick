---
phase: 20-typescript-sweep-firebase-removal
plan: 08
subsystem: migration-validation
tags: [migration, validation, firebase, supabase, scripts]

# Dependency graph
requires:
  - phase: 20-05
    provides: All source files converted to TypeScript
provides:
  - Dev Supabase reset script for repeatable migration testing
  - Migration validation script (24 checks across data integrity, service ops, zero-Firebase)
affects: [phase-20.1-data-migration, phase-21-uat]

# Tech tracking
tech-stack:
  added: [firebase-admin]
  patterns: [migration-validation-gate, repeatable-reset-cycle]

key-files:
  created:
    - scripts/reset-dev-supabase.ts
    - scripts/validate-migration.ts
  modified:
    - scripts/migrate-firebase-storage.ts

key-decisions:
  - "SQL-based migration re-apply instead of Supabase CLI (Device Guard blocks CLI executable)"
  - "Node.js fs scanning instead of grep for Windows compatibility in validation"
  - "EXPO_PUBLIC_SUPABASE_URL fallback in all scripts for env var naming consistency"
  - "Delete .migration-progress.json during reset for clean re-runs"
  - "image_url column (not photo_url) matches actual Supabase schema"
  - "Junction tables use select('*') not select('id') — composite primary keys"

patterns-established:
  - "Reset → Migrate → Validate cycle for repeatable migration testing"
  - "Progress file cleanup in reset script prevents stale resume state"

requirements-completed: [TS-04]

# Metrics
duration: 45min
completed: 2026-03-25
---

# Phase 20 Plan 08: Migration Validation Summary

**Dev Supabase reset script + migration validation script + D-16 human checkpoint gate — validated with 24/24 checks passing**

## What was built

1. **`scripts/reset-dev-supabase.ts`** — Wipes dev Supabase to clean state (auth users, 21 tables, 5 storage buckets, migration progress files). Safety check blocks execution against production URLs. Uses SQL via REST API instead of blocked Supabase CLI.

2. **`scripts/validate-migration.ts`** — 24-check validation across 3 categories:
   - Data integrity: row counts, photo URLs, friendship constraints, orphaned records
   - Service operations: auth, storage, all 19 tables queryable, RPCs callable
   - Zero Firebase fallbacks: scans all .ts/.tsx files for any Firebase imports

3. **`scripts/migrate-firebase-storage.ts`** — Fixed env var loading and SUPABASE_URL fallback.

## D-16 Gate Result

Human verified: Reset → Migrate → Validate cycle completed successfully. 24/24 checks passed. Zero Firebase imports remain in src/.

## Deviations

1. Supabase CLI blocked by Device Guard — replaced with SQL-based migration re-apply via REST API
2. grep commands fail on Windows — replaced with Node.js fs recursive file scanning
3. Schema mismatches found and fixed: `photo_url` → `image_url`, junction tables without `id` column, 2 non-existent tables removed
4. Gap discovered: No Firestore data migration script exists — Phase 20.1 inserted as urgent

## Self-Check: PASSED
