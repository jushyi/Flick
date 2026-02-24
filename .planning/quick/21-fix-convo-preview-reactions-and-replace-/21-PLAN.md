---
phase: quick-21
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ConversationRow.js
  - src/components/MessageBubble.js
  - src/components/ReplyPreview.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'Conversation preview shows descriptive text when a reaction message surfaces as lastMessage'
    - 'No unicode emoji characters are used as icons or placeholders in message components'
    - 'Swipe-to-reply arrow uses PixelIcon instead of Ionicons'
    - 'Reaction emojis in ReactionBadges and ReactionPicker remain unchanged'
  artifacts:
    - path: 'src/components/ConversationRow.js'
      provides: 'Descriptive reaction preview text with EMOJI_MAP lookup'
    - path: 'src/components/MessageBubble.js'
      provides: 'PixelIcon for reply arrow and image fallback text'
    - path: 'src/components/ReplyPreview.js'
      provides: 'PixelIcon-based photo type indicator'
  key_links:
    - from: 'src/components/ConversationRow.js'
      to: "lastMessage.type === 'reaction'"
      via: 'getPreviewText switch case'
      pattern: 'reaction.*emoji'
    - from: 'src/components/MessageBubble.js'
      to: 'src/components/PixelIcon.js'
      via: 'import replacement for Ionicons'
      pattern: 'PixelIcon.*arrow-undo'
---

<objective>
Fix conversation preview for reaction messages in the Messages screen and replace all emoji-as-icon
and Ionicons usage with PixelIcon in DM conversation components.

Purpose: Reaction messages can surface as lastMessage in ConversationRow due to race conditions,
currently showing generic "Sent" / "Sent a message". Also, several DM components use unicode emoji
characters as placeholder icons (camera emoji for photo type) and one uses Ionicons (swipe reply arrow),
which is inconsistent with the project-wide PixelIcon system. Reaction emojis in ReactionBadges and
ReactionPicker are actual content emojis and remain unchanged.

Output: Three updated component files with consistent PixelIcon usage and improved reaction previews.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ConversationRow.js
@src/components/MessageBubble.js
@src/components/ReplyPreview.js
@src/components/PixelIcon.js
@src/constants/pixelIcons.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix ConversationRow reaction preview and improve reaction display text</name>
  <files>src/components/ConversationRow.js</files>
  <action>
In ConversationRow.js, update the `getPreviewText()` function to show descriptive text when
`lastMessage.type === 'reaction'` surfaces as the conversation preview (race condition edge case).

Currently lines 81-83 show generic "Sent" / "Sent a message". Replace with emoji-aware preview:

1. Add an EMOJI_MAP constant at the top of the file (same map as ReactionBadges.js):

   ```
   const EMOJI_MAP = {
     heart: '\u2764\uFE0F',
     laugh: '\uD83D\uDE02',
     surprise: '\uD83D\uDE2E',
     sad: '\uD83D\uDE22',
     angry: '\uD83D\uDE21',
     thumbs_up: '\uD83D\uDC4D',
   };
   ```

2. Update the reaction case (lines 81-83) to:
   - If `isSender`: show `"You reacted {emojiChar}"` where emojiChar is looked up from
     `EMOJI_MAP[lastMessage.emoji]` (fall back to the raw emoji string if not in map,
     fall back to "You reacted" if no emoji field at all)
   - If NOT sender: show `"Reacted {emojiChar}"` with same lookup logic

Note: These are actual reaction emojis used as content (not as icons), so emoji usage here is correct
per user requirements ("reaction emojis are fine though").
</action>
<verify>
npm run lint -- --no-warn-ignored src/components/ConversationRow.js
</verify>
<done>ConversationRow shows "You reacted [emoji]" or "Reacted [emoji]" when a reaction message surfaces as lastMessage preview, with proper emoji lookup from EMOJI_MAP.</done>
</task>

<task type="auto">
  <name>Task 2: Replace Ionicons and emoji placeholders in MessageBubble with PixelIcon</name>
  <files>src/components/MessageBubble.js</files>
  <action>
In MessageBubble.js, make three changes:

1. **Remove Ionicons import** (line 12): Delete `import { Ionicons } from '@expo/vector-icons';`

2. **Add PixelIcon import**: Add `import PixelIcon from './PixelIcon';` in the components import group
   (after the existing ReactionBadges import on line 17).

3. **Replace swipe reply arrow icon** (line 286):
   Change from: `<Ionicons name="return-up-back" size={20} color={colors.text.secondary} />`
   Change to: `<PixelIcon name="arrow-undo" size={20} color={colors.text.secondary} />`

4. **Replace camera emoji fallback for reply-to images** (line 243):
   Change from: `{originalType === 'image' ? '\uD83D\uDCF7 Photo' : 'GIF'}`
   Change to: `{originalType === 'image' ? 'Photo' : 'GIF'}`
   (Simple text label without emoji. The text is already styled with `originalContentText` which uses
   `colors.text.secondary` - clean and consistent. No need for an inline icon in this context since
   it is inside a muted reply preview block that already has visual indicators.)

Do NOT touch reaction emojis in ReactionBadges or ReactionPicker - those are actual reaction content.
</action>
<verify>
npm run lint -- --no-warn-ignored src/components/MessageBubble.js
</verify>
<done>MessageBubble uses PixelIcon arrow-undo for swipe reply indicator, uses plain text "Photo" instead of camera emoji in reply-to fallback, and has zero Ionicons imports.</done>
</task>

<task type="auto">
  <name>Task 3: Replace camera emoji in ReplyPreview with plain text label</name>
  <files>src/components/ReplyPreview.js</files>
  <action>
In ReplyPreview.js, update the `getPreviewText()` function (line 59):

Change from: `if (message.type === 'image') return '\uD83D\uDCF7 Photo';`
Change to: `if (message.type === 'image') return 'Photo';`

Simple text label consistent with the MessageBubble change. The reply preview bar already has a
cyan accent bar and "Replying to..." label for visual context - the camera emoji adds nothing
and is inconsistent with the pixel art aesthetic.
</action>
<verify>
npm run lint -- --no-warn-ignored src/components/ReplyPreview.js
</verify>
<done>ReplyPreview shows plain "Photo" text instead of camera emoji for image message type previews.</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `npm run lint` passes with no errors on modified files
2. No `Ionicons` imports remain in `src/components/MessageBubble.js`
3. No unicode emoji characters used as icons/placeholders in modified files (reaction emoji in ReactionBadges/ReactionPicker is untouched and acceptable)
4. `grep -r "Ionicons" src/components/MessageBubble.js` returns no results
5. `grep -r "\uD83D\uDCF7" src/components/MessageBubble.js src/components/ReplyPreview.js` returns no results
</verification>

<success_criteria>

- ConversationRow shows "You reacted [emoji]" or "Reacted [emoji]" for reaction-type lastMessage
- MessageBubble swipe reply arrow uses PixelIcon arrow-undo (not Ionicons)
- MessageBubble reply-to image fallback shows "Photo" text (not camera emoji)
- ReplyPreview image type shows "Photo" text (not camera emoji)
- Zero Ionicons imports in MessageBubble.js
- All lint checks pass
  </success_criteria>

<output>
After completion, create `.planning/quick/21-fix-convo-preview-reactions-and-replace-/21-SUMMARY.md`
</output>
