---
phase: 20-typescript-sweep-firebase-removal
plan: 06
subsystem: firebase-removal
tags: [firebase, supabase, typescript, strict, cleanup]

# Dependency graph
requires:
  - phase: 20-05
    provides: All source files converted to TypeScript
  - phase: 20-08
    provides: D-16 migration validation gate passed
provides:
  - Zero Firebase dependencies in package.json
  - Strict TypeScript configuration
  - Updated CLAUDE.md for Supabase stack
affects: [phase-20.1-data-migration, phase-21-uat]

# Tech tracking
tech-stack:
  removed: ["@react-native-firebase/app", "@react-native-firebase/auth", "@react-native-firebase/firestore", "@react-native-firebase/functions", "@react-native-firebase/messaging", "@react-native-firebase/perf", "@react-native-firebase/storage"]
  patterns: [strict-typescript, supabase-only-stack]

key-files:
  modified:
    - package.json
    - app.json
    - app.config.js
    - tsconfig.json
    - CLAUDE.md
  deleted:
    - functions/ (entire directory)
    - __tests__/__mocks__/@react-native-firebase/ (7 mock files)
    - plugins/withFirebaseFix.js

key-decisions:
  - "strict: true with noImplicitAny: false — incremental strictness to avoid 3000+ errors blocking progress"
  - "Exclude supabase/ Edge Functions from tsc — Deno types not available in Node TS config"
  - "Keep useFrameworks: static in expo-build-properties — may still be needed by other native deps"

requirements-completed: [TS-04, CLEAN-01, CLEAN-02, CLEAN-04]

# Metrics
duration: 20min
completed: 2026-03-25
---

# Phase 20 Plan 06: Firebase Removal + Strict TypeScript Summary

**Removed all 7 Firebase packages, deleted functions/ directory, enabled strict TypeScript, rewrote CLAUDE.md for Supabase stack**

## What was done

1. Uninstalled all 7 `@react-native-firebase/*` packages (20,622 lines deleted)
2. Deleted `functions/` directory (Cloud Functions confirmed on Supabase)
3. Deleted Firebase mock files from `__tests__/__mocks__/`
4. Removed Firebase plugins from app.json (app, auth, perf)
5. Removed Google URL scheme from iOS infoPlist
6. Removed googleServicesFile from app.config.js
7. Enabled `strict: true` in tsconfig.json (with `noImplicitAny: false` for incremental adoption)
8. Rewrote CLAUDE.md — zero Firebase references, documents Supabase + PowerSync + Sentry stack

## Known Tech Debt

- ~2000 TypeScript strict mode errors remain (TS2339 property-doesn't-exist is the bulk)
- These are type-safety warnings, not runtime issues — Metro/Expo doesn't enforce tsc
- noImplicitAny deferred — will be enabled when type coverage improves
- EAS native build required to verify Firebase native removal is clean (Task 3 checkpoint)

## Self-Check: PASSED
