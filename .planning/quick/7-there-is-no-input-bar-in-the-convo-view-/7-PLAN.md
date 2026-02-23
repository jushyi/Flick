---
phase: quick
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/CustomBottomTabBar.js
  - src/screens/ConversationScreen.js
autonomous: true
requirements: [QUICK-07]

must_haves:
  truths:
    - 'DMInput is visible and tappable at the bottom of ConversationScreen on both iOS and Android'
    - 'DMInput is visible when starting a new conversation from NewMessageScreen'
    - 'Tab bar is hidden when viewing a conversation or starting a new message'
    - 'Tab bar reappears when navigating back to MessagesList'
  artifacts:
    - path: 'src/components/CustomBottomTabBar.js'
      provides: 'Tab bar auto-hide logic for nested stack screens'
      contains: 'Conversation'
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Conversation UI with visible input bar'
      contains: 'DMInput'
  key_links:
    - from: 'src/components/CustomBottomTabBar.js'
      to: 'navigation state'
      via: 'props.state inspection for nested route'
      pattern: 'Conversation|NewMessage'
---

<objective>
Fix the missing input bar in ConversationScreen and NewMessageScreen by hiding the bottom tab bar when navigating into nested stack screens (Conversation, NewMessage) within the Messages tab.

Purpose: The CustomBottomTabBar uses `position: 'absolute', bottom: 0` and is always visible, even when the user navigates into the Conversation or NewMessage screens inside the MessagesStack. This causes the tab bar to overlap/cover the DMInput component at the bottom of the screen, making it appear missing or untappable. The same issue affects nested screens in the Profile stack.

Output: Tab bar hides on nested stack screens; DMInput fully visible and functional in conversations.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/CustomBottomTabBar.js
@src/screens/ConversationScreen.js
@src/navigation/AppNavigator.js
@src/components/DMInput.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hide tab bar on nested stack screens (Conversation, NewMessage, and Profile sub-screens)</name>
  <files>src/components/CustomBottomTabBar.js</files>
  <action>
The root cause: CustomBottomTabBar renders with `position: 'absolute', bottom: 0` and is ALWAYS visible. When a user navigates from MessagesList to Conversation or NewMessage (nested inside MessagesStackNavigator), the tab bar sits on top of the DMInput component, making it invisible or untappable.

Fix: In CustomBottomTabBar, inspect the navigation state to detect when any tab's focused screen is a nested stack route (not the root screen). If so, return null to hide the tab bar entirely.

Implementation:

1. At the top of the CustomBottomTabBar component (before the return), extract the currently focused tab from `state.routes[state.index]`.
2. Check if the focused tab has a nested navigation state (`focusedRoute.state`). If it does, get the nested route name: `focusedRoute.state.routes[focusedRoute.state.index]?.name`.
3. Define an array of screens where the tab bar should be hidden: `['Conversation', 'NewMessage', 'Settings', 'EditProfile', 'CreateAlbum', 'AlbumPhotoPicker', 'AlbumGrid', 'MonthlyAlbumGrid', 'NotificationSettings', 'SoundSettings', 'Contributions', 'PrivacyPolicy', 'TermsOfService', 'DeleteAccount', 'RecentlyDeleted', 'BlockedUsers', 'ProfilePhotoCrop', 'SongSearch']`.
4. If the nested route name is in the hide list, return null (don't render the tab bar).

Alternative simpler approach (preferred): Instead of maintaining a list of screens to hide on, use the inverse logic -- only SHOW the tab bar when the focused route is a ROOT screen. Check if the focused tab has NO nested state OR if the nested route index is 0 (first/root screen). This is more maintainable because new screens added to any stack will automatically hide the tab bar.

Specifically:

```javascript
const focusedRoute = state.routes[state.index];
const nestedState = focusedRoute.state;
// Show tab bar only when on root screen of each tab's stack (or no nested state)
const isOnRootScreen = !nestedState || nestedState.index === 0;
if (!isOnRootScreen) return null;
```

This approach works because:

- Feed and Camera have no nested stacks, so `nestedState` is undefined -> tab bar shows
- MessagesList is index 0 in MessagesStack -> tab bar shows
- Conversation is index 1+ in MessagesStack -> tab bar hides
- ProfileMain is index 0 in ProfileStack -> tab bar shows
- Settings, EditProfile etc. are index 1+ in ProfileStack -> tab bar hides

Do NOT change the absolute positioning or height of the tab bar -- the tab bar should simply not render at all on non-root screens.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/CustomBottomTabBar.js --no-error-on-unmatched-pattern</automated>
<manual>Open the app, go to Messages tab, tap a conversation. The DMInput bar should be fully visible and tappable at the bottom. The bottom tab bar should NOT be visible. Press back to MessagesList -- the tab bar should reappear.</manual>
</verify>
<done>Tab bar is hidden when navigating to Conversation, NewMessage, or any nested Profile screen. Tab bar is visible on root screens (Feed, MessagesList, Camera, ProfileMain).</done>
</task>

<task type="auto">
  <name>Task 2: Remove bottom padding workaround from ConversationScreen if present and verify DMInput visibility</name>
  <files>src/screens/ConversationScreen.js</files>
  <action>
With the tab bar hidden on Conversation screen, verify the ConversationScreen layout is correct:

1. Review the ConversationScreen container style. It uses `flex: 1` which is correct.
2. The KeyboardAvoidingView uses `keyboardVerticalOffset: 0` for both platforms. With the tab bar now hidden (not just overlaid), this should be correct. However, if the ConversationScreen previously had any bottom padding or margin to try to account for the tab bar, REMOVE it -- it's no longer needed.
3. Verify DMInput's `paddingBottom: Math.max(insets.bottom, 8)` in DMInput.js handles safe area correctly. This should already work since `useSafeAreaInsets()` provides the correct bottom inset. No changes needed to DMInput.js.
4. Run ESLint on ConversationScreen.js to confirm no issues.

The key insight: the ConversationScreen code already renders DMInput correctly in both loading and loaded states (lines 229-233 for loading, line 281 for loaded). The problem was never in ConversationScreen itself -- it was the tab bar overlapping on top of it. Task 1 fixes the overlap. This task is a verification pass to ensure no leftover workarounds exist and the layout is clean.

If ConversationScreen.js needs no changes (which is likely), simply verify and move on without modifying the file.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ConversationScreen.js src/components/DMInput.js --no-error-on-unmatched-pattern</automated>
<manual>Open conversation, verify input bar has correct bottom safe area padding, keyboard raises input bar correctly on both iOS and Android.</manual>
</verify>
<done>ConversationScreen renders DMInput with correct spacing, no tab bar overlap, keyboard interaction works correctly.</done>
</task>

</tasks>

<verification>
1. `npx eslint src/components/CustomBottomTabBar.js src/screens/ConversationScreen.js --no-error-on-unmatched-pattern` passes
2. Tab bar hidden on Conversation screen, NewMessage screen, and Profile sub-screens
3. Tab bar visible on Feed, MessagesList, Camera, ProfileMain
4. DMInput visible and functional in both new and existing conversations
5. Keyboard raises input bar correctly on iOS and Android
</verification>

<success_criteria>

- DMInput is fully visible and interactive at the bottom of every conversation
- Tab bar automatically hides when navigating into any nested stack screen
- Tab bar automatically reappears when navigating back to root screens
- No layout regressions on Feed, Camera, or ProfileMain screens
  </success_criteria>

<output>
After completion, create `.planning/quick/7-there-is-no-input-bar-in-the-convo-view-/7-SUMMARY.md`
</output>
