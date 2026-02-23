---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/ConversationScreen.js
  - src/components/ConversationRow.js
  - src/components/ConversationHeader.js
autonomous: true
requirements: [QUICK-02]

must_haves:
  truths:
    - "Empty conversation shows 'Say hi' text right-side-up, not inverted"
    - 'DMInput bar is visible and usable in empty conversations'
    - 'Profile photos load in conversation list rows'
    - 'Profile photos load in conversation header when navigated from messages list'
  artifacts:
    - path: 'src/screens/ConversationScreen.js'
      provides: 'Fixed empty state rendering in inverted FlatList'
    - path: 'src/components/ConversationRow.js'
      provides: 'Correct profile photo field reference'
    - path: 'src/components/ConversationHeader.js'
      provides: 'Correct profile photo field reference with fallback'
  key_links:
    - from: 'src/components/ConversationRow.js'
      to: 'src/hooks/useMessages.js'
      via: 'friendProfile.profilePhotoURL field'
      pattern: 'profilePhotoURL'
    - from: 'src/components/ConversationHeader.js'
      to: 'route.params.friendProfile'
      via: 'profilePhotoURL || photoURL field'
      pattern: 'profilePhotoURL.*photoURL'
---

<objective>
Fix three DM conversation bugs: missing input bar on new empty conversations, upside-down empty state text, and profile photos not loading in conversation views.

Purpose: These are visual/functional regressions in the DM feature that break basic usability.
Output: Corrected ConversationScreen, ConversationRow, and ConversationHeader components.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/screens/ConversationScreen.js
@src/components/ConversationRow.js
@src/components/ConversationHeader.js
@src/hooks/useMessages.js
@src/screens/NewMessageScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix inverted FlatList empty state and missing input bar</name>
  <files>src/screens/ConversationScreen.js</files>
  <action>
The ConversationScreen uses an inverted FlatList. In an inverted FlatList, the `ListEmptyComponent` is rendered with `scaleY: -1` transform, causing the "Say hi" text to appear upside down. Additionally, the `contentContainerStyle` uses `flex: 1` when messages are empty, which in an inverted FlatList can cause the empty component to expand and push the DMInput off-screen.

Fix both issues:

1. **Upside-down empty state text:** Add `transform: [{ scaleY: -1 }]` to the `EmptyConversation` wrapper View to counter the FlatList's inversion. This makes the text render right-side-up.

2. **Missing input bar:** Change the empty `contentContainerStyle` from `styles.emptyContainer` (which uses `flex: 1`) to `styles.emptyListContent` — a new style that uses `flexGrow: 1` instead of `flex: 1`. With `flexGrow: 1` the FlatList's content can grow to fill available space but will NOT force the container to expand beyond the KeyboardAvoidingView's allocated space, keeping the DMInput visible.

Specific changes to `ConversationScreen.js`:

a) Update `EmptyConversation` component — add `scaleY: -1` transform to the outer View:

```jsx
const EmptyConversation = ({ displayName }) => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>Say hi to {displayName}!</Text>
  </View>
);
```

Change `styles.emptyContainer` to include `transform: [{ scaleY: -1 }]`.

But since `emptyContainer` is also used in the `contentContainerStyle`, create a separate style. Restructure:

- Rename existing `emptyContainer` to `emptyListContent` and set `flexGrow: 1, justifyContent: 'center', alignItems: 'center'`.
- Create `emptyStateWrapper` with `flex: 1, justifyContent: 'center', alignItems: 'center', transform: [{ scaleY: -1 }]` for the EmptyConversation component.
- Update `contentContainerStyle` on line 228 to use `styles.emptyListContent`.
- Update `EmptyConversation` to use `styles.emptyStateWrapper`.

This ensures the empty state text is right-side-up AND the DMInput remains visible and usable below the FlatList.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/screens/ConversationScreen.js --no-error-on-unmatched-pattern</automated>
<manual>Open a conversation with no messages. Verify: (1) "Say hi to [name]!" text is right-side-up and centered. (2) DMInput bar is visible at the bottom. (3) You can type and send a message.</manual>
</verify>
<done>"Say hi" empty state text renders right-side-up in the inverted FlatList, and the DMInput bar is visible and functional below the FlatList in empty conversations.</done>
</task>

<task type="auto">
  <name>Task 2: Fix profile photo field name mismatch in ConversationRow and ConversationHeader</name>
  <files>src/components/ConversationRow.js, src/components/ConversationHeader.js</files>
  <action>
Two field-name mismatches prevent profile photos from loading:

**ConversationRow (line 47):** Destructures `photoURL` from `friendProfile`, but `useMessages.js` stores the field as `profilePhotoURL` (line 65). The result: `photoURL` is always `undefined`, so the avatar fallback icon always shows instead of the photo.

Fix: Change the destructuring on line 47 from:

```js
const { photoURL, displayName } = friendProfile;
```

to:

```js
const { displayName } = friendProfile;
const photoURL = friendProfile.profilePhotoURL || friendProfile.photoURL;
```

This handles both field names, covering data from `useMessages` (uses `profilePhotoURL`) and any other source that might pass `photoURL`.

**ConversationHeader (line 46):** Uses `friendProfile?.photoURL` for the Image source. When navigated from MessagesScreen, the friendProfile has `profilePhotoURL` (not `photoURL`), so the image source URI is `undefined` and the photo does not load. When navigated from NewMessageScreen, it passes `photoURL`, so it works there.

Fix: Change the Image source on line 46 from:

```jsx
source={{ uri: friendProfile?.photoURL }}
```

to:

```jsx
source={{ uri: friendProfile?.profilePhotoURL || friendProfile?.photoURL }}
```

This covers both navigation paths (from MessagesScreen which provides `profilePhotoURL`, and from NewMessageScreen which provides `photoURL`).

Also add a fallback placeholder in ConversationHeader for when there is no photo URL at all (both are null/undefined). Currently it renders an Image with `uri: undefined` which shows a blank space with background color. Add a conditional: if neither URL exists, show a fallback View with the first letter of the display name (matching the pattern used in NewMessageScreen and ConversationRow).
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/ConversationRow.js src/components/ConversationHeader.js --no-error-on-unmatched-pattern</automated>
<manual>Open the Messages tab. Verify profile photos load in conversation list rows. Tap into a conversation and verify the profile photo loads in the header. Also test via New Message flow to ensure photos still load that way.</manual>
</verify>
<done>Profile photos load correctly in ConversationRow (messages list) and ConversationHeader (conversation view) regardless of whether the conversation was opened from the messages list or via the new message flow.</done>
</task>

</tasks>

<verification>
1. Lint passes on all three modified files with no errors.
2. Empty conversation shows right-side-up "Say hi" text with visible DMInput bar.
3. Profile photos appear in both the messages list rows and conversation headers.
4. Existing conversations with messages still render correctly (no regression).
</verification>

<success_criteria>

- Empty conversations display the "Say hi" text right-side-up (not inverted by FlatList)
- DMInput bar is visible and functional in empty conversations
- ConversationRow shows friend profile photos in the messages list
- ConversationHeader shows friend profile photos when navigated from messages list
- No regressions: existing message conversations still work, photos from NewMessage flow still load
  </success_criteria>

<output>
After completion, create `.planning/quick/2-fix-new-conversation-missing-input-bar-u/2-SUMMARY.md`
</output>
