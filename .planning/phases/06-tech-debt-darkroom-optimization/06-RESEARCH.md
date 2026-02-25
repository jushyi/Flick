# Phase 6: Tech Debt & Darkroom Optimization - Research

**Researched:** 2026-02-25
**Domain:** React Native / Jest / Firebase Cloud Firestore / GCS lifecycle / in-memory caching
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snap Cleanup Timing**

- Firestore TTL: 7 days after snap expiry before auto-deletion of the snap message document
- Storage lifecycle: 14 days before orphaned snap photos are deleted from Firebase Storage (longer than Firestore TTL to avoid edge cases where photo is deleted before doc TTL fires)
- Storage rule is path-based: only files under the snaps/ storage path are affected
- TTL scope includes both snap messages AND reactionBatches collection (already noted as 7-day cleanup in codebase)

**Darkroom Cache Behavior**

- In-memory cache only (module variable or context state) — no AsyncStorage persistence
- Cache scope: client-side only — affects App.js foreground trigger and DarkroomScreen focus trigger. Cloud function (server-side, every 2 min) remains independent and unchanged
- 5-minute maximum cache age — force Firestore re-check if cache is older than 5 minutes, even if the cached nextRevealAt hasn't elapsed yet
- Cache invalidation: cleared on new photo capture and after reveal processing (per DARK-02 requirement)
- Offline/failure handling: silently skip the reveal check, retry on next trigger (foreground or screen focus). Cloud function serves as server-side safety net
- No changes to reveal UX — photos flip from developing to revealed with current behavior, no new animations

**Test Coverage Scope**

- useConversation hook tests (DEBT-01): happy path only — test core flows for reactions, replies, and soft deletion. Verify Firestore calls and state updates
- snapFunctions.test.js (DEBT-02): fix the stale assertion at line 522 AND audit the entire test file for other stale/fragile assertions
- Variable rename (DEBT-05): rename `hoursSinceLastMutual` to accurately reflect its calculation AND add a brief inline comment explaining what the value represents

### Claude's Discretion

- Exact cache implementation pattern (module-level variable vs hook state vs ref)
- How to structure the useConversation test file (single describe block vs nested describes per feature)
- Specific TTL field naming in Firestore documents
- Whether to combine DEBT items into one plan or split across multiple

### Deferred Ideas (OUT OF SCOPE)

- Subtle reveal transition animation (fade/pulse when photos flip from developing to revealed)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                         | Research Support                                                                                                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEBT-01 | useConversation hook Phase 2 additions have dedicated unit tests                    | Existing test file covers Phase 1 only (8 tests); reactions, replies, soft deletion have zero dedicated tests; `messageService` exports confirmed: `sendReaction`, `removeReaction`, `sendReply`, `deleteMessageForMe` |
| DEBT-02 | Stale test assertion in snapFunctions.test.js line 522 is fixed                     | **Key finding:** line 522 already reads `expect(data.type).toBe('snap')` — all 15 tests pass; DEBT-02 now requires audit + formal verification pass, not a code change                                                 |
| DEBT-03 | Firestore TTL policy configured for snap message auto-cleanup                       | TTL is a Firebase console config operation; `expiresAt` field already set on snap messages in `index.js`; TTL field name is already `expiresAt` on messages collection                                                 |
| DEBT-04 | Firebase Storage lifecycle rule configured for orphaned snap photo cleanup          | GCS lifecycle config operation; Storage path is `snap-photos/`; 14-day window; path filter restricts to snaps only                                                                                                     |
| DEBT-05 | `hoursSinceLastMutual` variable renamed to accurately reflect its calculation       | Variable lives in `functions/index.js` at line 2880; divides by `DAY_MS` so value represents fractional days not hours; `< 1` means "< 1 day"                                                                          |
| DARK-01 | Darkroom reveal checks use local timestamp cache to avoid redundant Firestore reads | Two trigger sites: `App.js` foreground AppState listener + `useDarkroom.js` useFocusEffect; both call `isDarkroomReadyToReveal` which does a full Firestore `getDoc` on every invocation                               |
| DARK-02 | Cache invalidates on new photo capture and after reveal processing                  | Cache clear must happen in: (1) `useCamera.js`/photo upload path after capture, (2) after `revealPhotos()` + `scheduleNextReveal()` calls in both App.js and useDarkroom.js                                            |

</phase_requirements>

---

## Summary

Phase 6 is a pure maintenance phase — zero new user-facing features. It has five distinct work streams: (1) test gap fill for useConversation Phase 2 features, (2) test audit and verification for snapFunctions, (3) Firestore TTL console configuration, (4) GCS Storage lifecycle console configuration, and (5) a variable rename in Cloud Functions.

The darkroom optimization adds a two-field in-memory cache object to `darkroomService.js` (or as a module-level variable) so that `isDarkroomReadyToReveal` can skip the Firestore `getDoc` call when the cached `nextRevealAt` hasn't elapsed and the cache itself is less than 5 minutes old. Both the App.js foreground path and the `useDarkroom` focus path call this function, so caching at the service layer eliminates the Firestore read for both callers simultaneously.

**Critical finding on DEBT-02:** The `snapFunctions.test.js` file already has the correct assertion `expect(data.type).toBe('snap')` at line 522 and all 15 tests pass. The stale assertion documented in the v1.0 milestone audit has already been corrected. DEBT-02 should be treated as "audit and confirm" not "fix and re-run."

**Primary recommendation:** Implement cache as a module-level variable in `darkroomService.js`; fill `useConversation` test gaps in a new describe block appended to the existing test file; handle DEBT-02 as an audit-and-pass task; document TTL/lifecycle as manual console steps with verification evidence.

---

## Standard Stack

### Core (no new installs needed)

| Library                       | Version                           | Purpose                            | Why Standard                                   |
| ----------------------------- | --------------------------------- | ---------------------------------- | ---------------------------------------------- |
| jest-expo                     | current (per package.json preset) | Test runner for React Native hooks | Already used across 39 test suites             |
| @testing-library/react-native | current (via jest-expo)           | `renderHook`, `act`, `waitFor`     | Pattern established in useConversation.test.js |
| jest (functions)              | ^29.7.0                           | Cloud Functions test runner        | Already configured in functions/jest.config.js |

### No New Dependencies Required

All Phase 6 work uses libraries and patterns already established in the project. No `npm install` is needed.

**Test commands:**

```bash
# App tests (fast — 37 passing suites, ~7.5s)
npx jest --no-coverage

# Single hook test file
npx jest __tests__/hooks/useConversation.test.js --no-coverage

# Cloud Functions tests
cd functions && npx jest

# Cloud Functions single file
cd functions && npx jest __tests__/snapFunctions.test.js
```

---

## Architecture Patterns

### Pattern 1: Module-Level Cache (Recommended for DARK-01)

**What:** A plain JS object at module scope in `darkroomService.js` holds the cached `nextRevealAt` timestamp and the cache write time. No React state, no AsyncStorage.

**When to use:** When a side-effect-free service function needs to short-circuit expensive I/O using data that remains valid across multiple callers and render cycles.

**Why module-level over hook state/ref:**

- Both `App.js` and `useDarkroom.js` call `isDarkroomReadyToReveal`; a hook-level ref would only cache for one caller
- Module-level variable is shared across all callers in the same JS runtime — single source of truth
- Easier to invalidate: export a `clearRevealCache()` function that resets the object

**Example:**

```javascript
// darkroomService.js — module-level cache

/** @type {{ nextRevealAt: import('@react-native-firebase/firestore').FirebaseFirestoreTypes.Timestamp|null, cachedAt: number|null }} */
let _revealCache = {
  nextRevealAt: null,
  cachedAt: null,
};

const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the reveal cache. Call after new photo capture and after reveal processing.
 */
export const clearRevealCache = () => {
  _revealCache = { nextRevealAt: null, cachedAt: null };
};

export const isDarkroomReadyToReveal = async userId => {
  try {
    const now = Date.now();

    // Cache hit: use cached value if it's fresh and nextRevealAt hasn't elapsed yet
    if (
      _revealCache.nextRevealAt !== null &&
      _revealCache.cachedAt !== null &&
      now - _revealCache.cachedAt < CACHE_MAX_AGE_MS &&
      _revealCache.nextRevealAt.toMillis() > now
    ) {
      logger.debug('isDarkroomReadyToReveal: cache hit — not ready yet');
      return false;
    }

    // Cache miss or cache expired or cached time has elapsed: fetch from Firestore
    const result = await getDarkroom(userId);
    if (!result.success) return false;

    const { nextRevealAt } = result.darkroom;

    // Update cache regardless of ready state
    _revealCache = { nextRevealAt: nextRevealAt ?? null, cachedAt: now };

    return nextRevealAt && nextRevealAt.toMillis() <= now;
  } catch (error) {
    logger.error('Error checking darkroom reveal status', error);
    return false;
  }
};
```

**Cache invalidation sites (DARK-02):**

```javascript
// In App.js — after successful reveal
const revealResult = await revealPhotos(currentUser.uid);
await scheduleNextReveal(currentUser.uid);
clearRevealCache(); // ← new

// In useDarkroom.js — after reveal in loadDevelopingPhotos
await revealPhotos(user.uid);
await scheduleNextReveal(user.uid);
clearRevealCache(); // ← new

// In useCamera.js or photo upload path — after new photo capture
await ensureDarkroomInitialized(userId);
clearRevealCache(); // ← new
```

### Pattern 2: useConversation Phase 2 Test Structure (DEBT-01)

**What:** Append three new `describe` blocks to the existing `useConversation.test.js` to cover reactions, replies, and soft deletion. The existing 8 tests remain untouched.

**Current test file coverage (confirmed passing):**

- `conversation document subscription` (3 tests)
- `first-read-only guard` (2 tests)
- `foreground-only guard` (2 tests)
- `AppState listener cleanup` (1 test)

**Missing coverage (Phase 2 additions):**

- Reactions: `handleSendReaction` → calls `sendReaction` from messageService
- Reaction removal: `handleRemoveReaction` → calls `removeReaction` from messageService
- Replies: `handleSendReply` → calls `sendReply` from messageService
- Soft deletion: `handleDeleteForMe` → calls `deleteMessageForMe` from messageService

**Example pattern for reaction tests:**

```javascript
// Append to existing useConversation.test.js

// Additional mock functions (add to top of file mock setup)
const mockSendReaction = jest.fn();
const mockRemoveReaction = jest.fn();
const mockSendReply = jest.fn();
const mockDeleteMessageForMe = jest.fn();

// Add to jest.mock('../../src/services/firebase/messageService', ...) factory
sendReaction: (...args) => mockSendReaction(...args),
removeReaction: (...args) => mockRemoveReaction(...args),
sendReply: (...args) => mockSendReply(...args),
deleteMessageForMe: (...args) => mockDeleteMessageForMe(...args),

// New describe block
describe('Phase 2: reactions', () => {
  it('should call sendReaction with conversationId, currentUserId, targetMessageId, emoji', async () => {
    mockSendReaction.mockResolvedValue({ success: true, messageId: 'rxn-1' });

    const { result } = renderHook(() =>
      useConversation(mockConversationId, mockCurrentUserId)
    );

    await act(async () => {
      await result.current.handleSendReaction('msg-1', 'heart');
    });

    expect(mockSendReaction).toHaveBeenCalledWith(
      mockConversationId,
      mockCurrentUserId,
      'msg-1',
      'heart'
    );
  });

  it('should call removeReaction with conversationId, currentUserId, targetMessageId', async () => {
    mockRemoveReaction.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useConversation(mockConversationId, mockCurrentUserId)
    );

    await act(async () => {
      await result.current.handleRemoveReaction('msg-1');
    });

    expect(mockRemoveReaction).toHaveBeenCalledWith(
      mockConversationId,
      mockCurrentUserId,
      'msg-1'
    );
  });
});

describe('Phase 2: replies', () => {
  it('should call sendReply with correct arguments', async () => {
    mockSendReply.mockResolvedValue({ success: true, messageId: 'reply-1' });
    const replyToMessage = { id: 'orig-1', senderId: 'user2', type: 'text' };

    const { result } = renderHook(() =>
      useConversation(mockConversationId, mockCurrentUserId)
    );

    await act(async () => {
      await result.current.handleSendReply('reply text', null, null, replyToMessage);
    });

    expect(mockSendReply).toHaveBeenCalledWith(
      mockConversationId,
      mockCurrentUserId,
      'reply text',
      null,
      null,
      replyToMessage
    );
  });
});

describe('Phase 2: soft deletion', () => {
  it('should call deleteMessageForMe with conversationId, currentUserId, messageId', async () => {
    mockDeleteMessageForMe.mockResolvedValue({ success: true });

    const { result } = renderHook(() =>
      useConversation(mockConversationId, mockCurrentUserId)
    );

    await act(async () => {
      await result.current.handleDeleteForMe('msg-to-delete');
    });

    expect(mockDeleteMessageForMe).toHaveBeenCalledWith(
      mockConversationId,
      mockCurrentUserId,
      'msg-to-delete'
    );
  });
});
```

### Pattern 3: Firestore TTL Configuration (DEBT-03)

**What:** TTL policies are configured per-collection in the Firebase console (or via CLI/REST). They delete documents automatically based on a timestamp field.

**How:** Firebase console → Firestore → Data → TTL policies. Set:

- Collection: `conversations/{id}/messages` (subcollection — use collection group path `messages`)
- Field: `expiresAt`
- Scope: all documents in the collection group where `expiresAt` exists

**Key findings from codebase inspection:**

- `expiresAt` field is already written on snap message documents in `functions/index.js`
- The `reactionBatches` collection has `sentAt` + 7-day cleanup noted in codebase comments
- TTL documentation says: field must be Firestore Timestamp (not a number or string)
- TTL deletion runs within 72 hours of the document's expiry time (eventual consistency)

**Firebase CLI equivalent:**

```bash
firebase firestore:indexes --project <project-id>
# TTL policies cannot be created via CLI as of 2026 — must use Firebase console or REST API
```

**REST API for TTL (alternative to console):**

```bash
curl -X POST \
  "https://firestore.googleapis.com/v1/projects/PROJECT_ID/databases/(default)/collectionGroups/messages/fields/expiresAt" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"ttlConfig": {"state": "ENABLED"}}'
```

### Pattern 4: GCS Storage Lifecycle Configuration (DEBT-04)

**What:** Object lifecycle rules in Google Cloud Storage automatically delete objects matching a path prefix after a specified age. Configured per bucket, not per Firebase project.

**How:** GCS console → Storage → Bucket → Lifecycle → Add rule, OR via `gcloud` CLI:

```bash
# Create lifecycle.json
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {
      "age": 14,
      "matchesPrefix": ["snap-photos/"]
    }
  }]
}

# Apply to bucket
gsutil lifecycle set lifecycle.json gs://BUCKET_NAME
```

**Key notes:**

- Firebase Storage buckets are GCS buckets — the same `gsutil` / GCS console applies
- `matchesPrefix` restricts deletion to only `snap-photos/` objects — other photos are unaffected
- 14-day age means GCS deletes objects that are 14+ days old measured from object creation
- This is a safety net — `onSnapViewed` CF deletes immediately on view; lifecycle catches orphans

### Pattern 5: Variable Rename (DEBT-05)

**Location:** `functions/index.js` line 2880

**Current code:**

```javascript
const hoursSinceLastMutual = lastMutualAt ? (nowMs - lastMutualMs) / DAY_MS : Infinity;
if (hoursSinceLastMutual < 1) {
  // Less than 24h since last mutual exchange — just record the snap
```

**Fixed code:**

```javascript
// daysSinceLastMutual < 1 means less than one full day (< 24h) since last mutual exchange
const daysSinceLastMutual = lastMutualAt ? (nowMs - lastMutualMs) / DAY_MS : Infinity;
if (daysSinceLastMutual < 1) {
  // Less than 24h since last mutual exchange — just record the snap
```

The logic is correct. Only the variable name and the inline comment need to change. The `< 1` threshold is correct because `DAY_MS = 24 * 60 * 60 * 1000` and the comparison `< 1` means "less than 1 full day elapsed."

---

## Don't Hand-Roll

| Problem                  | Don't Build                                                 | Use Instead                           | Why                                                                                                             |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Firestore auto-cleanup   | A scheduled Cloud Function to query and delete expired docs | Firestore TTL policy (native)         | TTL is server-side, zero compute cost, runs automatically — `cleanupExpiredSnaps` CF already serves as fallback |
| Storage auto-cleanup     | Another Cloud Function scanning for old files               | GCS lifecycle rules (native)          | GCS lifecycle runs on Google infra, no code needed, no function invocations consumed                            |
| Cross-hook cache sharing | Redux store, Context provider, AsyncStorage                 | Module-level variable in service file | JS module singleton is shared across all importers in same runtime — simplest, zero React overhead              |

---

## Common Pitfalls

### Pitfall 1: TTL Policy Scope — Collection Group vs Single Collection

**What goes wrong:** Setting TTL on `conversations` (top-level) instead of the `messages` subcollection — documents in subcollections are NOT affected by parent collection TTL policies.

**Why it happens:** The Firestore console shows top-level collections first; `messages` is a subcollection inside `conversations/{id}/`.

**How to avoid:** In the Firebase console TTL dialog, enter the collection group ID `messages` (not `conversations`). Firestore TTL supports collection groups, so this will apply to all `messages` subcollections regardless of parent conversation ID.

**Warning signs:** After TTL is set, expired snap docs are not disappearing after 72+ hours.

### Pitfall 2: GCS Lifecycle `matchesPrefix` Not Matching

**What goes wrong:** Using `"snap-photos"` (no trailing slash) catches unintended objects like `snap-photos-backup/`.

**How to avoid:** Use `"snap-photos/"` (with trailing slash) as the prefix.

### Pitfall 3: Cache Hit Logic Hiding Real Expiry

**What goes wrong:** Cache returns `false` (not ready) even when `nextRevealAt` has elapsed, because the cache is checked before verifying if the cached time itself has passed.

**How to avoid:** The cache short-circuits only when `_revealCache.nextRevealAt.toMillis() > now` (i.e., time hasn't elapsed yet). If the cached `nextRevealAt` has elapsed, fall through to Firestore to confirm and trigger reveal.

**Correct logic flow:**

```
1. Cache exists AND cache is fresh (< 5 min old)?
   YES → Is nextRevealAt still in the future?
     YES → return false (cache hit: not ready)
     NO → fall through (cached time has elapsed, might be ready — re-fetch)
   NO → fall through (stale cache, re-fetch)
2. Fetch from Firestore
3. Update cache with new nextRevealAt
4. Return ready status
```

### Pitfall 4: clearRevealCache Called Before scheduleNextReveal

**What goes wrong:** Clearing cache before `scheduleNextReveal` completes means the next `isDarkroomReadyToReveal` call fetches from Firestore and gets the OLD `nextRevealAt` (before it's updated), potentially triggering a second reveal.

**How to avoid:** Always clear cache AFTER `scheduleNextReveal` resolves:

```javascript
await revealPhotos(userId);
await scheduleNextReveal(userId); // writes new nextRevealAt to Firestore
clearRevealCache(); // now safe to clear — Firestore has the new value
```

### Pitfall 5: snapFunctions Line 522 Already Correct

**What goes wrong:** Developer spends time "fixing" an assertion that doesn't need fixing, potentially introducing a regression.

**Finding:** `functions/__tests__/snapFunctions.test.js` line 522 is `expect(data.type).toBe('snap')` — all 15 tests pass. The stale assertion documented in the v1.0 audit has already been corrected. DEBT-02 work is: run the tests, confirm they pass, audit for other fragile assertions, and mark complete.

**Warning signs to look for during audit:** Hard-coded message text expectations (notification templates use `validBodies` array for flexibility — this is already correct), path assertions that might drift from actual Storage paths.

### Pitfall 6: useConversation Mock Setup for Phase 2 Tests

**What goes wrong:** The existing `jest.mock('../../src/services/firebase/messageService', ...)` factory only mocks `subscribeToMessages`, `loadMoreMessages`, `sendMessage`, `markConversationRead`. Adding new mock functions (`sendReaction`, etc.) requires updating BOTH the top-level mock variable declarations AND the factory return object.

**Pattern (from CLAUDE.md):** "Mock functions are defined outside `jest.mock()` blocks and referenced inside mock returns."

---

## Code Examples

### Cache Module Variable Pattern

```javascript
// Source: project convention (service layer pattern from CLAUDE.md)
// In darkroomService.js — add before isDarkroomReadyToReveal

let _revealCache = { nextRevealAt: null, cachedAt: null };
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export const clearRevealCache = () => {
  _revealCache = { nextRevealAt: null, cachedAt: null };
  logger.debug('darkroomService: Reveal cache cleared');
};
```

### Updating isDarkroomReadyToReveal with Cache

```javascript
// Source: project convention — preserves existing function signature
export const isDarkroomReadyToReveal = async userId => {
  try {
    const now = Date.now();

    // Cache hit: skip Firestore if cache is fresh and reveal time hasn't elapsed
    if (
      _revealCache.nextRevealAt !== null &&
      _revealCache.cachedAt !== null &&
      now - _revealCache.cachedAt < CACHE_MAX_AGE_MS &&
      _revealCache.nextRevealAt.toMillis() > now
    ) {
      logger.debug('isDarkroomReadyToReveal: cache hit — not ready', {
        userId,
        cachedNextRevealAt: _revealCache.nextRevealAt.toDate().toISOString(),
        cacheAgeMs: now - _revealCache.cachedAt,
      });
      return false;
    }

    // Cache miss, stale, or cached time elapsed — fetch from Firestore
    const result = await getDarkroom(userId);
    if (!result.success) return false;

    const { nextRevealAt } = result.darkroom;

    // Update cache
    _revealCache = { nextRevealAt: nextRevealAt ?? null, cachedAt: now };

    const isReady = nextRevealAt && nextRevealAt.toMillis() <= now;
    logger.debug('isDarkroomReadyToReveal: Firestore check', {
      userId,
      isReady,
      nextRevealAt: nextRevealAt?.toDate().toISOString(),
    });

    return isReady;
  } catch (error) {
    logger.error('Error checking darkroom reveal status', error);
    return false;
  }
};
```

### snapFunctions.test.js Audit Checklist

The existing tests that need review (they all pass — this is a fragility audit):

```javascript
// Line 520 — notification body check: CORRECT (uses validBodies array)
const validBodies = ['sent you a snap', 'just snapped you', 'New snap'];
expect(validBodies).toContain(body);

// Line 522 — type check: CORRECT
expect(data.type).toBe('snap');

// Line 523-524 — ID checks: CORRECT (match actual snapshot context params)
expect(data.messageId).toBe('msg-123');
expect(data.conversationId).toBe('user-a_user-b');
```

---

## State of the Art

| Old Approach                                               | Current Approach                            | Impact                                                                             |
| ---------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Manual Cloud Function cleanup for TTL                      | Firestore native TTL policy                 | Zero compute cost, more reliable, no function execution needed                     |
| No reveal cache — Firestore read on every foreground/focus | Module-level in-memory cache with 5-min TTL | Eliminates N-per-session Firestore reads; cloud function handles server-side truth |

---

## Validation Architecture

### Test Framework

| Property                      | Value                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| Framework                     | Jest via jest-expo (app), Jest 29 (functions)                    |
| Config file                   | `/jest.config.js` (app), `functions/jest.config.js`              |
| Quick run command — app       | `npx jest __tests__/hooks/useConversation.test.js --no-coverage` |
| Quick run command — functions | `cd functions && npx jest __tests__/snapFunctions.test.js`       |
| Full suite command            | `npm test` (runs both app + functions)                           |
| Estimated runtime             | ~8s (app suite alone), ~1s per individual file                   |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                               | Test Type   | Automated Command                                                     | File Exists?                                         |
| ------- | -------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| DEBT-01 | `handleSendReaction` calls `sendReaction` with correct args                            | unit        | `npx jest __tests__/hooks/useConversation.test.js --no-coverage`      | ❌ Wave 0 gap — new tests needed in existing file    |
| DEBT-01 | `handleRemoveReaction` calls `removeReaction` with correct args                        | unit        | `npx jest __tests__/hooks/useConversation.test.js --no-coverage`      | ❌ Wave 0 gap                                        |
| DEBT-01 | `handleSendReply` calls `sendReply` with correct args                                  | unit        | `npx jest __tests__/hooks/useConversation.test.js --no-coverage`      | ❌ Wave 0 gap                                        |
| DEBT-01 | `handleDeleteForMe` calls `deleteMessageForMe` with correct args                       | unit        | `npx jest __tests__/hooks/useConversation.test.js --no-coverage`      | ❌ Wave 0 gap                                        |
| DEBT-02 | All 15 snapFunctions tests pass + no fragile assertions                                | unit        | `cd functions && npx jest __tests__/snapFunctions.test.js`            | ✅ yes — audit only                                  |
| DEBT-03 | Firestore TTL on messages.expiresAt field                                              | manual-only | Manual: Firebase console TTL policy panel                             | N/A — console config                                 |
| DEBT-04 | GCS lifecycle rule on snap-photos/ prefix                                              | manual-only | Manual: `gsutil lifecycle get gs://BUCKET` to verify                  | N/A — console config                                 |
| DEBT-05 | `daysSinceLastMutual` used in functions/index.js (renamed from `hoursSinceLastMutual`) | unit        | `cd functions && npx jest __tests__/triggers/streakFunctions.test.js` | ✅ yes — rename doesn't break tests                  |
| DARK-01 | `isDarkroomReadyToReveal` skips Firestore when cache is fresh + reveal not elapsed     | unit        | `npx jest __tests__/services/darkroomService.test.js --no-coverage`   | ✅ yes (but needs new test cases for cache behavior) |
| DARK-02 | Cache clears after capture + after reveal                                              | unit        | `npx jest __tests__/services/darkroomService.test.js --no-coverage`   | ✅ yes (needs new test cases)                        |

### Nyquist Sampling Rate

- **Minimum sample interval:** After every committed task → run quick command for the file being modified
- **Full suite trigger:** Before final task of each plan wave — `npm test`
- **Phase-complete gate:** Full suite green before `/gsd:verify-work` runs
- **Estimated feedback latency per task:** ~1-2 seconds per individual file

### Wave 0 Gaps (must be created before implementation)

- [ ] `__tests__/hooks/useConversation.test.js` — **append** new describe blocks for reactions, replies, soft deletion (DEBT-01); also add mock wiring for `sendReaction`, `removeReaction`, `sendReply`, `deleteMessageForMe` in the existing mock factory
- [ ] `__tests__/services/darkroomService.test.js` — **append** new test cases: cache hit skips Firestore, cache miss calls Firestore, stale cache re-fetches, `clearRevealCache` resets state (DARK-01, DARK-02)

_(No new files needed — append to existing test files. No framework install needed.)_

---

## Open Questions

1. **reactionBatches TTL field name**
   - What we know: CONTEXT says TTL scope includes `reactionBatches` collection; codebase comment says "Auto-deleted 7 days after sending"
   - What's unclear: Whether `reactionBatches` has an `expiresAt` field or a `sentAt` field used for TTL; the exact field to configure in Firebase console
   - Recommendation: Search `functions/index.js` for `reactionBatches` write operations to confirm field name before configuring TTL

2. **clearRevealCache in CameraScreen / useCamera path**
   - What we know: Cache must clear on new photo capture; `ensureDarkroomInitialized` is called from the upload path
   - What's unclear: Exact call site in `useCamera.js` where capture + upload completes
   - Recommendation: Read `src/hooks/useCamera.js` during implementation to identify the right call site; calling `clearRevealCache()` in the same breath as `ensureDarkroomInitialized` is the safest approach

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `src/hooks/useDarkroom.js`, `App.js`, `src/services/firebase/darkroomService.js`, `src/services/firebase/messageService.js`
- `functions/__tests__/snapFunctions.test.js` — confirmed all 15 tests pass; line 522 assertion is `'snap'` (correct)
- `__tests__/hooks/useConversation.test.js` — confirmed 8 tests exist; Phase 2 features (reactions, replies, deletion) have no dedicated tests
- `functions/index.js` line 2880 — `hoursSinceLastMutual` variable confirmed, divides by `DAY_MS`
- `jest.config.js`, `functions/jest.config.js` — test infrastructure confirmed
- Live test run: `npx jest --no-coverage` → 37 pass, 2 fail (pre-existing unrelated failures)

### Secondary (MEDIUM confidence)

- Firebase Firestore TTL policy documentation — configuration via console or REST API; field must be Timestamp type
- GCS Object Lifecycle Management — `matchesPrefix` filter; `age` condition measured in days from object creation

### Tertiary (LOW confidence)

- None — all material claims verified against codebase directly

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies, all existing
- Architecture: HIGH — patterns verified from live codebase, tests confirmed
- Pitfalls: HIGH — discovered through direct code inspection + test run

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain — 30 days)
