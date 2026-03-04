---
phase: quick-37
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/hooks/useStreaks.js
  - __tests__/hooks/useStreaks.test.js
autonomous: true
requirements: [QUICK-37]
must_haves:
  truths:
    - "When a streak's expiresAt passes, the UI immediately shows no streak (default state) without waiting for the Cloud Function to run"
    - "The messages list also reflects expired streaks instantly, not just the conversation screen"
    - "When the Cloud Function eventually resets the streak document, the UI remains consistent (no flicker)"
  artifacts:
    - path: "src/hooks/useStreaks.js"
      provides: "Local expiry override in useStreak and useStreakMap"
    - path: "__tests__/hooks/useStreaks.test.js"
      provides: "Tests for expiry override behavior"
  key_links:
    - from: "src/hooks/useStreaks.js (useStreak)"
      to: "src/services/firebase/streakService.js (deriveStreakState)"
      via: "isExpired override applied after deriveStreakState returns"
      pattern: "isExpired.*default"
---

<objective>
Fix streak expiration so the UI immediately reflects ended streaks when the local countdown timer hits zero, rather than waiting up to 30 minutes for the processStreakExpiry Cloud Function to reset the document.

Purpose: Currently, `useStreak` sets `isExpired=true` locally when the countdown reaches zero, but this flag is never consumed -- the UI continues showing the active/warning streak state until the Cloud Function runs. This creates a confusing UX where the streak indicator shows a positive count after the streak has actually expired.

Output: Updated `useStreak` and `useStreakMap` hooks that override streak state to `'default'` when local expiry is detected, plus updated tests.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/hooks/useStreaks.js
@src/services/firebase/streakService.js
@src/components/StreakIndicator.js
@__tests__/hooks/useStreaks.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add local expiry override to useStreak and useStreakMap hooks</name>
  <files>src/hooks/useStreaks.js</files>
  <action>
In `useStreak`:
1. After deriving `streakState` via `useMemo(() => deriveStreakState(...))`, add a new `useMemo` that computes the effective streak state: if `isExpired` is true AND the raw `streakState` is not already `'default'`, override to `'default'`. Name this `effectiveStreakState`.
2. Similarly compute `effectiveDayCount`: if `isExpired` is true, return 0. Otherwise return `streakData?.dayCount || 0`.
3. Compute `effectiveStreakColor` using `getStreakColor(effectiveStreakState, effectiveDayCount)`.
4. Return `effectiveStreakState` as `streakState`, `effectiveDayCount` as `dayCount`, and `effectiveStreakColor` as `streakColor` in the hook return object. Continue returning `isExpired` and `timeRemaining` unchanged.

In `useStreakMap`:
1. Inside the `streaks.forEach` callback, after deriving `state` and `color`, check if the streak has an `expiresAt` field.
2. If `expiresAt` exists, compute whether it has passed: compare `expiresAt.toMillis()` (or `.toDate().getTime()` or `new Date(expiresAt).getTime()` -- use the same 3-way fallback pattern already in useStreak's `computeRemaining`) to `Date.now()`.
3. If expired (expiresAt timestamp <= Date.now()), override `state` to `'default'`, `dayCount` to 0, and recompute `color` using `getStreakColor('default', 0)`.
4. Store these overridden values in the map entry.

This ensures both the individual conversation view (useStreak) and the messages list view (useStreakMap) immediately reflect expired streaks.

Do NOT modify `deriveStreakState` in streakService.js -- that function is pure and should remain unaware of time. The override belongs in the hooks which have access to real-time state.
  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx jest __tests__/hooks/useStreaks.test.js --no-coverage 2>&1 | tail -20</automated>
    <manual>Existing tests still pass after the refactor</manual>
  </verify>
  <done>useStreak returns streakState='default' and dayCount=0 when isExpired is true. useStreakMap returns 'default'/0 for any streak whose expiresAt is in the past. Existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add tests for local expiry override behavior</name>
  <files>__tests__/hooks/useStreaks.test.js</files>
  <action>
Read the existing test file first. Add the following new test cases to the existing describe blocks:

For `useStreak`:
1. "returns streakState='default' and dayCount=0 when streak is locally expired" -- Set up a streak with `expiresAt` in the past (e.g., Date.now() - 1000), `dayCount: 10`, `warning: true`. After the hook processes the data, verify `streakState` is `'default'`, `dayCount` is 0, and `isExpired` is true.
2. "returns normal streakState when streak is not expired" -- Set up a streak with `expiresAt` in the future, `dayCount: 5`. Verify `streakState` is NOT `'default'` (should be 'active' for dayCount >= 3), `dayCount` is 5, and `isExpired` is false.

For `useStreakMap`:
1. "returns 'default' state for expired streaks in the map" -- Set up a streaks array where one streak has `expiresAt` in the past. Verify the map entry for that streak has `streakState: 'default'` and `dayCount: 0`.
2. "returns normal state for non-expired streaks in the map" -- Set up a streaks array where one streak has `expiresAt` in the future with `dayCount: 5`. Verify the map entry has `streakState: 'active'` and `dayCount: 5`.

Use the existing mock patterns in the test file (mock Firebase onSnapshot, mock Timestamp objects with `toMillis()` method). Follow the existing test structure and naming conventions.
  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx jest __tests__/hooks/useStreaks.test.js --no-coverage 2>&1 | tail -20</automated>
    <manual>All new and existing tests pass</manual>
  </verify>
  <done>4 new test cases confirm that expired streaks show 'default'/0 in both useStreak and useStreakMap, and non-expired streaks show their normal state. All existing tests continue to pass.</done>
</task>

</tasks>

<verification>
1. `npx jest __tests__/hooks/useStreaks.test.js --no-coverage` -- all tests pass
2. `npx jest functions/__tests__/triggers/streakFunctions.test.js --no-coverage` -- cloud function tests unaffected
3. `npm run lint -- src/hooks/useStreaks.js` -- no lint errors
</verification>

<success_criteria>
- useStreak hook returns streakState='default', dayCount=0 when local countdown reaches zero (isExpired=true)
- useStreakMap returns 'default'/0 for any streak whose expiresAt timestamp is in the past
- deriveStreakState in streakService.js is NOT modified (pure function preserved)
- All existing tests continue to pass
- 4 new tests verify expiry override behavior
</success_criteria>

<output>
After completion, create `.planning/quick/37-fix-streak-expiration-add-logic-to-end-s/37-SUMMARY.md`
</output>
