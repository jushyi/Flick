---
phase: quick
plan: 17
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
  - src/components/MessageBubble.js
  - functions/index.js
autonomous: true
requirements: [QUICK-17]

must_haves:
  truths:
    - 'Photo messages appear in conversation as images, not blank bubbles'
    - 'Photo picker opens directly without crop editor'
    - "Conversation list preview shows 'Sent a photo' for image messages"
    - "Push notification body shows 'Sent a photo' for image messages"
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Image picker without forced crop'
      contains: 'allowsEditing: false'
    - path: 'functions/index.js'
      provides: 'Image message preview text in Cloud Function'
      contains: 'Sent a photo'
    - path: 'src/components/MessageBubble.js'
      provides: 'Flexible aspect ratio for non-square images'
  key_links:
    - from: 'src/components/DMInput.js'
      to: 'src/services/firebase/messageService.js'
      via: 'onSendMessage(null, null, downloadUrl)'
      pattern: 'onSendMessage.*downloadUrl'
    - from: 'functions/index.js'
      to: 'conversations/{id}'
      via: 'lastMessage.text for image type'
      pattern: 'image.*Sent a photo'
---

<objective>
Fix two issues with photo sending in DM conversations:
1. Sending a photo results in a blank message in the conversation list and empty push notification because the Cloud Function only handles 'gif' and 'text' types but not 'image' type
2. The image picker forces a crop editor (allowsEditing: true, aspect: [1, 1]) which adds unnecessary friction -- remove the crop requirement so photos send directly

Also update MessageBubble to use flexible aspect ratio since photos will no longer be forced to 1:1 crop.

Purpose: Photos sent in DMs should show "Sent a photo" in conversation preview and notification, not blank text. And users should be able to send photos without being forced through a crop step.
Output: Fixed Cloud Function, updated DMInput picker config, flexible MessageBubble image rendering
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/DMInput.js
@src/components/MessageBubble.js
@src/hooks/useConversation.js
@src/services/firebase/messageService.js
@functions/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Cloud Function to handle image message type in preview and notification</name>
  <files>functions/index.js</files>
  <action>
In the `onNewMessage` Cloud Function (around line 2656), update the `lastMessagePreview` logic to handle the 'image' message type. Currently:

```js
const lastMessagePreview = message.type === 'gif' ? 'Sent a GIF' : message.text || '';
```

Change to handle all three types:

```js
const lastMessagePreview =
  message.type === 'gif'
    ? 'Sent a GIF'
    : message.type === 'image'
      ? 'Sent a photo'
      : message.text || '';
```

Also update the push notification body (around line 2706) from:

```js
const body = message.type === 'gif' ? 'Sent a GIF' : message.text;
```

To:

```js
const body =
  message.type === 'gif' ? 'Sent a GIF' : message.type === 'image' ? 'Sent a photo' : message.text;
```

This ensures both the conversation list preview and the push notification show "Sent a photo" instead of blank/empty text for image messages.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone/functions" && grep -n "Sent a photo" index.js | wc -l</automated>
<manual>Should output 2 (one for lastMessagePreview, one for notification body)</manual>
</verify>
<done>Cloud Function handles 'image' type: conversation lastMessage.text shows "Sent a photo", push notification body shows "Sent a photo"</done>
</task>

<task type="auto">
  <name>Task 2: Remove crop requirement from image picker and update MessageBubble for flexible aspect ratio</name>
  <files>src/components/DMInput.js, src/components/MessageBubble.js</files>
  <action>
In `src/components/DMInput.js`, update the `handleImagePick` function's `launchImageLibraryAsync` call (around line 93-98). Change:

```js
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
});
```

To:

```js
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: false,
  quality: 0.8,
});
```

Remove `allowsEditing` (set to false) and remove the `aspect` property entirely. This skips the crop editor so the user can send photos directly from their library.

In `src/components/MessageBubble.js`, update the `messageImage` style (around line 108-111) to use a flexible aspect ratio instead of fixed 200x200 square, since images will no longer be forced to 1:1. Change:

```js
messageImage: {
  width: 200,
  height: 200,
  borderRadius: 3,
},
```

To:

```js
messageImage: {
  width: 200,
  height: 250,
  borderRadius: 3,
},
```

Use 200x250 (4:5 ratio) which is a common photo aspect ratio that works well for portrait and landscape photos with `contentFit="cover"` already set on the Image component. This provides a taller preview area better suited for typical phone photos.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && grep -c "allowsEditing: false" src/components/DMInput.js && grep -c "height: 250" src/components/MessageBubble.js</automated>
<manual>Both commands should output 1</manual>
</verify>
<done>Image picker opens directly without crop editor. Message bubble shows images at 200x250 (4:5 ratio) instead of forced 200x200 square.</done>
</task>

</tasks>

<verification>
1. `grep "Sent a photo" functions/index.js` shows two matches (lastMessagePreview and notification body)
2. `grep "allowsEditing: false" src/components/DMInput.js` confirms crop is disabled
3. `grep -A1 "messageImage:" src/components/MessageBubble.js` shows 200x250 dimensions
4. No `aspect:` property in DMInput.js image picker config
</verification>

<success_criteria>

- Cloud Function produces "Sent a photo" for image type messages in both conversation preview and push notification
- Image picker opens library directly without crop editor step
- MessageBubble renders image messages at 4:5 aspect ratio
- Existing text and GIF message flows remain unaffected
  </success_criteria>

<output>
After completion, create `.planning/quick/17-fix-photo-sending-in-dm-conversations-se/17-SUMMARY.md`

Remind user to deploy:

1. JS changes: `eas update --branch production --message "Fix photo sending in DMs: show 'Sent a photo' preview, remove crop requirement"`
2. Cloud Function: `cd functions && firebase deploy --only functions`
   </output>
