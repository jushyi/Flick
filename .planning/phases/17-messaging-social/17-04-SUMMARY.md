---
phase: 17-messaging-social
plan: 04
subsystem: hooks
tags: [powersync, tanstack-query, supabase-realtime, useInfiniteQuery, messaging, streaks]

requires:
  - phase: 17-02
    provides: messageService.ts with all conversation/message CRUD operations
  - phase: 17-03
    provides: snapService.ts and streakService.ts with snap lifecycle and streak derivation
provides:
  - useMessages hook reading conversation list from PowerSync local SQLite
  - useConversation hook with TanStack pagination + Supabase Realtime
  - useStreak and useStreakMap hooks reading streak data from PowerSync
affects: [17-05-screens, messaging-screens, conversation-screen, messages-list]

tech-stack:
  added: []
  patterns:
    - "usePowerSyncQuery for reactive SQL queries from local SQLite"
    - "useInfiniteQuery with cursor-based pagination for messages"
    - "Supabase Realtime channel per conversation for INSERT/UPDATE invalidation"
    - "Map-based deduplication for paginated + realtime message merging"

key-files:
  created:
    - src/hooks/useMessages.ts
    - src/hooks/useConversation.ts
    - src/hooks/useStreaks.ts
  modified: []

key-decisions:
  - "useMessages returns raw ConversationRow with otherUserId -- screen fetches friend profiles separately via useQuery"
  - "useStreakMap returns Map<friendId, entry> instead of object keyed by streakId -- friendId is the natural lookup key for screens"
  - "useConversation uses callback-based invalidation instead of useMutation -- simpler for 10 action functions"
  - "Read receipts respect readReceiptsEnabled from userProfile.settings -- privacy toggle preserved"

patterns-established:
  - "PowerSync hook pattern: usePowerSyncQuery with SQL + useMemo for derivation"
  - "Realtime invalidation pattern: supabase.channel().on(postgres_changes).subscribe() + removeChannel cleanup"
  - "Message action pattern: useCallback wrapping service call + invalidateMessages"

requirements-completed: [MSG-01, MSG-02, MSG-03, MSG-06, MSG-07, MSG-08]

duration: 3min
completed: 2026-03-24
---

# Phase 17 Plan 04: Messaging Hooks Summary

**PowerSync-based useMessages/useStreaks hooks and TanStack+Realtime useConversation hook replacing all Firebase messaging subscriptions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T20:32:32Z
- **Completed:** 2026-03-24T20:35:55Z
- **Tasks:** 2
- **Files created:** 3 (641 total lines)

## Accomplishments
- useMessages reads conversation list from PowerSync local SQLite with zero network latency, soft-delete filtering, and derived otherUserId/unreadCount
- useConversation provides paginated messages via TanStack useInfiniteQuery, real-time updates via Supabase Realtime channel, Map-based deduplication, read receipts, and all 10 message action functions
- useStreak and useStreakMap read streak data from PowerSync with pure-function state/color derivation via deriveStreakState/getStreakColor

## Task Commits

Each task was committed atomically:

1. **Task 1: useMessages.ts and useStreaks.ts (PowerSync-based hooks)** - `09b65022` (feat)
2. **Task 2: useConversation.ts (TanStack + Realtime hook)** - `0ff6f50f` (feat)
3. **Lint/Prettier fixes** - `208eb69c` (fix)

## Files Created/Modified
- `src/hooks/useMessages.ts` - Conversation list hook reading from PowerSync, exports useMessages (116 lines)
- `src/hooks/useConversation.ts` - Individual conversation hook with TanStack + Supabase Realtime, exports useConversation (376 lines)
- `src/hooks/useStreaks.ts` - Streak hooks reading from PowerSync, exports useStreak and useStreakMap (149 lines)

## Decisions Made
- useMessages returns raw ConversationRow with derived otherUserId rather than joining friend profile data -- screen layer handles profile fetching via separate useQuery, keeping the hook focused on conversation data
- useStreakMap keyed by friendId (not streakId) since screens look up streaks by friend, not by internal streak ID
- useConversation uses plain useCallback wrappers around service functions instead of useMutation -- with 10 action functions, useMutation would add unnecessary complexity without meaningful benefit (no optimistic updates needed)
- Read receipts privacy toggle reads from userProfile.settings?.readReceipts, matching the existing Firebase hook behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import path for PowerSync**
- **Found during:** Task 1
- **Issue:** Plan specified `@powersync/react-native` for `usePowerSync`, but project uses `useQuery` from `@powersync/react` (as established in useDarkroom.ts pattern)
- **Fix:** Used `useQuery as usePowerSyncQuery` from `@powersync/react` matching existing project convention
- **Files modified:** src/hooks/useMessages.ts, src/hooks/useStreaks.ts
- **Committed in:** 09b65022

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Corrected import path to match established project pattern. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all hooks are fully wired to their respective data sources (PowerSync, TanStack, Supabase Realtime).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 messaging hooks ready for screen integration in Plan 05
- useMessages provides conversation list for MessagesList screen
- useConversation provides messages + actions for Conversation screen
- useStreak/useStreakMap provide streak visuals for both screens

---
*Phase: 17-messaging-social*
*Completed: 2026-03-24*
