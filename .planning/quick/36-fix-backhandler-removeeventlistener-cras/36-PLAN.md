---
phase: quick-36
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/PhotoDetailScreen.js
autonomous: true
requirements: [BUGFIX-BACKHANDLER]

must_haves:
  truths:
    - "Android stories mode no longer crashes with BackHandler.removeEventListener TypeError"
    - "Android hardware back button still triggers suck-back dismiss animation"
    - "iOS behavior is completely unchanged (BackHandler block is android-only)"
  artifacts:
    - path: "src/screens/PhotoDetailScreen.js"
      provides: "Fixed BackHandler subscription cleanup"
      contains: "subscription.remove()"
  key_links:
    - from: "src/screens/PhotoDetailScreen.js"
      to: "BackHandler API"
      via: "addEventListener returns subscription, cleanup calls subscription.remove()"
      pattern: "const subscription = BackHandler\\.addEventListener"
---

<objective>
Fix BackHandler.removeEventListener crash on Android stories

Purpose: The deprecated `BackHandler.removeEventListener()` API was removed in recent React Native versions. PhotoDetailScreen.js line 710 uses this removed API, causing a TypeError crash when tapping through stories on Android. The fix is to use the subscription pattern (capture return value of `addEventListener`, call `.remove()` in cleanup) — the same pattern already used in ProfileSetupScreen.js, CommentsBottomSheet.js, and SnapViewer.js.

Output: Fixed PhotoDetailScreen.js with no Android crash on story navigation
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/PhotoDetailScreen.js (lines 700-711 — the buggy useEffect)
@src/components/SnapViewer.js (line 176 — correct subscription pattern for reference)
@src/screens/ProfileSetupScreen.js (line 98 — correct subscription pattern for reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix BackHandler cleanup to use subscription pattern</name>
  <files>src/screens/PhotoDetailScreen.js</files>
  <action>
In `src/screens/PhotoDetailScreen.js`, locate the useEffect block at ~line 700 that handles Android hardware back button.

Current (broken):
```javascript
useEffect(() => {
  if (Platform.OS !== 'android') return;

  const onBackPress = () => {
    animatedClose();
    return true;
  };

  BackHandler.addEventListener('hardwareBackPress', onBackPress);
  return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
}, [animatedClose]);
```

Replace with (fixed — matches project convention in SnapViewer.js, ProfileSetupScreen.js, CommentsBottomSheet.js):
```javascript
useEffect(() => {
  if (Platform.OS !== 'android') return;

  const onBackPress = () => {
    animatedClose();
    return true;
  };

  const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
  return () => subscription.remove();
}, [animatedClose]);
```

The only change is:
1. Capture the return value of `addEventListener` into `const subscription`
2. Replace `BackHandler.removeEventListener('hardwareBackPress', onBackPress)` with `subscription.remove()`

Do NOT change anything else in this file. The `BackHandler` import at line 31 remains unchanged.
  </action>
  <verify>
    <automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/PhotoDetailScreen.js --no-error-on-unmatched-pattern 2>&1 | tail -5</automated>
    <manual>Confirm the useEffect cleanup uses subscription.remove() not BackHandler.removeEventListener()</manual>
  </verify>
  <done>PhotoDetailScreen.js uses the subscription pattern for BackHandler cleanup. No more BackHandler.removeEventListener calls exist in the file. Lint passes. The fix matches the established convention used in SnapViewer.js, ProfileSetupScreen.js, and CommentsBottomSheet.js.</done>
</task>

</tasks>

<verification>
1. `grep -n "removeEventListener" src/screens/PhotoDetailScreen.js` returns no results
2. `grep -n "subscription.remove" src/screens/PhotoDetailScreen.js` returns the cleanup line
3. `grep -c "BackHandler.addEventListener" src/screens/PhotoDetailScreen.js` returns 1 (unchanged count)
4. ESLint passes on the file
</verification>

<success_criteria>
- Zero instances of `BackHandler.removeEventListener` in PhotoDetailScreen.js
- BackHandler useEffect uses `const subscription = BackHandler.addEventListener(...)` and `subscription.remove()` pattern
- ESLint passes with no new warnings or errors
- No other code in the file is modified
</success_criteria>

<output>
After completion, create `.planning/quick/36-fix-backhandler-removeeventlistener-cras/36-SUMMARY.md`
</output>
