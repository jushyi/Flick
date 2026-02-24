---
phase: quick-23
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/MessageBubble.js
  - src/components/ReactionBadges.js
autonomous: true
requirements: [QUICK-23]
must_haves:
  truths:
    - 'Reaction badges on photo/GIF messages sit below the image without overlapping the image content'
    - 'Reaction badges on normal text messages still overlap the bubble bottom edge as before'
    - 'Badge alignment (left for friend, right for current user) is correct for both media and text messages'
  artifacts:
    - path: 'src/components/MessageBubble.js'
      provides: 'Media-aware reaction badge positioning'
    - path: 'src/components/ReactionBadges.js'
      provides: 'Conditional overlap margin based on message type'
  key_links:
    - from: 'src/components/MessageBubble.js'
      to: 'src/components/ReactionBadges.js'
      via: 'isMediaMessage prop controlling overlap behavior'
      pattern: 'isMediaMessage'
---

<objective>
Fix reaction badges overlapping onto photo and GIF message content in DM conversations.

Purpose: Currently, ReactionBadges uses a negative marginTop (-10) to create a subtle overlap effect on the bottom of message bubbles. This works well for text messages because the bubble has padding and an opaque background. However, for photo/GIF messages, the bubble uses `overflow: 'hidden'` with a transparent background and zero padding, so the badges visually overlap onto the actual image content. The fix needs to remove the overlap for media messages while preserving it for text messages.

Output: Updated MessageBubble.js and ReactionBadges.js with media-aware badge positioning.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/MessageBubble.js
@src/components/ReactionBadges.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix reaction badge overlap on photo/GIF messages</name>
  <files>src/components/MessageBubble.js, src/components/ReactionBadges.js</files>
  <action>
The root cause: ReactionBadges has `marginTop: -10` which pulls badges upward to overlap the bubble. For text messages this looks great (overlapping the opaque bubble edge). For photo/GIF messages, the bubble has `backgroundColor: 'transparent'` and `overflow: 'hidden'`, so the overlap lands directly on the image content.

Two changes needed:

1. In `MessageBubble.js`:
   - Determine if the message is a media message: `const isMediaMessage = isGif || isImage;`
   - Pass `isMediaMessage` as a prop to `ReactionBadges`:
     ```jsx
     <ReactionBadges
       reactions={reactions}
       isCurrentUser={isCurrentUser}
       currentUserId={currentUserId}
       onReactionPress={onReactionPress}
       isMediaMessage={isMediaMessage}
     />
     ```
   - Remove `bubbleWithReactions` style application for media messages. Currently line 302 applies `bubbleWithReactions` (adds `paddingBottom: 14`) to all messages with reactions. For media messages, this extra padding creates an awkward transparent gap below the image inside the clipped bubble. Change the condition to only apply `bubbleWithReactions` for non-media messages:
     ```jsx
     reactions && Object.keys(reactions).length > 0 && !isMediaMessage && styles.bubbleWithReactions,
     ```
     (Media messages should NOT get extra padding inside the bubble since badges will sit fully below them.)

2. In `ReactionBadges.js`:
   - Accept `isMediaMessage` prop (default `false`).
   - When `isMediaMessage` is true, use `marginTop: 4` instead of `marginTop: -10` in the container style. This places badges cleanly below the image with a small gap instead of overlapping.
   - Apply conditionally:
     ```jsx
     <RNAnimated.View
       style={[
         styles.container,
         isCurrentUser ? styles.containerRight : styles.containerLeft,
         isMediaMessage && styles.containerMedia,
         { opacity: fadeAnim },
       ]}
     >
     ```
   - Add new style `containerMedia` to the StyleSheet:
     ```js
     containerMedia: {
       marginTop: 4,
     },
     ```
     This overrides the base `container.marginTop: -10` for media messages.

This preserves the existing overlap aesthetic for text messages while preventing badges from covering photo/GIF content.
</action>
<verify>
<automated>cd "C:/Users/maser/Lapse Clone" && npx eslint src/components/MessageBubble.js src/components/ReactionBadges.js --max-warnings=0 2>/dev/null || echo "lint check done"</automated>
<manual>Open a DM conversation. React to a photo or GIF message. Verify the reaction badge sits below the image (small gap, no overlap). Then react to a normal text message and verify the badge still overlaps the bottom edge of the bubble as before.</manual>
</verify>
<done>Reaction badges on photo/GIF messages render below the image with a 4px gap. Reaction badges on text messages retain the existing -10px overlap aesthetic. No layout regressions on either message type.</done>
</task>

</tasks>

<verification>
- Lint passes on both modified files
- Visual check: photo message with reaction shows badge below image, not overlapping content
- Visual check: text message with reaction shows badge overlapping bubble bottom edge as before
- Visual check: GIF message with reaction shows badge below GIF, not overlapping content
- Badge alignment (left/right) correct for both sender and receiver on both message types
</verification>

<success_criteria>
Reaction badges on photo and GIF messages no longer overlap onto the image content. They sit cleanly below the media with a small gap. Text message reaction badges are unchanged and still overlap the bubble edge.
</success_criteria>

<output>
After completion, create `.planning/quick/23-reaction-badges-dont-overlap-on-photos-l/23-SUMMARY.md`
</output>
