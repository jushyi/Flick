---
plan: "17-05"
phase: "17-messaging-social"
status: complete
started: "2026-03-24T21:00:00.000Z"
completed: "2026-03-24T21:30:00.000Z"
duration: "30m"
---

## Summary

Wired all messaging screens to Supabase hooks and services, replacing Firebase data sources across 4 screen files.

## What Was Built

- **MessagesScreen.js**: Uses `useMessages` (PowerSync) for instant conversation list, `useStreakMap` for streak indicators, `useQueries` for batch friend profile fetching from Supabase users table. Adapter maps snake_case to camelCase.
- **ConversationScreen.js**: Uses `useConversation` (TanStack + Realtime) for paginated messages with real-time updates. Added `adaptMessage()` for all 5 message types, `buildReactionMap()` for reaction aggregation. Unsend uses Supabase directly. Screenshot detection inserts to Supabase notifications table.
- **SnapPreviewScreen.js**: Replaced Firebase `uploadAndSendSnap` with Supabase `snapService`. Throw-on-error pattern.
- **NewMessageScreen.js**: Replaced Firebase `getOrCreateConversation` with Supabase `messageService`.

## Deviations

1. [Rule 3] Plan referenced CameraScreen for snap upload, but actual import was in SnapPreviewScreen.js. Updated correct file.
2. [Rule 2] Read receipt "isRead" temporarily hardcoded to false -- `last_read_at_p1/p2` not yet in PowerSync schema.

## Commits

- `60cfdd5c` feat(17-05): wire MessagesScreen and ConversationScreen to Supabase hooks
- `872427d0` feat(17-05): wire SnapPreviewScreen and NewMessageScreen to Supabase services
- `dde5fc7e` fix(17-05): clean up unused variable warnings in ConversationScreen

## Key Files

### Created
(none)

### Modified
- `src/screens/MessagesScreen.js`
- `src/screens/ConversationScreen.js`
- `src/screens/SnapPreviewScreen.js`
- `src/screens/NewMessageScreen.js`

## Self-Check: PASSED

- [x] All auto tasks executed (2/2)
- [x] Human verification approved
- [x] Each task committed individually
- [x] Lint passes with no new errors
