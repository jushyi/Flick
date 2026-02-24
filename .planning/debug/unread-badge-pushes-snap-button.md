---
status: diagnosed
trigger: 'ConversationRow unread badge pushes snap shortcut button up'
created: 2026-02-24T00:00:00Z
updated: 2026-02-24T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — see Resolution
test: n/a
expecting: n/a
next_action: Return diagnosis

## Symptoms

expected: Unread badge appears without affecting the snap camera shortcut button position
actual: The amber unread badge for snap messages displaces/pushes the snap camera shortcut button upward
errors: None (visual layout bug)
reproduction: Open Messages list, have a conversation with unread snap messages — observe snap camera button shifts up
started: After unread badge was added to ConversationRow

## Eliminated

(none)

## Evidence

- timestamp: 2026-02-24T00:01:00Z
  checked: rightColumn style (line 243-246)
  found: rightColumn has NO fixed height and default flexDirection 'column'. alignItems 'flex-end' only controls horizontal alignment.
  implication: rightColumn grows/shrinks vertically based on children count and size.

- timestamp: 2026-02-24T00:02:00Z
  checked: UnreadBadge rendering (line 196) and style (line 252-261)
  found: UnreadBadge is a SIBLING of rightTopRow inside rightColumn. It has height:18 + marginTop:4 = 22px when visible, and returns null (0px) when no unreads.
  implication: When badge appears, rightColumn grows by 22px. When badge is absent, rightColumn is only 24px (just the rightTopRow).

- timestamp: 2026-02-24T00:03:00Z
  checked: Outer row style (line 203-210)
  found: The row container uses alignItems:'center', which vertically centers all children.
  implication: When rightColumn grows from 24px to 46px (badge present), the center point shifts. The entire rightColumn is re-centered, pushing the rightTopRow (containing the snap button) upward by ~11px.

## Resolution

root_cause: The UnreadBadge is a flow-layout sibling of rightTopRow inside rightColumn (flexDirection column). When the badge appears (22px: 18px height + 4px marginTop), rightColumn grows taller. Because the parent row uses alignItems:'center', the taller rightColumn is re-centered vertically, causing the rightTopRow (timestamp + snap button) to shift upward relative to the avatar and text. Conversations without the badge have a shorter rightColumn, so their snap buttons sit at a different vertical position.
fix:
verification:
files_changed: []
