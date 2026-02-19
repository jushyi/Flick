---
plan: 07
title: "NewMessageScreen — Friend Picker"
status: success
created: 2026-02-19
commits:
  - hash: 26c1236
    message: "feat(dm): add NewMessageScreen friend picker"
files_created:
  - src/screens/NewMessageScreen.js
files_modified: []
---

## Summary

Created `NewMessageScreen.js` — a searchable friend picker screen for starting new DM conversations. The screen is the entry point from the Messages tab's "New Message" action.

## What was built

### NewMessageScreen (`src/screens/NewMessageScreen.js`)

- **Header**: Back button (chevron-back PixelIcon) + centered "New Message" title
- **Search bar**: TextInput with `colors.background.tertiary` background, borderRadius 12, clear (X) button when text is present
- **Friends list**: FlatList with 40px circular profile photos (expo-image with `cachePolicy="memory-disk"`), display name, and @username per row
- **Search filtering**: Case-insensitive `startsWith` matching on both `username` AND `displayName` (replicates `useMentionSuggestions` pattern)
- **Friend selection**: Calls `getOrCreateConversation(currentUserId, friend.uid)` from messageService, then `navigation.replace('Conversation', ...)` for correct back-stack behavior
- **Loading state**: PixelSpinner shown centered while friends are fetching
- **Empty states**: "Add friends to start messaging" (no friends) and "No friends match your search" (no search results)
- **Double-tap prevention**: `selectedFriendId` state disables all rows and shows ActivityIndicator on the tapped row while `getOrCreateConversation` runs
- **Keyboard handling**: `keyboardDismissMode="on-drag"` on the FlatList
- **Avatar fallback**: Missing profile photos show first-letter placeholder (matches FriendCard pattern)

### Patterns followed

- Friend fetching: Replicates `FriendsScreen.fetchFriends()` pattern — `getFriendships()` + `batchGetUsers()` for efficient batch loading
- Search filter: Mirrors `useMentionSuggestions` lines 108-133 — case-insensitive `startsWith` on both fields
- Import organization: React/RN core > third-party > services > components > context > utils
- Logging: Uses `logger` throughout, no `console.log`
- Colors: All from `colors` constants, no hardcoded hex values

## Verification checklist

- [x] `npm run lint` passes (0 errors)
- [x] `npm test` passes (pre-existing failures in photoLifecycle.test.js, unrelated)
- [x] Screen file exists at `src/screens/NewMessageScreen.js`
- [x] Search filters by both username AND displayName
- [x] Friend selection calls `getOrCreateConversation` from messageService
- [x] Uses `navigation.replace` for correct back-stack behavior
- [x] Empty states handled (no friends + no search results)
- [x] Loading and empty states handled gracefully
- [x] Profile photos use `expo-image` with `cachePolicy="memory-disk"`
- [x] Safe area insets applied for status bar

## Dependencies

- **Depends on**: PLAN-01 (`messageService.js` for `getOrCreateConversation`)
- **Consumed by**: PLAN-10 (navigation integration will wire this screen into the Messages stack)
- **Navigates to**: `Conversation` screen (from PLAN-09, not yet implemented — navigation.replace call is ready)

## Deviations

None. Implementation matches the plan exactly.
