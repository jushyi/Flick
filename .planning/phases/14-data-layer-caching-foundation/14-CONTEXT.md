# Phase 14: Data Layer & Caching Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Unified data-fetching layer for the app. TanStack Query manages all server state with caching, PowerSync provides instant local reads from SQLite, and AsyncStorage-backed persistence ensures the app opens with cached data instead of loading spinners. No service rewrites -- this phase builds the foundation infrastructure and one proof-of-concept hook. Actual hook migrations happen in Phases 15-17.

</domain>

<decisions>
## Implementation Decisions

### PowerSync + TanStack Query boundary
- PowerSync useQuery() for reading synced tables (photos, conversations, friendships, streaks)
- TanStack useMutation() for all writes, TanStack useQuery() for non-synced data (comments, notifications, albums, user profiles)
- PowerSync local writes for all 4 synced tables -- write to local SQLite first, PowerSync syncs to Supabase. Instant UI update, works offline
- No abstraction layer -- hooks explicitly use PowerSync or TanStack depending on the data type. Developers always know where data comes from
- Supabase Realtime changes invalidate TanStack Query cache via queryClient.invalidateQueries() -- no direct cache patching

### Query client defaults
- Global staleTime: 30 seconds -- data is fresh for 30s, then background refetch on next access
- Refetch on app foreground: enabled -- all active queries refetch when user returns from background
- Retry policy: 3 retries with exponential backoff (1s, 2s, 4s) -- TanStack Query default
- gcTime: 10 minutes -- inactive query data garbage collected after 10min

### Cache persistence strategy
- AsyncStorage as persistence backend (already installed, no new native dependency)
- Persist critical screens only: feed, conversations list, user profile queries
- 24-hour cache expiry -- persisted cache discarded after 24 hours to prevent showing very stale content
- Other query data fetches fresh on each session

### Hook migration pattern
- Phase 14 builds foundation only: QueryClient setup, providers, persistence config, PowerSync initialization
- One proof-of-concept hook: useProfile -- reads user profile from Supabase via TanStack Query, persists to cache, serves as template for Phase 15-17 rewrites
- Existing Firebase hooks remain untouched -- rewrites happen in Phases 15-17 as each service is migrated
- New data layer code lives in src/lib/ directory: queryClient.ts, powersync.ts, supabase.ts
- Query key factory pattern established in src/lib/queryKeys.ts -- all future hooks use factories like queryKeys.photos.list(), queryKeys.conversations.detail(id)

### Claude's Discretion
- Exact PowerSync initialization sequence and error handling
- QueryClient provider placement in the component tree (likely wrapping the navigation container)
- AsyncStorage persister configuration details (throttle time, serialization)
- useProfile hook implementation details (query function, select transform, error handling)
- Whether to create a shared mutation helper for optimistic updates pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & architecture decisions
- `.planning/research/STACK.md` -- TanStack Query, PowerSync, and AsyncStorage version specs; package installation order; TypeScript migration strategy
- `.planning/research/ARCHITECTURE.md` -- Service layer restructuring, data flow changes, PowerSync sync rules

### Prior phase context
- `.planning/phases/12-schema-infrastructure-foundation/12-CONTEXT.md` -- PowerSync sync scope (4 tables, 30-day photo window), RLS policies, dev environment setup, schema design decisions

### Requirements
- `.planning/REQUIREMENTS.md` -- PERF-01 (TanStack Query), PERF-08 (offline persistence), PERF-09 (PowerSync instant reads)
- `.planning/ROADMAP.md` -- Phase 14 success criteria (3 items)

### Project context
- `.planning/PROJECT.md` -- Constraints (dev-first migration, functionally identical, offline media capture non-negotiable)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@react-native-async-storage/async-storage` (v2.2.0) -- already installed, used in 12 files. Direct fit for TanStack Query persistence
- Existing `tsconfig.json` extends `expo/tsconfig.base` -- TypeScript foundation from Phase 12 available
- `src/services/firebase/index.js` -- barrel file pattern for service imports; src/lib/ will follow similar pattern

### Established Patterns
- All hooks use manual useState + useEffect + Firebase subscriptions -- TanStack Query replaces this pattern entirely
- Custom in-memory caching in useMessages (friendProfileCacheRef with 5-min TTL) -- TanStack Query eliminates the need for manual caches
- Service layer returns `{ success, error, data }` objects -- TanStack mutations can wrap these directly
- Upload queue uses AsyncStorage persistence -- pattern validates AsyncStorage as persistence layer

### Integration Points
- QueryClientProvider wraps the app at the root level (App.js or navigation container)
- PowerSync provider sits alongside QueryClientProvider -- both provide React context
- src/lib/supabase.ts creates the Supabase client (from Phase 13) that both TanStack query functions and PowerSync use
- PowerSync connects to Supabase via the PowerSync connector pattern (auth token from Supabase session)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches. The key insight is that this phase is pure infrastructure scaffolding with one PoC hook to prove the stack works end-to-end.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 14-data-layer-caching-foundation*
*Context gathered: 2026-03-23*
