---
feature: direct-messaging
plan: 01
title: "Message Service Layer"
status: success
completed: 2026-02-19
commits:
  - e4eaa65: "feat(dm): add message service with core CRUD functions"
  - 6f23fab: "feat(dm): add subscription and pagination functions to message service"
produces:
  - src/services/firebase/messageService.js
---

## Summary

Created `src/services/firebase/messageService.js` with all 9 functions specified in the plan. The service provides the complete data access layer for direct messaging between friends, following the established `{ success, error }` service pattern used throughout the app.

## Functions Implemented

### Task 1: Core CRUD (6 functions)

1. **`generateConversationId(userId1, userId2)`** - Deterministic ID generation mirroring `friendshipService.generateFriendshipId`. Sorts UIDs alphabetically, joins with underscore.
2. **`getOrCreateConversation(currentUserId, friendId)`** - Uses `setDoc` (not `addDoc`) with the deterministic ID. Checks existence first, returns `isNew` flag.
3. **`sendMessage(conversationId, senderId, text, gifUrl)`** - Adds to `messages` subcollection via `addDoc`. Does NOT update conversation metadata (Cloud Function responsibility per PLAN-02).
4. **`markConversationRead(conversationId, userId)`** - Resets `unreadCount.${userId}` to 0 via dot-notation update.
5. **`softDeleteConversation(conversationId, userId)`** - Sets `deletedAt.${userId}` to `serverTimestamp()` and resets unread count to 0.
6. **`getConversation(conversationId)`** - Single document fetch returning `{ id, ...data }`.

### Task 2: Subscriptions & Pagination (3 functions)

7. **`subscribeToConversations(userId, callback)`** - Real-time listener with `array-contains` on `participants`, ordered by `updatedAt desc`, limited to 50. Returns unsubscribe function.
8. **`subscribeToMessages(conversationId, callback, deletedAtCutoff, messageLimit)`** - Real-time listener on messages subcollection. Supports `deletedAtCutoff` filtering for soft-deletion. Passes `lastDoc` cursor in callback for pagination handoff.
9. **`loadMoreMessages(conversationId, lastDoc, deletedAtCutoff, messageLimit)`** - One-shot `getDocs` with cursor-based pagination via `startAfter(lastDoc)`. Returns `hasMore` boolean.

## Verification

- [x] `npm run lint` passes (no errors on messageService.js)
- [x] All 9 functions exported with `{ success, error }` pattern
- [x] Imports use `@react-native-firebase/firestore` exclusively (modular API)
- [x] No `console.log` usage -- logger from `../../utils/logger` only
- [x] Deterministic ID generation mirrors `friendshipService.generateFriendshipId`
- [x] `getOrCreateConversation` uses `setDoc` (not `addDoc`)
- [x] `sendMessage` does NOT update conversation metadata
- [x] Subscription functions return unsubscribe functions
- [x] Cursor-based pagination compatible with real-time listeners
- [x] All errors caught and logged with `logger.error`

## Test Results

- 22 test suites passed, 735 tests passed
- 1 pre-existing test suite failure (3 tests in `photoLifecycle.test.js`) -- unrelated to this change

## Deviations

None. All functions implemented exactly as specified in the plan.
