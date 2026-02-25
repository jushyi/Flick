---
phase: 06-tech-debt-darkroom-optimization
plan: 01
subsystem: testing, darkroom
tags: [jest, tdd, darkroom, cache]
---

## What Was Built

TDD RED phase for darkroom reveal cache: wrote 5 failing tests that capture the cache contract for `isDarkroomReadyToReveal` before implementation exists.

## Key Decisions

- Extended `createMockTimestamp` helper with `toMillis()` method to match the cache implementation's expected API
- Used `jest.spyOn(Date, 'now')` to control cache timing in tests
- Tests verify cache hit (skip Firestore), cache miss (first call), cache stale (>5 min), cached time elapsed, and cache invalidation via `clearRevealCache`

## Self-Check: PASSED

- [x] 16 existing tests pass
- [x] 5 new cache tests fail with `clearRevealCache is not a function` (expected RED)
- [x] No syntax errors in test file
- [x] `createMockTimestamp` includes `toMillis` method

## key-files

### modified
- `__tests__/services/darkroomService.test.js` — Added cache behavior describe blocks and clearRevealCache tests

## Commits

- `f66803e` test(06-01): add failing darkroom cache behavior tests (TDD RED)
