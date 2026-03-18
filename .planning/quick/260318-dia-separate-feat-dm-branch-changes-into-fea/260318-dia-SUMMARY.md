---
phase: quick
plan: 260318-dia
subsystem: git-ops
tags: [cherry-pick, hotfix, ota-deployment, production-fixes]

# Dependency graph
requires:
  - phase: feat/dm
    provides: "Bug fix commits to cherry-pick"
provides:
  - "hotfix/production-fixes branch with 9 production-safe commits"
  - "OTA-deployable bug fixes independent of feat/dm feature code"
affects: [production, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: ["upload-first-then-write pattern for photo race condition fix"]

key-files:
  created: []
  modified:
    - src/components/comments/CommentsBottomSheet.js
    - src/components/comments/CommentInput.js
    - src/services/firebase/photoService.js
    - src/services/uploadQueueService.js
    - __tests__/services/photoService.test.js
    - __tests__/integration/photoLifecycle.test.js
    - src/components/CustomBottomTabBar.js
    - src/screens/FeedScreen.js
    - src/utils/imageUtils.js
    - src/screens/ActivityScreen.js
    - src/components/PixelSpinner.js
    - src/components/comments/GifPicker.js

key-decisions:
  - "Resolved 2 cherry-pick comment-only conflicts by keeping the more descriptive comments from feat/dm"
  - "Added integration test fix commit to match refactored createPhoto upload-first flow"
  - "CustomBottomTabBar.js had no diff on hotfix (already up to date on main) so was auto-excluded from cache key commit"

patterns-established: []

requirements-completed: [HOTFIX-CHERRY-PICK]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Quick Task 260318-dia: Separate feat/dm Branch Changes Summary

**9 production-safe bug fixes cherry-picked from feat/dm into hotfix/production-fixes branch, ready for OTA deployment via `eas update`**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T13:57:11Z
- **Completed:** 2026-03-18T14:03:31Z
- **Tasks:** 3
- **Files modified:** 12 (11 source + 1 integration test)

## Accomplishments
- Created hotfix/production-fixes branch off main with 9 commits (7 full cherry-picks + 1 partial extraction + 1 test fix)
- All tests pass on hotfix branch (23 suites, 747 tests; 5 function suites, 82 tests)
- Zero feature leakage -- no DM, snap, streak, or pinned snap code present

## Task Commits

Each task was committed atomically on `hotfix/production-fixes`:

1. **Task 1: Create hotfix branch and cherry-pick 7 clean commits**
   - `186edb55` fix(android): track keyboard height changes
   - `b6c618d4` fix(android): keep keyboard open after comment submit
   - `d2286e2f` fix: eliminate photo upload race condition
   - `38b0c0fa` fix: use Firebase token in profile photo cache keys
   - `7a60115c` fix: auto-clear notification badge on Activity screen
   - `0bb807e1` fix: wrap PixelSpinner SVG in centering View for Android
   - `03af00c9` fix: guard GIF picker against uninitialized Giphy SDK

2. **Task 2: Extract partial cherry-pick for CommentInput isGiphyReady guard** - `973e8b99`

3. **Task 3: Validate hotfix branch** - `2b050ec1` test: update integration tests to match refactored createPhoto flow

## Files Created/Modified

**On hotfix/production-fixes branch (not feat/dm):**
- `src/components/comments/CommentsBottomSheet.js` - Android keyboard height tracking comments
- `src/components/comments/CommentInput.js` - Android keyboard fix + isGiphyReady guard
- `src/services/firebase/photoService.js` - Photo upload race condition fix (upload-first pattern)
- `src/services/uploadQueueService.js` - Upload queue race condition fix
- `__tests__/services/photoService.test.js` - Updated unit tests for refactored photoService
- `__tests__/integration/photoLifecycle.test.js` - Updated integration tests for refactored createPhoto
- `src/screens/FeedScreen.js` - Profile photo cache key reload on change
- `src/utils/imageUtils.js` - Firebase token cache key utility with descriptive comments
- `src/screens/ActivityScreen.js` - Auto-clear notification badge on screen load
- `src/components/PixelSpinner.js` - Android centering fix
- `src/components/comments/GifPicker.js` - SDK initialization guard with isGiphyReady export

## Decisions Made
- Resolved 2 cherry-pick conflicts (CommentsBottomSheet.js and imageUtils.js) -- both were comment-only conflicts where the code was already identical on main; kept the more descriptive comments from feat/dm
- CustomBottomTabBar.js already had the cache key fix on main (no diff needed), so the cherry-pick correctly excluded it
- Added a 9th commit (integration test fix) because the photoService race condition fix changed the createPhoto API contract from addDoc-then-upload to upload-then-setDoc, breaking 3 integration tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed integration tests broken by photoService refactor**
- **Found during:** Task 3 (validation)
- **Issue:** 3 integration tests in photoLifecycle.test.js expected the old createPhoto flow (addDoc first, then upload, then updateDoc with URL). The refactored flow generates a doc ref, uploads first, then uses setDoc -- so tests mocking addDoc and deleteDoc for rollback were incorrect.
- **Fix:** Updated 3 tests: (1) mock doc() with specific ID instead of addDoc, assert setDoc instead of addDoc; (2) verify no Firestore write on upload failure instead of rollback deleteDoc; (3) capture data via setDoc mock instead of addDoc mock.
- **Files modified:** `__tests__/integration/photoLifecycle.test.js`
- **Verification:** Full test suite passes (23 suites, 738 passed + 5 function suites, 82 passed)
- **Committed in:** `2b050ec1`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Essential fix -- tests would fail on the hotfix branch without it. No scope creep.

## Issues Encountered
- Two cherry-pick conflicts (commits 1 and 4) were comment-only -- the code changes had already been applied to main through a previous path. Resolved by keeping the explanatory comments.
- CustomBottomTabBar.js was listed in the plan but had no diff on the hotfix (already up to date). This is expected -- the cache key commit on feat/dm touched 3 files, but one was already current on main.

## User Setup Required
None - no external service configuration required.

## Next Steps

The hotfix branch is ready. The user should:
1. Review: `git log hotfix/production-fixes`
2. Push: `git push -u origin hotfix/production-fixes`
3. Create PR to main (or merge directly)
4. After merge, deploy OTA: `eas update --branch production --message "hotfix: 9 production bug fixes"`

---
*Quick Task: 260318-dia*
*Completed: 2026-03-18*
