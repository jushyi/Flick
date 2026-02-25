---
phase: 06-tech-debt-darkroom-optimization
plan: 02
subsystem: darkroom, app-lifecycle
tags: [cache, firestore-optimization, darkroom, performance]
---

## What Was Built

Implemented the darkroom reveal cache (TDD GREEN phase) and wired cache invalidation at all required call sites:

1. **darkroomService.js**: Added module-level `_revealCache` with 5-minute freshness window. `isDarkroomReadyToReveal` now skips Firestore when cache shows reveal time hasn't elapsed. Exported `clearRevealCache` for invalidation.
2. **App.js**: `clearRevealCache()` called after `scheduleNextReveal` in foreground AppState handler
3. **useDarkroom.js**: `clearRevealCache()` called after `scheduleNextReveal` in `loadDevelopingPhotos`
4. **uploadQueueService.js**: `clearRevealCache()` called after `ensureDarkroomInitialized` in photo upload path

## Key Decisions

- Switched from `Timestamp.now().seconds` comparison to `Date.now()` + `toMillis()` for consistency with cache timing
- Updated test factories (`createTestDarkroom`, `createReadyDarkroom`) to use `createTimestamp` helper for proper `toMillis()` support
- Added global `Date.now` mock in darkroomService test `beforeEach` to align with the new implementation

## Self-Check: PASSED

- [x] All 21 darkroomService tests pass (GREEN)
- [x] All 16 useDarkroom tests pass
- [x] clearRevealCache imported and called in all 3 call sites
- [x] Full suite: 922 pass, 8 fail (all pre-existing), 9 skipped
- [x] No regressions introduced

## key-files

### modified
- `src/services/firebase/darkroomService.js` — Cache implementation and clearRevealCache export
- `App.js` — clearRevealCache after foreground reveal
- `src/hooks/useDarkroom.js` — clearRevealCache after scheduleNextReveal
- `src/services/uploadQueueService.js` — clearRevealCache after ensureDarkroomInitialized
- `__tests__/services/darkroomService.test.js` — Global Date.now mock, afterEach restoreAllMocks
- `__tests__/hooks/useDarkroom.test.js` — Added clearRevealCache to mock
- `__tests__/integration/photoLifecycle.test.js` — Added clearRevealCache, fixed inline timestamp
- `__tests__/setup/testFactories.js` — Updated darkroom factories to use createTimestamp

## Commits

- `572c8cb` feat(06-02): implement darkroom reveal cache in isDarkroomReadyToReveal
- `e5ee437` feat(06-02): wire clearRevealCache at all invalidation points
