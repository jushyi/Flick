---
phase: quick
plan: 30
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ConversationRow.js
autonomous: true
requirements: []
must_haves:
  truths:
    - 'Unread badge appears inline between the snap polaroid icon and the time indicator'
    - 'Unread badge has small horizontal padding separating it from both neighbors'
    - 'Layout does not break when there is no unread count (badge hidden, snap icon and time stay adjacent)'
    - 'Snap amber badge color still applies for snap-type unread messages'
  artifacts:
    - path: 'src/components/ConversationRow.js'
      provides: 'ConversationRow with repositioned unread badge'
      contains: 'UnreadBadge'
  key_links:
    - from: 'ConversationRow rightTopRow'
      to: 'UnreadBadge'
      via: 'inline flex child between snap icon and timestamp'
      pattern: 'rightTopRow.*UnreadBadge'
---

<objective>
Move the unread message badge in ConversationRow from its current absolute-positioned location (below the right column) to an inline position between the snap polaroid icon and the time indicator, with a small amount of horizontal padding on each side.

Purpose: Improve visual hierarchy in the messages list so the unread badge is more prominent and spatially associated with the conversation metadata.
Output: Updated ConversationRow.js with repositioned badge.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ConversationRow.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reposition UnreadBadge inline between snap icon and timestamp</name>
  <files>src/components/ConversationRow.js</files>
  <action>
In `ConversationRow.js`, make the following changes:

1. **Move UnreadBadge into rightTopRow.** Currently `UnreadBadge` is rendered after the `rightTopRow` View as a sibling, with absolute positioning (`top: 22`). Move it INSIDE the `rightTopRow` View, placed between the snap polaroid `TouchableOpacity` and the timestamp `Text`.

2. **Update the render order inside rightTopRow.** The new order should be:
   - PixelIcon snap-polaroid button (if `onSnapCamera` exists)
   - UnreadBadge (between snap icon and time)
   - Timestamp Text

3. **Remove absolute positioning from unreadBadge style.** Delete `position: 'absolute'`, `top: 22`, and `right: 0` from `styles.unreadBadge`. The badge is now a normal flex child inside the row.

4. **Add horizontal margin to unreadBadge.** Add `marginHorizontal: 4` to `styles.unreadBadge` so there is a small gap between the badge and its neighbors (the snap icon on one side, the timestamp on the other).

5. **Keep rightTopRow alignment.** The existing `flexDirection: 'row'`, `alignItems: 'center'`, and `gap: 6` on `rightTopRow` already handle horizontal layout and vertical centering. The badge will naturally center vertically with the other elements.

6. **Remove minHeight from rightColumn.** The `minHeight: 24` on `rightColumn` was there to accommodate the absolutely-positioned badge. It is no longer needed since the badge is now inline. Remove it.

7. **Keep all existing badge logic unchanged.** The `isSnap` prop, amber color, count display, and 99+ cap must all remain exactly as they are.
   </action>
   <verify>
   <automated>cd "C:/Users/maser/Lapse Clone" && npx jest --passWithNoTests --silent 2>&1 | tail -5</automated>
   <manual>Open the Messages tab. Verify that conversations with unread messages show the badge circle inline between the snap camera icon and the time text, with a small gap on each side. Verify conversations with zero unread show no badge and the snap icon sits next to the time. Verify snap-type unread messages still show the amber-colored badge.</manual>
   </verify>
   <done>Unread badge renders inline between the snap polaroid icon and the timestamp in ConversationRow, with ~4px horizontal padding on each side. No absolute positioning remains on the badge. Layout is clean with and without unread counts.</done>
   </task>

</tasks>

<verification>
- ConversationRow renders UnreadBadge inside rightTopRow between snap icon and timestamp
- Badge has marginHorizontal for padding from neighbors
- Badge no longer uses absolute positioning
- Snap amber variant still works for snap-type unread messages
- Rows without unread messages show snap icon and time adjacent with no gap artifact
</verification>

<success_criteria>

- Unread badge is visually positioned between the snap polaroid icon and the time indicator
- Small padding separates badge from both neighbors
- Layout is correct with 0 unread (badge hidden), 1-99 unread, and 99+ unread
- Snap amber badge color still applies when last message is a snap
- No layout regressions on iOS or Android
  </success_criteria>

<output>
After completion, create `.planning/quick/30-the-icon-badge-for-unread-messages-in-a-/30-SUMMARY.md`
</output>
