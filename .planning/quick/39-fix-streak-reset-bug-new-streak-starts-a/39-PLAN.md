---
phase: quick-39
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - functions/index.js
  - functions/__tests__/triggers/streakFunctions.test.js
autonomous: true
requirements: [QUICK-39]
must_haves:
  truths:
    - "When a streak expires and users start a new one, dayCount begins at 1 (not the previous streak's count)"
    - "updateStreakOnSnap detects expired streaks and resets before incrementing"
    - "Existing non-expired streak behavior is unchanged"
  artifacts:
    - path: "functions/index.js"
      provides: "Expired-streak detection in updateStreakOnSnap"
      contains: "expiresAt.*expired"
    - path: "functions/__tests__/triggers/streakFunctions.test.js"
      provides: "Test covering streak restart after expiry"
      contains: "starts at 1.*expired"
  key_links:
    - from: "functions/index.js (updateStreakOnSnap)"
      to: "streak document expiresAt field"
      via: "expiry check before dayCount increment"
      pattern: "expiresAt.*toMillis.*nowMs"
---

<objective>
Fix bug where a new streak starts at the previous streak's dayCount instead of 1.

Purpose: When a streak expires and users start exchanging snaps again, the new streak should start at dayCount 1, not continue from the old count. The root cause is that `updateStreakOnSnap` in Cloud Functions does not check whether the streak document has expired before reading and incrementing `dayCount`. The `processStreakExpiry` cron job runs every 30 minutes, so there is a window where the document still holds the old dayCount after expiry.

Output: Fixed `updateStreakOnSnap` function and regression test.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@functions/index.js (lines 69-97 for streak constants, lines 2831-2920 for updateStreakOnSnap, lines 3640-3767 for processStreakExpiry)
@functions/__tests__/triggers/streakFunctions.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add expired-streak detection to updateStreakOnSnap</name>
  <files>functions/index.js</files>
  <action>
In the `updateStreakOnSnap` function (line ~2860, after reading `const streak = streakDoc.data()`), add an expiry check BEFORE any other logic. The check should:

1. Read `streak.expiresAt` and compare against `nowMs` (already available in scope).
2. If `streak.expiresAt` exists AND `streak.expiresAt.toMillis() <= nowMs`, the streak has expired. Reset the document inline (same as processStreakExpiry does) and then treat this as a fresh first snap:

```javascript
// Check if streak has expired (cron hasn't cleaned it up yet)
if (streak.expiresAt && streak.expiresAt.toMillis() <= nowMs) {
  // Reset expired streak and record this as first snap of a new streak
  const participants = streak.participants;
  transaction.update(streakRef, {
    dayCount: 0,
    lastMutualAt: null,
    streakStartedAt: null,
    expiresAt: null,
    warningAt: null,
    warning: false,
    warningSentAt: null,
    lastSnapBy: {
      [participants[0]]: null,
      [participants[1]]: null,
      [senderId]: now,
    },
    updatedAt: now,
  });
  return;
}
```

Note: The `lastSnapBy` object first nulls both participants then overwrites the sender's entry with `now`. This is equivalent to resetting + recording the first snap in one atomic write. The spread ordering means the sender's entry will be set to `now` (the later key wins).

IMPORTANT: This block must go right after `const streak = streakDoc.data();` and `const lastSnapBy = streak.lastSnapBy || {};` (line ~2861), BEFORE the `otherHasSnapped` check. This ensures expired streaks are caught regardless of the snap state.

Actually, to make the key override work correctly, structure it as:

```javascript
lastSnapBy: {
  [participants[0]]: null,
  [participants[1]]: null,
  [senderId]: now,
}
```

Since `senderId` is one of the participants, the later key assignment overwrites the null, correctly setting only the sender's snap timestamp.
  </action>
  <verify>
    <automated>cd functions && npm test -- --testPathPattern=streakFunctions --verbose 2>&1 | tail -30</automated>
    <manual>All existing streak tests still pass (no regression).</manual>
  </verify>
  <done>updateStreakOnSnap detects expired streaks and resets dayCount to 0 before processing the snap, preventing the new streak from inheriting the old count.</done>
</task>

<task type="auto">
  <name>Task 2: Add regression test for streak restart after expiry</name>
  <files>functions/__tests__/triggers/streakFunctions.test.js</files>
  <action>
Add a new test inside the `updateStreakOnSnap (via onNewMessage)` describe block. The test should verify that when a streak document has an expired `expiresAt` (in the past) and a high `dayCount`, sending a new snap resets the streak rather than continuing from the old count.

Test: "resets expired streak to dayCount 0 when snap is sent after expiry (before cron cleanup)"

Setup:
- `streakExists: true`
- `streakDoc`: dayCount 15, expiresAt in the past (e.g., `FIXED_NOW_MS - 1000`), lastSnapBy both null, lastMutualAt set to some old time, streakStartedAt set, warning: true, warningSentAt set

Action: user-b sends a snap via `onNewMessage`

Assertions:
- `transactionOps.update` was called
- The update contains `dayCount: 0` (NOT 16)
- The update contains `lastMutualAt: null`
- The update contains `streakStartedAt: null`
- The update contains `expiresAt: null`
- The update contains `warningAt: null`
- The update contains `warning: false`
- The update sets `lastSnapBy['user-b']` to the current timestamp (sender recorded their snap)
- The update sets `lastSnapBy['user-a']` to null

Also add a second test: "increments dayCount normally when streak has NOT expired"

Setup:
- `streakExists: true`
- `streakDoc`: dayCount 5, expiresAt in the FUTURE (e.g., `FIXED_NOW_MS + 10 * 60 * 60 * 1000`), lastSnapBy with user-a having snapped, lastMutualAt 25h ago

Action: user-b sends a snap (completing mutual exchange)

Assertions:
- `transactionOps.update` was called with `dayCount: 6` (normal increment, NOT reset)
- Confirms the expiry check does not false-positive on active streaks
  </action>
  <verify>
    <automated>cd functions && npm test -- --testPathPattern=streakFunctions --verbose 2>&1 | tail -40</automated>
    <manual>Both new tests pass. All existing tests still pass.</manual>
  </verify>
  <done>Two new regression tests confirm: (1) expired streak resets to dayCount 0 on next snap, and (2) non-expired streak increments normally.</done>
</task>

</tasks>

<verification>
Run the full streak test suite:
```bash
cd functions && npm test -- --testPathPattern=streakFunctions --verbose
```
All tests pass including the two new regression tests.
</verification>

<success_criteria>
- All existing streak tests pass (no regression)
- New test "resets expired streak to dayCount 0 when snap is sent after expiry" passes
- New test "increments dayCount normally when streak has NOT expired" passes
- The fix handles the race window between streak expiry and the 30-minute cron job
</success_criteria>

<output>
After completion, create `.planning/quick/39-fix-streak-reset-bug-new-streak-starts-a/39-SUMMARY.md`
</output>
