---
phase: 46-performance-optimization
plan: 03
subsystem: performance
tags: [expo-image, cacheKey, cache-control, firebase-storage, cdn, image-optimization]

# Dependency graph
requires:
  - phase: 46-01
    provides: server-side filtered feed queries
  - phase: 46-02
    provides: optimized Firestore reads with indexes
provides:
  - expo-image migration complete (all remote images)
  - stable cacheKey on all Image sources (survives URL token rotation)
  - CDN edge caching via Cache-Control on all Storage uploads
affects: [47-firebase-perf-monitoring, 48-ui-ux-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      expo-image with cacheKey for stable caching,
      Cache-Control metadata on Firebase Storage uploads,
    ]

key-files:
  created: []
  modified:
    [
      src/screens/StoriesViewerModal.js,
      src/components/AlbumCard.js,
      src/components/MonthlyAlbumCard.js,
      src/components/FullscreenSelectsViewer.js,
      src/components/InAppNotificationBanner.js,
      src/screens/ProfileScreen.js,
      src/components/ProfileSong/ProfileSongCard.js,
      src/components/FeedPhotoCard.js,
      src/screens/PhotoDetailScreen.js,
      src/components/PhotoDetailModal.js,
      src/components/SwipeablePhotoCard.js,
      src/components/comments/CommentRow.js,
      src/components/MeStoryCard.js,
      src/components/FriendStoryCard.js,
      src/screens/RecentlyDeletedScreen.js,
      src/screens/AlbumPhotoPickerScreen.js,
      src/screens/AlbumGridScreen.js,
      src/components/AlbumPhotoViewer.js,
      src/screens/MonthlyAlbumGridScreen.js,
      src/components/FriendCard.js,
      src/navigation/AppNavigator.js,
      src/services/firebase/storageService.js,
    ]

key-decisions:
  - 'Skip cacheKey for iTunes album art (stable Apple CDN URLs without tokens)'
  - 'Skip cacheKey for local device URIs (camera roll, darkroom captures)'
  - '1-year Cache-Control max-age for immutable photo uploads'

patterns-established:
  - 'expo-image cacheKey pattern: cacheKey={`type-${id}`} for all Firebase-hosted images'
  - 'Cache-Control metadata on all Storage uploads for CDN edge caching'

issues-created: []

# Metrics
duration: 12min
completed: 2026-02-10
---

# Phase 46 Plan 03: Image Loading & Caching Summary

**Complete expo-image migration with stable cacheKey on all 22 image components and CDN edge caching via Cache-Control headers on Storage uploads**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-10T00:00:00Z
- **Completed:** 2026-02-10T00:12:00Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- Migrated remaining 7 files from react-native Image to expo-image (fixing CRIT-6 StoriesViewerModal bug)
- Added stable cacheKey to all expo-image sources across 20 files — prevents re-downloads on Firebase URL token rotation
- Added Cache-Control: public, max-age=31536000 metadata to all 3 upload functions in storageService.js for CDN edge caching

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete expo-image migration for remaining files** - `9e095b6` (perf)
2. **Task 2: Add cacheKey to all image sources and Cache-Control to uploads** - `a371556` (perf)

## Files Created/Modified

- `src/screens/StoriesViewerModal.js` - Fixed CRIT-6: migrated to expo-image + cacheKey for profile/story
- `src/components/AlbumCard.js` - Migrated 3 Image instances + recyclingKey + cacheKey for cover/stack
- `src/components/MonthlyAlbumCard.js` - Migrated to expo-image + recyclingKey + cacheKey
- `src/components/FullscreenSelectsViewer.js` - Migrated with contentFit="contain"
- `src/components/InAppNotificationBanner.js` - Migrated notification avatar + cacheKey
- `src/screens/ProfileScreen.js` - Migrated profile photo + cacheKey
- `src/components/ProfileSong/ProfileSongCard.js` - Migrated album art with low priority
- `src/components/FeedPhotoCard.js` - Added cacheKey for photo and profile images
- `src/screens/PhotoDetailScreen.js` - Added cacheKey to 4 Image instances + snapshot ref enhancement
- `src/components/PhotoDetailModal.js` - Added cacheKey for photo and profile
- `src/components/SwipeablePhotoCard.js` - Added cacheKey for photo
- `src/components/comments/CommentRow.js` - Added cacheKey for avatar and media
- `src/components/MeStoryCard.js` - Added cacheKey for story thumb and profile
- `src/components/FriendStoryCard.js` - Added cacheKey for story thumb and profile
- `src/screens/RecentlyDeletedScreen.js` - Added cacheKey to 2 Image instances
- `src/screens/AlbumPhotoPickerScreen.js` - Added cacheKey for photo
- `src/screens/AlbumGridScreen.js` - Added cacheKey for photo
- `src/components/AlbumPhotoViewer.js` - Added cacheKey to full photo and thumbnail
- `src/screens/MonthlyAlbumGridScreen.js` - Added cacheKey to 3 Image instances
- `src/components/FriendCard.js` - Added cacheKey for profile
- `src/navigation/AppNavigator.js` - Added cacheKey for tab bar avatar
- `src/services/firebase/storageService.js` - Added Cache-Control metadata to all 3 upload functions

## Decisions Made

- Skipped cacheKey for iTunes album art (ClipSelectionModal, SongSearchResult, ProfileSongCard) — stable Apple CDN URLs without tokens
- Skipped cacheKey for local device URIs (SelectsBanner, FullscreenSelectsViewer, SelectsScreen, CommentInput) — not Firebase-hosted
- Used 1-year max-age for Cache-Control since photos are immutable (unique ID per photo)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added cacheKey to FriendCard.js and AppNavigator.js**

- **Found during:** Task 2 (cacheKey sweep)
- **Issue:** Plan listed specific files but FriendCard.js and AppNavigator.js also display remote profile photos via expo-image without cacheKey
- **Fix:** Added `cacheKey={`profile-${userId}`}` to FriendCard and `cacheKey='profile-tab-icon'` to AppNavigator tab bar
- **Files modified:** src/components/FriendCard.js, src/navigation/AppNavigator.js
- **Verification:** All expo-image instances with remote URLs now have cacheKey
- **Committed in:** a371556

**2. [Rule 2 - Missing Critical] Enhanced PhotoDetailScreen snapshot ref for cacheKey**

- **Found during:** Task 2 (cacheKey addition to PhotoDetailScreen)
- **Issue:** Cube transition animation needed photoId and userId on snapshotRef for proper cacheKey generation on outgoing face
- **Fix:** Added photoId and userId fields to snapshotRef.current
- **Files modified:** src/screens/PhotoDetailScreen.js
- **Verification:** CacheKey properly generated for both incoming and outgoing cube faces
- **Committed in:** a371556

---

**Total deviations:** 2 auto-fixed (2 missing critical), 0 deferred
**Impact on plan:** Both auto-fixes necessary for complete cacheKey coverage. No scope creep.

## Issues Encountered

None

## Next Phase Readiness

- All remote images now use expo-image with stable cacheKey — immune to Firebase URL token rotation
- CDN edge caching enabled for all photo uploads
- Ready for FlatList & React rendering optimization (46-04)

---

_Phase: 46-performance-optimization_
_Completed: 2026-02-10_
