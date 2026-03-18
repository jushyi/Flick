---
phase: quick-3
plan: 01
subsystem: image-caching
tags: [bug-fix, cache, expo-image, firebase-storage, profile-photos]
dependency_graph:
  requires: []
  provides: [proper-profile-photo-cache-invalidation]
  affects:
    [
      CustomBottomTabBar,
      CommentRow,
      MentionSuggestionsOverlay,
      InAppNotificationBanner,
      all-components-using-profileCacheKey,
    ]
tech_stack:
  added: []
  patterns: [URL-token-based cache key derivation]
key_files:
  created: []
  modified:
    - src/utils/imageUtils.js
    - src/components/CustomBottomTabBar.js
    - src/components/comments/CommentRow.js
    - src/components/comments/MentionSuggestionsOverlay.js
    - src/components/InAppNotificationBanner.js
decisions:
  - profileCacheKey now extracts Firebase Storage token query param as cache discriminator
  - Fallback to full URL slice (not path-stripped) for non-Firebase URLs
  - Components use profileCacheKey(prefix, url) pattern uniformly across the app
metrics:
  duration: 2 min
  completed: 2026-02-26
  tasks_completed: 2
  files_modified: 5
---

# Quick Task 3: Fix Stale Profile Photo Caching Summary

**One-liner:** Fixed cache key generation to use Firebase Storage token param instead of path-only hashing, ensuring all 14+ profile photo display sites invalidate correctly on re-upload.

## What Was Built

Fixed a two-part cache invalidation bug causing stale profile photos to persist after updates:

1. **`profileCacheKey` root cause fix** (`src/utils/imageUtils.js`) — The function was stripping query params via `split('?')[0]`, meaning it always saw the same path (`...profile.jpg`) regardless of re-upload. Firebase Storage's `token` query param is the only thing that changes on re-upload to the same path. Now extracts the token and uses its last 8 chars.

2. **Four components with fully static cache keys** — These used hardcoded strings with no URL-derived component, causing permanent stale serving until sign-out cleared the expo-image cache. All four now call `profileCacheKey(prefix, url)`.

## Tasks Completed

| Task | Name                                     | Commit  | Files Modified                                                                                 |
| ---- | ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| 1    | Fix profileCacheKey to include URL token | 39bdfde | src/utils/imageUtils.js                                                                        |
| 2    | Fix static cache keys in 4 components    | fd1b9d2 | CustomBottomTabBar.js, CommentRow.js, MentionSuggestionsOverlay.js, InAppNotificationBanner.js |

## Verification

- Node.js inline test: two Firebase URLs with different tokens (`aaa-bbb-111` vs `ccc-ddd-222`) produce keys `profile-abc--bbb-111` vs `profile-abc--ddd-222` — confirmed different.
- Grep for `cacheKey: 'profile-tab-icon'`, `cacheKey: \`avatar-${`, `cacheKey: \`mention-${`, `cacheKey: 'notif-avatar'` returns zero results.
- All profile photo display sites (14 total across src/) use `profileCacheKey`.
- ESLint passed on all modified files (via lint-staged pre-commit hook).

## Deviations from Plan

None - plan executed exactly as written.

## Root Cause Summary

Firebase Storage download URLs for profile photos follow:
`https://firebasestorage.googleapis.com/.../profile.jpg?alt=media&token={uuid}`

The storage path never changes (same userId, same filename). The `token` UUID is the only differentiator between old and new uploads. The original `profileCacheKey` used `photoURL.split('?')[0].slice(-8)` which always returned `ile.jpg` — identical before and after any photo update. This meant expo-image always hit its cache and never fetched the new image.

## Self-Check: PASSED

- src/utils/imageUtils.js: modified, committed 39bdfde
- src/components/CustomBottomTabBar.js: modified, committed fd1b9d2
- src/components/comments/CommentRow.js: modified, committed fd1b9d2
- src/components/comments/MentionSuggestionsOverlay.js: modified, committed fd1b9d2
- src/components/InAppNotificationBanner.js: modified, committed fd1b9d2
