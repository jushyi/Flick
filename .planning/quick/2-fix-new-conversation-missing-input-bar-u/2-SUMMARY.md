---
phase: quick
plan: 2
subsystem: ui
tags: [react-native, flatlist, inverted-list, profile-photo, dm, conversation]

# Dependency graph
requires:
  - phase: 01-message-infrastructure-read-receipts
    provides: DM conversation UI (ConversationScreen, ConversationRow, ConversationHeader)
provides:
  - Fixed empty conversation empty state rendering (right-side-up text, visible input bar)
  - Correct profile photo field references in conversation list and header
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'profilePhotoURL || photoURL fallback pattern for profile photo field resolution'
    - 'scaleY: -1 counter-transform for ListEmptyComponent in inverted FlatList'
    - 'flexGrow: 1 instead of flex: 1 for inverted FlatList contentContainerStyle to preserve sibling visibility'

key-files:
  created: []
  modified:
    - src/screens/ConversationScreen.js
    - src/components/ConversationRow.js
    - src/components/ConversationHeader.js

key-decisions:
  - 'Use flexGrow: 1 instead of flex: 1 for empty FlatList content to keep DMInput visible'
  - 'Use profilePhotoURL || photoURL fallback to handle both useMessages and NewMessage navigation sources'
  - 'Add initial-letter fallback in ConversationHeader when no photo URL exists'

patterns-established:
  - 'profilePhotoURL field fallback: always use profilePhotoURL || photoURL when accessing friend profile photos'

requirements-completed: [QUICK-02]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Quick Task 2: Fix New Conversation Missing Input Bar Summary

**Fixed inverted FlatList empty state (upside-down text, hidden input bar) and profile photo field name mismatches in ConversationRow and ConversationHeader**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T20:07:39Z
- **Completed:** 2026-02-23T20:09:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Empty conversations now display "Say hi to [name]!" text right-side-up with DMInput bar visible and functional below
- Profile photos load correctly in conversation list rows (ConversationRow) using profilePhotoURL field from useMessages hook
- Profile photos load correctly in conversation header (ConversationHeader) regardless of navigation source, with initial-letter fallback when no photo exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix inverted FlatList empty state and missing input bar** - `e686a98` (fix)
2. **Task 2: Fix profile photo field name mismatch in ConversationRow and ConversationHeader** - `b7cb2bc` (fix)

## Files Created/Modified

- `src/screens/ConversationScreen.js` - Added scaleY: -1 counter-transform to EmptyConversation wrapper; replaced flex: 1 with flexGrow: 1 in empty contentContainerStyle
- `src/components/ConversationRow.js` - Changed photoURL destructuring to use profilePhotoURL || photoURL fallback
- `src/components/ConversationHeader.js` - Updated Image source to use profilePhotoURL || photoURL; added initial-letter fallback View when no photo URL exists

## Decisions Made

- Used `flexGrow: 1` instead of `flex: 1` for the empty FlatList content container style. This allows the content to grow to fill space without forcing the container to expand beyond the KeyboardAvoidingView's bounds, which keeps the DMInput visible.
- Added `profilePhotoURL || photoURL` fallback pattern in both ConversationRow and ConversationHeader to handle profile data from different sources (useMessages stores as profilePhotoURL, NewMessageScreen may pass photoURL).
- Added an initial-letter fallback in ConversationHeader (matching the pattern used in ConversationRow and NewMessageScreen) for when no profile photo URL exists at all.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Reminder: deploy changes via OTA update:

```bash
eas update --branch production --message "Fix DM conversation empty state and profile photos"
```

---

_Quick Task: 2_
_Completed: 2026-02-23_
