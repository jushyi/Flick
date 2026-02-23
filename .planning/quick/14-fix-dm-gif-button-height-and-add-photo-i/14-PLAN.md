---
phase: quick
plan: 14
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/DMInput.js
  - src/components/MessageBubble.js
  - src/services/firebase/messageService.js
  - src/hooks/useConversation.js
  - src/services/firebase/storageService.js
autonomous: true
requirements: [QUICK-14]

must_haves:
  truths:
    - 'GIF button is the same height as the text input bar'
    - 'Photo button is visible next to the GIF button in DM input'
    - 'Tapping photo button opens device image picker'
    - 'Selected photo uploads to Firebase Storage and sends as an image message'
    - 'Image messages render as tappable images in MessageBubble'
  artifacts:
    - path: 'src/components/DMInput.js'
      provides: 'Photo picker button + GIF button height fix'
    - path: 'src/components/MessageBubble.js'
      provides: 'Image message rendering'
    - path: 'src/services/firebase/messageService.js'
      provides: 'Image URL field support in sendMessage'
    - path: 'src/hooks/useConversation.js'
      provides: 'imageUrl passthrough in handleSendMessage'
  key_links:
    - from: 'src/components/DMInput.js'
      to: 'src/services/firebase/storageService.js'
      via: 'uploadCommentImage (reuse for DM images)'
      pattern: 'uploadCommentImage'
    - from: 'src/components/DMInput.js'
      to: 'src/hooks/useConversation.js'
      via: 'onSendMessage callback with (text, gifUrl, imageUrl)'
      pattern: 'onSendMessage'
    - from: 'src/services/firebase/messageService.js'
      to: 'src/components/MessageBubble.js'
      via: "message.type === 'image' + message.imageUrl"
      pattern: 'type.*image'
---

<objective>
Fix the GIF button height in the DM input bar so it matches the input field height, and add a photo picker button next to the GIF button that allows sending image messages in DM conversations.

Purpose: The GIF button is visually shorter than the input bar (mismatched padding), and there is no way to send photos in DMs like there is in comments. This brings DM input to feature parity with CommentInput for media.

Output: Updated DMInput with aligned GIF button and new photo button, plus full image message pipeline (upload, send, render).
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/DMInput.js
@src/components/MessageBubble.js
@src/components/comments/CommentInput.js (reference for photo picker pattern)
@src/styles/CommentInput.styles.js (reference for button styling)
@src/services/firebase/messageService.js
@src/services/firebase/storageService.js (uploadCommentImage to reuse)
@src/hooks/useConversation.js
@src/screens/ConversationScreen.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix GIF button height and add photo picker button to DMInput</name>
  <files>
    src/components/DMInput.js
  </files>
  <action>
Two changes in DMInput.js:

**1. Fix GIF button height mismatch:**
The GIF button uses `paddingVertical: 6` and `paddingHorizontal: 10` which makes it shorter than the input wrapper (which has `paddingVertical: Platform.select({ ios: 8, android: 4 })`). Change the GIF button and the new photo button to use `alignSelf: 'stretch'` within the inputRow (which already has `alignItems: 'flex-end'`). Actually, the better fix: move the GIF button (and the new photo button) INSIDE the `inputWrapper` View, positioned to the right of the TextInput — exactly like CommentInput does it. This way they inherit the wrapper's height naturally.

Restructure the input row layout to match CommentInput's pattern:

- `inputWrapper` contains: TextInput (flex: 1) + photo button + GIF button (all in a row)
- Send button stays outside `inputWrapper` to the right
- Remove the standalone `gifButton` container from outside inputWrapper

**2. Add photo picker button:**
Add imports: `import * as ImagePicker from 'expo-image-picker';`, `import * as Haptics from 'expo-haptics';`, `import { Alert } from 'react-native';` (already imported from RN), `import { Image } from 'expo-image';`, `import { uploadCommentImage } from '../services/firebase/storageService';`, and `import logger from '../utils/logger';`.

Add state: `const [selectedMedia, setSelectedMedia] = useState(null);` and `const [isUploading, setIsUploading] = useState(false);`.

Add `handleImagePick` callback (copy pattern from CommentInput.js lines 146-176):

- Request media library permissions via `ImagePicker.requestMediaLibraryPermissionsAsync()`
- On denial, show Alert
- Launch `ImagePicker.launchImageLibraryAsync` with `MediaTypeOptions.Images`, `allowsEditing: true`, `aspect: [1, 1]`, `quality: 0.8`
- On success, set `setSelectedMedia({ uri: result.assets[0].uri, type: 'image' })`
- Use `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on press

Add `clearMedia` callback: `setSelectedMedia(null);`

Add media preview section above the inputRow (copy pattern from CommentInput.js lines 273-291):

- Show selected image thumbnail (80x80) with expo-image
- Show remove button (X) in top-right corner
- Show "GIF" badge if media type is gif

Update `handleGifSelected` to set `setSelectedMedia({ uri: gifUrl, type: 'gif' })` instead of immediately sending. This unifies the flow so both image and gif go through the same preview+send pipeline.

Update `handleSend`:

- If `selectedMedia` exists and type is 'image': upload via `uploadCommentImage(selectedMedia.uri)`, then call `onSendMessage(null, null, downloadUrl)` where 3rd arg is imageUrl
- If `selectedMedia` exists and type is 'gif': call `onSendMessage(null, selectedMedia.uri, null)` (gif flow, same as before but unified)
- If text only: call `onSendMessage(trimmedText, null, null)`
- Set `isUploading` state during upload, clear `selectedMedia` and `text` after send
- Update `hasText` to `const canSend = text.trim().length > 0 || !!selectedMedia;` and use it for showing the send button

Update `onSendMessage` prop signature: `onSendMessage(text, gifUrl, imageUrl)`.

**Styling for the photo and GIF buttons inside inputWrapper:**

```javascript
imageButton: {
  paddingLeft: 8,
  paddingVertical: 2,
},
gifButton: {
  paddingLeft: 8,
  paddingVertical: 2,
},
gifButtonText: {
  color: colors.text.secondary,
  fontSize: 12,
  fontFamily: typography.fontFamily.bodyBold,
},
```

Use `<PixelIcon name="image-outline" size={22} color={colors.text.secondary} />` for the photo button (same as CommentInput).

For the media preview above the input row, add styles matching CommentInput:

```javascript
mediaPreviewContainer: {
  position: 'relative',
  marginHorizontal: 12,
  marginTop: 8,
  marginBottom: 4,
  alignSelf: 'flex-start',
},
mediaPreview: {
  width: 80,
  height: 80,
  borderRadius: 4,
},
removeMediaButton: {
  position: 'absolute',
  top: -8,
  right: -8,
  zIndex: 1,
},
removeMediaButtonBg: {
  backgroundColor: 'rgba(0,0,0,0.7)',
  borderRadius: 12,
  width: 24,
  height: 24,
  justifyContent: 'center',
  alignItems: 'center',
},
gifBadge: {
  position: 'absolute',
  bottom: 4,
  left: 4,
  backgroundColor: 'rgba(0,0,0,0.7)',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
},
gifBadgeText: {
  color: colors.text.primary,
  fontSize: 10,
  fontFamily: typography.fontFamily.bodyBold,
},
```

Keep the retro aesthetic: inputWrapper should keep its existing border styling (borderRadius: 4, borderWidth: 1, borderColor: colors.border.default). The photo and GIF buttons sit inside it to the right of the text input.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/DMInput.js --max-warnings 0 2>&1 | head -20</automated>
<manual>Open DM conversation, verify GIF button matches input bar height, photo button visible next to GIF</manual>
</verify>
<done>GIF button aligns with input bar height. Photo button (image-outline icon) is visible next to GIF button. Tapping photo button opens image picker. Selected media shows preview above input with remove button. Send button appears when media is selected.</done>
</task>

<task type="auto">
  <name>Task 2: Add image message support to message service, hook, and bubble</name>
  <files>
    src/services/firebase/messageService.js
    src/hooks/useConversation.js
    src/components/MessageBubble.js
    src/screens/ConversationScreen.js
  </files>
  <action>
**messageService.js — Update sendMessage to accept imageUrl:**

Change the function signature from `sendMessage(conversationId, senderId, text, gifUrl = null)` to `sendMessage(conversationId, senderId, text, gifUrl = null, imageUrl = null)`.

Update the empty check: `if (!text && !gifUrl && !imageUrl)` return error.

Update type derivation: `const type = imageUrl ? 'image' : gifUrl ? 'gif' : 'text';`

Update messageData to include: `imageUrl: imageUrl || null` alongside existing `gifUrl: gifUrl || null`. Keep `text: (gifUrl || imageUrl) ? null : text`.

**useConversation.js — Update handleSendMessage to pass imageUrl:**

Change the callback signature from `async (text, gifUrl = null)` to `async (text, gifUrl = null, imageUrl = null)`.

Pass `imageUrl` through to `sendMessage`: `await sendMessage(conversationId, currentUserId, text, gifUrl, imageUrl)`.

Update the logger call to include `hasImage: !!imageUrl`.

**MessageBubble.js — Add image rendering:**

Add a check: `const isImage = message.type === 'image';`

In the Pressable content, add an `isImage` branch similar to the existing `isGif` branch:

```jsx
{isGif || isImage ? (
  <Image
    source={{ uri: message.gifUrl || message.imageUrl }}
    style={isGif ? styles.gifImage : styles.messageImage}
    contentFit={isImage ? 'cover' : 'contain'}
    transition={200}
  />
) : (
  <Text ...>{message.text}</Text>
)}
```

Add `bubbleImage` style (same as `bubbleGif`): `{ paddingHorizontal: 4, paddingVertical: 4, overflow: 'hidden' }`.

Add `messageImage` style: `{ width: 200, height: 200, borderRadius: 3 }` (square since images are cropped 1:1 by the picker).

Apply `(isGif || isImage) && styles.bubbleGif` to the bubble style array.

**ConversationScreen.js — No changes needed.** The `onSendMessage={handleSendMessage}` prop already passes through whatever DMInput calls with. The DMInput now calls `onSendMessage(text, gifUrl, imageUrl)` and useConversation's `handleSendMessage(text, gifUrl, imageUrl)` accepts it.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/services/firebase/messageService.js src/hooks/useConversation.js src/components/MessageBubble.js --max-warnings 0 2>&1 | head -20</automated>
<manual>Send an image in DM conversation, verify it appears as a rendered image in the message bubble</manual>
</verify>
<done>messageService.sendMessage accepts imageUrl parameter and writes type 'image' messages. useConversation passes imageUrl through. MessageBubble renders image messages as 200x200 cover images. Full pipeline: pick image -> upload -> send -> render works end-to-end.</done>
</task>

</tasks>

<verification>
1. Open a DM conversation
2. Verify GIF button height matches the text input field (both inside the same wrapper)
3. Verify photo button (image icon) is visible next to GIF button
4. Tap photo button -> image picker opens
5. Select an image -> preview appears above input with remove (X) button
6. Tap send -> image uploads and appears as image message in conversation
7. Tap GIF button -> select GIF -> preview appears -> send -> GIF renders in conversation
8. Text-only messages still work as before
9. Verify on both iOS and Android (keyboard padding, safe areas still correct)
</verification>

<success_criteria>

- GIF button is vertically aligned with (inside) the input field wrapper
- Photo picker button visible and functional
- Image messages stored with type 'image' and imageUrl field in Firestore
- Image messages render as 200x200 images in MessageBubble
- No regressions to text or GIF messaging
- Lint passes on all modified files
  </success_criteria>

<output>
After completion, create `.planning/quick/14-fix-dm-gif-button-height-and-add-photo-i/14-SUMMARY.md`
</output>
