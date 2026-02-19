---
feature: direct-messaging
plan: 06
title: "Custom Hooks — useMessages + useConversation"
status: success
created: 2026-02-19
---

## Summary

Created two custom hooks that bridge the messageService (data layer) with the screens (UI layer) for direct messaging.

## Files Created

- `src/hooks/useMessages.js` — Conversation list hook for MessagesScreen
- `src/hooks/useConversation.js` — Individual conversation hook for ConversationScreen

## Commits

1. `7a114a8` — `feat(dm): create useMessages hook for conversation list`
2. `2281c9e` — `feat(dm): create useConversation hook for individual conversation`

## Task Details

### Task 1: useMessages Hook

Created `src/hooks/useMessages.js` with:
- **Real-time subscription** via `subscribeToConversations()` from messageService
- **Soft-delete filtering**: Conversations hidden when `deletedAt[userId]` is set and no newer `lastMessage.timestamp` exists
- **Friend profile caching**: `useRef(new Map())` stores fetched profiles; only uncached IDs are fetched per snapshot
- **Unread count aggregation**: `totalUnreadCount` sums `unreadCount[userId]` across all visible conversations
- **Optimistic delete**: `handleDeleteConversation()` immediately removes from local state, calls `softDeleteConversation()`, reverts on failure (pattern from useComments.js)
- **Cleanup**: `unsubscribeRef` pattern with useEffect cleanup (pattern from useComments.js)

Returns: `{ conversations, loading, totalUnreadCount, handleDeleteConversation }`

### Task 2: useConversation Hook

Created `src/hooks/useConversation.js` with:
- **Real-time subscription** via `subscribeToMessages()` for newest 25 messages
- **Cursor-based pagination**: `loadMore()` with triple guard (`loadingMore || !hasMore || !lastDocRef.current`) matching useFeedPhotos.js pattern
- **Dual-list merge**: `recentMessages` (real-time) + `olderMessages` (paginated), deduplicated via Map, sorted by createdAt descending for inverted FlatList
- **Send message**: `handleSendMessage()` calls messageService; real-time subscription auto-picks up new messages
- **Mark as read**: Calls `markConversationRead()` on mount/conversationId change
- **Notification dismissal**: Dismisses presented notifications matching conversationId on mount
- **Cleanup**: `unsubscribeRef` pattern with useEffect cleanup; pagination state reset on conversationId change

Returns: `{ messages, loading, loadingMore, hasMore, loadMore, handleSendMessage }`

## Patterns Followed

- **useComments.js**: `unsubscribeRef` pattern, useEffect cleanup, optimistic delete with revert
- **useFeedPhotos.js**: `loadMore` guard pattern (`loadingMore || !hasMore || !lastDoc`)
- **feedService.js**: `batchFetchUserData` pattern for friend profile joining (adapted with useRef cache)
- **Import organization**: React core > third-party > services > utils (per CLAUDE.md)
- **Logging**: All logging via `logger` utility, no `console.log`
- **Firebase SDK**: All imports from `@react-native-firebase/firestore` (modular)

## Verification

- [x] `npm run lint` passes (zero errors on both new files)
- [x] `npm test` passes (22/23 suites; 3 pre-existing failures in photoLifecycle.test.js)
- [x] Both hook files exist in `src/hooks/`
- [x] `useMessages` returns conversations, loading, totalUnreadCount, handleDeleteConversation
- [x] `useConversation` returns messages, loading, loadingMore, hasMore, loadMore, handleSendMessage
- [x] All imports use `@react-native-firebase/firestore` (not web SDK)
- [x] No `console.log` — only `logger`

## Deviations

None. Implementation matches the plan specification exactly.
