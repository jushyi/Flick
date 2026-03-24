---
phase: 17-messaging-social
plan: 03
subsystem: services
tags: [supabase, storage, snaps, streaks, webp, typescript, unit-tests]

requires:
  - phase: 17-messaging-social-01
    provides: PostgreSQL triggers for streak upsert and snap cleanup chain
  - phase: 17-messaging-social-02
    provides: messageService.sendMessage for snap message creation
provides:
  - snapService.ts with uploadAndSendSnap, markSnapViewed, getSignedSnapUrl
  - streakService.ts with generateStreakId, deriveStreakState, getStreakColor
  - Unit tests for both services (36 tests total)
affects: [17-04, 17-05, 18-notifications]

tech-stack:
  added: []
  patterns: [proxy mock pattern for jest.mock scope rules, inline streak color palette]

key-files:
  created:
    - src/services/supabase/snapService.ts
    - src/services/supabase/streakService.ts
    - __tests__/services/snapService.test.ts
    - __tests__/services/streakService.test.ts
  modified:
    - jest.config.js

key-decisions:
  - "Inline STREAK_COLORS palette in streakService since colors.streak not defined in design system"
  - "Proxy mock pattern (arrow functions delegating to mockFn) to survive jest clearMocks between tests"
  - "Stub messageService.ts and supabase.ts for parallel plan execution (overwritten by Plan 02 merge)"

patterns-established:
  - "Proxy mock pattern: jest.mock factory uses arrow functions calling outer mock vars for clearMocks resilience"
  - "Pure function service: streakService has zero Supabase imports, reads from PowerSync local SQLite"

requirements-completed: [MSG-04, MSG-05]

duration: 7min
completed: 2026-03-24
---

# Phase 17 Plan 03: Snap & Streak Services Summary

**Snap upload with WebP compression and 3-retry backoff, plus pure TypeScript streak state derivation with 5 states and 3 active tier colors**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T20:15:39Z
- **Completed:** 2026-03-24T20:23:13Z
- **Tasks:** 2
- **Files created:** 4 (2 services + 2 test files)
- **Files modified:** 1 (jest.config.js)

## What Was Built

### Task 1: snapService.ts and streakService.ts

**snapService.ts** (175 lines) -- Snap lifecycle operations for Supabase:
- `uploadAndSendSnap`: Compresses to WebP 0.9 at 1080px, uploads to private snaps bucket, sends snap message via messageService, updates message with snap_storage_path. Retries up to 3 times with exponential backoff (1s, 2s, 4s).
- `markSnapViewed`: Sets snap_viewed_at timestamp which triggers PostgreSQL cleanup chain (Plan 01 trigger -> pg_net -> Edge Function).
- `getSignedSnapUrl`: Client-side 5-minute signed URL generation from Supabase Storage (no Edge Function needed).

**streakService.ts** (120 lines) -- Pure TypeScript functions for client-side streak state:
- `generateStreakId`: Deterministic pair key from sorted user IDs.
- `deriveStreakState`: 5-state machine (default, building, pending, active, warning) derived from StreakData read via PowerSync.
- `getStreakColor`: 3-tier active color mapping (3-9 days, 10-49 days, 50+ days) plus warning/pending/building/default colors.

### Task 2: Unit Tests

**snapService.test.ts** (11 tests):
- WebP compression at 1080px width verified
- Snaps bucket upload with correct content-type and no-cache
- sendMessage integration with type='snap' and caption truncation
- snap_storage_path update after message creation
- Retry with exponential backoff on failure
- Throws after all 3 retries exhausted
- markSnapViewed updates snap_viewed_at
- getSignedSnapUrl with 300-second expiry

**streakService.test.ts** (25 tests):
- generateStreakId sorting and idempotency
- All 5 deriveStreakState states with various input combinations
- User1 vs User2 perspective handling
- Warning priority over active state
- All 3 active tier colors at exact boundaries
- All non-active state colors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub files for parallel execution**
- **Found during:** Task 2
- **Issue:** messageService.ts and supabase.ts don't exist in this worktree (created by Plan 02 and Phase 12)
- **Fix:** Created minimal stub files to satisfy imports and allow tests to run
- **Files created:** src/services/supabase/messageService.ts (stub), src/lib/supabase.ts (stub)
- **Commit:** 8a44d7a9

**2. [Rule 3 - Blocking] Updated jest.config.js for TypeScript test files**
- **Found during:** Task 2
- **Issue:** testMatch only matched `.test.js`, not `.test.ts`
- **Fix:** Changed testMatch to `['**/__tests__/**/*.test.{js,ts,tsx}']` and added `@supabase/supabase-js` to transformIgnorePatterns
- **Files modified:** jest.config.js
- **Commit:** 8a44d7a9

**3. [Rule 1 - Bug] Inline streak colors instead of colors.streak reference**
- **Found during:** Task 1
- **Issue:** `colors.streak` namespace does not exist in colors.js design system
- **Fix:** Defined inline STREAK_COLORS constant matching Firebase streakService.js hex values
- **Files modified:** src/services/supabase/streakService.ts
- **Commit:** c0799843

## Known Stubs

| File | Line | Reason | Resolving Plan |
|------|------|--------|---------------|
| src/services/supabase/messageService.ts | all | Stub for parallel execution | Plan 02 |
| src/lib/supabase.ts | all | Stub for parallel execution | Phase 12 (main branch) |

## Self-Check: PASSED

- All 4 created files exist on disk
- Both commits verified (c0799843, 8a44d7a9)
- snapService.ts: 209 lines (min 80)
- streakService.ts: 129 lines (min 50)
- All 36 tests pass
