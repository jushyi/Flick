---
phase: quick-27
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/SnapPreviewScreen.js
autonomous: true
requirements: [QUICK-27]
must_haves:
  truths:
    - 'After sending a snap from the Messages tab, user lands on the Conversation screen with that friend'
    - 'The SnapCamera and SnapPreview screens are fully removed from the navigation stack'
    - 'The Conversation screen shows the newly sent snap message'
  artifacts:
    - path: 'src/screens/SnapPreviewScreen.js'
      provides: 'Post-send navigation to Conversation instead of MessagesList'
      contains: 'popToTop'
  key_links:
    - from: 'src/screens/SnapPreviewScreen.js'
      to: 'MainTabs > Messages > Conversation'
      via: 'navigation.navigate with nested screen params'
      pattern: 'navigate.*MainTabs.*Messages.*Conversation'
---

<objective>
Fix snap send navigation: after sending a snap from the Messages tab, navigate back to the Conversation screen instead of the messages list.

Purpose: Currently `navigation.pop(2)` pops SnapPreview and SnapCamera from the root stack, but the Material Top Tab Navigator does not preserve the nested Messages stack state (Conversation being active). The user lands on MessagesList instead of the Conversation they were in.

Output: Updated SnapPreviewScreen.js with correct post-send navigation to the Conversation.
</objective>

<context>
@src/screens/SnapPreviewScreen.js
@src/navigation/AppNavigator.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace pop(2) with explicit Conversation navigation after snap send</name>
  <files>src/screens/SnapPreviewScreen.js</files>
  <action>
In `SnapPreviewScreen.js`, modify the `handleSend` success path (line 124, currently `navigation.pop(2)`) to navigate explicitly to the Conversation screen inside the Messages tab.

Replace:

```javascript
navigation.pop(2);
```

With:

```javascript
// Pop all snap screens off the root stack, then navigate into the Conversation.
// popToTop removes SnapPreview + SnapCamera, revealing MainTabs.
// The navigate call ensures the Messages tab's Conversation screen is focused
// (Material Top Tabs may reset nested stack state on tab blur, so we explicitly
// navigate rather than relying on preserved state).
navigation.popToTop();
setTimeout(() => {
  navigation.navigate('MainTabs', {
    screen: 'Messages',
    params: {
      screen: 'Conversation',
      params: {
        conversationId,
        friendId,
        friendProfile: {
          uid: friendId,
          displayName: friendDisplayName || 'Friend',
        },
      },
    },
  });
}, 100);
```

The 100ms delay follows the project's established pattern for nested navigator param propagation (see App.js lines 195-200 and the notification navigation handler at lines 219-227 which uses the same `MainTabs > Messages > Conversation` nesting pattern).

Add `friendDisplayName` to the `handleSend` useCallback dependency array (it is already captured in scope via route.params destructuring but should be explicit in deps since we now use it in the navigation call).

Do NOT change any other behavior in the file. The retake/dismiss flow (`handleDismiss` using `goBack`) remains unchanged.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/SnapPreviewScreen.js --no-error-on-unmatched-pattern</automated>
<manual>Open a conversation, tap the snap camera button, take a photo, send it. After sending, verify you land on the Conversation screen (not the messages list). The sent snap should appear in the conversation.</manual>
</verify>
<done>After sending a snap from the Messages tab, the user lands on the Conversation screen with their friend (not the MessagesList). The SnapCamera and SnapPreview screens are fully removed from the root navigation stack.</done>
</task>

</tasks>

<verification>
- Lint passes on SnapPreviewScreen.js
- Manual test: From a conversation, open snap camera, capture photo, send snap. User returns to the same conversation after send completes.
- Manual test: The snap retake flow (X button or swipe-down on SnapPreview) still works correctly (goes back to snap camera).
- Manual test: The snap camera close button (X on CameraScreen in snap mode) still works correctly (goes back to conversation).
</verification>

<success_criteria>

- Sending a snap from Messages tab navigates to the Conversation screen (not MessagesList)
- No regressions in snap retake or snap camera close flows
- Lint clean
  </success_criteria>

<output>
After completion, create `.planning/quick/27-after-sending-a-snap-from-messages-tab-n/27-SUMMARY.md`
</output>
