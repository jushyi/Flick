---
phase: 14-data-layer-caching-foundation
plan: 01
subsystem: database
tags: [tanstack-query, powersync, react-query, async-storage, offline-first, caching]

# Dependency graph
requires:
  - phase: 12-schema-infrastructure-foundation
    provides: PowerSync schema (AppSchema), Supabase client, TypeScript config
provides:
  - QueryClient with AsyncStorage persister and selective persistence
  - Query key factory for 7 data domains
  - PowerSync database instance with app schema
  - Full SupabaseConnector with CRUD and fatal error handling
  - Metro config preventing PowerSync inlineRequires crash
  - Jest config supporting TypeScript tests with PowerSync mocks
affects: [14-02-provider-wiring, 15-service-layer-migration, 17-realtime-subscriptions]

# Tech tracking
tech-stack:
  added: ["@tanstack/react-query", "@tanstack/react-query-persist-client", "@tanstack/query-async-storage-persister", "@powersync/react-native", "@powersync/react", "@journeyapps/react-native-quick-sqlite"]
  patterns: [query-key-factory, selective-cache-persistence, fatal-error-discard]

key-files:
  created:
    - src/lib/queryClient.ts
    - src/lib/queryKeys.ts
    - src/lib/powersync/database.ts
    - metro.config.js
    - __tests__/__mocks__/@powersync/react-native.js
    - __tests__/__mocks__/@powersync/react.js
  modified:
    - src/lib/powersync/connector.ts
    - package.json
    - jest.config.js

key-decisions:
  - "Selective persistence via meta.persist=true flag on individual queries"
  - "24-hour maxAge for persisted cache with 1-second throttle on writes"
  - "Fatal PostgreSQL error codes (22xxx, 23xxx, 42501) discard transactions to avoid infinite retry"

patterns-established:
  - "Query key factory pattern: queryKeys.domain.action(params) for type-safe cache invalidation"
  - "Selective persistence: only queries with meta.persist=true survive app restarts"
  - "Fatal error discard: PowerSync connector discards transactions on non-retryable Postgres errors"

requirements-completed: [PERF-01, PERF-08, PERF-09]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 14 Plan 01: Data Layer Foundation Summary

**TanStack Query + PowerSync packages installed with QueryClient (30s stale, 10min gc, selective persistence), query key factory for 7 domains, and full SupabaseConnector with CRUD + fatal error handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T13:50:04Z
- **Completed:** 2026-03-24T13:52:41Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Installed 6 packages (3 TanStack Query, 3 PowerSync) with Metro and Jest compatibility
- Created QueryClient with production-ready defaults and AsyncStorage persistence (meta.persist gate)
- Built query key factory covering all 7 data domains with full type safety
- Upgraded SupabaseConnector from stub to full CRUD implementation with fatal error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Install packages and configure Metro + Jest** - `141bf8f6` (chore)
2. **Task 2: Create QueryClient, query key factory, and PowerSync database modules** - `9c5020f1` (feat)

## Files Created/Modified
- `src/lib/queryClient.ts` - QueryClient instance, AsyncStorage persister, selective persistOptions
- `src/lib/queryKeys.ts` - Query key factory for profile, photos, conversations, friends, comments, notifications, albums
- `src/lib/powersync/database.ts` - PowerSync database instance with app schema
- `src/lib/powersync/connector.ts` - Full SupabaseConnector with PUT/PATCH/DELETE and fatal error handling
- `metro.config.js` - Metro config with PowerSync inlineRequires blocklist
- `jest.config.js` - Updated for TypeScript tests and PowerSync mock mappings
- `package.json` - 6 new dependencies added
- `__tests__/__mocks__/@powersync/react-native.js` - PowerSync native module mock
- `__tests__/__mocks__/@powersync/react.js` - PowerSync React hooks mock

## Decisions Made
- Selective persistence via meta.persist=true flag -- only explicitly flagged queries survive app restarts, preventing stale data leaks
- 24-hour maxAge for persisted cache with 1-second throttle on AsyncStorage writes to avoid I/O pressure
- Fatal PostgreSQL error codes (22xxx data exception, 23xxx constraint violation, 42501 insufficient privilege) discard transactions to avoid infinite retry loops

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data layer modules ready for Plan 02 to wire into provider tree
- QueryClient, persistOptions, powerSyncDb, and SupabaseConnector all exported and importable
- PowerSync mocks in place for testing

---
*Phase: 14-data-layer-caching-foundation*
*Completed: 2026-03-24*
