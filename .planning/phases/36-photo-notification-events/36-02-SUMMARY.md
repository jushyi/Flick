---
phase: 36-photo-notification-events
plan: 02
subsystem: notifications
tags: [firebase, cloud-functions, push-notifications, tagged-notifications, photo-tagging]

# Dependency graph
requires:
  - phase: 36-01
    provides: Story notification patterns, getRandomTemplate function
  - phase: 35-02
    provides: Social notification triggers and preference checking pattern
  - phase: 34
    provides: Push notification infrastructure (expo-server-sdk, token refresh)
provides:
  - sendTaggedPhotoNotification Cloud Function
  - Tagged notification deep link handling
  - TAGGING-SCHEMA.md for Phase 39/40 integration
affects: [phase-39, phase-40, phase-41]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TAG_NOTIFICATION_TEMPLATES for single tag notifications
    - TAG_BATCH_TEMPLATES for batch tag notifications
    - pendingTags object for 30-second debounce window
    - taggedUserIds array schema for photo documents

key-files:
  created:
    - .planning/phases/36-photo-notification-events/TAGGING-SCHEMA.md
  modified:
    - functions/index.js
    - src/services/firebase/notificationService.js

key-decisions:
  - '30-second debounce window for tag batching (longer than 10s reaction debounce)'
  - '5 templates for single tags, 3 for batch tags'
  - 'Tagged notifications fall under "tags" preference category'
  - 'Deep link opens tagger story and scrolls to specific photo'

patterns-established:
  - 'pendingTags object with timeout for debouncing multiple tags'
  - 'taggedUserIds array diff detection for new tags only'
  - 'Batch notification with photoIds array and photoCount'

issues-created: []

# Metrics
duration: 12min
completed: 2026-02-06
---

# Phase 36 Plan 02: Tagged Photo Notifications Summary

**Implement tagged photo notification infrastructure that will alert users when they're tagged in photos**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-06
- **Completed:** 2026-02-06
- **Tasks:** 3
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

- Added TAG_NOTIFICATION_TEMPLATES (5 varied templates for single tags)
- Added TAG_BATCH_TEMPLATES (3 templates for batch notifications)
- Created sendBatchedTagNotification helper function
- Created sendTaggedPhotoNotification Cloud Function watching photos/{photoId}.onUpdate
- Implemented 30-second debounce window for tag batching
- Added 'tagged' case to handleNotificationTapped() with deep link params
- Created TAGGING-SCHEMA.md documenting expected schema for Phase 39/40 integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sendTaggedPhotoNotification Cloud Function** - `f178731` (feat)
2. **Task 2: Add tagged notification deep link handler** - `6660c76` (feat)
3. **Task 3: Document taggedUserIds schema** - `197206c` (docs)

## Files Created/Modified

- `functions/index.js` - Added TAG_NOTIFICATION_TEMPLATES, TAG_BATCH_TEMPLATES, pendingTags, TAG_DEBOUNCE_MS, sendBatchedTagNotification, sendTaggedPhotoNotification
- `src/services/firebase/notificationService.js` - Added 'tagged' case to handleNotificationTapped with highlightUserId, highlightPhotoId, openStory, scrollToPhoto params
- `.planning/phases/36-photo-notification-events/TAGGING-SCHEMA.md` - Schema documentation for Phase 39/40 integration

## Deployment

- **Functions deployed:** sendTaggedPhotoNotification (new), sendStoryNotification (from 36-01)
- **Deployment status:** Successful
- **Console:** https://console.firebase.google.com/project/re-lapse-fa89b/overview

## Decisions Made

- 30-second debounce window (longer than 10-second reaction debounce) since tagging multiple photos is common during triage
- Deep link opens tagger's story and scrolls to specific tagged photo
- Skip notifications for self-tags and deleted photos
- Tagged notifications respect "tags" notification preference

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Phase 36 Status

Phase 36 is now complete. Both plans executed:

- 36-01: Story notifications (triage completion triggers, Cloud Function, deep linking)
- 36-02: Tagged photo notifications (Cloud Function ready for Phase 39/40 tagging UI)

## Next Steps

- Phase 37: Darkroom Ready Notifications (audit existing implementation)
- Phase 38: Notification UI Polish
- Phase 39: Darkroom Photo Tagging (will add taggedUserIds to photos)
- Phase 40: Feed Photo Tagging (will add taggedUserIds to existing photos)

---

_Phase: 36-photo-notification-events_
_Completed: 2026-02-06_
