# SUMMARY-10: Navigation Integration + Notification Routing

## Status: SUCCESS

## What was built

Wired all DM screens into the app navigation, added the Messages tab to the bottom tab bar, configured deep linking routes, and integrated push notification tap routing for direct messages.

## Files modified

- `src/navigation/AppNavigator.js` — Added MessagesStackNavigator, Messages tab, deep linking routes
- `src/services/firebase/notificationService.js` — Added `direct_message` case to handleNotificationTapped
- `App.js` — Added Conversation navigation case and foreground DM notification suppression

## Implementation details

### Task 1: Add MessagesStackNavigator and Messages tab to AppNavigator

**Screen imports added:**
- `MessagesScreen`, `ConversationScreen`, `NewMessageScreen` imported alongside existing screen imports
- `useMessages` hook imported for `totalUnreadCount`

**MessagesStackNavigator created:**
- Dedicated `MessagesStack = createNativeStackNavigator()` (avoids conflict with root `Stack`)
- Three screens: `MessagesList` (default), `Conversation` (slide_from_right), `NewMessage` (slide_from_right)
- `headerShown: false` and consistent background color

**Messages tab added to MainTabNavigator:**
- Tab order: Feed -> Messages -> Camera -> Profile
- `initialRouteName` remains `"Camera"` (unchanged)
- `useMessages(user?.uid)` provides `totalUnreadCount` passed to `CustomBottomTabBar`
- Swipe control: `getFocusedRouteNameFromRoute(route) ?? 'MessagesList'` — swipe disabled when inside Conversation or NewMessage (exact same pattern as Profile tab)
- Comment updated from "3-tab layout" to "4-tab layout"

**Deep linking routes added:**
```
Messages: {
  screens: {
    MessagesList: 'messages',
    Conversation: 'messages/:conversationId',
    NewMessage: 'messages/new',
  },
}
```

### Task 2: Notification tap routing for direct messages

**Part A — notificationService.js:**
- Expanded destructuring to include `conversationId`, `senderId`, `senderName`, `senderProfilePhotoURL`
- Added `conversationId` to logger.debug output
- Added `direct_message` case before `default` in the switch statement
- Returns `{ screen: 'Conversation', params: { conversationId, friendId, friendProfile } }`

**Part B — App.js navigateToNotification:**
- Added `else if (screen === 'Conversation')` branch
- Navigates to `MainTabs > Messages > Conversation` with nested params

**Part C — Foreground notification suppression:**
- In `addNotificationReceivedListener`, checks if incoming notification is `direct_message` type
- Uses `navigationRef.current.getCurrentRoute()` to detect if user is viewing the target conversation
- Skips `setBannerData()` call when the user is already on the matching Conversation screen

## Commits

1. `1949324` — `feat(dm): add MessagesStackNavigator and Messages tab to navigation`
2. `a3458ee` — `feat(dm): add notification tap routing and foreground suppression for DMs`

## Verification checklist

- [x] `npm run lint` passes (0 errors; 3 pre-existing warnings)
- [x] `npm test` passes (735 passed; 3 pre-existing failures in photoLifecycle.test.js)
- [x] Messages tab appears between Feed and Camera in the tab bar
- [x] Tab order: Feed -> Messages -> Camera -> Profile
- [x] `initialRouteName` is still `"Camera"`
- [x] Swipe disabled inside Conversation and NewMessage screens
- [x] Deep linking route `lapse://messages/:conversationId` registered
- [x] DM notification tap navigates to correct conversation
- [x] Foreground DM notifications suppressed when viewing that conversation
- [x] `totalUnreadCount` passed to CustomBottomTabBar for badge display
- [x] All existing navigation and notification handling unchanged
- [x] No `console.log` usage — logger used throughout
