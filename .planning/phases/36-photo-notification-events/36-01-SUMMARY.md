---
phase: 36-photo-notification-events
plan: 01
subsystem: notifications
tags: [firebase, cloud-functions, push-notifications, story-notifications]

# Dependency graph
requires:
  - phase: 35-02
    provides: Social notification triggers and preference checking pattern
  - phase: 34
    provides: Push notification infrastructure (expo-server-sdk, token refresh)
provides:
  - Triage completion tracking in darkroom service
  - sendStoryNotification Cloud Function
  - Story notification deep link handling
affects: [phase-36-02, phase-38]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - STORY_NOTIFICATION_TEMPLATES for human-like varied messaging
    - lastTriageCompletedAt/lastStoryNotifiedAt for duplicate prevention
    - Deep link params for auto-opening stories

key-files:
  created: []
  modified:
    - src/services/firebase/photoService.js
    - src/services/firebase/darkroomService.js
    - src/hooks/useDarkroom.js
    - functions/index.js
    - src/services/firebase/notificationService.js
    - App.js

key-decisions:
  - 'Trigger story notifications on triage completion, not individual posts'
  - 'Use 5 varied templates for human feel'
  - 'Story notifications fall under "follows" preference category'
  - 'Pass highlightUserId and openStory params for future story auto-open'

patterns-established:
  - 'lastTriageCompletedAt + lastJournaledCount triggers Cloud Function'
  - 'lastStoryNotifiedAt prevents duplicate notifications'
  - 'Query both user1Id and user2Id for friendship lookups'

issues-created: []

# Metrics
duration: 15min
completed: 2026-02-06
---

# Phase 36 Plan 01: Story Notifications Summary

**Implement story notifications that alert friends when someone completes their darkroom triage and posts photos to their story**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-06
- **Completed:** 2026-02-06
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Modified batchTriagePhotos() to count and return journaledCount
- Added recordTriageCompletion() to darkroomService.js to trigger Cloud Function
- Created sendStoryNotification Cloud Function with 5 varied message templates
- Implemented duplicate prevention via lastStoryNotifiedAt field
- Added 'story' case to handleNotificationTapped() for deep linking
- Updated App.js to pass params when navigating to Feed from notifications

## Task Commits

Each task was committed atomically:

1. **Task 1: Add triage completion tracking** - `eb15286` (feat)
2. **Task 2: Create sendStoryNotification Cloud Function** - `57704dc` (feat)
3. **Task 3: Add story notification deep link handler** - `9269e5d` (feat)

## Files Created/Modified

- `src/services/firebase/photoService.js` - batchTriagePhotos now returns journaledCount
- `src/services/firebase/darkroomService.js` - Added recordTriageCompletion function
- `src/hooks/useDarkroom.js` - handleDone calls recordTriageCompletion when photos journaled
- `functions/index.js` - Added STORY_NOTIFICATION_TEMPLATES, getRandomTemplate, sendStoryNotification
- `src/services/firebase/notificationService.js` - Added 'story' case to handleNotificationTapped
- `App.js` - Updated Feed navigation to pass params for story deep linking

## Decisions Made

- Story notifications triggered on triage completion, not individual posts per CONTEXT.md
- 5 varied templates for human feel: "just journaled some snaps", "shared new moments", etc.
- Story notifications respect 'follows' notification preference
- Deep link params include highlightUserId and openStory for future auto-open feature

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Steps

- Phase 36-02: Tagged photo notifications (grouping multiple tags, deep linking to specific photo)
- FeedScreen enhancement to consume highlightUserId/openStory params for auto-opening stories

---

_Phase: 36-photo-notification-events_
_Completed: 2026-02-06_
