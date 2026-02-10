---
phase: 44-notification-activity-feed
plan: 02
subsystem: notifications
tags: [activity-feed, deep-linking, reaction-clumping, time-grouping, navigation]

# Dependency graph
requires:
  - phase: 44-01
    provides: unified deep linking for all notification types
  - phase: 38-notification-ui-polish
    provides: notification tap handling, per-tap mark-as-read
provides:
  - Reaction clumping (per-user-per-photo deduplication)
  - Time-grouped section headers (Today / This Week / Earlier)
  - Correct deep links opening PhotoDetail for all photo-related notification types
  - Story notification deep linking to stories viewer
affects: [46-full-notifications-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'useMemo for derived notification data (clumping + grouping)'
    - 'openPhotoDetail context for notification deep links'

key-files:
  created: []
  modified:
    - src/screens/ActivityScreen.js

key-decisions:
  - 'Reaction clumping uses client-side deduplication via Map keyed on senderId+photoId'
  - 'All photo-related notification taps fetch photo and open PhotoDetail directly instead of navigating to Feed'
  - "Story taps fetch poster's story data via getUserStoriesData and open in stories mode"
  - "friend_accepted navigates to sender's profile, not friends list"
  - "Story action text hardcoded to 'posted to their story' to avoid Cloud Function template name duplication"

patterns-established: []

issues-created: []

# Metrics
duration: 32min
completed: 2026-02-09
---

# Phase 44 Plan 02: Reaction Clumping + Time Grouping + Deep Link Polish Summary

**Client-side reaction deduplication per user+photo, time-grouped section headers (Today/This Week/Earlier), and corrected deep links opening PhotoDetail directly for all photo notification types**

## Performance

- **Duration:** 32 min
- **Started:** 2026-02-09T21:03:11Z
- **Completed:** 2026-02-09T21:35:52Z
- **Tasks:** 2 planned + 1 checkpoint (with bug fixes during verification)
- **Files modified:** 1

## Accomplishments

- Reaction notifications from the same user on the same photo are collapsed into a single item showing latest reaction state
- Notifications display under time-grouped section headers (Today, This Week, Earlier) with empty sections omitted
- All photo-related notification taps (reaction, comment, mention, tagged) now open PhotoDetail directly
- Comment/mention taps auto-open the comments sheet
- Story taps fetch and open the poster's story in stories mode
- Story notification text fixed to avoid duplicate sender name

## Task Commits

Each task was committed atomically:

1. **Task 1: Add client-side reaction clumping** - `8128b50` (feat)
2. **Task 2: Add time-grouped section headers** - `0ff4baa` (feat)

Bug fixes during checkpoint verification:

3. **Fix notification deep links to open PhotoDetail directly** - `f8a9eca` (fix)
4. **Fix story notification text and deep link** - `47dd844` (fix)

## Files Created/Modified

- `src/screens/ActivityScreen.js` - Added reaction clumping, time grouping, corrected all notification deep links, fixed story text

## Decisions Made

- Reaction clumping uses client-side Map deduplication keyed on `senderId+photoId`, keeping the latest by `createdAt.seconds`
- All photo notification taps fetch the photo via `getPhotoById` and open `PhotoDetail` instead of navigating to Feed (which had no handler for photoId params)
- Story taps use `getUserStoriesData(item.senderId)` to fetch story photos and open in stories mode
- `friend_accepted` navigates to sender's profile (not friends list) — more useful to see who accepted
- Story action text hardcoded to "posted to their story" because Cloud Function templates embed the name mid-sentence causing "Abby See what Abby captured today"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Notification deep links navigated to Feed instead of opening photo**

- **Found during:** Checkpoint verification
- **Issue:** All photo notification types (reaction, comment, mention, tagged) navigated to `MainTabs > Feed` with `photoId` param, but FeedScreen had no handler for that param — notifications did nothing
- **Fix:** Import `usePhotoDetail` and `getPhotoById`, fetch photo from Firestore, open `PhotoDetail` directly. Comment/mention taps set `initialShowComments: true`
- **Files modified:** src/screens/ActivityScreen.js
- **Verification:** User confirmed all notification types open correct screens
- **Committed in:** `f8a9eca`

**2. [Rule 1 - Bug] friend_accepted navigated to friends list instead of sender's profile**

- **Found during:** Checkpoint verification
- **Issue:** Tapping friend_accepted notification went to FriendsList — user expected to see who accepted
- **Fix:** Changed to `handleAvatarPress(item.senderId, item.senderName)` for OtherUserProfile navigation
- **Files modified:** src/screens/ActivityScreen.js
- **Committed in:** `f8a9eca` (same commit)

**3. [Rule 1 - Bug] Story notification displayed duplicate sender name**

- **Found during:** Checkpoint verification
- **Issue:** Cloud Function uses templates like "See what {name} captured today" which embeds name mid-sentence. Activity feed prepends sender name, resulting in "Abby See what Abby captured today"
- **Fix:** Added explicit `type === 'story'` check in `getActionText` returning "posted to their story"
- **Files modified:** src/screens/ActivityScreen.js
- **Committed in:** `47dd844`

**4. [Rule 1 - Bug] Story notification tap didn't open story**

- **Found during:** Checkpoint verification
- **Issue:** Story tap used `item.userId` (nonexistent field) instead of `item.senderId`. Condition was always false, falling through to default profile navigation
- **Fix:** Changed to `item.senderId`, fetch story data via `getUserStoriesData`, open in PhotoDetail stories mode
- **Files modified:** src/screens/ActivityScreen.js
- **Committed in:** `47dd844`

---

**Total deviations:** 4 auto-fixed bugs (all deep linking / display issues found during visual verification)
**Impact on plan:** All fixes necessary for correct notification behavior. No scope creep.

## Issues Encountered

None beyond the deep linking bugs caught during checkpoint verification.

## Next Phase Readiness

- Phase 44 (Notification Activity Feed) is complete
- All notification types render correctly with proper deep linking
- Ready for Phase 45 (Security Audit)

---

_Phase: 44-notification-activity-feed_
_Completed: 2026-02-09_
