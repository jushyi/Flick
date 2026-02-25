# Phase 6: Tech Debt & Darkroom Optimization - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve all carried tech debt from v1.0 (unit tests, stale assertions, TTL policies, Storage lifecycle rules, variable renaming) and optimize darkroom reveal checks with local timestamp caching to eliminate redundant Firestore reads. No new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Snap Cleanup Timing

- Firestore TTL: 7 days after snap expiry before auto-deletion of the snap message document
- Storage lifecycle: 14 days before orphaned snap photos are deleted from Firebase Storage (longer than Firestore TTL to avoid edge cases where photo is deleted before doc TTL fires)
- Storage rule is path-based: only files under the snaps/ storage path are affected
- TTL scope includes both snap messages AND reactionBatches collection (already noted as 7-day cleanup in codebase)

### Darkroom Cache Behavior

- In-memory cache only (module variable or context state) — no AsyncStorage persistence
- Cache scope: client-side only — affects App.js foreground trigger and DarkroomScreen focus trigger. Cloud function (server-side, every 2 min) remains independent and unchanged
- 5-minute maximum cache age — force Firestore re-check if cache is older than 5 minutes, even if the cached nextRevealAt hasn't elapsed yet
- Cache invalidation: cleared on new photo capture and after reveal processing (per DARK-02 requirement)
- Offline/failure handling: silently skip the reveal check, retry on next trigger (foreground or screen focus). Cloud function serves as server-side safety net
- No changes to reveal UX — photos flip from developing to revealed with current behavior, no new animations

### Test Coverage Scope

- useConversation hook tests (DEBT-01): happy path only — test core flows for reactions, replies, and soft deletion. Verify Firestore calls and state updates
- snapFunctions.test.js (DEBT-02): fix the stale assertion at line 522 AND audit the entire test file for other stale/fragile assertions
- Variable rename (DEBT-05): rename `hoursSinceLastMutual` to accurately reflect its calculation AND add a brief inline comment explaining what the value represents

### Claude's Discretion

- Exact cache implementation pattern (module-level variable vs hook state vs ref)
- How to structure the useConversation test file (single describe block vs nested describes per feature)
- Specific TTL field naming in Firestore documents
- Whether to combine DEBT items into one plan or split across multiple

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- Subtle reveal transition animation (fade/pulse when photos flip from developing to revealed) — noted during discussion, belongs in a polish/UX phase

</deferred>

---

_Phase: 06-tech-debt-darkroom-optimization_
_Context gathered: 2026-02-25_
