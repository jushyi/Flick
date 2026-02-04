# UAT Issues: Phase 18 Plan 01

**Tested:** 2026-02-04
**Source:** .planning/phases/18-content-visibility/18-01-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

None - all issues resolved in 18-01-FIX.

## Resolved Issues

### UAT-004: Visibility should use triage timestamp, not capture timestamp

**Discovered:** 2026-02-04
**Resolved:** 2026-02-04 - Fixed in 18-01-FIX
**Phase/Plan:** 18-01
**Severity:** Major
**Feature:** Content visibility duration
**Description:** Currently visibility is calculated from `capturedAt` (when photo was taken). Should use `triagedAt` (when user triaged to journal) instead. Users often wait days to triage photos, so they may "expire" before anyone sees them.
**Resolution:** Changed all 4 visibility queries (getFeedPhotos, subscribeFeedPhotos, getUserStoriesData, getFriendStoriesData) to filter by `triagedAt >= cutoff` instead of `capturedAt >= cutoff`. Also updated `triagePhoto()` to set `triagedAt: serverTimestamp()` when journaling/archiving.
**Files modified:** `src/services/firebase/feedService.js`, `src/services/firebase/photoService.js`
**Commit:** `86c06b5`

### UAT-002: Older photos missing photoState field (data migration needed)

**Discovered:** 2026-02-04
**Resolved:** 2026-02-04 - Fixed in 18-01-FIX
**Phase/Plan:** 18-01
**Severity:** Major
**Feature:** Content visibility filtering
**Description:** Photos triaged before the photoState field was added have `photoState: null` instead of `'journal'` or `'archive'`. These photos don't appear in the visibility-filtered queries.
**Resolution:** Added `migratePhotoStateField()` function to photoService.js. Queries triaged photos, filters for null/undefined photoState, sets `photoState: 'journal'` and ensures `triagedAt` timestamp. Uses Firestore batch writes for efficiency (max 500 per batch). Function exported for use from settings/admin.
**Files modified:** `src/services/firebase/photoService.js`
**Commit:** `57dd100`

### UAT-003: Pull-to-refresh doesn't reload stories

**Discovered:** 2026-02-04
**Resolved:** 2026-02-04 - Fixed in 18-01-FIX
**Phase/Plan:** 18-01
**Severity:** Minor
**Feature:** Stories bar refresh
**Description:** Pulling down to refresh on the feed screen doesn't reload the stories bar. Only a full app reload updates stories.
**Resolution:** Updated `handleRefresh()` in FeedScreen.js to call `loadMyStories()` in addition to `refreshFeed()` and `loadFriendStories()`. All three data sources now refresh on pull-to-refresh.
**Files modified:** `src/screens/FeedScreen.js`
**Commit:** `2c04d67`

### UAT-005: Empty feed should show random friend photos

**Discovered:** 2026-02-04
**Resolved:** 2026-02-04 - Fixed in 18-01-FIX
**Phase/Plan:** 18-01
**Severity:** Minor
**Feature:** Feed content
**Description:** When there are no recent posts within the visibility window, the feed is empty. Should show random older photos from friends as a fallback so feed is never empty.
**Resolution:** Added `getRandomFriendPhotos()` function to feedService.js that queries all journaled friend photos (no time filter), shuffles randomly, and returns limited count. FeedScreen now loads archive photos as fallback when recent feed is empty but user has friends.
**Files modified:** `src/services/firebase/feedService.js`, `src/screens/FeedScreen.js`
**Commit:** `f1d0cb5`

### UAT-006: Duplicate day headers in monthly albums when journaling old photos

**Discovered:** 2026-02-04
**Resolved:** 2026-02-04
**Phase/Plan:** 18-01
**Severity:** Medium
**Feature:** Monthly albums display
**Description:** When journaling photos from a previous date (e.g., Jan 26 photos journaled on Feb 4), the monthly album creates a duplicate day header instead of merging with existing photos from that day.
**Root cause:** `photoService.js` sets `month` field to current month when creating photos, and `triagePhoto()` didn't update the `month` field based on `capturedAt`. Photos ended up with mismatched `month` field vs their actual `capturedAt` date.
**Resolution:** Added `getMonthFromTimestamp()` helper and updated `triagePhoto()` to recalculate `month` from `capturedAt` when journaling.
**Files modified:** `src/services/firebase/photoService.js`
**Note:** Existing photos with incorrect `month` fields are not auto-migrated. New triage actions will use correct month.

### UAT-001: Missing Firestore composite indexes

**Discovered:** 2026-02-04
**Resolved:** 2026-02-04 - User created indexes manually in Firebase Console
**Phase/Plan:** 18-01
**Severity:** Blocker (resolved)
**Feature:** Content visibility duration filtering
**Description:** The new server-side Firestore queries with timestamp filtering required composite indexes that didn't exist.
**Resolution:** Created two indexes in Firebase Console:

1. `photos` collection: `photoState` (Asc) + `userId` (Asc) + `capturedAt` (Asc)
2. `photos` collection: `photoState` (Asc) + `capturedAt` (Asc)

---

_Phase: 18-content-visibility_
_Plan: 01_
_Tested: 2026-02-04_
_All issues resolved: 2026-02-04_
