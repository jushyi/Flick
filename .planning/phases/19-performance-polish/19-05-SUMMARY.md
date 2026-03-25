---
phase: 19-performance-polish
plan: 05
subsystem: performance
tags: [image-transforms, prefetching, optimistic-updates, signed-urls, tanstack-query, expo-image]

# Dependency graph
requires:
  - phase: 19-01
    provides: skeleton screens and Toast config
  - phase: 19-02
    provides: imageUrl utilities (appendTransformParams, isUrlNearExpiry, FEED_CARD_WIDTH)
  - phase: 19-03
    provides: useOptimisticMutation hook with multi-key support
provides:
  - 400px feed card images via Supabase image transforms
  - Prefetching of first image per friend on feed load
  - Prefetching of next 3 photos during story viewing
  - Optimistic mutations for comments, mark-as-read, blocks, albums
  - Proactive signed URL refresh for snap images
affects: [phase-20-cutover, phase-21-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [useOptimisticMutation wiring pattern, useSnapUrl local hook pattern, appendTransformParams for full URLs]

key-files:
  created: []
  modified:
    - src/hooks/useFeedPhotos.ts
    - src/hooks/usePhotoDetailModal.js
    - src/components/FriendStoryCard.js
    - src/hooks/useComments.ts
    - src/hooks/useConversation.ts
    - src/hooks/useAlbums.ts
    - src/hooks/useBlocks.ts
    - src/services/supabase/signedUrlService.ts
    - src/screens/ConversationScreen.js
    - __tests__/hooks/useAlbums.test.ts

key-decisions:
  - "Reactions left on old Firebase callback pattern -- converting to useOptimisticMutation multi-key requires architectural refactor of FeedScreen reaction flow"
  - "useSnapUrl implemented as local hook in ConversationScreen rather than standalone file since it is tightly coupled to snap viewing flow"
  - "refreshSignedUrlIfExpiring returns original URL on error for graceful degradation with expo-image disk cache"

patterns-established:
  - "useOptimisticMutation wiring: replace useMutation calls with useOptimisticMutation providing queryKey, updater, and errorMessage"
  - "useSnapUrl pattern: check isUrlNearExpiry before rendering signed URLs, refresh in background while serving cached image"

requirements-completed: [PERF-04, PERF-05, PERF-06, PERF-10, PERF-11]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 19 Plan 05: Integration Wiring Summary

**400px feed image transforms with prefetching, optimistic mutations on all TanStack hooks, and proactive snap URL expiry refresh**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T15:55:07Z
- **Completed:** 2026-03-25T15:59:49Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Feed images served at 400px via appendTransformParams, with full-res preserved for PhotoDetail
- First image per friend prefetched on feed load; next 3 prefetched during story viewing
- All TanStack mutation hooks (comments, mark-as-read, blocks, albums) wired to useOptimisticMutation with automatic rollback and toast on error
- signedUrlService gains refreshSignedUrlIfExpiring for proactive snap URL refresh
- ConversationScreen gains useSnapUrl local hook for expiry-aware snap rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire image transform URLs + prefetching into feed and story hooks** - `db2e0f7` (feat)
2. **Task 2: Wire useOptimisticMutation into comment, read, block, album, and reaction mutation hooks** - `4e253a0` (feat)
3. **Task 3: Wire proactive signed URL refresh into snap rendering** - `1fbba56` (feat)

## Files Created/Modified
- `src/hooks/useFeedPhotos.ts` - 400px card image URLs via appendTransformParams, prefetch first image per friend
- `src/hooks/usePhotoDetailModal.js` - Batch prefetch on story open, adjacent prefetch during navigation, next-friend prefetch
- `src/components/FriendStoryCard.js` - Thumbnail images served at 400px
- `src/hooks/useComments.ts` - add/delete/like/unlike comments with useOptimisticMutation
- `src/hooks/useConversation.ts` - useMarkAsRead with optimistic unread count reset
- `src/hooks/useAlbums.ts` - update/addPhotos/removePhotos with useOptimisticMutation
- `src/hooks/useBlocks.ts` - block/unblock with optimistic list updates
- `src/services/supabase/signedUrlService.ts` - refreshSignedUrlIfExpiring helper
- `src/screens/ConversationScreen.js` - useSnapUrl local hook with isUrlNearExpiry check
- `__tests__/hooks/useAlbums.test.ts` - Updated tests for optimistic mutation wiring

## Decisions Made
- **Reactions deferred:** Reaction toggle in FeedScreen uses old Firebase callback architecture (context -> PhotoDetailScreen -> usePhotoDetailModal -> onReactionToggle). Converting to useOptimisticMutation multi-key pattern requires refactoring the entire reaction flow from callbacks to TanStack mutations. This will be addressed when FeedScreen migrates fully to Supabase data.
- **useSnapUrl as local hook:** Implemented in ConversationScreen.js rather than as a separate file since it's tightly coupled to the snap viewing flow and only used in one screen.
- **Graceful degradation:** refreshSignedUrlIfExpiring returns the original URL on any error, relying on expo-image's disk cache to serve the cached image even if the URL has technically expired.

## Deviations from Plan

### Deferred Items

**1. Reaction multi-key optimistic updates**
- **Reason:** Reactions flow through old Firebase callback chain (FeedScreen -> PhotoDetailContext -> usePhotoDetailModal -> onReactionToggle). The actual mutation lives in FeedScreen with manual optimistic state management, not TanStack useMutation. Converting requires architectural refactoring beyond this plan's scope.
- **Impact:** Reaction toggling still works (existing manual optimistic UI) but doesn't benefit from useOptimisticMutation's automatic rollback/toast pattern.
- **Resolution:** Will be addressed when FeedScreen reaction flow migrates from Firebase to Supabase TanStack queries.

---

**Total deviations:** 1 deferred (reaction multi-key updaters)
**Impact on plan:** All other integrations complete. Reaction optimization is a future improvement, not a regression.

## Issues Encountered
- Pre-existing test failures in notificationService.test.js (4 tests) -- old Firebase notification service tests unrelated to this plan's changes.

## Known Stubs
None -- all integrations are fully wired with real data sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 performance-polish plans 01-05 complete
- All image transform, prefetching, optimistic mutation, and URL refresh infrastructure is in place
- Ready for Phase 20 cutover or Phase 21 verification

---
*Phase: 19-performance-polish*
*Completed: 2026-03-25*
