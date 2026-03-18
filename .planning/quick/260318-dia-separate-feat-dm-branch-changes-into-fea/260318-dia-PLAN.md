---
phase: quick
plan: 260318-dia
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/comments/CommentsBottomSheet.js
  - src/components/comments/CommentInput.js
  - src/services/firebase/photoService.js
  - src/services/uploadQueueService.js
  - __tests__/services/photoService.test.js
  - src/components/CustomBottomTabBar.js
  - src/screens/FeedScreen.js
  - src/utils/imageUtils.js
  - src/screens/ActivityScreen.js
  - src/components/PixelSpinner.js
  - src/components/comments/GifPicker.js
autonomous: true
requirements: [HOTFIX-CHERRY-PICK]

must_haves:
  truths:
    - "hotfix/production-fixes branch exists based off main with no feature code"
    - "All 8 cherry-picked commits apply cleanly (7 full + 1 partial)"
    - "Tests pass on the hotfix branch (npm test)"
    - "No DM/snap/streak/pinned-snap code leaks into the hotfix branch"
    - "Branch is ready for OTA deployment via eas update"
  artifacts:
    - path: "src/components/comments/CommentsBottomSheet.js"
      provides: "Android keyboard height tracking fix"
      contains: "onLayout"
    - path: "src/components/comments/CommentInput.js"
      provides: "Android keyboard fix + Giphy guard"
      contains: "isGiphyReady"
    - path: "src/services/firebase/photoService.js"
      provides: "Photo upload race condition fix"
      contains: "uploadPhoto"
    - path: "src/services/uploadQueueService.js"
      provides: "Upload queue race condition fix"
      contains: "processQueue"
    - path: "src/components/CustomBottomTabBar.js"
      provides: "Firebase token cache key fix"
      contains: "cacheKey"
    - path: "src/screens/FeedScreen.js"
      provides: "Firebase token cache key fix"
      contains: "profileCacheKey"
    - path: "src/utils/imageUtils.js"
      provides: "Firebase token cache key utility"
      contains: "profileCacheKey"
    - path: "src/screens/ActivityScreen.js"
      provides: "Auto-clear notification badge"
      contains: "setBadgeCountAsync"
    - path: "src/components/PixelSpinner.js"
      provides: "Android centering fix"
      contains: "centering"
    - path: "src/components/comments/GifPicker.js"
      provides: "SDK initialization guard"
      contains: "isGiphyReady"
  key_links:
    - from: "src/components/comments/CommentInput.js"
      to: "src/components/comments/GifPicker.js"
      via: "import { isGiphyReady }"
      pattern: "isGiphyReady"
---

<objective>
Create a hotfix/production-fixes branch off main containing 8 cherry-picked bug fixes and performance improvements from feat/dm that are safe to deploy independently via OTA update.

Purpose: Ship production-impacting fixes (photo upload race condition, stale profile caching, Android keyboard issues, GIF picker crashes) without waiting for the full DM feature branch to merge.

Output: A hotfix branch with clean commits ready for `eas update --branch production`.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260318-dia-separate-feat-dm-branch-changes-into-fea/260318-dia-CONTEXT.md

Key context: The feat/dm branch has 425 commits since main. Most are feature work (DM, snaps, streaks, pinned snaps, Live Activities) that cannot be deployed independently. However, 8 commits fix bugs in code that already exists on production main. These fixes touch ONLY pre-existing files and can be cherry-picked cleanly.

IMPORTANT CORRECTION from orchestrator analysis: Commit 6c90c2f1 (BackHandler.removeEventListener fix in PhotoDetailScreen) was listed as cherry-pickable but is NOT — the BackHandler code does not exist on main's PhotoDetailScreen (0 references). It was added as part of feat/dm phase 07-02 work. This commit is EXCLUDED.

Cherry-pick order (chronological, oldest first):
1. 0a786d68 — fix(android): track keyboard height changes (CommentsBottomSheet.js)
2. 75a90380 — fix(android): keep keyboard open after comment submit (CommentInput.js)
3. 6dd917e9 — fix: eliminate photo upload race condition (photoService.js, uploadQueueService.js, photoService.test.js)
4. dbe2e78b — fix: Firebase token in profile photo cache keys (CustomBottomTabBar.js, FeedScreen.js, imageUtils.js)
5. 4a43597f — fix: auto-clear notification badge on Activity screen (ActivityScreen.js)
6. 3e43ebef — fix: wrap PixelSpinner SVG in centering View for Android (PixelSpinner.js)
7. e99f19a5 — fix: guard GIF picker against uninitialized Giphy SDK (GifPicker.js)
8. 7cf9757d — PARTIAL: extract only CommentInput.js changes (add isGiphyReady guard). DMInput.js is a NEW file that does not exist on main — skip it.

Dependency chain: Commit 8 depends on commit 7 (imports isGiphyReady which commit 7 exports). All other commits are independent.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create hotfix branch and cherry-pick 7 clean commits</name>
  <files>
    src/components/comments/CommentsBottomSheet.js
    src/components/comments/CommentInput.js
    src/services/firebase/photoService.js
    src/services/uploadQueueService.js
    __tests__/services/photoService.test.js
    src/components/CustomBottomTabBar.js
    src/screens/FeedScreen.js
    src/utils/imageUtils.js
    src/screens/ActivityScreen.js
    src/components/PixelSpinner.js
    src/components/comments/GifPicker.js
  </files>
  <action>
    1. Stash or commit any uncommitted work on the current branch (feat/dm).
    2. Create the hotfix branch off main:
       ```
       git checkout main
       git pull origin main
       git checkout -b hotfix/production-fixes
       ```

    3. Cherry-pick 7 clean commits in chronological order. Each should apply without conflicts since the target files have NO intermediate modifications between main and the fix commit:
       ```
       git cherry-pick 0a786d68   # CommentsBottomSheet keyboard height
       git cherry-pick 75a90380   # CommentInput keyboard fix
       git cherry-pick 6dd917e9   # photoService + uploadQueueService race condition
       git cherry-pick dbe2e78b   # cache key fix (CustomBottomTabBar, FeedScreen, imageUtils)
       git cherry-pick 4a43597f   # ActivityScreen badge auto-clear
       git cherry-pick 3e43ebef   # PixelSpinner Android centering
       git cherry-pick e99f19a5   # GifPicker SDK guard
       ```

    4. If ANY cherry-pick produces a conflict:
       - Run `git diff` to see the conflict markers
       - Resolve by keeping the fix changes and the main branch's surrounding context
       - `git add <resolved-files>` then `git cherry-pick --continue`
       - If truly irreconcilable, `git cherry-pick --abort` and note it as skipped

    5. Verify the commit log looks correct:
       ```
       git log --oneline main..hotfix/production-fixes
       ```
       Should show exactly 7 commits with their original messages.
  </action>
  <verify>
    <automated>cd C:/Users/maser/Projects/flick && git log --oneline main..hotfix/production-fixes | wc -l</automated>
    Expected output: 7 (or 6-7 if one was skipped due to conflict)
  </verify>
  <done>hotfix/production-fixes branch exists with 7 cherry-picked commits, all applied cleanly, no feature code (DM/snap/streak) present</done>
</task>

<task type="auto">
  <name>Task 2: Extract partial cherry-pick for CommentInput isGiphyReady guard</name>
  <files>src/components/comments/CommentInput.js</files>
  <action>
    Commit 7cf9757d touches TWO files: DMInput.js (NEW file, does not exist on main) and CommentInput.js (exists on main). We need only the CommentInput.js changes.

    On the hotfix/production-fixes branch (should already be checked out from Task 1):

    1. Extract only the CommentInput.js diff from the mixed commit:
       ```
       git show 7cf9757d -- src/components/comments/CommentInput.js > /tmp/comment-input-giphy-guard.patch
       ```

    2. Apply the patch:
       ```
       git apply /tmp/comment-input-giphy-guard.patch
       ```
       This patch adds two changes to CommentInput.js:
       - Line ~30: Adds `isGiphyReady` to the import from `./GifPicker`
       - Line ~94: Adds the guard check `if (!isGiphyReady()) { Alert.alert(...); return; }` before `openGifPicker()`

    3. If `git apply` fails due to context mismatch (the surrounding lines may differ slightly after earlier cherry-picks), apply manually:
       - In the import line (~line 30), change:
         `import { openGifPicker, useGifSelection } from './GifPicker';`
         to:
         `import { openGifPicker, useGifSelection, isGiphyReady } from './GifPicker';`
       - In the `handleGifPick` callback (after the `Haptics.impactAsync` line, before `openGifPicker()`), add:
         ```javascript
         if (!isGiphyReady()) {
           Alert.alert('GIF Unavailable', 'GIF picker is not available right now.');
           return;
         }
         ```

    4. Stage and commit:
       ```
       git add src/components/comments/CommentInput.js
       git commit -m "fix: add isGiphyReady guard to CommentInput GIF button

       Extracted from 7cf9757d (which also modified DMInput.js, a file
       that does not exist on main). Guards handleGifPick with SDK
       availability check and shows user-friendly Alert when unavailable.

       Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
       ```
  </action>
  <verify>
    <automated>cd C:/Users/maser/Projects/flick && git log --oneline main..hotfix/production-fixes | wc -l && grep -c "isGiphyReady" src/components/comments/CommentInput.js</automated>
    Expected: 8 commits total, and isGiphyReady appears 2 times in CommentInput.js (import + usage)
  </verify>
  <done>CommentInput.js has the isGiphyReady guard extracted from the mixed commit, DMInput.js is NOT present, total of 8 commits on hotfix branch</done>
</task>

<task type="auto">
  <name>Task 3: Validate hotfix branch — tests pass, no feature leakage</name>
  <files></files>
  <action>
    On the hotfix/production-fixes branch:

    1. Run the test suite to verify nothing is broken:
       ```
       npm test
       ```
       All existing tests should pass. The photoService.test.js changes from commit 6dd917e9 should be compatible.

    2. Verify NO new feature files leaked in:
       ```
       git diff --name-only main..hotfix/production-fixes
       ```
       The output should contain ONLY these files (no DM, snap, streak, or pinned snap files):
       - src/components/comments/CommentsBottomSheet.js
       - src/components/comments/CommentInput.js
       - src/services/firebase/photoService.js
       - src/services/uploadQueueService.js
       - __tests__/services/photoService.test.js
       - src/components/CustomBottomTabBar.js
       - src/screens/FeedScreen.js
       - src/utils/imageUtils.js
       - src/screens/ActivityScreen.js
       - src/components/PixelSpinner.js
       - src/components/comments/GifPicker.js

       If ANY file appears that is NOT in this list, investigate: either a cherry-pick brought in unintended changes, or a conflict resolution included extra code.

    3. Spot-check for feature code leakage — search for DM/snap/streak imports:
       ```
       git diff main..hotfix/production-fixes | grep -i "messageService\|snapService\|streakService\|DMInput\|SnapViewer\|pinnedSnap"
       ```
       This should return ZERO results.

    4. Print the final summary for the user:
       ```
       echo "=== Hotfix Branch Summary ==="
       echo "Branch: hotfix/production-fixes"
       echo "Base: main"
       git log --oneline main..hotfix/production-fixes
       echo ""
       echo "Files changed:"
       git diff --stat main..hotfix/production-fixes
       ```

    5. Switch back to the original branch:
       ```
       git checkout feat/dm
       ```

    6. Remind user of next steps:
       - Review the hotfix branch: `git log hotfix/production-fixes`
       - Push: `git push -u origin hotfix/production-fixes`
       - Create PR to main (or merge directly)
       - After merge, deploy OTA: `eas update --branch production --message "hotfix: 8 production bug fixes"`
  </action>
  <verify>
    <automated>cd C:/Users/maser/Projects/flick && git stash && git checkout hotfix/production-fixes && npm test 2>&1 | tail -5 && git diff --name-only main..hotfix/production-fixes | wc -l && git checkout feat/dm && git stash pop 2>/dev/null; true</automated>
    Expected: tests pass, exactly 11 files changed, back on feat/dm
  </verify>
  <done>All tests pass on hotfix branch, exactly 11 files modified (no feature leakage), branch is ready for PR/merge and OTA deployment. User has been reminded to run `eas update` after merge.</done>
</task>

</tasks>

<verification>
1. `git log --oneline main..hotfix/production-fixes` shows exactly 8 commits
2. `git diff --name-only main..hotfix/production-fixes` shows exactly 11 files, all pre-existing on main
3. `npm test` passes on the hotfix branch
4. `git diff main..hotfix/production-fixes | grep -ci "messageService\|snapService\|streakService"` returns 0
5. Current branch is back on feat/dm after verification
</verification>

<success_criteria>
- hotfix/production-fixes branch exists off main with 8 commits (7 full cherry-picks + 1 partial extraction)
- All cherry-picked changes affect only files that exist on production main
- No DM, snap, streak, pinned snap, or Live Activity code is present on the hotfix branch
- Test suite passes on the hotfix branch
- feat/dm branch is untouched (no modifications)
- User knows to push, PR, merge, and run `eas update --branch production` to deploy
</success_criteria>

<output>
After completion, create `.planning/quick/260318-dia-separate-feat-dm-branch-changes-into-fea/260318-dia-SUMMARY.md`
</output>
