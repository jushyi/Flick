---
phase: 20-typescript-sweep-firebase-removal
plan: 02
subsystem: monitoring
tags: [sentry, performance, crash-reporting, firebase-removal]
dependency_graph:
  requires: [20-01]
  provides: [sentryService, useScreenTrace-sentry]
  affects: [App.js, metro.config.js, app.json]
tech_stack:
  added: ["@sentry/react-native"]
  patterns: ["Sentry spans for performance traces", "navigation integration for screen tracking"]
key_files:
  created:
    - src/services/sentryService.ts
    - src/hooks/useScreenTrace.ts
  modified:
    - App.js
    - metro.config.js
    - app.json
    - package.json
    - __tests__/services/sentryService.test.ts
  deleted:
    - src/hooks/useScreenTrace.js
decisions:
  - "registerNavigationContainer called at module level in App.js (ref is a createRef, stable across renders)"
  - "Sentry DSN placeholder '__DSN__' -- user must replace with actual DSN from Sentry dashboard"
  - "app.json Sentry plugin uses ___ORG___ and ___PROJECT___ placeholders -- user fills in at next native build"
metrics:
  duration: "3m 37s"
  completed: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 9
requirements_completed: [CLEAN-05]
---

# Phase 20 Plan 02: Sentry Integration Summary

Installed @sentry/react-native as the replacement for Firebase Performance Monitoring, with crash reporting, performance traces via Sentry spans, and automatic React Navigation screen tracking.

## What Was Done

### Task 1: Install Sentry and create sentryService.ts
- Installed `@sentry/react-native` via npm with legacy peer deps
- Created `src/services/sentryService.ts` with four exports: `initSentry`, `setSentryUser`, `withTrace`, `navigationIntegration`
- Updated `metro.config.js` to use `getSentryExpoConfig` (preserves PowerSync inline requires blocklist)
- Added `@sentry/react-native/expo` plugin to `app.json` with placeholder org/project
- Wired `initSentry()` at module level in `App.js`, registered navigation container for screen tracking
- Replaced `initPerformanceMonitoring()` import with Sentry equivalents
- Enabled sentryService tests (removed `.skip`) -- all 5 tests pass

### Task 2: Port useScreenTrace to Sentry and clean up performanceService
- Deleted `src/hooks/useScreenTrace.js` (Firebase Performance)
- Created `src/hooks/useScreenTrace.ts` using `Sentry.startInactiveSpan` with `ui.load` operation
- Hook API unchanged (`useScreenTrace(screenName)` returns `{ markLoaded }`) so all 6 consumer screens work without changes
- Confirmed zero `performanceService` or `@react-native-firebase/perf` imports remain in `src/`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 84ec5a70 | Install Sentry SDK and create sentryService.ts |
| 2 | ef40f029 | Port useScreenTrace to Sentry spans and remove Firebase Performance |

## Deviations from Plan

None - plan executed exactly as written.

## User Action Required

Before the next native build, the user must:
1. Create a Sentry account and React Native project at sentry.io
2. Replace `'__DSN__'` in `src/services/sentryService.ts` with the actual Sentry DSN
3. Replace `___ORG___` and `___PROJECT___` in `app.json` Sentry plugin config with actual Sentry org/project names

These are JS-only changes (OTA-updatable) except for the app.json plugin config which requires a native rebuild.

## Known Stubs

- `src/services/sentryService.ts` line 11: DSN set to `'__DSN__'` placeholder -- intentional, user fills in from Sentry dashboard (documented in user_setup)
- `app.json` Sentry plugin: `___ORG___` and `___PROJECT___` placeholders -- intentional, user fills in at build time

## Self-Check: PASSED
